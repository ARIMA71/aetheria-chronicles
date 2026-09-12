const db = require('../config/db');
const LevelingSystem = require('../utils/LevelingSystem');

exports.getPartyPresets = async (req, res) => {
    const { playerId } = req.params;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        let [presets] = await conn.query('SELECT * FROM player_party_presets WHERE player_id = ? ORDER BY preset_slot ASC', [playerId]);

        // Auto-correct main_char_inv_id to ensure MC data is always valid (heals broken states from DB rebuilds)
        const [mcRows] = await conn.query("SELECT inv_id FROM player_inventories WHERE player_id = ? AND master_item_id = 1 AND item_type = 'Character' LIMIT 1", [playerId]);
        const trueMcInvId = mcRows.length > 0 ? mcRows[0].inv_id : null;
        if (trueMcInvId) {
            for (let p of presets) {
                if (p.main_char_inv_id !== trueMcInvId) {
                    await conn.query('UPDATE player_party_presets SET main_char_inv_id = ? WHERE ppp_id = ?', [trueMcInvId, p.ppp_id]);
                    p.main_char_inv_id = trueMcInvId;
                }
            }
        }

        // Inisialisasi Pemain Baru: Generate 1 Preset di Slot 1 jika kosong
        if (presets.length === 0) {
            const [mcRows] = await conn.query("SELECT inv_id FROM player_inventories WHERE player_id = ? AND master_item_id = 1 AND item_type = 'Character' LIMIT 1", [playerId]);
            const [weapRows] = await conn.query("SELECT inv_id FROM player_inventories WHERE player_id = ? AND item_type = 'Weapon' ORDER BY (master_item_id = 7) DESC, inv_id ASC LIMIT 1", [playerId]);

            if (mcRows.length > 0 && weapRows.length > 0) {
                const mcInvId = mcRows[0].inv_id;
                const weapInvId = weapRows[0].inv_id;

                const [insertRes] = await conn.query(
                    `INSERT INTO player_party_presets 
                    (player_id, preset_slot, main_char_inv_id, weap_grid_1_inv_id) 
                    VALUES (?, 1, ?, ?)`,
                    [playerId, mcInvId, weapInvId]
                );

                const pppId = insertRes.insertId;
                await conn.query(
                    `INSERT INTO player_mc_skills (ppp_id, slot_number, ms_id) VALUES 
                    (?, 1, 1), (?, 2, 2), (?, 3, 3), (?, 4, 4)`,
                    [pppId, pppId, pppId, pppId]
                );

                // Refetch presets
                [presets] = await conn.query('SELECT * FROM player_party_presets WHERE player_id = ? ORDER BY preset_slot ASC', [playerId]);
            }
        }

        // Fetch MC skills for all presets
        for (let preset of presets) {
            const [skills] = await conn.query(
                `SELECT slot_number, ms_id FROM player_mc_skills WHERE ppp_id = ? ORDER BY slot_number ASC`,
                [preset.ppp_id]
            );
            preset.mc_skills = skills;
        }

        await conn.commit();
        conn.release();

        return res.status(200).json({
            status: 'success',
            data: presets
        });

    } catch (error) {
        if (conn) {
            await conn.rollback();
            conn.release();
        }
        console.error('[getPartyPresets] Error:', error);
        return res.status(500).json({ status: 'error', message: 'Failed to fetch party presets' });
    }
};

