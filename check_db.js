require('dotenv').config({ path: './server/.env' });
const db = require('./server/config/db');

async function test() {
    try {
        const questId = 5;
        const [monsterRows] = await db.query(`
        SELECT mon.mon_id, mon.mon_name,
            mb.mb_id, mb.ms_id AS mb_ms_id,
            ms.ms_id AS skill_id, ms.ms_name AS skill_name
        FROM quest_enemies qe
        JOIN master_monsters mon ON qe.mon_id = mon.mon_id
        LEFT JOIN monster_behavior mb ON mon.mon_id = mb.mon_id
        LEFT JOIN master_skills ms ON mb.ms_id = ms.ms_id
        WHERE qe.mq_id = ?
        `, [questId]);

        console.log("=== DB QUERY RESULT FOR QUEST ID 5 ===");
        console.log("Number of rows:", monsterRows.length);
        if (monsterRows.length > 0) {
            console.log("mon_id:", monsterRows[0].mon_id, "name:", monsterRows[0].mon_name);
            console.log("mb_ids found:", monsterRows.map(r => r.mb_id));
            console.log("skill_ids found:", monsterRows.map(r => r.skill_id));
        } else {
            console.log("No rows found!");
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
}

test();
