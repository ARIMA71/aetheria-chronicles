const db = require('../config/db');

exports.pull = async (req, res) => {
    const { playerId, drawType, elementPool } = req.body;

    if (!playerId || !drawType || !elementPool) {
        return res.status(400).json({
            status: 'error',
            message: 'playerId, drawType, dan elementPool wajib diisi!'
        });
    }

    if (!['1x', '10x+1'].includes(drawType)) {
        return res.status(400).json({
            status: 'error',
            message: 'drawType tidak valid.'
        });
    }

    const gbId = 1; // Hardcoded Standard Banner MVP

    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        // 0. Cek Banner aktif dan ambil konfigurasi harga/pity
        const [bannerRows] = await conn.query(
            'SELECT gb_cost_single, gb_cost_multies, gb_pity_guarantee FROM gacha_banners WHERE gb_id = ? AND is_active = 1',
            [gbId]
        );

        if (bannerRows.length === 0) {
            throw new Error('BANNER_NOT_FOUND');
        }

        const bannerConfig = bannerRows[0];
        const cost = drawType === '10x+1' ? bannerConfig.gb_cost_multies : bannerConfig.gb_cost_single;
        const pullsCount = drawType === '10x+1' ? 11 : 1;
        const pityGuarantee = bannerConfig.gb_pity_guarantee;

        // 1. Validasi Diamond
        const [playerRows] = await conn.query(
            'SELECT diamond FROM players WHERE player_id = ? FOR UPDATE',
            [playerId]
        );

        if (playerRows.length === 0) {
            throw new Error('PLAYER_NOT_FOUND');
        }

        const currentDiamond = playerRows[0].diamond;
        if (currentDiamond < cost) {
            await conn.rollback();
            conn.release();
            return res.status(200).json({
                status: 'error',
                message: 'Diamond tidak cukup.'
            });
        }

        // Potong Diamond
        await conn.query(
            'UPDATE players SET diamond = diamond - ? WHERE player_id = ?',
            [cost, playerId]
        );
        const newDiamond = currentDiamond - cost;

        // 2. Ambil dan Inisialisasi Pity
        const [pityRows] = await conn.query(
            'SELECT pity_counter FROM player_gacha_pity WHERE player_id = ? AND gb_id = ? FOR UPDATE',
            [playerId, gbId]
        );

        let pityCounter = 0;
        if (pityRows.length === 0) {
            await conn.query(
                'INSERT INTO player_gacha_pity (player_id, gb_id, pity_counter) VALUES (?, ?, 0)',
                [playerId, gbId]
            );
        } else {
            pityCounter = pityRows[0].pity_counter;
        }

        // 3. Ambil Item Banner beserta drop_chance-nya
        let sqlBanner = `
            SELECT gbi.item_id as master_item_id, gbi.drop_chance, mw.mw_rarity, mw.mw_element, mw.unlocks_mc_id, mw.mw_name 
            FROM gacha_banner_items gbi
            JOIN master_weapons mw ON gbi.item_id = mw.mw_id
            WHERE gbi.gb_id = ?
        `;
        let bannerParams = [gbId];
        
        if (elementPool !== 'All') {
            sqlBanner += ' AND mw.mw_element = ?';
            bannerParams.push(elementPool);
        }
        
        const [bannerItems] = await conn.query(sqlBanner, bannerParams);
        
        if (bannerItems.length === 0) {
            throw new Error('NO_BANNER_ITEMS');
        }

        const ssrItems = bannerItems.filter(i => i.mw_rarity === 'SSR');

        // Fungsi untuk mengambil item berdasarkan bobot drop_chance
        const getRandomItemWeighted = (itemsPool) => {
            if (itemsPool.length === 0) return bannerItems[Math.floor(Math.random() * bannerItems.length)]; // Fallback
            
            const totalWeight = itemsPool.reduce((sum, item) => sum + item.drop_chance, 0);
            let random = Math.random() * totalWeight;
            
            for (const item of itemsPool) {
                if (random < item.drop_chance) {
                    return item;
                }
                random -= item.drop_chance;
            }
            return itemsPool[itemsPool.length - 1]; // Safety fallback
        };

        // 4. Proses Gacha (RNG dengan drop_chance & Pity Guarantee)
        const pulledItems = [];
        let newPityCounter = pityCounter;

        for (let i = 0; i < pullsCount; i++) {
            // Check Pity Guarantee (jika roll ini mencapai batas pity)
            if (newPityCounter >= (pityGuarantee - 1)) {
                item = getRandomItemWeighted(ssrItems); // Garansi SSR
                newPityCounter = 0; // Reset pity HANYA ketika menyentuh angka guarantee
            } else {
                item = getRandomItemWeighted(bannerItems); // Roll normal
                newPityCounter++; // Selalu tambah pity, tidak peduli dapat SSR dari RNG atau tidak
            }

            pulledItems.push(item);
        }

        // Update Pity di DB
        await conn.query(
            'UPDATE player_gacha_pity SET pity_counter = ? WHERE player_id = ? AND gb_id = ?',
            [newPityCounter, playerId, gbId]
        );

        // 5. Proses Inventory & Konversi Karakter
        const resultsData = [];
        
        for (const pulled of pulledItems) {
            let resultEntry = {
                item_type: 'Weapon',
                master_item_id: pulled.master_item_id,
                name: pulled.mw_name,
                rarity: pulled.mw_rarity,
                element: pulled.mw_element,
                is_character_unlocked: false,
                is_character_duplicate: false,
                materials_converted: null
            };

            // Selalu insert senjata
            await conn.query(
                `INSERT INTO player_inventories 
                 (player_id, master_item_id, item_type, item_level, limit_break_level, item_exp) 
                 VALUES (?, ?, 'Weapon', 1, 0, 0)`,
                [playerId, pulled.master_item_id]
            );

            // Cek apakah ada unlock karakter
            if (pulled.unlocks_mc_id !== null) {
                // Cek kepemilikan karakter
                const [charExists] = await conn.query(
                    `SELECT inv_id FROM player_inventories 
                     WHERE player_id = ? AND master_item_id = ? AND item_type = 'Character'`,
                    [playerId, pulled.unlocks_mc_id]
                );

                if (charExists.length > 0) {
                    // Karakter Duplikat - Konversi Material
                    resultEntry.is_character_duplicate = true;
                    const matAmount = pulled.mw_rarity === 'SSR' ? 10 : (pulled.mw_rarity === 'SR' ? 5 : 1);
                    const matId = 4; // Enhance Crystal (As per instruction)

                    await conn.query(
                        `INSERT INTO player_materials (player_id, mat_id, quantity) 
                         VALUES (?, ?, ?) 
                         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
                        [playerId, matId, matAmount]
                    );

                    resultEntry.materials_converted = {
                        mat_id: matId,
                        quantity: matAmount,
                        reason: 'Duplicate Character'
                    };
                } else {
                    // Unlock Karakter Baru
                    await conn.query(
                        `INSERT INTO player_inventories 
                         (player_id, master_item_id, item_type, item_level, limit_break_level, item_exp) 
                         VALUES (?, ?, 'Character', 1, 0, 0)`,
                        [playerId, pulled.unlocks_mc_id]
                    );
                    resultEntry.is_character_unlocked = true;
                }
            } else if (pulled.mw_rarity === 'R') {
                // Rarity R tidak memiliki karakter, sehingga diberikan kompensasi material bonus
                const matId = 5; // Weapon Whetstone
                const matAmount = 1;

                await conn.query(
                    `INSERT INTO player_materials (player_id, mat_id, quantity) 
                     VALUES (?, ?, ?) 
                     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
                    [playerId, matId, matAmount]
                );

                resultEntry.materials_converted = {
                    mat_id: matId,
                    quantity: matAmount,
                    reason: 'R Rarity Bonus'
                };
            }

            resultsData.push(resultEntry);
        }

        await conn.commit();
        conn.release();

        return res.status(200).json({
            status: 'success',
            message: 'Gacha berhasil!',
            data: {
                pulled_items: resultsData,
                new_diamond_balance: newDiamond,
                pity_counter: newPityCounter
            }
        });

    } catch (error) {
        if (conn) {
            await conn.rollback();
            conn.release();
        }
        console.error('[gachaController.pull] Error:', error);
        
        if (error.message === 'BANNER_NOT_FOUND') {
            return res.status(404).json({
                status: 'error',
                message: 'Banner Gacha tidak ditemukan atau tidak aktif.'
            });
        }
        if (error.message === 'PLAYER_NOT_FOUND') {
            return res.status(404).json({
                status: 'error',
                message: 'Player tidak ditemukan.'
            });
        }
        if (error.message === 'NO_BANNER_ITEMS') {
            return res.status(500).json({
                status: 'error',
                message: 'Tidak ada item di banner ini dengan elemen yang dipilih.'
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan internal server saat memproses gacha.',
            error_detail: error.message
        });
    }
};

exports.info = async (req, res) => {
    const { playerId } = req.params;
    const gbId = 1;

    const conn = await db.getConnection();
    try {
        const [playerRows] = await conn.query('SELECT diamond FROM players WHERE player_id = ?', [playerId]);
        const diamond = playerRows[0] ? playerRows[0].diamond : 0;

        const [pityRows] = await conn.query('SELECT pity_counter FROM player_gacha_pity WHERE player_id = ? AND gb_id = ?', [playerId, gbId]);
        const pityCounter = pityRows[0] ? pityRows[0].pity_counter : 0;

        const [bannerRows] = await conn.query('SELECT gb_pity_guarantee, gb_cost_single, gb_cost_multies FROM gacha_banners WHERE gb_id = ?', [gbId]);
        const banner = bannerRows[0] || { gb_pity_guarantee: 50, gb_cost_single: 50, gb_cost_multies: 500 };

        const [itemRows] = await conn.query(`
            SELECT mw.mw_name, mw.mw_rarity, mw.mw_element, gbi.drop_chance 
            FROM gacha_banner_items gbi 
            JOIN master_weapons mw ON gbi.item_id = mw.mw_id 
            WHERE gbi.gb_id = ? 
            ORDER BY gbi.drop_chance ASC
        `, [gbId]);

        conn.release();
        return res.json({
            status: 'success',
            data: { 
                diamond, 
                pity_counter: pityCounter, 
                pity_guarantee: banner.gb_pity_guarantee, 
                cost_single: banner.gb_cost_single, 
                cost_multies: banner.gb_cost_multies,
                banner_items: itemRows
            }
        });
    } catch (error) {
        if (conn) conn.release();
        return res.status(500).json({ status: 'error', message: error.message });
    }
};
