const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

async function clearActiveSessions() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_aetheria',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const [result] = await pool.query('UPDATE battle_sessions SET bs_status = "FAILED" WHERE bs_status = "ACTIVE"');
        console.log(`Cleared ${result.affectedRows} corrupted active sessions.`);
    } catch (e) {
        console.error('Error clearing sessions:', e);
    } finally {
        await pool.end();
    }
}

clearActiveSessions();
