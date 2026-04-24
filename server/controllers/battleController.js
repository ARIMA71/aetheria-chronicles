const db = require('../config/db');

exports.initBattle = async (req, res) => {
// 1. Tangkap data yang dikirim dari Phaser
    const { playerId, questId, presetSlot} = req.body;

    // Validasi sederhana
    if (!playerId || !questId || !presetSlot) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'playerId, questId, dan presetSlot wajib diisi!' 
        });
    }

    try {
        // Query stats party berdasarkan preset
        const queryStats = `
        WITH ppp AS (
        SELECT * FROM player_party_presets WHERE player_id = ${playerId} AND preset_slot = ${presetSlot}
        )
        SELECT 'Main Character' AS role_slot, pi.inv_id, 'Character' AS item_type, pi.item_level AS LEVEL,
        mc.mc_name AS NAME, mc.mc_element AS element, mc.mc_portrait_path AS image_path,
        (mc.mc_base_hp + (mc.mc_hp_growth * (pi.item_level - 1))) AS calculated_hp,
        (mc.mc_base_atk + (mc.mc_atk_growth * (pi.item_level - 1))) AS calculated_atk
        FROM ppp JOIN player_inventories PI ON ppp.main_char_inv_id = pi.inv_id 
        JOIN master_characters mc ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
        UNION ALL
        SELECT 'Char Slot 1', pi.inv_id, 'Character', pi.item_level, mc.mc_name, mc.mc_element, mc.mc_portrait_path,
        (mc.mc_base_hp + (mc.mc_hp_growth * (pi.item_level - 1))), (mc.mc_base_atk + (mc.mc_atk_growth * (pi.item_level - 1)))
        FROM ppp JOIN player_inventories PI ON ppp.char_slot_1_inv_id = pi.inv_id 
        JOIN master_characters mc ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
        UNION ALL
        SELECT 'Char Slot 2', pi.inv_id, 'Character', pi.item_level, mc.mc_name, mc.mc_element, mc.mc_portrait_path,
        (mc.mc_base_hp + (mc.mc_hp_growth * (pi.item_level - 1))), (mc.mc_base_atk + (mc.mc_atk_growth * (pi.item_level - 1)))
        FROM ppp JOIN player_inventories PI ON ppp.char_slot_2_inv_id = pi.inv_id 
        JOIN master_characters mc ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
        UNION ALL
        SELECT 'Char Slot 3', pi.inv_id, 'Character', pi.item_level, mc.mc_name, mc.mc_element, mc.mc_portrait_path,
        (mc.mc_base_hp + (mc.mc_hp_growth * (pi.item_level - 1))), (mc.mc_base_atk + (mc.mc_atk_growth * (pi.item_level - 1)))
        FROM ppp JOIN player_inventories PI ON ppp.char_slot_3_inv_id = pi.inv_id 
        JOIN master_characters mc ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
        UNION ALL
        SELECT 'Weapon Grid 1', pi.inv_id, 'Weapon', pi.item_level, mw.mw_name, mw.mw_element, mw.mw_img_path,
        (mw.mw_base_hp + (mw.mw_hp_growth * (pi.item_level - 1))), (mw.mw_base_atk + (mw.mw_atk_growth * (pi.item_level - 1)))
        FROM ppp JOIN player_inventories PI ON ppp.weap_grid_1_inv_id = pi.inv_id 
        JOIN master_weapons mw ON pi.master_item_id = mw.mw_id AND pi.item_type = 'Weapon'
        UNION ALL
        SELECT 'Weapon Grid 2', pi.inv_id, 'Weapon', pi.item_level, mw.mw_name, mw.mw_element, mw.mw_img_path,
        (mw.mw_base_hp + (mw.mw_hp_growth * (pi.item_level - 1))), (mw.mw_base_atk + (mw.mw_atk_growth * (pi.item_level - 1)))
        FROM ppp JOIN player_inventories PI ON ppp.weap_grid_2_inv_id = pi.inv_id 
        JOIN master_weapons mw ON pi.master_item_id = mw.mw_id AND pi.item_type = 'Weapon'
        UNION ALL
        SELECT 'Weapon Grid 3', pi.inv_id, 'Weapon', pi.item_level, mw.mw_name, mw.mw_element, mw.mw_img_path,
        (mw.mw_base_hp + (mw.mw_hp_growth * (pi.item_level - 1))), (mw.mw_base_atk + (mw.mw_atk_growth * (pi.item_level - 1)))
        FROM ppp JOIN player_inventories PI ON ppp.weap_grid_3_inv_id = pi.inv_id 
        JOIN master_weapons mw ON pi.master_item_id = mw.mw_id AND pi.item_type = 'Weapon'
        UNION ALL
        SELECT 'Weapon Grid 4', pi.inv_id, 'Weapon', pi.item_level, mw.mw_name, mw.mw_element, mw.mw_img_path,
        (mw.mw_base_hp + (mw.mw_hp_growth * (pi.item_level - 1))), (mw.mw_base_atk + (mw.mw_atk_growth * (pi.item_level - 1)))
        FROM ppp JOIN player_inventories PI ON ppp.weap_grid_4_inv_id = pi.inv_id 
        JOIN master_weapons mw ON pi.master_item_id = mw.mw_id AND pi.item_type = 'Weapon'
        UNION ALL
        SELECT 'Weapon Grid 5', pi.inv_id, 'Weapon', pi.item_level, mw.mw_name, mw.mw_element, mw.mw_img_path,
        (mw.mw_base_hp + (mw.mw_hp_growth * (pi.item_level - 1))), (mw.mw_base_atk + (mw.mw_atk_growth * (pi.item_level - 1)))
        FROM ppp JOIN player_inventories PI ON ppp.weap_grid_5_inv_id = pi.inv_id 
        JOIN master_weapons mw ON pi.master_item_id = mw.mw_id AND pi.item_type = 'Weapon';
        `;
        // Query ambil Skill party
        const querySkills = `
        SELECT pi.inv_id, ms.ms_name, ms.ms_category, ms.ms_modifier_value, ms.ms_cooldown, ms.ms_element
        FROM player_party_presets ppp
        JOIN player_inventories PI ON pi.inv_id IN (
        ppp.main_char_inv_id, ppp.char_slot_1_inv_id, ppp.char_slot_2_inv_id, ppp.char_slot_3_inv_id,
        ppp.weap_grid_1_inv_id, ppp.weap_grid_2_inv_id, ppp.weap_grid_3_inv_id, ppp.weap_grid_4_inv_id, ppp.weap_grid_5_inv_id
        )
        JOIN item_skills its ON pi.master_item_id = its.item_id AND pi.item_type = its.item_type
        JOIN master_skills ms ON its.ms_id = ms.ms_id
        WHERE ppp.player_id = ${playerId} AND ppp.preset_slot = ${presetSlot};
        `;
        // 3. Query ambil Monster
        const queryMonsters = `
        SELECT 
        mon.mon_id,
        mon.mon_name,
        mon.mon_element,
        qe.monster_level,
        (mon.mon_base_hp * qe.monster_level) AS calculated_hp, 
        (mon.mon_base_atk * qe.monster_level) AS calculated_atk,
        mai.condition_type,
        mai.condition_value,
        ms.ms_name AS skill_name,
        ms.ms_category,
        ms.ms_modifier_value
        FROM quest_enemies qe
        JOIN master_monsters mon ON qe.mon_id = mon.mon_id
        LEFT JOIN monster_ai_behavior mai ON mon.mon_id = mai.mon_id
        LEFT JOIN master_skills ms ON mai.ms_id = ms.ms_id
        WHERE qe.mq_id = ${questId};
        `;

        // // DUMMY DATA SEMENTARA (Agar bisa dites di Postman/Phaser sekarang)
        // const dummyData = {
        //     party: [{ name: "Hero Dummy", hp: 100 }],
        //     monsters: [{ name: "Slime Dummy", hp: 50 }]
        // };

        const [[statsRows], [skillsRows], [monsterRows]] = await Promise.all([
            db.query(queryStats, [playerId, presetSlot]),
            db.query(querySkills, [playerId, presetSlot]),
            db.query(queryMonsters, [questId])
        ]);

        if (statsRows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Party preset tidak ditemukan.' });
        }

        // Processing Data
        let totalGridHp = 0;
        let totalGridAtk = 0;
        const tempCharacters = [];
        const globalPassives = [];
        const enemies = [];

        // 1. Ekstrak Grid Stats & Siapkan Karakter Dasar
        statsRows.forEach(item => {
            const itemSkills = skillsRows.filter(s => s.inv_id === item.inv_id);
            const formattedSkills = itemSkills.map(s => ({
                name: s.ms_name,
                category: s.ms_category,
                modifier: s.ms_modifier_value,
                cooldown: s.ms_cooldown,
                element: s.ms_element,
                vfx_path: s.ms_vfx_path
            }));

            if (item.item_type === 'Weapon') {
                // Konversi ke Number untuk jaga-jaga MySQL mengembalikan string
                totalGridHp += Number(item.calculated_hp) || 0;
                totalGridAtk += Number(item.calculated_atk) || 0;
                
                formattedSkills.forEach(skill => {
                    if (skill.category === 'Passive') {
                        globalPassives.push({ source_weapon: item.name, ...skill });
                    }
                });
            } else {
                // Simpan karakter sementara ke array
                tempCharacters.push({
                    slot: item.role_slot,
                    name: item.name,
                    element: item.element,
                    level: item.level,
                    base_hp: Number(item.calculated_hp) || 0,
                    base_atk: Number(item.calculated_atk) || 0,
                    portrait_path: item.image_path,
                    skills: formattedSkills
                });
            }
        });

        // 2. Terapkan Final Stat Calculation (Grid Bonus ditambahkan ke Karakter)
        const finalCharacters = tempCharacters.map(char => ({
            ...char,
            final_stats: {
                hp: char.base_hp + totalGridHp,
                atk: char.base_atk + totalGridAtk
            }
        }));

        // 3. Proses Mapping Musuh
        const monsterMap = {};
        monsterRows.forEach(row => {
            if (!monsterMap[row.mon_id]) {
                monsterMap[row.mon_id] = {
                    id: row.mon_id,
                    name: row.mon_name,
                    element: row.mon_element,
                    level: row.monster_level || 1, // Fallback aman
                    final_stats: { 
                        hp: Number(row.calculated_hp) || 0, 
                        atk: Number(row.calculated_atk) || 0 
                    },
                    ai_behaviors: []
                };
            }
            if (row.skill_name) {
                monsterMap[row.mon_id].ai_behaviors.push({
                    condition_type: row.condition_type,
                    condition_value: row.condition_value,
                    skill: {
                        name: row.skill_name,
                        category: row.ms_category,
                        modifier: row.ms_modifier_value,
                        // vfx_path: row.ms_vfx_path
                    }
                });
            }
        });
        
        for (const key in monsterMap) {
            enemies.push(monsterMap[key]);
        }

        // =========================================================
        // RESPONSE AKHIR
        // =========================================================
        res.status(200).json({
            status: 'success',
            message: 'Data arena pertarungan siap!',
            data: {
                quest_id: parseInt(questId),
                player_party: {
                    active_passives: globalPassives,
                    characters: finalCharacters
                },
                enemies: enemies
            }
        });

        // // Format Response Best Practice
        // res.status(200).json({
        //     status: 'success',
        //     message: 'Data battle berhasil dimuat',
        //     data: dummyData
        // });

    } catch (error) {
        console.error("Error init battle:", error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Terjadi kesalahan pada server saat memuat data battle',
            error_detail: error.message
        });
    }
}

exports.saveBattleResult = (req, res) => {
    res.json({
        message: 'SAVED'
    });
};