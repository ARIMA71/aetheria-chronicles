require('dotenv').config();
require('./config/db');
require('./utils/LevelingSystem').init();
const express = require('express');
const cors = require('cors');

const routes = require('./routes');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', routes);

// Serve Client Static Build & Game Assets
const path = require('path');
const clientDistPath = path.join(__dirname, '../client/dist');
const clientAssetsPath = path.join(__dirname, '../client/assets');

app.use(express.static(clientDistPath));
app.use('/assets', express.static(clientAssetsPath));

// Fallback to index.html for non-API routes
app.use((req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ============================================================
// Garbage Collection Anti-Username Lock
// ============================================================
const db = require('./config/db');

// Berjalan setiap 30 menit
setInterval(async () => {
    try {
        const [guests] = await db.query(
            "SELECT player_id FROM players WHERE is_guest = 1 AND created_at < (NOW() - INTERVAL 1 HOUR)"
        );

        if (guests.length > 0) {
            const playerIds = guests.map(g => g.player_id);

            // Karena foreign key ke tabel-tabel ini tidak pakai ON DELETE CASCADE, kita harus hapus manual secara berurutan
            // Hapus tabel yang mereferensi inventory dan battle_sessions terlebih dahulu
            await db.query("DELETE FROM player_party_presets WHERE player_id IN (?)", [playerIds]);
            await db.query("DELETE FROM player_quests WHERE player_id IN (?)", [playerIds]);
            
            // Hapus parent selanjutnya
            await db.query("DELETE FROM battle_sessions WHERE player_id IN (?)", [playerIds]);
            await db.query("DELETE FROM player_inventories WHERE player_id IN (?)", [playerIds]);
            
            // Hapus data lainnya
            await db.query("DELETE FROM player_materials WHERE player_id IN (?)", [playerIds]);
            await db.query("DELETE FROM player_gacha_pity WHERE player_id IN (?)", [playerIds]);
            
            // Terakhir hapus dari tabel players
            const [result] = await db.query("DELETE FROM players WHERE player_id IN (?)", [playerIds]);
            
            console.log(`[GC] Cleaned up ${result.affectedRows} abandoned guest accounts.`);
        }
    } catch (err) {
        console.error('[GC] Error cleaning up guest accounts:', err.message);
    }
}, 30 * 60 * 1000);

