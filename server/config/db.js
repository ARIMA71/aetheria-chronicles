const mysql = require('mysql2/promise')

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
})

// Auto-migration for stamina regeneration support
async function initDbSchema() {
    try {
        const [columns] = await pool.query("SHOW COLUMNS FROM players LIKE 'stamina_last_updated'");
        if (columns.length === 0) {
            await pool.query("ALTER TABLE players ADD COLUMN stamina_last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
            console.log("✅ Column 'stamina_last_updated' added to table 'players'.");
            // Set initial value for existing rows
            await pool.query("UPDATE players SET stamina_last_updated = NOW()");
        }
    } catch (e) {
        console.error("Failed to init database schema:", e);
    }
}
initDbSchema();

module.exports = pool