const db = require('../config/db');
const BattleService = require('../services/BattleService');

exports.initBattle = async (req, res) => {
    const { playerId, questId, presetSlot } = req.body;

    if (!playerId || !questId || !presetSlot) {
        return res.status(400).json({
            status: 'error',
            message: 'playerId, questId, dan presetSlot wajib diisi!'
        });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Ambil data stamina cost dari quest
        const [questRows] = await conn.query(
            'SELECT mq_stamina_cost FROM master_quests WHERE mq_id = ?',
            [questId]
        );
        const staminaCost = questRows[0] ? questRows[0].mq_stamina_cost : 10;

        // Ambil data stamina player
        const [playerRows] = await conn.query(
            'SELECT stamina FROM players WHERE player_id = ? FOR UPDATE',
            [playerId]
        );
        const playerStamina = playerRows[0] ? playerRows[0].stamina : 0;

        if (playerStamina < staminaCost) {
            await conn.rollback();
            conn.release();
            return res.status(200).json({
                status: 'success',
                reason: 'INSUFFICIENT_STAMINA',
                message: 'Stamina tidak cukup untuk memulai quest!'
            });
        }

        // Kurangi stamina player
        await conn.query(
            'UPDATE players SET stamina = GREATEST(0, stamina - ?) WHERE player_id = ?',
            [staminaCost, playerId]
        );
        
        await conn.commit();
        conn.release();

        const battleState = await BattleService.initializeBattle(playerId, questId, presetSlot);
        
        return res.status(200).json({
            status: 'success',
            message: 'Data arena pertarungan siap!',
            data: battleState
        });

    } catch (error) {
        if (conn) {
            await conn.rollback();
            conn.release();
        }
        console.error('[initBattle] Error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan pada server saat memuat data battle.',
            error_detail: error.message
        });
    }
};