exports.getPlayerInventory = async (req, res) => {
    const { playerId } = req.params;
    try {
        const [userRows] = await db.query('SELECT username, gender FROM players WHERE player_id = ?', [playerId]);
        const username = userRows.length > 0 ? userRows[0].username : 'Main Character';
        const genderSuffix = (userRows.length > 0 && userRows[0].gender ? userRows[0].gender : 'Male').toLowerCase();

        // 1. Fetch characters
        const [characters] = await db.query(`
            SELECT pi.inv_id, pi.master_item_id, pi.item_level, pi.limit_break_level, pi.item_exp, mc.*,
                   sa.ms_id AS sa_id, sa.ms_name AS sa_name, sa.ms_desc AS sa_desc, sa.ms_category AS sa_category, sa.ms_element AS sa_element
            FROM player_inventories pi
            JOIN master_characters mc ON pi.master_item_id = mc.mc_id
            LEFT JOIN master_skills sa ON mc.mc_special_attack_id = sa.ms_id
            WHERE pi.player_id = ? AND pi.item_type = 'Character'
        `, [playerId]);

        // 2. Fetch weapons
        const [weapons] = await db.query(`
            SELECT pi.inv_id, pi.master_item_id, pi.item_level, pi.limit_break_level, pi.item_exp, mw.*,
                   sa.ms_id AS sa_id, sa.ms_name AS sa_name, sa.ms_desc AS sa_desc, sa.ms_category AS sa_category, sa.ms_element AS sa_element
            FROM player_inventories pi
            JOIN master_weapons mw ON pi.master_item_id = mw.mw_id
            LEFT JOIN master_skills sa ON mw.mw_special_attack_id = sa.ms_id
            WHERE pi.player_id = ? AND pi.item_type = 'Weapon'
        `, [playerId]);

        // 3. Eager-load skills for all characters
        const charIds = characters.map(c => c.master_item_id);
        let charSkillsMap = {};
        if (charIds.length > 0) {
            const [charSkills] = await db.query(`
                SELECT isc.item_id, isc.unlock_level, isc.unlock_limit_break,
                       ms.ms_id, ms.ms_name, ms.ms_desc, ms.ms_category, ms.ms_action_type,
                       ms.ms_target_type, ms.ms_modifier_value, ms.ms_cooldown, ms.ms_element
                FROM item_skills isc
                JOIN master_skills ms ON isc.ms_id = ms.ms_id
                WHERE isc.item_type = 'Character' AND isc.item_id IN (?)
                ORDER BY isc.item_id, isc.unlock_level ASC
            `, [charIds]);
            for (const sk of charSkills) {
                if (!charSkillsMap[sk.item_id]) charSkillsMap[sk.item_id] = [];
                charSkillsMap[sk.item_id].push(sk);
            }
        }
        for (const char of characters) {
            if (char.master_item_id === 1) {
                char.mc_name = username;
                if (char.mc_splash_path) char.mc_splash_path += `-${genderSuffix}`;
                if (char.mc_portrait_path) char.mc_portrait_path += `-${genderSuffix}`;
                if (char.mc_square_path) char.mc_square_path += `-${genderSuffix}`;
                if (char.mc_sprite_path) char.mc_sprite_path += `-${genderSuffix}`;
            }

            if (char.mc_splash_path && !char.mc_splash_path.endsWith('.png')) char.mc_splash_path += '.png';
            if (char.mc_portrait_path && !char.mc_portrait_path.endsWith('.png')) char.mc_portrait_path += '.png';
            if (char.mc_square_path && !char.mc_square_path.endsWith('.png')) char.mc_square_path += '.png';
            if (char.mc_sprite_path && !char.mc_sprite_path.endsWith('.png')) char.mc_sprite_path += '.png';
            
            char.skills = charSkillsMap[char.master_item_id] || [];
            if (char.sa_id) {
                char.skills.push({
                    ms_id: char.sa_id,
                    ms_name: char.sa_name,
                    ms_desc: char.sa_desc,
                    ms_category: char.sa_category || 'Special',
                    ms_element: char.sa_element
                });
            }
        }

        // 4. Eager-load skills for all weapons
        const weapIds = weapons.map(w => w.master_item_id);
        let weapSkillsMap = {};
        if (weapIds.length > 0) {
            const [weapSkills] = await db.query(`
                SELECT isc.item_id, isc.unlock_level, isc.unlock_limit_break,
                       ms.ms_id, ms.ms_name, ms.ms_desc, ms.ms_category, ms.ms_action_type,
                       ms.ms_target_type, ms.ms_modifier_value, ms.ms_cooldown, ms.ms_element
                FROM item_skills isc
                JOIN master_skills ms ON isc.ms_id = ms.ms_id
                WHERE isc.item_type = 'Weapon' AND isc.item_id IN (?)
                ORDER BY isc.item_id, isc.unlock_level ASC
            `, [weapIds]);
            for (const sk of weapSkills) {
                if (!weapSkillsMap[sk.item_id]) weapSkillsMap[sk.item_id] = [];
                weapSkillsMap[sk.item_id].push(sk);
            }
        }
        for (const weap of weapons) {
            weap.skills = weapSkillsMap[weap.master_item_id] || [];
            if (weap.sa_id) {
                weap.skills.push({
                    ms_id: weap.sa_id,
                    ms_name: weap.sa_name,
                    ms_desc: weap.sa_desc,
                    ms_category: weap.sa_category || 'Special',
                    ms_element: weap.sa_element
                });
            }
        }

        // 4.5. Eager-load status effects for all fetched skills
        const allMsIds = new Set();
        characters.forEach(c => {
            if (c.skills) c.skills.forEach(s => allMsIds.add(s.ms_id));
        });
        weapons.forEach(w => {
            if (w.skills) w.skills.forEach(s => allMsIds.add(s.ms_id));
        });

        if (allMsIds.size > 0) {
            const msIdArray = Array.from(allMsIds);
            const [effects] = await db.query(`
                 SELECT sse.ms_id, mse.mse_name AS effect_name, mse.mse_type AS effect_type, mse.modifier_target AS target_stat, mse.modifier_value AS value, mse.mse_duration AS duration, sse.effect_target
                 FROM skill_status_effects sse
                 JOIN master_status_effects mse ON sse.mse_id = mse.mse_id
                 WHERE sse.ms_id IN (?)
             `, [msIdArray]);

            const effectMap = {};
            for (const e of effects) {
                if (!effectMap[e.ms_id]) effectMap[e.ms_id] = [];
                effectMap[e.ms_id].push({
                    effect_name: e.effect_name, effect_type: e.effect_type, target_stat: e.target_stat,
                    value: e.value, duration: e.duration, effect_target: e.effect_target
                });
            }

            characters.forEach(c => {
                if (c.skills) c.skills.forEach(s => s.status_effects = effectMap[s.ms_id] || []);
            });
            weapons.forEach(w => {
                if (w.skills) w.skills.forEach(s => s.status_effects = effectMap[s.ms_id] || []);
            });
        }

        // 5. Fetch materials
        const [materials] = await db.query(`
            SELECT pm.mat_id, pm.quantity, mm.mat_name, mm.mat_desc, mm.icon_path
            FROM player_materials pm
            JOIN master_materials mm ON pm.mat_id = mm.mat_id
            WHERE pm.player_id = ?
        `, [playerId]);

        // 6. Fetch gold (currency)
        const [playerData] = await db.query('SELECT gold FROM players WHERE player_id = ?', [playerId]);
        const gold = playerData.length > 0 ? playerData[0].gold : 0;

        return res.status(200).json({
            status: 'success',
            data: { characters, weapons, materials, gold }
        });
    } catch (error) {
        console.error('[getPlayerInventory] Error:', error);
        return res.status(500).json({ status: 'error', message: 'Failed to fetch inventory' });
    }
};

