/**
 * seed-test-data.js
 * Seed script untuk menyiapkan data tes:
 * 1. Insert Full Potion (mat_id: 8) ke master_materials jika belum ada.
 * 2. Insert 5x Full Potion ke player_materials untuk player_id: 1.
 * 3. Insert histori player_quests (mq_id 1-5 Completed) untuk player_id: 1.
 */

require('dotenv').config();
const db = require('./config/db');

async function seed() {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // ── 1. Register Full Potion di master_materials ──
        const [existing] = await conn.query(
            'SELECT mat_id FROM master_materials WHERE mat_id = 8'
        );
        if (existing.length === 0) {
            await conn.query(
                "INSERT INTO master_materials (mat_id, mat_name, mat_desc) VALUES (8, 'Full Potion', 'Stamina Refill & Battle Revive: Mengisi penuh stamina ATAU menghidupkan kembali seluruh party dengan 100% HP dan cooldown reset.')"
            );
            console.log('✅ Inserted Full Potion (mat_id: 8) into master_materials.');
        } else {
            console.log('ℹ️  Full Potion (mat_id: 8) already exists in master_materials.');
        }

        // ── 2. Grant 5x Full Potion ke player_id: 1 ──
        await conn.query(
            'INSERT INTO player_materials (player_id, mat_id, quantity) VALUES (1, 8, 5) ON DUPLICATE KEY UPDATE quantity = 5'
        );
        console.log('✅ Granted 5x Full Potion to player_id: 1 in player_materials.');

        // ── 2.5. Set character & weapon levels to 80 for player_id: 1 to restore high HP/stats ──
        await conn.query(
            'UPDATE player_inventories SET item_level = 80 WHERE player_id = 1'
        );
        console.log('✅ Updated player_id: 1 character & weapon levels to 80.');

        // ── 3. Seed player_quests: mq_id 1-5 = Completed untuk player_id: 1 ──
        // Hapus data lama jika ada agar idempotent
        await conn.query(
            'DELETE FROM player_quests WHERE player_id = 1'
        );

        const questSeeds = [
            [1, 1, 'Completed', null],
            [1, 2, 'Completed', null],
            [1, 3, 'Completed', null],
            [1, 4, 'Completed', null],
            [1, 5, 'Completed', null],
        ];

        for (const seed of questSeeds) {
            await conn.query(
                'INSERT INTO player_quests (player_id, mq_id, pq_status, bs_id) VALUES (?, ?, ?, ?)',
                seed
            );
        }
        console.log('✅ Seeded 5 completed quest records for player_id: 1 (mq_id 1-5).');

        await conn.commit();
        console.log('\n🎉 Seed completed successfully!');
    } catch (e) {
        await conn.rollback();
        console.error('❌ Seed failed:', e.message);
    } finally {
        conn.release();
        process.exit();
    }
}

seed();
