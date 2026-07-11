const mysql = require('mysql2/promise');
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'db_aetheria'
});

async function run() {
    try {
        const [players] = await pool.query('DESCRIBE players');
        console.log('players table:', players.map(r => r.Field));
        
        const [invs] = await pool.query('DESCRIBE player_inventories');
        console.log('player_inventories table:', invs.map(r => r.Field));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