exports.getMcSkills = async (req, res) => {
    try {
        // IDs 1-8 are generic any-element skills. 35 is Lord of Vermilion Special Attack.
        // Fetch from item_skills to get unlock conditions
        const [skills] = await db.query(`
            SELECT isc.unlock_level, isc.unlock_limit_break, ms.*
            FROM item_skills isc
            JOIN master_skills ms ON isc.ms_id = ms.ms_id
            WHERE isc.item_id = 1 AND isc.item_type = 'Character'
            ORDER BY isc.unlock_level ASC, ms.ms_id ASC
        `);

        if (skills.length > 0) {
            const skillIds = skills.map(s => s.ms_id);
            const [effects] = await db.query(`
                 SELECT sse.ms_id, mse.mse_name AS effect_name, mse.mse_type AS effect_type, mse.modifier_target AS target_stat, mse.modifier_value AS value, mse.mse_duration AS duration, sse.effect_target
                 FROM skill_status_effects sse
                 JOIN master_status_effects mse ON sse.mse_id = mse.mse_id
                 WHERE sse.ms_id IN (?)
            `, [skillIds]);

            const effectMap = {};
            for (const e of effects) {
                if (!effectMap[e.ms_id]) effectMap[e.ms_id] = [];
                effectMap[e.ms_id].push({
                    effect_name: e.effect_name, effect_type: e.effect_type, target_stat: e.target_stat,
                    value: e.value, duration: e.duration, effect_target: e.effect_target
                });
            }

            skills.forEach(s => {
                s.status_effects = effectMap[s.ms_id] || [];
            });
        }

        return res.status(200).json({
            status: 'success',
            data: skills
        });
    } catch (error) {
        console.error('[getMcSkills] Error:', error);
        return res.status(500).json({ status: 'error', message: 'Failed to fetch MC skills' });
    }
};

