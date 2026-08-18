const db = require('../config/db')
const { checkAndRegenStamina } = require('../services/staminaService')

exports.getPlayerParty = async (req, res) => {
    const playerId = req.params.playerId
    // console.log(`Fetching party for player ID: ${playerId}`)
    console.log(req.params)
    try {
        const [rows] = await db.query(`
            SELECT
                mc.mc_id,
                mc.mc_name,
                mc.mc_element,
                pi.item_level
            FROM player_party_presets ppp
            JOIN player_inventories pi
                ON pi.inv_id = ppp.char_slot_1_inv_id
            JOIN master_characters mc
                ON mc.mc_id = pi.master_item_id
            WHERE ppp.player_id = ?
            
        `, [playerId])
        res.status(200).json({
            status: 'success',
            data: rows
        });
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'failed to get data' })
    }
}

exports.getPlayerProfile = async (req, res) => {
    const playerId = req.params.playerId || 1;
    try {
        // Check and regenerate stamina if needed
        await checkAndRegenStamina(playerId, db);

        const [playerRows] = await db.query(
            `SELECT player_id, username, gender, player_level, player_exp, stamina, stamina_last_updated, gold, diamond
             FROM players WHERE player_id = ?`,
            [playerId]
        );

        if (playerRows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Player tidak ditemukan.'
            });
        }

        const player = playerRows[0];

        // Ambil progress quest tertinggi yang selesai
        const [questRows] = await db.query(
            `SELECT MAX(mq_id) AS max_completed
             FROM player_quests
             WHERE player_id = ? AND pq_status = 'Completed'`,
            [playerId]
        );

        const currentQuestStage = questRows[0] && questRows[0].max_completed !== null
            ? questRows[0].max_completed + 1
            : 1;

        const maxStamina = Math.min(200, 50 + ((player.player_level - 1) * 5));

        // Calculate seconds remaining until refill (5 min / 300 sec cap)
        let staminaRefillIn = 0;
        if (player.stamina < maxStamina) {
            const lastUpdated = new Date(player.stamina_last_updated).getTime();
            const now = Date.now();
            const elapsed = Math.floor((now - lastUpdated) / 1000);
            staminaRefillIn = Math.max(0, 300 - elapsed);
        }

        res.status(200).json({
            status: 'success',
            data: {
                player_id: player.player_id,
                username: player.username,
                gender: player.gender,
                player_level: player.player_level,
                player_exp: player.player_exp,
                stamina: player.stamina,
                max_stamina: maxStamina,
                stamina_refill_in: staminaRefillIn,
                gold: player.gold,
                diamond: player.diamond,
                current_quest_stage: currentQuestStage
            }
        });
    } catch (err) {
        console.error('[playerController.getPlayerProfile] Error:', err);
        res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan saat memuat data profil player.'
        });
    }
};

// ============================================================
// POST /api/player/use-stamina-potion
// Body: { playerId }
// Konsumsi 1x Full Potion (mat_id=8) dan isi ulang stamina ke max.
// ============================================================
exports.useStaminaPotion = async (req, res) => {
    const { playerId } = req.body;

    if (!playerId) {
        return res.status(400).json({
            status: 'error',
            message: 'playerId wajib diisi.'
        });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Cek stok Full Potion (mat_id = 8)
        const [potionRows] = await conn.query(
            'SELECT quantity FROM player_materials WHERE player_id = ? AND mat_id = 8',
            [playerId]
        );

        const currentQty = potionRows[0] ? potionRows[0].quantity : 0;
        if (currentQty <= 0) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({
                status: 'error',
                message: 'Full Potion tidak tersedia di inventory.'
            });
        }

        // 2. Tambah 120 Stamina (Max 999)
        const HARD_CAP = 999;
        const [playerRows] = await conn.query('SELECT stamina FROM players WHERE player_id = ?', [playerId]);
        const currentStam = playerRows[0] ? playerRows[0].stamina : 0;
        const newStam = Math.min(HARD_CAP, currentStam + 120);

        // 3. Kurangi 1x Full Potion
        await conn.query(
            'UPDATE player_materials SET quantity = quantity - 1 WHERE player_id = ? AND mat_id = 8',
            [playerId]
        );

        // 4. Set stamina baru
        await conn.query(
            'UPDATE players SET stamina = ? WHERE player_id = ?',
            [newStam, playerId]
        );

        await conn.commit();
        conn.release();

        return res.status(200).json({
            status: 'success',
            message: `Stamina berhasil ditambah 120! Full Potion tersisa: ${currentQty - 1}.`,
            data: {
                stamina: newStam,
                full_potion_count: currentQty - 1
            }
        });

    } catch (err) {
        await conn.rollback();
        conn.release();
        console.error('[playerController.useStaminaPotion] Error:', err);
        return res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan saat menggunakan Full Potion.',
            error_detail: err.message
        });
    }
};

// ============================================================
// GET /api/player/:playerId/party-presets
// Returns characters & weapons for presets 1, 2, 3 with power calculation.
// ============================================================
exports.getPartyPresets = async (req, res) => {
    const { playerId } = req.params;

    try {
        const presets = [];

        for (let slot = 1; slot <= 3; slot++) {
            // Query characters in this preset slot
            const [charRows] = await db.query(`
                SELECT mc.mc_name AS name, mc.mc_element AS element, pi.item_level AS level,
                    (mc.mc_base_hp  + (mc.mc_hp_growth  * (pi.item_level - 1))) AS hp,
                    (mc.mc_base_atk + (mc.mc_atk_growth * (pi.item_level - 1))) AS atk,
                    (mc.mc_base_def + (mc.mc_def_growth * (pi.item_level - 1))) AS def
                FROM player_party_presets ppp
                JOIN player_inventories pi ON pi.inv_id IN (
                    ppp.main_char_inv_id, ppp.char_slot_1_inv_id, ppp.char_slot_2_inv_id, ppp.char_slot_3_inv_id
                )
                JOIN master_characters mc ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
                WHERE ppp.player_id = ? AND ppp.preset_slot = ?
            `, [playerId, slot]);

            // Calculate total power: (Sum HP / 10) + Sum(ATK) * 1.5 + Sum(DEF) * 1.2
            let totalHp = 0, totalAtk = 0, totalDef = 0;
            charRows.forEach(c => {
                totalHp += Number(c.hp) || 0;
                totalAtk += Number(c.atk) || 0;
                totalDef += Number(c.def) || 0;
            });
            const totalPower = Math.floor((totalHp / 10) + (totalAtk * 1.5) + (totalDef * 1.2));

            presets.push({
                slot,
                characters: charRows,
                total_power: totalPower,
                has_data: charRows.length > 0
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Data party presets berhasil dimuat.',
            data: { presets }
        });

    } catch (err) {
        console.error('[playerController.getPartyPresets] Error:', err);
        return res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan saat memuat data party presets.',
            error_detail: err.message
        });
    }
};