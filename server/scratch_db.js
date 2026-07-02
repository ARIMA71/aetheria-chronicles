const db = require('../config/db');

async function test() {
    try {
        const [rows] = await db.query('SHOW COLUMNS FROM master_quests');
        console.log(rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
test();
