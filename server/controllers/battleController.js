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
            // Ambil stok Full Potion (mat_id = 8)
            const [potionRows] = await conn.query(
                'SELECT quantity FROM player_materials WHERE player_id = ? AND mat_id = 8',
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
        
        // Hapus ai_behaviors dari payload client
        if (clientBattleState.enemies) {
            clientBattleState.enemies.forEach(enemy => {
                delete enemy.ai_behaviors;
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
            // Full Potion refills stamina to max too
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

        // 6. Bagikan EXP (Player Rank & Party)
        let expData = { base_exp: 0, player_rank: 1, player_total_exp: 0, party_exp_details: [] };
        
        try {
            const [questMetaRows] = await conn.query('SELECT mq_reward_exp FROM master_quests WHERE mq_id = ?', [questId]);
            const rewardExp = questMetaRows[0] ? (questMetaRows[0].mq_reward_exp || 0) : 0;
            
            expData.base_exp = rewardExp;
            
            if (rewardExp > 0) {
                // Update Player Rank EXP
                await conn.query('UPDATE players SET player_exp = player_exp + ? WHERE player_id = ?', [rewardExp, playerId]);
                
                // Fetch Active Party from preset to distribute EXP
                const [presetRows] = await conn.query(
                    'SELECT main_char_inv_id, char_slot_1_inv_id, char_slot_2_inv_id, char_slot_3_inv_id FROM player_party_presets WHERE player_id = ? ORDER BY preset_slot ASC LIMIT 1',
                    [playerId]
                );
                
                if (presetRows.length > 0) {
                    const p = presetRows[0];
                    const partyInvIds = [p.main_char_inv_id, p.char_slot_1_inv_id, p.char_slot_2_inv_id, p.char_slot_3_inv_id].filter(id => id !== null);
                    
                    if (partyInvIds.length > 0) {
                        await conn.query(
                            `UPDATE player_inventories SET item_exp = item_exp + ? WHERE inv_id IN (?)`,
                            [rewardExp, partyInvIds]
                        );
                        
                        // Cek level riil terbaru untuk ditampilkan di client
                        const [updatedPartyRows] = await conn.query(
                            `SELECT pi.inv_id, pi.item_exp, pi.limit_break_level, mc.mc_id, mc.mc_name, mc.mc_rarity
                             FROM player_inventories pi
                             JOIN master_characters mc ON pi.master_item_id = mc.mc_id
                             WHERE pi.inv_id IN (?)`,
                            [partyInvIds]
                        );
                        
                        for (const char of updatedPartyRows) {
                            const maxLevel = LevelingSystem.getCharMaxLevel(char.mc_id, char.mc_rarity, char.limit_break_level);
                            const realLevel = LevelingSystem.calculateCurrentLevel(char.item_exp, maxLevel, 'Character');
                            const thresholds = LevelingSystem.getExpThresholds(realLevel, maxLevel, 'Character');
                            expData.party_exp_details.push({
                                inv_id: char.inv_id,
                                name: char.mc_name,
                                total_exp: char.item_exp,
                                current_level: realLevel,
                                max_level: maxLevel,
                                current_level_base_exp: thresholds.current_level_base_exp,
                                next_level_exp: thresholds.next_level_exp
                            });
                        }
                    }
                }
            }
            
            // Cek level rank terbaru
            const [playerExpRows] = await conn.query('SELECT player_exp FROM players WHERE player_id = ?', [playerId]);
            const totalPlayerExp = playerExpRows[0] ? playerExpRows[0].player_exp : 0;
            const rankLevel = LevelingSystem.calculateCurrentLevel(totalPlayerExp, 100, 'Rank');
            const rankThresholds = LevelingSystem.getExpThresholds(rankLevel, 100, 'Rank');
            expData.player_rank = rankLevel;
            expData.player_total_exp = totalPlayerExp;
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

exports.getBossAction = async (req, res) => {
    try {
        const { bsId, battleState, bossSkills } = req.body;

        // Log to file for debugging
        try {
            require('fs').writeFileSync('req-body-log.json', JSON.stringify({ bsId, battleState, bossSkills }, null, 2));
        } catch (e) {
            console.error('Failed to write log file:', e);
        }

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

        // Parse battle_state_json dan hapus ai_behaviors sebelum kirim ke client
        let clientState = null;
        try {
            clientState = JSON.parse(session.battle_state_json);
            if (clientState.enemies) {
                clientState.enemies.forEach(enemy => { delete enemy.ai_behaviors; });
            }
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
    try {
        const { bsId, battleStateJson, remainingTime } = req.body;
        if (!bsId || !battleStateJson) {
            return res.status(400).json({ status: 'error', message: 'bsId dan battleStateJson wajib diisi!' });
        }

        // syncState adalah fire-and-forget (tidak di-await untuk DB)
        BattleService.syncState(bsId, battleStateJson, remainingTime || 0);

        return res.status(200).json({
            status: 'success',
            message: 'State tersinkronisasi.'
        });
    } catch (error) {
        console.error('[syncBattleState] Error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Gagal menyinkronisasi state.',
            error_detail: error.message
        });
    }
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

exports.surrenderBattle = async (req, res) => {
    const { bsId } = req.body;
    if (!bsId) {
        return res.status(400).json({ status: 'error', message: 'bsId wajib diisi!' });
    }
    try {
        await BattleService.surrenderSession(bsId);
        return res.status(200).json({ status: 'success', message: 'Pertempuran dihentikan.' });
    } catch (error) {
        console.error('[surrenderBattle] Error:', error);
        return res.status(500).json({ status: 'error', message: 'Gagal surrender battle.', error_detail: error.message });
    }
};