exports.savePartyPreset = async (req, res) => {
    const { playerId, presetSlot } = req.params;
    const {
        char_slot_1_inv_id, char_slot_2_inv_id, char_slot_3_inv_id,
        weap_grid_1_inv_id, weap_grid_2_inv_id, weap_grid_3_inv_id, weap_grid_4_inv_id, weap_grid_5_inv_id,
        mc_skills // array of up to 4 ms_ids
    } = req.body;

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Verify ownership of all provided inv_ids
        const invIds = [
            char_slot_1_inv_id, char_slot_2_inv_id, char_slot_3_inv_id,
            weap_grid_1_inv_id, weap_grid_2_inv_id, weap_grid_3_inv_id, weap_grid_4_inv_id, weap_grid_5_inv_id
        ].filter(id => id != null && !isNaN(Number(id))).map(id => Number(id));

        if (invIds.length > 0) {
            const [owned] = await conn.query(`SELECT inv_id FROM player_inventories WHERE player_id = ? AND inv_id IN (?)`, [playerId, invIds]);
            const ownedSet = new Set(owned.map(o => Number(o.inv_id)));
            const unowned = invIds.filter(id => !ownedSet.has(Number(id)));

            if (unowned.length > 0) {
                await conn.rollback();
                conn.release();
                return res.status(403).json({ status: 'error', message: 'Akses ditolak: Ada item yang tidak dimiliki player.' });
            }
        }

        // 2. Prevent duplicate inv_ids in weapons
        const weapons = [weap_grid_1_inv_id, weap_grid_2_inv_id, weap_grid_3_inv_id, weap_grid_4_inv_id, weap_grid_5_inv_id].filter(id => id != null);
        if (new Set(weapons).size !== weapons.length) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ status: 'error', message: 'Tidak boleh menggunakan inv_id senjata yang sama di slot berbeda.' });
        }

        // 3. Prevent duplicate inv_ids in characters
        const characters = [char_slot_1_inv_id, char_slot_2_inv_id, char_slot_3_inv_id].filter(id => id != null);
        if (new Set(characters).size !== characters.length) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ status: 'error', message: 'Karakter tidak boleh duplikat di dalam party.' });
        }

        // 4. Require at least weap_grid_1_inv_id
        if (!weap_grid_1_inv_id) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ status: 'error', message: 'Slot Main Weapon (Grid 1) tidak boleh kosong.' });
        }

        // 5. Update or Insert the preset
        // We do NOT update main_char_inv_id. It stays locked.
        const [existing] = await conn.query('SELECT ppp_id FROM player_party_presets WHERE player_id = ? AND preset_slot = ?', [playerId, presetSlot]);
        let pppId;

        if (existing.length === 0) {
            // INSERT
            const [mcRows] = await conn.query("SELECT inv_id FROM player_inventories WHERE player_id = ? AND master_item_id = 1 AND item_type = 'Character' LIMIT 1", [playerId]);
            const mcInvId = mcRows.length > 0 ? mcRows[0].inv_id : null;

            if (!mcInvId) {
                await conn.rollback();
                conn.release();
                return res.status(400).json({ status: 'error', message: 'Main Character tidak ditemukan.' });
            }

            const [insertRes] = await conn.query(`
                INSERT INTO player_party_presets 
                (player_id, preset_slot, main_char_inv_id, char_slot_1_inv_id, char_slot_2_inv_id, char_slot_3_inv_id,
                weap_grid_1_inv_id, weap_grid_2_inv_id, weap_grid_3_inv_id, weap_grid_4_inv_id, weap_grid_5_inv_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                playerId, presetSlot, mcInvId,
                char_slot_1_inv_id || null, char_slot_2_inv_id || null, char_slot_3_inv_id || null,
                weap_grid_1_inv_id, weap_grid_2_inv_id || null, weap_grid_3_inv_id || null, weap_grid_4_inv_id || null, weap_grid_5_inv_id || null
            ]);
            pppId = insertRes.insertId;
        } else {
            // UPDATE
            pppId = existing[0].ppp_id;
            await conn.query(`
                UPDATE player_party_presets 
                SET 
                    char_slot_1_inv_id = ?, char_slot_2_inv_id = ?, char_slot_3_inv_id = ?,
                    weap_grid_1_inv_id = ?, weap_grid_2_inv_id = ?, weap_grid_3_inv_id = ?, weap_grid_4_inv_id = ?, weap_grid_5_inv_id = ?
                WHERE ppp_id = ?
            `, [
                char_slot_1_inv_id || null, char_slot_2_inv_id || null, char_slot_3_inv_id || null,
                weap_grid_1_inv_id, weap_grid_2_inv_id || null, weap_grid_3_inv_id || null, weap_grid_4_inv_id || null, weap_grid_5_inv_id || null,
                pppId
            ]);
        }

        // 6. Update mc_skills
        if (mc_skills && Array.isArray(mc_skills)) {
            const [presetRows] = await conn.query('SELECT ppp_id FROM player_party_presets WHERE player_id = ? AND preset_slot = ?', [playerId, presetSlot]);
            const pppId = presetRows[0].ppp_id;

            await conn.query('DELETE FROM player_mc_skills WHERE ppp_id = ?', [pppId]);

            const skillInserts = [];
            for (let i = 0; i < Math.min(mc_skills.length, 4); i++) {
                if (mc_skills[i] != null) {
                    skillInserts.push([pppId, i + 1, mc_skills[i]]);
                }
            }
            if (skillInserts.length > 0) {
                await conn.query('INSERT INTO player_mc_skills (ppp_id, slot_number, ms_id) VALUES ?', [skillInserts]);
            }
        }

        await conn.commit();
        conn.release();

        return res.status(200).json({ status: 'success', message: 'Party preset berhasil disimpan!' });

    } catch (error) {
        if (conn) {
            await conn.rollback();
            conn.release();
        }
        console.error('[savePartyPreset] Error:', error);
        return res.status(500).json({ status: 'error', message: 'Gagal menyimpan party preset.' });
    }
};

exports.getLimitBreakCost = async (req, res) => {
    const { mcId, targetLb } = req.params;
    let conn;
    try {
        conn = await db.getConnection();
        const [costRows] = await conn.query(
            "SELECT c.mat_id, c.mat_qty, c.gold_cost, m.mat_name FROM char_lb_costs c LEFT JOIN master_materials m ON c.mat_id = m.mat_id WHERE c.mc_id = ? AND c.target_lb_level = ?",
            [mcId, targetLb]
        );

        if (costRows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'LB Cost not found' });
        }

        return res.status(200).json({ status: 'success', data: costRows[0] });
    } catch (error) {
        console.error('[getLimitBreakCost] Error:', error);
        return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
};

exports.limitBreak = async (req, res) => {
    const { playerId } = req.params;
    const { inv_id } = req.body;

    if (!inv_id) {
        return res.status(400).json({ status: 'error', message: 'Parameter inv_id diperlukan.' });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Fetch inventory and ensure ownership
        const [invRows] = await conn.query(
            "SELECT master_item_id, item_level, limit_break_level, item_type FROM player_inventories WHERE inv_id = ? AND player_id = ? FOR UPDATE",
            [inv_id, playerId]
        );

        if (invRows.length === 0) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({ status: 'error', message: 'Item tidak ditemukan atau bukan milik Anda.' });
        }

        const invItem = invRows[0];

        // As per current spec, Limit Break is for characters only? Wait, weapon limit breaks could exist, but the table is char_lb_costs.
        if (invItem.item_type !== 'Character') {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ status: 'error', message: 'Saat ini Limit Break hanya didukung untuk Karakter.' });
        }

        const currentLB = invItem.limit_break_level;
        const targetLB = currentLB + 1;

        // 2. Fetch costs from char_lb_costs
        const [costRows] = await conn.query(
            "SELECT mat_id, mat_qty, gold_cost FROM char_lb_costs WHERE mc_id = ? AND target_lb_level = ?",
            [invItem.master_item_id, targetLB]
        );

        if (costRows.length === 0) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ status: 'error', message: 'Karakter sudah mencapai batas maksimal Limit Break atau data biaya tidak tersedia.' });
        }

        const lbCost = costRows[0];

        // 3. Check Gold
        const [playerRows] = await conn.query("SELECT gold FROM players WHERE player_id = ? FOR UPDATE", [playerId]);
        const playerGold = playerRows[0].gold;
        if (playerGold < lbCost.gold_cost) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ status: 'error', message: 'Gold tidak mencukupi untuk Limit Break.' });
        }

        // 4. Check Materials
        const [matRows] = await conn.query("SELECT quantity FROM player_materials WHERE player_id = ? AND mat_id = ? FOR UPDATE", [playerId, lbCost.mat_id]);
        const currentMatQty = matRows.length > 0 ? matRows[0].quantity : 0;

        if (currentMatQty < lbCost.mat_qty) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ status: 'error', message: 'Material tidak mencukupi untuk Limit Break.' });
        }

        // 5. Deduct Costs and Apply Limit Break
        await conn.query("UPDATE players SET gold = gold - ? WHERE player_id = ?", [lbCost.gold_cost, playerId]);
        await conn.query("UPDATE player_materials SET quantity = quantity - ? WHERE player_id = ? AND mat_id = ?", [lbCost.mat_qty, playerId, lbCost.mat_id]);
        await conn.query("UPDATE player_inventories SET limit_break_level = ? WHERE inv_id = ?", [targetLB, inv_id]);

        // 6. Cek apakah ada skill baru yang terbuka
        const [charDetail] = await conn.query("SELECT mc_name FROM master_characters WHERE mc_id = ?", [invItem.master_item_id]);
        const charName = charDetail.length > 0 ? charDetail[0].mc_name : 'Unknown';

        const [unlockedSkills] = await conn.query(`
            SELECT ms.ms_name
            FROM item_skills isc
            JOIN master_skills ms ON isc.ms_id = ms.ms_id
            WHERE isc.item_id = ? AND isc.item_type = 'Character'
              AND isc.unlock_level <= ? 
              AND isc.unlock_limit_break = ?
        `, [invItem.master_item_id, invItem.item_level, targetLB]);

        const newSkillsUnlocked = unlockedSkills.map(s => s.ms_name);

        await conn.commit();
        conn.release();

        return res.status(200).json({
            status: 'success',
            message: 'Limit Break berhasil! Skill atau potensi baru mungkin telah terbuka.',
            data: {
                new_limit_break_level: targetLB,
                char_name: charName,
                new_skills_unlocked: newSkillsUnlocked
            }
        });

    } catch (error) {
        if (conn) {
            await conn.rollback();
            conn.release();
        }
        console.error('[limitBreak] Error:', error);
        return res.status(500).json({ status: 'error', message: 'Gagal melakukan Limit Break akibat kesalahan server.' });
    }
};

exports.upgradeItem = async (req, res) => {
    const { playerId } = req.params;
    const { invId, itemType, quantity, materialId } = req.body;

    if (!invId || !itemType || !quantity || !materialId) {
        return res.status(400).json({ status: 'error', message: 'Missing required parameters.' });
    }

    if (quantity <= 0) {
        return res.status(400).json({ status: 'error', message: 'Quantity must be at least 1.' });
    }

    const costPerItem = 500;
    const totalCost = costPerItem * quantity;
    const expPerItem = 80000;
    const totalExpGain = expPerItem * quantity;

    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        // Check Gold
        const [playerRows] = await conn.query('SELECT gold FROM players WHERE player_id = ? FOR UPDATE', [playerId]);
        if (playerRows.length === 0) {
            throw new Error('Player not found');
        }
        if (playerRows[0].gold < totalCost) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ status: 'error', message: 'Not enough Gold.' });
        }

        // Check Materials
        const [matRows] = await conn.query('SELECT quantity FROM player_materials WHERE player_id = ? AND mat_id = ? FOR UPDATE', [playerId, materialId]);
        if (matRows.length === 0 || matRows[0].quantity < quantity) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ status: 'error', message: 'Not enough materials.' });
        }

        // Fetch item details
        const [invRows] = await conn.query('SELECT * FROM player_inventories WHERE inv_id = ? AND player_id = ? FOR UPDATE', [invId, playerId]);
        if (invRows.length === 0) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({ status: 'error', message: 'Item not found in inventory.' });
        }

        const invItem = invRows[0];
        if (invItem.item_type !== itemType) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ status: 'error', message: 'Item type mismatch.' });
        }

        // Get max level
        let maxLevel = 1;
        let sysItemType = itemType;
        if (itemType === 'Character') {
            const [mcRows] = await conn.query('SELECT mc_rarity FROM master_characters WHERE mc_id = ?', [invItem.master_item_id]);
            maxLevel = LevelingSystem.getCharMaxLevel(invItem.master_item_id, mcRows[0].mc_rarity, invItem.limit_break_level);
            if (invItem.master_item_id === 1) sysItemType = 'MC';
        } else {
            const [mwRows] = await conn.query('SELECT mw_rarity FROM master_weapons WHERE mw_id = ?', [invItem.master_item_id]);
            maxLevel = LevelingSystem.getWeaponMaxLevel(mwRows[0].mw_rarity);
        }

        if (invItem.item_level >= maxLevel) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ status: 'error', message: 'Item is already at max level.' });
        }

        // Process EXP
        const newTotalExp = invItem.item_exp + totalExpGain;
        const newLevel = LevelingSystem.calculateCurrentLevel(newTotalExp, maxLevel, sysItemType);

        // Deduct
        await conn.query('UPDATE players SET gold = gold - ? WHERE player_id = ?', [totalCost, playerId]);
        await conn.query('UPDATE player_materials SET quantity = quantity - ? WHERE player_id = ? AND mat_id = ?', [quantity, playerId, materialId]);

        // Update Item
        await conn.query('UPDATE player_inventories SET item_level = ?, item_exp = ? WHERE inv_id = ?', [newLevel, newTotalExp, invId]);

        await conn.commit();
        conn.release();

        return res.status(200).json({
            status: 'success',
            message: 'Upgrade successful!',
            data: {
                new_level: newLevel,
                new_exp: newTotalExp
            }
        });

    } catch (error) {
        if (conn) {
            await conn.rollback();
            conn.release();
        }
        console.error('[upgradeItem] Error:', error);
        return res.status(500).json({ status: 'error', message: 'Internal server error.' });
    }
};