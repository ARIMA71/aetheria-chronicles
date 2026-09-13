const db = require('../config/db');

exports.getQuests = async (req, res) => {
    const playerId = req.query.playerId || 1;

    try {
        // Query to get all master quests and their area information
        // We also join with player_quests to see if the player has completed it
        const [rows] = await db.query(`
            SELECT
                mq.mq_id, mq.mq_name, mq.mq_stamina_cost, mq.mq_power_lvl, mq.mq_order,
                pq.pq_status
            FROM master_quests mq
            LEFT JOIN player_quests pq ON mq.mq_id = pq.mq_id AND pq.player_id = ?
            ORDER BY mq.mq_order ASC
        `, [playerId]);

        // --------------------------------------------------
        // [HEADSTART PLAYTEST] Quest Unlock Rule:
        // - Stage 0 s/d 7 (mq_order 0-7): Bebas dimainkan tanpa urutan.
        // - Stage Nightmare 8-10 (mq_order >= 8): Terkunci sampai Stage 7 diselesaikan.
        // --------------------------------------------------
        let hasCompletedStage7 = false;
        rows.forEach(r => {
            if (r.pq_status === 'Completed' && (r.mq_order >= 7 || r.mq_id === 8)) {
                hasCompletedStage7 = true;
            }
        });

        // Query enemy info for each quest
        const [enemies] = await db.query(`
            SELECT qe.mq_id, m.mon_name AS name, COALESCE(qe.override_element, m.mon_element) AS element, qe.monster_level AS level
            FROM quest_enemies qe
            JOIN master_monsters m ON qe.mon_id = m.mon_id
        `);

        // Query drop loot info
        const [loots] = await db.query(`
            SELECT qr.mq_id, qr.reward_type, m.mat_name, mw.mw_name, qr.quantity, qr.drop_chance, qr.is_first_clear
            FROM quest_rewards qr
            LEFT JOIN master_materials m ON qr.reward_item_id = m.mat_id AND qr.reward_type = 'Material'
            LEFT JOIN master_weapons mw ON qr.reward_item_id = mw.mw_id AND qr.reward_type = 'Weapon'
        `);

        // Group into 3 Areas: Green Plains (0-3), Mountain Pass (4-7), Abyss Depths (8-10)
        const areaConfig = [
            { name: "Green Plains", range: [0, 3] },
            { name: "Mountain Pass", range: [4, 7] },
            { name: "Abyss Depths", range: [8, 10] }
        ];

        const areas = areaConfig.map(ac => ({
            area_name: ac.name,
            status: 'LOCKED',
            quests: []
        }));

        rows.forEach(q => {
            // Determine Area
            let targetArea = areas[0];
            if (q.mq_order >= 4 && q.mq_order <= 7) targetArea = areas[1];
            if (q.mq_order >= 8) targetArea = areas[2];

            // [HEADSTART PLAYTEST] Unlock Determination:
            // Stage 0-7 selalu terbuka; Stage 8+ (Nightmare) butuh penyelesaian Stage 7 (mq_order 7)
            const isUnlocked = q.mq_order <= 7 ? true : hasCompletedStage7;
            if (isUnlocked) targetArea.status = 'UNLOCKED';

            const questEnemies = enemies.filter(e => e.mq_id === q.mq_id).map(e => ({ name: e.name, level: e.level, element: e.element }));
            
            const questRewards = loots.filter(l => l.mq_id === q.mq_id).map(l => {
                let itemName = l.reward_type;
                if (l.reward_type === 'Material' && l.mat_name) itemName = l.mat_name;
                if (l.reward_type === 'Weapon' && l.mw_name) itemName = l.mw_name;
                if (l.reward_type === 'Gold') itemName = 'Gold';
                if (l.reward_type === 'Diamond') itemName = 'Diamond';
                return {
                    item_name: itemName,
                    quantity: l.quantity,
                    drop_chance: l.drop_chance,
                    is_first_clear: l.is_first_clear === 1
                };
            });

            targetArea.quests.push({
                mq_id: q.mq_id,
                name: q.mq_name,
                stamina_cost: q.mq_stamina_cost,
                power_level: q.mq_power_lvl,
                status: isUnlocked ? 'UNLOCKED' : 'LOCKED',
                completed: q.pq_status === 'Completed',
                enemies: questEnemies,
                rewards: questRewards
            });
        });

        res.status(200).json({
            status: 'success',
            data: { areas }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ status: 'error', message: 'Failed to fetch quests' });
    }
};
