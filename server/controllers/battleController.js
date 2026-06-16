const db = require('../config/db');

// =============================================================
// Helper: Format satu baris efek status dari hasil JOIN menjadi
// objek standar. Mengembalikan null jika baris tidak punya efek.
// =============================================================
function formatStatusEffect(row, prefix = '') {
    const name = row[`${prefix}effect_name`];
    if (!name) return null; // LEFT JOIN miss → skill tanpa efek
    return {
        effect_name:   name,
        effect_type:   row[`${prefix}effect_type`]   || null,
        target_stat:   row[`${prefix}target_stat`]   || null,
        value:         Number(row[`${prefix}effect_value`]) || 0,
        duration:      row[`${prefix}effect_duration`] !== undefined ? row[`${prefix}effect_duration`] : null,
        effect_target: row[`${prefix}effect_target`]  || null
    };
}

exports.initBattle = async (req, res) => {
    // =========================================================
    // 1. Tangkap & Validasi Request Body
    // =========================================================
    const { playerId, questId, presetSlot } = req.body;

    if (!playerId || !questId || !presetSlot) {
        return res.status(400).json({
            status: 'error',
            message: 'playerId, questId, dan presetSlot wajib diisi!'
        });
    }

    try {
        // =========================================================
        // QUERY 1: Ambil data 4 slot karakter di party preset
        //   - Stat final: langsung mc_base_hp & mc_base_atk
        //     (Weapon Grid diabaikan untuk iterasi pertama)
        //   - UNION ALL agar slot kosong (NULL inv_id) tidak muncul
        // =========================================================
        const queryCharacters = `
        SELECT
            'Main Character' AS role_slot,
            pi.inv_id,
            pi.item_level    AS level,
            mc.mc_id,
            mc.mc_name          AS name,
            mc.mc_element       AS element,
            (mc.mc_base_hp  + (mc.mc_hp_growth  * (pi.item_level - 1))) AS base_hp,
            (mc.mc_base_atk + (mc.mc_atk_growth * (pi.item_level - 1))) AS base_atk,
            (mc.mc_base_def + (mc.mc_def_growth * (pi.item_level - 1))) AS base_def,
            mc.mc_max_sa        AS max_sa,
            mc.mc_portrait_path AS portrait_path,
            mc.mc_sprite_path   AS sprite_path
        FROM player_party_presets ppp
        JOIN player_inventories pi
            ON ppp.main_char_inv_id = pi.inv_id
        JOIN master_characters mc
            ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?

        UNION ALL

        SELECT 'Char Slot 1', pi.inv_id, pi.item_level, mc.mc_id,
            mc.mc_name, mc.mc_element,
            (mc.mc_base_hp  + (mc.mc_hp_growth  * (pi.item_level - 1))),
            (mc.mc_base_atk + (mc.mc_atk_growth * (pi.item_level - 1))),
            (mc.mc_base_def + (mc.mc_def_growth * (pi.item_level - 1))),
            mc.mc_max_sa, mc.mc_portrait_path, mc.mc_sprite_path
        FROM player_party_presets ppp
        JOIN player_inventories pi ON ppp.char_slot_1_inv_id = pi.inv_id
        JOIN master_characters mc  ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?

        UNION ALL

        SELECT 'Char Slot 2', pi.inv_id, pi.item_level, mc.mc_id,
            mc.mc_name, mc.mc_element,
            (mc.mc_base_hp  + (mc.mc_hp_growth  * (pi.item_level - 1))),
            (mc.mc_base_atk + (mc.mc_atk_growth * (pi.item_level - 1))),
            (mc.mc_base_def + (mc.mc_def_growth * (pi.item_level - 1))),
            mc.mc_max_sa, mc.mc_portrait_path, mc.mc_sprite_path
        FROM player_party_presets ppp
        JOIN player_inventories pi ON ppp.char_slot_2_inv_id = pi.inv_id
        JOIN master_characters mc  ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?

        UNION ALL

        SELECT 'Char Slot 3', pi.inv_id, pi.item_level, mc.mc_id,
            mc.mc_name, mc.mc_element,
            (mc.mc_base_hp  + (mc.mc_hp_growth  * (pi.item_level - 1))),
            (mc.mc_base_atk + (mc.mc_atk_growth * (pi.item_level - 1))),
            (mc.mc_base_def + (mc.mc_def_growth * (pi.item_level - 1))),
            mc.mc_max_sa, mc.mc_portrait_path, mc.mc_sprite_path
        FROM player_party_presets ppp
        JOIN player_inventories pi ON ppp.char_slot_3_inv_id = pi.inv_id
        JOIN master_characters mc  ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?
        `;

        // =========================================================
        // QUERY 2: Ambil semua skill KARAKTER beserta status effects-nya
        //
        //   JOIN Chain:
        //     player_party_presets → player_inventories → item_skills
        //     → master_skills
        //     LEFT JOIN skill_status_effects (sse)   ← one-to-many
        //     LEFT JOIN master_status_effects (mse)  ← detail efek
        //
        //   Karena LEFT JOIN bersifat one-to-many, satu skill dengan
        //   N efek akan menghasilkan N baris. Pengelompokan dilakukan
        //   di Node.js menggunakan Map dengan key "inv_id:ms_id".
        // =========================================================
        const querySkills = `
        -- MC's Active Skills from player_mc_skills based on the selected party preset
        SELECT
            pi.inv_id,
            ms.ms_id,
            ms.ms_name           AS name,
            ms.ms_category       AS category,
            ms.ms_action_type    AS type,
            ms.ms_target_type    AS target_type,
            ms.ms_modifier_value AS modifier,
            ms.ms_cooldown       AS cooldown,
            ms.ms_element        AS element,
            ms.ms_icon_path      AS icon_path,
            ms.ms_vfx_path       AS vfx_path,
            -- Status Effect columns (NULL jika tidak ada)
            mse.mse_name         AS effect_name,
            mse.mse_type         AS effect_type,
            mse.modifier_target  AS target_stat,
            mse.modifier_value   AS effect_value,
            mse.mse_duration     AS effect_duration,
            sse.effect_target    AS effect_target,
            mse.mse_id           AS mse_id
        FROM player_party_presets ppp
        JOIN player_inventories pi
            ON ppp.main_char_inv_id = pi.inv_id
        JOIN player_mc_skills pmcs
            ON ppp.ppp_id = pmcs.ppp_id
        JOIN master_skills ms
            ON pmcs.ms_id = ms.ms_id
        LEFT JOIN skill_status_effects sse
            ON ms.ms_id = sse.ms_id
        LEFT JOIN master_status_effects mse
            ON sse.mse_id = mse.mse_id
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?

        UNION ALL

        -- Other Characters' Active Skills from item_skills
        SELECT
            pi.inv_id,
            ms.ms_id,
            ms.ms_name           AS name,
            ms.ms_category       AS category,
            ms.ms_action_type    AS type,
            ms.ms_target_type    AS target_type,
            ms.ms_modifier_value AS modifier,
            ms.ms_cooldown       AS cooldown,
            ms.ms_element        AS element,
            ms.ms_icon_path      AS icon_path,
            ms.ms_vfx_path       AS vfx_path,
            -- Status Effect columns (NULL jika tidak ada)
            mse.mse_name         AS effect_name,
            mse.mse_type         AS effect_type,
            mse.modifier_target  AS target_stat,
            mse.modifier_value   AS effect_value,
            mse.mse_duration     AS effect_duration,
            sse.effect_target    AS effect_target,
            mse.mse_id           AS mse_id
        FROM player_party_presets ppp
        JOIN player_inventories pi
            ON pi.inv_id IN (
                ppp.char_slot_1_inv_id,
                ppp.char_slot_2_inv_id,
                ppp.char_slot_3_inv_id
            )
        JOIN item_skills its
            ON pi.master_item_id = its.item_id AND its.item_type = 'Character'
        JOIN master_skills ms
            ON its.ms_id = ms.ms_id
        LEFT JOIN skill_status_effects sse
            ON ms.ms_id = sse.ms_id
        LEFT JOIN master_status_effects mse
            ON sse.mse_id = mse.mse_id
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?

        UNION ALL

        -- MC's Special Attack dari Senjata Utama di Grid
        SELECT
            pi_mc.inv_id,
            ms.ms_id,
            ms.ms_name           AS name,
            ms.ms_category       AS category,
            ms.ms_action_type    AS type,
            ms.ms_target_type    AS target_type,
            ms.ms_modifier_value AS modifier,
            ms.ms_cooldown       AS cooldown,
            ms.ms_element        AS element,
            ms.ms_icon_path      AS icon_path,
            ms.ms_vfx_path       AS vfx_path,
            mse.mse_name         AS effect_name,
            mse.mse_type         AS effect_type,
            mse.modifier_target  AS target_stat,
            mse.modifier_value   AS effect_value,
            mse.mse_duration     AS effect_duration,
            sse.effect_target    AS effect_target,
            mse.mse_id           AS mse_id
        FROM player_party_presets ppp
        JOIN player_inventories pi_mc
            ON ppp.main_char_inv_id = pi_mc.inv_id
        JOIN player_inventories pi_w1
            ON ppp.weap_grid_1_inv_id = pi_w1.inv_id
        JOIN master_weapons mw
            ON pi_w1.master_item_id = mw.mw_id AND pi_w1.item_type = 'Weapon'
        JOIN master_skills ms
            ON mw.mw_special_attack_id = ms.ms_id
        LEFT JOIN skill_status_effects sse
            ON ms.ms_id = sse.ms_id
        LEFT JOIN master_status_effects mse
            ON sse.mse_id = mse.mse_id
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?

        UNION ALL

        -- Special Attack Karakter Lain dari master_characters
        SELECT
            pi.inv_id,
            ms.ms_id,
            ms.ms_name           AS name,
            ms.ms_category       AS category,
            ms.ms_action_type    AS type,
            ms.ms_target_type    AS target_type,
            ms.ms_modifier_value AS modifier,
            ms.ms_cooldown       AS cooldown,
            ms.ms_element        AS element,
            ms.ms_icon_path      AS icon_path,
            ms.ms_vfx_path       AS vfx_path,
            mse.mse_name         AS effect_name,
            mse.mse_type         AS effect_type,
            mse.modifier_target  AS target_stat,
            mse.modifier_value   AS effect_value,
            mse.mse_duration     AS effect_duration,
            sse.effect_target    AS effect_target,
            mse.mse_id           AS mse_id
        FROM player_party_presets ppp
        JOIN player_inventories pi
            ON pi.inv_id IN (
                ppp.char_slot_1_inv_id,
                ppp.char_slot_2_inv_id,
                ppp.char_slot_3_inv_id
            )
        JOIN master_characters mc
            ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
        JOIN master_skills ms
            ON mc.mc_special_attack_id = ms.ms_id
        LEFT JOIN skill_status_effects sse
            ON ms.ms_id = sse.ms_id
        LEFT JOIN master_status_effects mse
            ON sse.mse_id = mse.mse_id
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?

        ORDER BY inv_id, ms_id, mse_id
        `;

        // =========================================================
        // QUERY 3: Ambil data musuh + AI Behavior + Status Effects
        //
        //   JOIN Chain:
        //     quest_enemies → master_monsters
        //     LEFT JOIN monster_ai_behavior (mai)
        //     LEFT JOIN master_skills (ms)
        //     LEFT JOIN skill_status_effects (sse)  ← one-to-many
        //     LEFT JOIN master_status_effects (mse) ← detail efek
        //
        //   Pengelompokan di Node.js: nested Map
        //     Level 1: mon_id       → data monster
        //     Level 2: mai_id       → satu entry AI behavior
        //     Level 3: mse_id array → status_effects dalam skill
        // =========================================================
        const queryMonsters = `
        SELECT
            mon.mon_id,
            mon.mon_name,
            mon.mon_element,
            mon.mon_base_hp,
            mon.mon_hp_growth,
            mon.mon_base_atk,
            mon.mon_atk_growth,
            mon.mon_base_def,
            mon.mon_def_growth,
            mon.mon_max_sa,
            mon.mon_icon_path,
            mon.mon_sprite_path,
            qe.monster_level,
            mai.mai_id,
            mai.boss_phase,
            mai.base_utility,
            mai.score_modifiers,
            ms.ms_id             AS skill_id,
            ms.ms_name           AS skill_name,
            ms.ms_category       AS skill_category,
            ms.ms_action_type    AS skill_type,
            ms.ms_target_type    AS skill_target_type,
            ms.ms_modifier_value AS skill_modifier,
            ms.ms_cooldown       AS skill_cooldown,
            ms.ms_icon_path      AS skill_icon_path,
            ms.ms_vfx_path       AS skill_vfx_path,
            -- Status Effect columns (NULL jika tidak ada)
            mse.mse_name         AS effect_name,
            mse.mse_type         AS effect_type,
            mse.modifier_target  AS target_stat,
            mse.modifier_value   AS effect_value,
            mse.mse_duration     AS effect_duration,
            sse.effect_target    AS effect_target
        FROM quest_enemies qe
        JOIN master_monsters mon
            ON qe.mon_id = mon.mon_id
        LEFT JOIN monster_ai_behavior mai
            ON mon.mon_id = mai.mon_id
        LEFT JOIN master_skills ms
            ON mai.ms_id = ms.ms_id
        LEFT JOIN skill_status_effects sse
            ON ms.ms_id = sse.ms_id
        LEFT JOIN master_status_effects mse
            ON sse.mse_id = mse.mse_id
        WHERE qe.mq_id = ?
        ORDER BY mon.mon_id, mai.mai_id, mse.mse_id
        `;

        const queryWeapons = `
        SELECT
            pi.inv_id,
            pi.item_level AS level,
            mw.mw_name AS name,
            mw.mw_element AS element,
            (mw.mw_base_hp + (mw.mw_hp_growth * (pi.item_level - 1))) AS calculated_hp,
            (mw.mw_base_atk + (mw.mw_atk_growth * (pi.item_level - 1))) AS calculated_atk,
            (CASE WHEN pi.inv_id = ppp.weap_grid_1_inv_id THEN 1 ELSE 0 END) AS is_main_weapon
        FROM player_party_presets ppp
        JOIN player_inventories pi ON pi.inv_id IN (
            ppp.weap_grid_1_inv_id,
            ppp.weap_grid_2_inv_id,
            ppp.weap_grid_3_inv_id,
            ppp.weap_grid_4_inv_id,
            ppp.weap_grid_5_inv_id
        )
        JOIN master_weapons mw ON pi.master_item_id = mw.mw_id AND pi.item_type = 'Weapon'
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?
        `;

        // =========================================================
        // QUERY 5: Ambil passive skill senjata dari grid
        //   JOIN Chain:
        //     player_party_presets → player_inventories → master_weapons
        //     → item_skills (Weapon) → master_skills
        //     → skill_weapon_modifiers
        //
        //   Menghasilkan total persentase bonus pasif per stat_target
        //   (ATK, HP, DEF, CRIT) dari seluruh senjata di grid.
        // =========================================================
        const queryWeaponPassives = `
        SELECT
            swm.stat_target,
            swm.element_condition,
            swm.modifier_value
        FROM player_party_presets ppp
        JOIN player_inventories pi ON pi.inv_id IN (
            ppp.weap_grid_1_inv_id,
            ppp.weap_grid_2_inv_id,
            ppp.weap_grid_3_inv_id,
            ppp.weap_grid_4_inv_id,
            ppp.weap_grid_5_inv_id
        )
        JOIN master_weapons mw ON pi.master_item_id = mw.mw_id AND pi.item_type = 'Weapon'
        JOIN item_skills its ON mw.mw_id = its.item_id AND its.item_type = 'Weapon'
        JOIN master_skills ms ON its.ms_id = ms.ms_id
        JOIN skill_weapon_modifiers swm ON ms.ms_id = swm.ms_id
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?
        `;

        // =========================================================
        // Jalankan semua query secara paralel (Promise.all)
        // =========================================================
        const [
            [charRows],
            [skillRows],
            [monsterRows],
            [weaponRows],
            [weaponPassiveRows]
        ] = await Promise.all([
            db.query(queryCharacters, [
                playerId, presetSlot,
                playerId, presetSlot,
                playerId, presetSlot,
                playerId, presetSlot
            ]),
            db.query(querySkills, [
                playerId, presetSlot,
                playerId, presetSlot,
                playerId, presetSlot,
                playerId, presetSlot
            ]),
            db.query(queryMonsters, [questId]),
            db.query(queryWeapons, [playerId, presetSlot]),
            db.query(queryWeaponPassives, [playerId, presetSlot])
        ]);

        // Validasi: minimal karakter MC harus ditemukan
        if (charRows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Party preset tidak ditemukan untuk player dan slot yang diberikan.'
            });
        }

        // =========================================================
        // PROCESSING: Grouping skill + status_effects dari skillRows
        //
        //   skillRows bisa punya baris duplikat per skill (akibat LEFT
        //   JOIN status effects). Kita kelompokkan menggunakan Map
        //   dengan composite key "inv_id:ms_id" agar unik per skill
        //   per karakter.
        // =========================================================
        // Map<"inv_id:ms_id", skillObject>
        const skillMap = new Map();

        skillRows.forEach(row => {
            const key = `${row.inv_id}:${row.ms_id}`;

            if (!skillMap.has(key)) {
                skillMap.set(key, {
                    _inv_id:     row.inv_id, // internal, dihapus saat di-render
                    id:          row.ms_id,
                    name:        row.name,
                    category:    row.category,
                    type:        row.type,
                    target_type: row.target_type,
                    modifier:    Number(row.modifier) || 0,
                    cooldown:    row.cooldown,
                    element:     row.element,
                    icon_path:   row.icon_path,
                    vfx_path:    row.vfx_path,
                    status_effects: []
                });
            }

            // Tambahkan efek status jika ada (effect_name tidak null)
            const effect = formatStatusEffect(row);
            if (effect) {
                skillMap.get(key).status_effects.push(effect);
            }
        });

        // =========================================================
        // PROCESSING: Kalkulasi Grid Senjata (Raw Stat)
        // =========================================================
        let totalGridHp = 0;
        let totalGridAtk = 0;
        (weaponRows || []).forEach(wp => {
            totalGridHp += Number(wp.calculated_hp) || 0;
            totalGridAtk += Number(wp.calculated_atk) || 0;
        });

        // =========================================================
        // Cari elemen dari senjata utama (Slot 1) untuk diwariskan ke karakter 'Any'
        const mainWeapon = (weaponRows || []).find(w => w.is_main_weapon === 1);
        const mainWeaponElement = mainWeapon ? mainWeapon.element : 'Fire';

        // =========================================================
        // PROCESSING: Mapping Karakter
        //   - Filter skill dari skillMap berdasarkan inv_id karakter
        //   - Hitung final stat: (base + gridSum) * (1 + passivePercent)
        //   - Hapus field internal _inv_id sebelum kirim ke response
        // =========================================================
        const characters = charRows.map(char => {
            const charSkills = Array.from(skillMap.values())
                .filter(s => s._inv_id === char.inv_id)
                .map(({ _inv_id, ...skill }) => skill); // buang _inv_id

            // Base stat setelah level growth + grid senjata
            const rawHp  = (Number(char.base_hp)  || 0) + totalGridHp;
            const rawAtk = (Number(char.base_atk) || 0) + totalGridAtk;
            const rawDef = Number(char.base_def)   || 500;

            // Karakter berelemen 'Any' (MC) mewarisi elemen Senjata Utama
            const charElement = char.element === 'Any' ? mainWeaponElement : char.element;

            // Kalkulasi Passive Bonus dari Weapon Skills per Karakter (sesuai Element)
            const personalPassive = { ATK: 0, HP: 0, DEF: 0, CRIT: 0 };
            (weaponPassiveRows || []).forEach(row => {
                const cond = (row.element_condition || 'Any').trim().toLowerCase();
                if (cond === 'any' || cond === charElement.toLowerCase()) {
                    const stat = row.stat_target; // 'ATK' | 'HP' | 'DEF' | 'CRIT'
                    if (personalPassive.hasOwnProperty(stat)) {
                        personalPassive[stat] += Number(row.modifier_value) || 0;
                    }
                }
            });

            return {
                slot:    char.role_slot,
                name:    char.name,
                element: charElement,
                level:   char.level,
                final_stats: {
                    hp:     Math.floor(rawHp  * (1 + personalPassive.HP)),
                    atk:    Math.floor(rawAtk * (1 + personalPassive.ATK)),
                    def:    Math.floor(rawDef * (1 + personalPassive.DEF)),
                    crit:   Number((0.1 + (personalPassive.CRIT || 0)).toFixed(4)),
                    max_sa: Number(char.max_sa)   || 100
                },
                portrait_path: char.portrait_path,
                sprite_path:   char.sprite_path,
                skills: charSkills
            };
        });

        // =========================================================
        // PROCESSING: Mapping Musuh + AI Behavior + Status Effects
        //
        //   Nested grouping:
        //     monsterMap[mon_id]             → data monster (unik)
        //     behaviorMap[mai_id]            → satu AI behavior entry
        //     behaviorMap[mai_id].skill
        //       .status_effects[]            → efek status per skill AI
        //
        //   Keamanan: guard `mai_id !== null` mencegah entry kosong
        //   akibat monster yang tidak punya AI behavior di DB.
        // =========================================================
        const monsterMap = {};    // { [mon_id]: monsterObject }
        const behaviorMap = {};   // { [mai_id]: behaviorObject } — lookup sementara

        monsterRows.forEach(row => {
            // --- Level 1: Monster ---
            if (!monsterMap[row.mon_id]) {
                monsterMap[row.mon_id] = {
                    id:      row.mon_id,
                    name:    row.mon_name,
                    element: row.mon_element,
                    level:   row.monster_level || 1,
                    // Kalkulasi stat musuh dinamis berdasarkan level & growth rate
                    final_stats: {
                        hp:  (Number(row.mon_base_hp)  || 0) + (Number(row.mon_hp_growth)  || 0) * ((row.monster_level || 1) - 1),
                        atk: (Number(row.mon_base_atk) || 0) + (Number(row.mon_atk_growth) || 0) * ((row.monster_level || 1) - 1),
                        def: (Number(row.mon_base_def)  || 0) + (Number(row.mon_def_growth) || 0) * ((row.monster_level || 1) - 1)
                    },
                    caMax:       Number(row.mon_max_sa) || 5,
                    icon_path:   row.mon_icon_path,
                    sprite_path: row.mon_sprite_path,
                    ai_behaviors: []
                };
            }

            // --- Level 2: AI Behavior (guard: mai_id & skill_id harus ada) ---
            if (row.mai_id !== null && row.skill_id !== null) {
                if (!behaviorMap[row.mai_id]) {
                    // Parse score_modifiers: kolom JSON MySQL bisa datang sebagai
                    // string atau object tergantung versi driver
                    let parsedModifiers = row.score_modifiers;
                    if (typeof parsedModifiers === 'string') {
                        try { parsedModifiers = JSON.parse(parsedModifiers); }
                        catch (e) { parsedModifiers = {}; }
                    }

                    const behaviorEntry = {
                        phase:        row.boss_phase   || 'Normal',
                        base_utility: Number(row.base_utility) || 1.0,
                        modifiers:    parsedModifiers  || {},
                        skill: {
                            id:       row.skill_id,
                            name:     row.skill_name,
                            category: row.skill_category,
                            type:     row.skill_type,
                            target_type: row.skill_target_type || 'Single_Enemy',
                            modifier: Number(row.skill_modifier) || 0,
                            cooldown: row.skill_cooldown,
                            icon_path: row.skill_icon_path,
                            vfx_path:  row.skill_vfx_path,
                            status_effects: []  // akan diisi di bawah
                        }
                    };

                    behaviorMap[row.mai_id] = behaviorEntry;
                    monsterMap[row.mon_id].ai_behaviors.push(behaviorEntry);
                }

                // --- Level 3: Status Effect pada Skill AI ---
                const effect = formatStatusEffect(row);
                if (effect) {
                    behaviorMap[row.mai_id].skill.status_effects.push(effect);
                }
            }
        });

        const enemies = Object.values(monsterMap);

        // Validasi: musuh harus ditemukan untuk quest yang diberikan
        if (enemies.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: `Tidak ada musuh yang ditemukan untuk questId: ${questId}`
            });
        }

        // Ambil jumlah Green Potion (mat_id = 6) dari player_materials
        const [materialRow] = await db.query(
            'SELECT quantity FROM player_materials WHERE player_id = ? AND mat_id = 6',
            [playerId]
        );
        const potionCount = materialRow[0] ? materialRow[0].quantity : 0;

        // =========================================================
        // RESPONSE AKHIR — Standar JSON sesuai GEMINI.md
        // =========================================================
        return res.status(200).json({
            status: 'success',
            message: 'Data arena pertarungan siap!',
            data: {
                quest_id: parseInt(questId),
                player_party: {
                    characters
                },
                enemies,
                potion_count: potionCount
            }
        });

    } catch (error) {
        console.error('[initBattle] Error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan pada server saat memuat data battle.',
            error_detail: error.message
        });
    }
};

