const mysql = require('mysql2/promise');
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'db_aetheria'
});

async function run() {
    try {
        const [tables] = await pool.query('SHOW TABLES');
        console.log("All tables:", tables.map(t => Object.values(t)[0]));

        const [lbCost] = await pool.query('DESCRIBE character_limit_breaks');
        console.log('character_limit_breaks:', lbCost);
        
        const [itemSkills] = await pool.query('DESCRIBE item_skills');
        console.log('item_skills:', itemSkills);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
