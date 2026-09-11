const db = require('../config/db');
const BattleService = require('../services/BattleService');
const { checkAndRegenStamina } = require('../services/staminaService');
const LevelingSystem = require('../utils/LevelingSystem');

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

        // Run auto-regeneration check first
        await checkAndRegenStamina(playerId, conn);

        // Ambil data stamina player
        const [playerRows] = await conn.query(
            'SELECT stamina FROM players WHERE player_id = ? FOR UPDATE',
            [playerId]
        );
        const playerStamina = playerRows[0] ? playerRows[0].stamina : 0;

        if (playerStamina < staminaCost) {
            // Ambil stok Full Potion (mat_id = 7)
            const [potionRows] = await conn.query(
                'SELECT quantity FROM player_materials WHERE player_id = ? AND mat_id = 7',
                [playerId]
            );
            const potionCount = potionRows[0] ? potionRows[0].quantity : 0;

            await conn.rollback();
            conn.release();
            return res.status(200).json({
                status: 'success',
                reason: 'INSUFFICIENT_STAMINA',
                message: 'Stamina tidak cukup untuk memulai quest!',
                data: {
                    stamina_cost: staminaCost,
                    current_stamina: playerStamina,
                    full_potion_count: potionCount
                }
            });
        }

        // Kurangi stamina player dan update last updated timestamp
        await conn.query(
            'UPDATE players SET stamina = GREATEST(0, stamina - ?), stamina_last_updated = CURRENT_TIMESTAMP WHERE player_id = ?',
            [staminaCost, playerId]
        );
        
        await conn.commit();
        conn.release();

        const battleState = await BattleService.initializeBattle(playerId, questId, presetSlot);
        
        // Buat salinan state untuk client agar data rahasia tidak bocor
        const clientBattleState = JSON.parse(JSON.stringify(battleState));
        if (clientBattleState.enemies) {
            clientBattleState.enemies.forEach(enemy => {
                if (enemy.ai_behaviors) {
                    enemy.ai_behaviors.forEach(b => {
                        // Hapus parameter logika AI rahasia agar tidak bisa di-inspect player di browser
                        delete b.base_utility;
                        delete b.modifiers;
                        delete b.score_modifiers;
                    });
                }
            });
        }
        

        return res.status(200).json({
            status: 'success',
            message: 'Data arena pertarungan siap!',
            data: clientBattleState
        });

    } catch (error) {
        if (conn) {
            await conn.rollback();
            conn.release();
        }

        // Tangani kasus double-init: ada sesi ACTIVE yang belum selesai
        if (error.message && error.message.startsWith('ACTIVE_SESSION_EXISTS')) {
            return res.status(409).json({
                status: 'error',
                reason: 'ACTIVE_SESSION_EXISTS',
                message: 'Kamu masih memiliki pertempuran aktif. Selesaikan dulu sebelum memulai yang baru.'
            });
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

        let actualPotionsUsed = potionsUsed;
        if (bsId) {
            const [sessionRows] = await conn.query('SELECT battle_state_json FROM battle_sessions WHERE bs_id = ?', [bsId]);
            if (sessionRows.length > 0) {
                try {
                    const state = JSON.parse(sessionRows[0].battle_state_json);
                    actualPotionsUsed = state.potions_used || 0;
                } catch (e) {}
            }
        }

        // Kurangi green potion yang telah digunakan selama pertempuran
        if (actualPotionsUsed && Number(actualPotionsUsed) > 0) {
            await conn.query(
                'UPDATE player_materials SET quantity = GREATEST(0, quantity - ?) WHERE player_id = ? AND mat_id = 6',
                [Number(actualPotionsUsed), playerId]
            );
        }

        // Update stamina if full potion was used (potion deduction is already handled in BattleService.js)
        if (fullPotionsUsed && Number(fullPotionsUsed) > 0) {
            // Full Potion refills stamina to max
            await conn.query(
                'UPDATE players SET stamina = 100, stamina_last_updated = CURRENT_TIMESTAMP WHERE player_id = ?',
                [playerId]
            );
        }

        // Ambil data stamina player yang tersisa untuk dikembalikan di response
        const [playerRows] = await conn.query(
            'SELECT stamina FROM players WHERE player_id = ?',
            [playerId]
        );
        const remainingStamina = playerRows[0] ? playerRows[0].stamina : 0;

        // 3. Cek apakah ini penyelesaian pertama kali
        const [existingQuest] = await conn.query(
            'SELECT pq_id FROM player_quests WHERE player_id = ? AND mq_id = ?',
            [playerId, questId]
        );
        const isFirstClear = existingQuest.length === 0;

        // 4. Ambil semua kemungkinan reward dari quest_rewards
        const [rewardRows] = await conn.query(
            'SELECT * FROM quest_rewards WHERE mq_id = ?',
            [questId]
        );

        if (rewardRows.length === 0) {
            // Quest without drops is valid, just proceed with empty rewards array
            console.log(`[saveBattleResult] No loot drops found for questId: ${questId}. Proceeding to EXP phase.`);
        }

        // 5. RNG Roll & Guaranteed First Clear
        const obtainedRaw = [];
        for (const reward of rewardRows) {
            if (reward.is_first_clear === 1) {
                if (isFirstClear) obtainedRaw.push(reward); // Guaranteed on first clear
                continue; // Skip normal roll for first-clear exclusive items
            }
            
            const roll = Math.random();
            if (roll <= reward.drop_chance) {
                obtainedRaw.push(reward);
            }
        }

        // 5. Proses setiap reward yang didapatkan ke dalam DB
        const obtainedRewards = [];

        for (const item of obtainedRaw) {
            const type = item.reward_type;

            if (type === 'Gold') {
                await conn.query(
                    'UPDATE players SET gold = gold + ? WHERE player_id = ?',
                    [item.quantity, playerId]
                );
                obtainedRewards.push({
                    reward_type: 'Gold', reward_item_id: 0, quantity: item.quantity,
                    name: 'Gold', description: 'Mata uang utama permainan.', rarity: null, element: null
                });
            } else if (type === 'Diamond') {
                await conn.query(
                    'UPDATE players SET diamond = diamond + ? WHERE player_id = ?',
                    [item.quantity, playerId]
                );
                obtainedRewards.push({
                    reward_type: 'Diamond', reward_item_id: 0, quantity: item.quantity,
                    name: 'Diamond', description: 'Mata uang premium.', rarity: null, element: null
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
                // Cek apakah player sudah memiliki senjata ini sebelumnya
                const [weapExists] = await conn.query(
                    `SELECT inv_id FROM player_inventories
                     WHERE player_id = ? AND master_item_id = ? AND item_type = 'Weapon'`,
                    [playerId, item.reward_item_id]
                );
                const isWeapDuplicate = weapExists.length > 0;

                // 1. Selalu insert senjata ke inventory (layaknya Gacha)
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
                    name: detail.name, description: isWeapDuplicate ? 'Sudah dimiliki (duplikat)' : null, rarity: detail.rarity, element: detail.element
                });

                // 2. Cek apakah senjata memiliki karakter yang terikat
                if (detail.unlocks_mc_id !== null) {
                    const [charExists] = await conn.query(
                        `SELECT inv_id FROM player_inventories
                         WHERE player_id = ? AND master_item_id = ? AND item_type = 'Character'`,
                        [playerId, detail.unlocks_mc_id]
                    );

                    if (charExists.length > 0) {
                        // Karakter Duplikat - Konversi Material (Enhance Crystal, mat_id: 4)
                        const matAmount = detail.rarity === 'SSR' ? 10 : (detail.rarity === 'SR' ? 5 : 1);
                        const matId = 4;

                        await conn.query(
                            `INSERT INTO player_materials (player_id, mat_id, quantity) 
                             VALUES (?, ?, ?) 
                             ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
                            [playerId, matId, matAmount]
                        );

                        obtainedRewards.push({
                            reward_type: 'Material', reward_item_id: matId, quantity: matAmount,
                            name: 'Enhance Crystal', description: 'Konversi Karakter Duplikat', rarity: detail.rarity, element: null
                        });
                    } else {
                        // Karakter Baru - Buka Karakter
                        await conn.query(
                            `INSERT INTO player_inventories
                                (player_id, master_item_id, item_type, item_level, limit_break_level, item_exp)
                             VALUES (?, ?, 'Character', 1, 0, 0)`,
                            [playerId, detail.unlocks_mc_id]
                        );
                        const [charDetail] = await conn.query(
                            'SELECT mc_name AS name, mc_rarity AS rarity, mc_element AS element, mc_portrait_path FROM master_characters WHERE mc_id = ?',
                            [detail.unlocks_mc_id]
                        );
                        const cDetail = charDetail[0] || { name: 'Unknown Character', rarity: null, element: null, mc_portrait_path: null };
                        
                        obtainedRewards.push({
                            reward_type: 'Character', reward_item_id: detail.unlocks_mc_id, quantity: 1,
                            name: cDetail.name, description: `Karakter terbuka via Senjata ${detail.name}!`, rarity: cDetail.rarity, element: cDetail.element,
                            is_new_unlock: true, portrait_path: cDetail.mc_portrait_path
                        });
                    }
                } else {
                    // 3. Senjata TANPA karakter terikat (Rarity R)
                    if (isWeapDuplicate) {
                        // Jika senjata duplikat, kompensasi Weapon Whetstone (mat_id: 5)
                        const matId = 5;
                        const matAmount = 1;

                        await conn.query(
                            `INSERT INTO player_materials (player_id, mat_id, quantity) 
                             VALUES (?, ?, ?) 
                             ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
                            [playerId, matId, matAmount]
                        );

                        obtainedRewards.push({
                            reward_type: 'Material', reward_item_id: matId, quantity: matAmount,
                            name: 'Weapon Whetstone', description: 'Kompensasi Senjata Duplikat', rarity: detail.rarity, element: null
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
                    'SELECT mc_name AS name, mc_rarity AS rarity, mc_element AS element, mc_portrait_path FROM master_characters WHERE mc_id = ?',
                    [item.reward_item_id]
                );
                const detail = charDetail[0] || { name: 'Unknown Character', rarity: null, element: null, mc_portrait_path: null };
                obtainedRewards.push({
                    reward_type: 'Character', reward_item_id: item.reward_item_id, quantity: item.quantity,
                    name: detail.name, description: isDuplicate ? 'Sudah dimiliki (duplikat)' : null, rarity: detail.rarity, element: detail.element,
                    is_new_unlock: !isDuplicate, portrait_path: detail.mc_portrait_path
                });
            }
        }

        // 6. Catat progress quest player
        if (isFirstClear) {
            await conn.query('INSERT INTO player_quests (player_id, mq_id, pq_status) VALUES (?, ?, \'Completed\')', [playerId, questId]);
        } else {
            await conn.query('UPDATE player_quests SET pq_status = \'Completed\' WHERE player_id = ? AND mq_id = ?', [playerId, questId]);
        }

        // 6. Bagikan EXP (Player Rank & Party)
        let expData = { base_exp: 0, player_rank: 1, player_total_exp: 0, party_exp_details: [] };
        
        try {
            const [questMetaRows] = await conn.query('SELECT reward_player_exp, reward_char_exp FROM master_quests WHERE mq_id = ?', [questId]);
            const rewardPlayerExp = questMetaRows[0] ? (questMetaRows[0].reward_player_exp || 0) : 0;
            const rewardCharExp = questMetaRows[0] ? (questMetaRows[0].reward_char_exp || 0) : 0;
            
            expData.base_exp = rewardCharExp; // Use char exp as the base for the UI display
            
            if (rewardPlayerExp > 0 || rewardCharExp > 0) {
                // We process Player Rank EXP later down below to safely lock it
                
                // Fetch Active Party from preset to distribute EXP
                const [presetRows] = await conn.query(
                    'SELECT main_char_inv_id, char_slot_1_inv_id, char_slot_2_inv_id, char_slot_3_inv_id FROM player_party_presets WHERE player_id = ? ORDER BY preset_slot ASC LIMIT 1',
                    [playerId]
                );
                
                if (presetRows.length > 0 && rewardCharExp > 0) {
                    const p = presetRows[0];
                    const partyInvIds = [p.main_char_inv_id, p.char_slot_1_inv_id, p.char_slot_2_inv_id, p.char_slot_3_inv_id].filter(id => id !== null);
                    
                    if (partyInvIds.length > 0) {
                        // Baca data party sebelum ditambahkan EXP
                        const [partyRows] = await conn.query(
                            `SELECT pi.inv_id, pi.item_exp, pi.item_level, pi.limit_break_level, mc.mc_id, mc.mc_name, mc.mc_rarity, mc.mc_element, mc.mc_portrait_path
                             FROM player_inventories pi
                             JOIN master_characters mc ON pi.master_item_id = mc.mc_id
                             WHERE pi.inv_id IN (?)`,
                            [partyInvIds]
                        );
                        
                        for (const char of partyRows) {
                            const charType = char.mc_id === 1 ? 'MC' : 'Character';
                            const maxLevel = LevelingSystem.getCharMaxLevel(char.mc_id, char.mc_rarity, char.limit_break_level);
                            const maxLevelExpCap = LevelingSystem.getExpThresholds(maxLevel, maxLevel, charType).current_level_base_exp;
                            
                            // Self-heal dummy data: if EXP is less than what their current level dictates
                            const dbBaseExp = LevelingSystem.getExpThresholds(char.item_level, maxLevel, charType).current_level_base_exp;
                            let currentExp = char.item_exp;
                            if (currentExp < dbBaseExp) {
                                currentExp = dbBaseExp;
                            }

                            // Tambahkan EXP tapi batasi di maxLevelExpCap (Opsi A: EXP Lock/Hangus)
                            let newExp = currentExp + rewardCharExp;
                            if (newExp > maxLevelExpCap) {
                                newExp = maxLevelExpCap;
                            }

                            const realLevel = LevelingSystem.calculateCurrentLevel(newExp, maxLevel, charType);
                            
                            // Deteksi Skill Unlock
                            let newSkillsUnlocked = [];
                            if (realLevel > char.item_level) {
                                // Cari di item_skills (karakter id = char.mc_id, item_type = 'Character')
                                const [unlockedSkills] = await conn.query(`
                                    SELECT ms.ms_name
                                    FROM item_skills isc
                                    JOIN master_skills ms ON isc.ms_id = ms.ms_id
                                    WHERE isc.item_id = ? AND isc.item_type = 'Character'
                                      AND isc.unlock_level > ? 
                                      AND isc.unlock_level <= ?
                                      AND isc.unlock_limit_break <= ?
                                `, [char.mc_id, char.item_level, realLevel, char.limit_break_level]);
                                
                                newSkillsUnlocked = unlockedSkills.map(s => s.ms_name);
                            }

                            // Update EXP dan Level di DB
                            await conn.query('UPDATE player_inventories SET item_exp = ?, item_level = ? WHERE inv_id = ?', [newExp, realLevel, char.inv_id]);
                            
                            const thresholds = LevelingSystem.getExpThresholds(realLevel, maxLevel, charType);
                            expData.party_exp_details.push({
                                inv_id: char.inv_id,
                                mc_id: char.mc_id,
                                name: char.mc_name,
                                rarity: char.mc_rarity,
                                element: char.mc_element,
                                portrait_path: char.mc_portrait_path,
                                total_exp: newExp,
                                current_level: realLevel,
                                old_level: char.item_level,
                                max_level: maxLevel,
                                current_level_base_exp: thresholds.current_level_base_exp,
                                next_level_exp: thresholds.next_level_exp,
                                new_skills: newSkillsUnlocked
                            });
                        }
                    }
                }
            }
            
            // Cek level rank terbaru
            const [playerExpRows] = await conn.query('SELECT player_exp, player_level FROM players WHERE player_id = ?', [playerId]);
            let currentTotalExp = playerExpRows[0] ? playerExpRows[0].player_exp : 0;
            const dbPlayerLevel = playerExpRows[0] ? playerExpRows[0].player_level : 1;
            
            // Self-heal dummy data for player rank
            const pDbBaseExp = LevelingSystem.getExpThresholds(dbPlayerLevel, 100, 'Rank').current_level_base_exp;
            if (currentTotalExp < pDbBaseExp) {
                currentTotalExp = pDbBaseExp;
            }

            const pMaxLevelExpCap = LevelingSystem.getExpThresholds(100, 100, 'Rank').current_level_base_exp;
            let pNewExp = currentTotalExp;
            
            if (rewardPlayerExp > 0) {
                pNewExp = currentTotalExp + rewardPlayerExp;
                if (pNewExp > pMaxLevelExpCap) {
                    pNewExp = pMaxLevelExpCap;
                }
                
                const rankLevel = LevelingSystem.calculateCurrentLevel(pNewExp, 100, 'Rank');
                
                let totalDiamondReward = 0;
                if (rankLevel > dbPlayerLevel) {
                    for (let l = dbPlayerLevel + 1; l <= rankLevel; l++) {
                        if (l % 10 === 0) totalDiamondReward += 100;
                        else totalDiamondReward += 50;
                    }
                    if (totalDiamondReward > 0) {
                         await conn.query('UPDATE players SET diamond = diamond + ? WHERE player_id = ?', [totalDiamondReward, playerId]);
                         obtainedRewards.push({
                              reward_type: 'Diamond', reward_item_id: 0, quantity: totalDiamondReward,
                              name: 'Diamond', description: `Level Up Reward! (Rank ${dbPlayerLevel} ➔ ${rankLevel})`, rarity: null, element: null
                         });
                    }
                }
                
                await conn.query('UPDATE players SET player_exp = ?, player_level = ? WHERE player_id = ?', [pNewExp, rankLevel, playerId]);
                expData.player_rank = rankLevel;
            } else {
                expData.player_rank = dbPlayerLevel;
            }
            
            const rankLevelForThresholds = expData.player_rank;
            const rankThresholds = LevelingSystem.getExpThresholds(rankLevelForThresholds, 100, 'Rank');
            expData.player_total_exp = pNewExp;
            expData.player_current_level_base_exp = rankThresholds.current_level_base_exp;
            expData.player_next_level_exp = rankThresholds.next_level_exp;
            
        } catch (expError) {
            console.error('[saveBattleResult] Warning: Gagal memproses EXP reward', expError.message);
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
                remaining_stamina: remainingStamina,
                exp_data: expData
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

// [DEPRECATED & REMOVED] exports.getBossAction (versi lama client-sends-bossSkills)
// Digantikan oleh endpoint /api/battle/ai-decision di bawah yang menggunakan
// BattleService.processEnemyTurn() — fully server-authoritative.

/**
 * GET /api/battle/active/:playerId
 * Cek apakah player punya battle session ACTIVE.
 */
exports.getActiveBattle = async (req, res) => {
    try {
        const { playerId } = req.params;
        if (!playerId) {
            return res.status(400).json({ status: 'error', message: 'playerId wajib diisi!' });
        }

        const session = await BattleService.getActiveSession(playerId);

        if (!session) {
            return res.status(200).json({
                status: 'success',
                message: 'Tidak ada pertempuran aktif.',
                data: { has_active: false }
            });
        }

        // Parse battle_state_json
        let clientState = null;
        try {
            clientState = JSON.parse(session.battle_state_json);
        } catch (e) {
            clientState = null;
        }

        // Ambil nama quest untuk ditampilkan di Pop-up
        const [questRow] = await db.query('SELECT mq_name FROM master_quests WHERE mq_id = ?', [session.mq_id]);
        const questName = questRow[0] ? questRow[0].mq_name : 'Unknown Quest';

        return res.status(200).json({
            status: 'success',
            message: 'Ditemukan pertempuran aktif.',
            data: {
                has_active: true,
                bs_id: session.bs_id,
                mq_id: session.mq_id,
                quest_name: questName,
                remaining_time: session.remaining_time,
                battle_state: clientState
            }
        });
    } catch (error) {
        console.error('[getActiveBattle] Error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Gagal mengecek pertempuran aktif.',
            error_detail: error.message
        });
    }
};

/**
 * POST /api/battle/sync
 * Sinkronisasi state pertempuran dari client (Turn End).
 * Fire-and-forget: DB write berjalan async, response langsung.
 */
exports.syncBattleState = async (req, res) => {
    // Obsolete: Server-authoritative model makes client-side sync unnecessary.
    return res.status(200).json({
        status: 'success',
        message: 'Sync diabaikan (Server-Authoritative mode)'
    });
};

/**
 * POST /api/battle/surrender
 * Player menyerah. Sesi diubah ke FAILED. Stamina TIDAK dikembalikan.
 */
exports.surrenderBattle = async (req, res) => {
    try {
        const { bsId, playerId } = req.body;
        if (!bsId || !playerId) {
            return res.status(400).json({ status: 'error', message: 'bsId dan playerId wajib diisi!' });
        }

        await BattleService.surrenderSession(bsId);

        return res.status(200).json({
            status: 'success',
            message: 'Kamu telah menyerah. Stamina yang digunakan tidak dikembalikan.'
        });
    } catch (error) {
        console.error('[surrenderBattle] Error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Gagal memproses penyerahan.',
            error_detail: error.message
        });
    }
};

/**
 * POST /api/battle/ai-decision
 * Resolves the enemy turn (AI, target selection, actions) server-side.
 */
exports.getBossAction = async (req, res) => {
    try {
        const { bsId } = req.body;
        if (!bsId) {
            return res.status(400).json({ status: 'error', message: 'bsId wajib disertakan' });
        }

        const result = await BattleService.processEnemyTurn(bsId);

        return res.status(200).json({
            status: 'success',
            message: 'Enemy Turn Processed',
            data: result
        });
    } catch (error) {
        console.error('[getBossAction] Error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Gagal memproses giliran musuh.',
            error_detail: error.message
        });
    }
};

/**
 * POST /api/battle/action
 * Eksekusi aksi dari client (Player atau AI Musuh).
 */
exports.executeAction = async (req, res) => {
    try {
        const { bsId, actionData } = req.body;
        if (!bsId || !actionData) {
            return res.status(400).json({ status: 'error', message: 'bsId dan actionData wajib diisi!' });
        }

        const result = await BattleService.processAction(bsId, actionData);

        return res.status(200).json({
            status: 'success',
            message: 'Aksi dieksekusi',
            data: result
        });
    } catch (error) {
        console.error('[executeAction] Error:', error);
        
        if (error.message && error.message.startsWith('RACE_CONDITION')) {
            return res.status(429).json({
                status: 'error',
                message: 'Aksi sebelumnya masih diproses. Harap tunggu.'
            });
        }
        
        return res.status(500).json({
            status: 'error',
            message: 'Gagal mengeksekusi aksi.',
            error_detail: error.message
        });
    }
};

exports.endTurn = async (req, res) => {
    try {
        const { bsId } = req.body;
        if (!bsId) {
            return res.status(400).json({ status: 'error', message: 'bsId wajib disertakan' });
        }

        const result = await BattleService.processTurnEnd(bsId);

        return res.status(200).json({
            status: 'success',
            message: 'Turn dievaluasi',
            data: result
        });
    } catch (error) {
        console.error('[endTurn] Error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Gagal mengevaluasi end turn.',
            error_detail: error.message
        });
    }
};

/**
 * POST /api/battle/process-turn
 * Eksekusi batch aksi giliran player (Tactical Command Queue).
 */
exports.processTurnBatch = async (req, res) => {
    try {
        const { bsId, character_actions } = req.body;

        // Input validation
        if (!bsId) {
            return res.status(400).json({ status: 'error', message: 'bsId wajib diisi!' });
        }
        if (!Array.isArray(character_actions) || character_actions.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'character_actions harus berupa array dan tidak boleh kosong!'
            });
        }

        // Validate each action entry has a slot and action_type
        for (const action of character_actions) {
            if (!action.slot || !action.action_type) {
                return res.status(400).json({
                    status: 'error',
                    message: `Setiap aksi dalam character_actions harus memiliki 'slot' dan 'action_type'. Periksa payload Anda.`
                });
            }
        }

        const result = await BattleService.processTurnBatch(bsId, { character_actions });

        return res.status(200).json({
            status: 'success',
            message: 'Batch Turn Berhasil Dieksekusi',
            data: result
        });
    } catch (error) {
        console.error('[processTurnBatch] Error:', error);

        if (error.message && error.message.startsWith('RACE_CONDITION')) {
            return res.status(429).json({
                status: 'error',
                message: 'Giliran sebelumnya masih diproses. Harap tunggu sebentar.'
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Gagal memproses batch turn.',
            error_detail: error.message
        });
    }
};