exports.saveBattleResult = async (req, res) => {
    const { playerId, questId, potionsUsed } = req.body;

    if (!playerId || !questId) {
        return res.status(400).json({
            status: 'error',
            message: 'playerId dan questId wajib diisi!'
        });
    }

    // =========================================================
    // 2. Buka koneksi dari pool & mulai transaksi
    // =========================================================
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        // Kurangi green potion yang telah digunakan selama pertempuran
        if (potionsUsed && Number(potionsUsed) > 0) {
            await conn.query(
                'UPDATE player_materials SET quantity = GREATEST(0, quantity - ?) WHERE player_id = ? AND mat_id = 6',
                [Number(potionsUsed), playerId]
            );
        }

        // Ambil data stamina cost dari quest
        const [questRows] = await conn.query(
            'SELECT mq_stamina_cost FROM master_quests WHERE mq_id = ?',
            [questId]
        );
        const staminaCost = questRows[0] ? questRows[0].mq_stamina_cost : 10;

        // Ambil data stamina player
        const [playerRows] = await conn.query(
            'SELECT stamina FROM players WHERE player_id = ?',
            [playerId]
        );
        const playerStamina = playerRows[0] ? playerRows[0].stamina : 0;

        if (playerStamina < staminaCost) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({
                status: 'error',
                message: 'Stamina tidak cukup untuk menyelesaikan quest!'
            });
        }

        // Kurangi stamina player
        await conn.query(
            'UPDATE players SET stamina = GREATEST(0, stamina - ?) WHERE player_id = ?',
            [staminaCost, playerId]
        );
        const remainingStamina = Math.max(0, playerStamina - staminaCost);

        // =========================================================
        // 3. Ambil semua kemungkinan reward dari quest_rewards
        // =========================================================
        const [rewardRows] = await conn.query(
            'SELECT * FROM quest_rewards WHERE mq_id = ?',
            [questId]
        );

        if (rewardRows.length === 0) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({
                status: 'error',
                message: `Tidak ada reward yang ditemukan untuk questId: ${questId}`
            });
        }

        // =========================================================
        // 4. RNG Roll — tentukan item mana yang didapatkan
        // =========================================================
        const obtainedRaw = [];

        for (const reward of rewardRows) {
            const roll = Math.random();
            if (roll <= reward.drop_chance) {
                obtainedRaw.push(reward);
            }
        }

        // =========================================================
        // 5. Proses setiap reward yang didapatkan ke dalam DB
        // =========================================================
        const obtainedRewards = [];

        for (const item of obtainedRaw) {
            const type = item.reward_type; // 'Currency' | 'Material' | 'Weapon' | 'Character'

            // --- Currency ---
            if (type === 'Currency') {
                await conn.query(
                    'UPDATE players SET currency = currency + ? WHERE player_id = ?',
                    [item.quantity, playerId]
                );

                obtainedRewards.push({
                    reward_type:   'Currency',
                    reward_item_id: 0,
                    quantity:       item.quantity,
                    name:           'Gold',
                    description:    'Mata uang utama permainan.',
                    rarity:         null,
                    element:        null
                });
            }

            // --- Material ---
            else if (type === 'Material') {
                await conn.query(
                    `INSERT INTO player_materials (player_id, mat_id, quantity)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
                    [playerId, item.reward_item_id, item.quantity]
                );

                // Ambil detail dari master_materials
                const [matDetail] = await conn.query(
                    'SELECT mat_name AS name, mat_desc AS description FROM master_materials WHERE mat_id = ?',
                    [item.reward_item_id]
                );
                const detail = matDetail[0] || { name: 'Unknown Material', description: null };

                obtainedRewards.push({
                    reward_type:    'Material',
                    reward_item_id: item.reward_item_id,
                    quantity:       item.quantity,
                    name:           detail.name,
                    description:    detail.description,
                    rarity:         null,
                    element:        null
                });
            }

            // --- Weapon ---
            else if (type === 'Weapon') {
                await conn.query(
                    `INSERT INTO player_inventories
                        (player_id, master_item_id, item_type, item_level, limit_break_level, item_exp)
                     VALUES (?, ?, 'Weapon', 1, 0, 0)`,
                    [playerId, item.reward_item_id]
                );

                // Ambil detail dari master_weapons beserta unlocks_mc_id
                const [weapDetail] = await conn.query(
                    'SELECT mw_name AS name, mw_rarity AS rarity, mw_element AS element, unlocks_mc_id FROM master_weapons WHERE mw_id = ?',
                    [item.reward_item_id]
                );
                const detail = weapDetail[0] || { name: 'Unknown Weapon', rarity: null, element: null, unlocks_mc_id: null };

                obtainedRewards.push({
                    reward_type:    'Weapon',
                    reward_item_id: item.reward_item_id,
                    quantity:       item.quantity,
                    name:           detail.name,
                    description:    null,
                    rarity:         detail.rarity,
                    element:        detail.element
                });

                // Cek apakah senjata ini membuka karakter
                if (detail.unlocks_mc_id !== null) {
                    // Cek kepemilikan karakter tersebut
                    const [charExists] = await conn.query(
                        `SELECT inv_id FROM player_inventories
                         WHERE player_id = ? AND master_item_id = ? AND item_type = 'Character'`,
                        [playerId, detail.unlocks_mc_id]
                    );

                    if (charExists.length === 0) {
                        // Belum punya -> unlock karakternya!
                        await conn.query(
                            `INSERT INTO player_inventories
                                (player_id, master_item_id, item_type, item_level, limit_break_level, item_exp)
                             VALUES (?, ?, 'Character', 1, 0, 0)`,
                            [playerId, detail.unlocks_mc_id]
                        );

                        // Ambil detail karakter yang di-unlock
                        const [charDetail] = await conn.query(
                            'SELECT mc_name AS name, mc_rarity AS rarity, mc_element AS element FROM master_characters WHERE mc_id = ?',
                            [detail.unlocks_mc_id]
                        );
                        const cDetail = charDetail[0] || { name: 'Unknown Character', rarity: null, element: null };

                        obtainedRewards.push({
                            reward_type:    'Character',
                            reward_item_id: detail.unlocks_mc_id,
                            quantity:       1,
                            name:           cDetail.name,
                            description:    `Karakter terbuka via Senjata ${detail.name}!`,
                            rarity:         cDetail.rarity,
                            element:        cDetail.element
                        });
                    }
                }
            }

            // --- Character ---
            else if (type === 'Character') {
                // Cek apakah karakter sudah dimiliki
                const [exists] = await conn.query(
                    `SELECT inv_id FROM player_inventories
                     WHERE player_id = ? AND master_item_id = ? AND item_type = 'Character'`,
                    [playerId, item.reward_item_id]
                );

                let isDuplicate = false;
                if (exists.length === 0) {
                    await conn.query(
                        `INSERT INTO player_inventories
                            (player_id, master_item_id, item_type, item_level, limit_break_level, item_exp)
                         VALUES (?, ?, 'Character', 1, 0, 0)`,
                        [playerId, item.reward_item_id]
                    );
                } else {
                    isDuplicate = true;
                }

                // Ambil detail dari master_characters
                const [charDetail] = await conn.query(
                    'SELECT mc_name AS name, mc_rarity AS rarity, mc_element AS element FROM master_characters WHERE mc_id = ?',
                    [item.reward_item_id]
                );
                const detail = charDetail[0] || { name: 'Unknown Character', rarity: null, element: null };

                obtainedRewards.push({
                    reward_type:    'Character',
                    reward_item_id: item.reward_item_id,
                    quantity:       item.quantity,
                    name:           detail.name,
                    description:    isDuplicate ? 'Sudah dimiliki (duplikat)' : null,
                    rarity:         detail.rarity,
                    element:        detail.element
                });
            }
        }

        // =========================================================
        // 6. Commit transaksi
        // =========================================================
        await conn.commit();
        conn.release();

        // =========================================================
        // 7. Kirim response standar
        // =========================================================
        return res.status(200).json({
            status: 'success',
            message: 'Hasil battle berhasil diproses!',
            data: {
                obtained_rewards: obtainedRewards,
                remaining_stamina: remainingStamina
            }
        });

    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error('[saveBattleResult] Error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan pada server saat memproses hasil battle.',
            error_detail: error.message
        });
    }
};