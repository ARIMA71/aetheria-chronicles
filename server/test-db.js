const db = require('./config/db');

async function test() {
    try {
        const [rows] = await db.query(
            `SELECT player_id, username, password_hash, player_level, player_exp, stamina, gold, diamond
             FROM players
             WHERE username = 'Gran'`
        );
        console.log('Query success:', rows.length);
    } catch (e) {
        require('fs').writeFileSync('db_error.txt', e.toString());
    } finally {
        process.exit();
    }
}
test();
