const db = require('../config/db')

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
            
        `,[playerId])
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
    const playerId = req.params.playerId;
    try {
        const [playerRows] = await db.query(
            `SELECT player_id, username, player_level, player_exp, stamina, gold, diamond, currency
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

        res.status(200).json({
            status: 'success',
            data: {
                player_id: player.player_id,
                username: player.username,
                player_level: player.player_level,
                player_exp: player.player_exp,
                stamina: player.stamina,
                gold: player.gold,
                diamond: player.diamond,
                currency: player.currency,
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