exports.saveBattleResult = async (req, res) => {
    // bsId must be provided by the client now, along with the standard params
    const { bsId, playerId, questId, potionsUsed, fullPotionsUsed } = req.body;

    if (!playerId || !questId) {
        return res.status(400).json({
            status: 'error',
            message: 'playerId dan questId wajib diisi!'
        });
    }

    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        // Kurangi green potion yang telah digunakan selama pertempuran
        if (potionsUsed && Number(potionsUsed) > 0) {
            await conn.query(
                'UPDATE player_materials SET quantity = GREATEST(0, quantity - ?) WHERE player_id = ? AND mat_id = 6',
                [Number(potionsUsed), playerId]
            );
        }

        // Kurangi full potion yang telah digunakan untuk revive
        if (fullPotionsUsed && Number(fullPotionsUsed) > 0) {
            await conn.query(
                'UPDATE player_materials SET quantity = GREATEST(0, quantity - ?) WHERE player_id = ? AND mat_id = 8',
                [Number(fullPotionsUsed), playerId]
            );
        }

        // Ambil data stamina player yang tersisa untuk dikembalikan di response
        const [playerRows] = await conn.query(
            'SELECT stamina FROM players WHERE player_id = ?',
            [playerId]
        );
        const remainingStamina = playerRows[0] ? playerRows[0].stamina : 0;

        // 3. Ambil semua kemungkinan reward dari quest_rewards
        const [rewardRows] = await conn.query(
            'SELECT * FROM quest_rewards WHERE mq_id = ?',
            [questId]
        );

        if (rewardRows.length === 0) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({
                status: 'error',
                message: `Tidak ada reward yang ditemukan untuk questId: ${questId}`
            });
        }

        // 4. RNG Roll
        const obtainedRaw = [];
        for (const reward of rewardRows) {
            const roll = Math.random();
            if (roll <= reward.drop_chance) {
                obtainedRaw.push(reward);
            }
        }

        // 5. Proses setiap reward yang didapatkan ke dalam DB
        const obtainedRewards = [];

        for (const item of obtainedRaw) {
            const type = item.reward_type;

            if (type === 'Currency') {
                await conn.query(
                    'UPDATE players SET gold = gold + ? WHERE player_id = ?',
                    [item.quantity, playerId]
                );
                obtainedRewards.push({
                    reward_type: 'Currency', reward_item_id: 0, quantity: item.quantity,
                    name: 'Gold', description: 'Mata uang utama permainan.', rarity: null, element: null
                });
            } else if (type === 'Material') {
                await conn.query(
                    `INSERT INTO player_materials (player_id, mat_id, quantity)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
                    [playerId, item.reward_item_id, item.quantity]
                );
                const [matDetail] = await conn.query(
                    'SELECT mat_name AS name, mat_desc AS description FROM master_materials WHERE mat_id = ?',
                    [item.reward_item_id]
                );
                const detail = matDetail[0] || { name: 'Unknown Material', description: null };
                obtainedRewards.push({
                    reward_type: 'Material', reward_item_id: item.reward_item_id, quantity: item.quantity,
                    name: detail.name, description: detail.description, rarity: null, element: null
                });
            } else if (type === 'Weapon') {
                await conn.query(
                    `INSERT INTO player_inventories
                        (player_id, master_item_id, item_type, item_level, limit_break_level, item_exp)
                     VALUES (?, ?, 'Weapon', 1, 0, 0)`,
                    [playerId, item.reward_item_id]
                );
                const [weapDetail] = await conn.query(
                    'SELECT mw_name AS name, mw_rarity AS rarity, mw_element AS element, unlocks_mc_id FROM master_weapons WHERE mw_id = ?',
                    [item.reward_item_id]
                );
                const detail = weapDetail[0] || { name: 'Unknown Weapon', rarity: null, element: null, unlocks_mc_id: null };
                obtainedRewards.push({
                    reward_type: 'Weapon', reward_item_id: item.reward_item_id, quantity: item.quantity,
                    name: detail.name, description: null, rarity: detail.rarity, element: detail.element
                });

                // Unlocks char
                if (detail.unlocks_mc_id !== null) {
                    const [charExists] = await conn.query(
                        `SELECT inv_id FROM player_inventories
                         WHERE player_id = ? AND master_item_id = ? AND item_type = 'Character'`,
                        [playerId, detail.unlocks_mc_id]
                    );
                    if (charExists.length === 0) {
                        await conn.query(
                            `INSERT INTO player_inventories
                                (player_id, master_item_id, item_type, item_level, limit_break_level, item_exp)
                             VALUES (?, ?, 'Character', 1, 0, 0)`,
                            [playerId, detail.unlocks_mc_id]
                        );
                        const [charDetail] = await conn.query(
                            'SELECT mc_name AS name, mc_rarity AS rarity, mc_element AS element FROM master_characters WHERE mc_id = ?',
                            [detail.unlocks_mc_id]
                        );
                        const cDetail = charDetail[0] || { name: 'Unknown Character', rarity: null, element: null };
                        obtainedRewards.push({
                            reward_type: 'Character', reward_item_id: detail.unlocks_mc_id, quantity: 1,
                            name: cDetail.name, description: `Karakter terbuka via Senjata ${detail.name}!`, rarity: cDetail.rarity, element: cDetail.element
                        });
                    }
                }
            } else if (type === 'Character') {
                const [exists] = await conn.query(
                    `SELECT inv_id FROM player_inventories
                     WHERE player_id = ? AND master_item_id = ? AND item_type = 'Character'`,
                    [playerId, item.reward_item_id]
                );
                let isDuplicate = false;
                if (exists.length === 0) {
                    await conn.query(
                        `INSERT INTO player_inventories
                            (player_id, master_item_id, item_type, item_level, limit_break_level, item_exp)
                         VALUES (?, ?, 'Character', 1, 0, 0)`,
                        [playerId, item.reward_item_id]
                    );
                } else {
                    isDuplicate = true;
                }
                const [charDetail] = await conn.query(
                    'SELECT mc_name AS name, mc_rarity AS rarity, mc_element AS element FROM master_characters WHERE mc_id = ?',
                    [item.reward_item_id]
                );
                const detail = charDetail[0] || { name: 'Unknown Character', rarity: null, element: null };
                obtainedRewards.push({
                    reward_type: 'Character', reward_item_id: item.reward_item_id, quantity: item.quantity,
                    name: detail.name, description: isDuplicate ? 'Sudah dimiliki (duplikat)' : null, rarity: detail.rarity, element: detail.element
                });
            }
        }

        // 5.5. Catat progress quest player
        const [existingQuest] = await conn.query(
            'SELECT pq_id FROM player_quests WHERE player_id = ? AND mq_id = ?',
            [playerId, questId]
        );

        if (existingQuest.length === 0) {
            await conn.query('INSERT INTO player_quests (player_id, mq_id, pq_status) VALUES (?, ?, \'Completed\')', [playerId, questId]);
        } else {
            await conn.query('UPDATE player_quests SET pq_status = \'Completed\' WHERE player_id = ? AND mq_id = ?', [playerId, questId]);
        }

        // Clean up RAM Session
        if (bsId) {
            await BattleService.finalizeBattle(bsId);
        }

        await conn.commit();
        conn.release();

        return res.status(200).json({
            status: 'success',
            message: 'Hasil battle berhasil diproses!',
            data: {
                obtained_rewards: obtainedRewards,
                remaining_stamina: remainingStamina
            }
        });

    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error('[saveBattleResult] Error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan pada server saat memproses hasil battle.',
            error_detail: error.message
        });
    }
};

exports.getBossAction = async (req, res) => {
    try {
        const { bsId, battleState, bossSkills } = req.body;

        if (!bsId || !battleState || !bossSkills) {
            return res.status(400).json({
                status: 'error',
                message: 'bsId, battleState, dan bossSkills wajib diisi untuk sinkronisasi state!'
            });
        }

        const selectedSkill = await BattleService.getAiDecision(bsId, battleState, bossSkills);

        return res.status(200).json({
            status: 'success',
            message: 'Boss action calculated successfully',
            data: {
                selected_skill: selectedSkill
            }
        });
    } catch (error) {
        console.error('[getBossAction] Error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan pada server saat sinkronisasi state dan menghitung aksi bos.',
            error_detail: error.message
        });
    }
};