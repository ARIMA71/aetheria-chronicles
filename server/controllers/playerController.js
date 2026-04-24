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