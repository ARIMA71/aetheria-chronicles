const db = require('../config/db');
const GridCalculatorService = require('./GridCalculatorService');
const DamageCalculatorService = require('./DamageCalculatorService');
const AiBehaviorService = require('./AiBehaviorService');
const BattleMemoryStore = require('../cache/BattleMemoryStore');

// Helper formatting status effect from DB
function formatStatusEffect(row, prefix = '') {
    const name = row[`${prefix}effect_name`];
    if (!name) return null;
    return {
        effect_name: name,
        effect_type: row[`${prefix}effect_type`] || null,
        target_stat: row[`${prefix}target_stat`] || null,
        value: Number(row[`${prefix}effect_value`]) || 0,
        duration: row[`${prefix}effect_duration`] !== undefined ? row[`${prefix}effect_duration`] : null,
        effect_target: row[`${prefix}effect_target`] || null
    };
}

class BattleService {
    async initializeBattle(playerId, questId, presetSlot) {
        // [Query Logic extracted from BattleController]
        const queryCharacters = `
        SELECT 'Main Character' AS role_slot, pi.inv_id, pi.item_level AS level, mc.mc_id,
            mc.mc_name AS name, mc.mc_element AS element,
            (mc.mc_base_hp  + (mc.mc_hp_growth  * (pi.item_level - 1))) AS base_hp,
            (mc.mc_base_atk + (mc.mc_atk_growth * (pi.item_level - 1))) AS base_atk,
            (mc.mc_base_def + (mc.mc_def_growth * (pi.item_level - 1))) AS base_def,
            mc.mc_max_sa AS max_sa, mc.mc_portrait_path AS portrait_path, mc.mc_sprite_path AS sprite_path
        FROM player_party_presets ppp
        JOIN player_inventories pi ON ppp.main_char_inv_id = pi.inv_id
        JOIN master_characters mc ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?
        UNION ALL
        SELECT 'Char Slot 1', pi.inv_id, pi.item_level, mc.mc_id, mc.mc_name, mc.mc_element,
            (mc.mc_base_hp  + (mc.mc_hp_growth  * (pi.item_level - 1))),
            (mc.mc_base_atk + (mc.mc_atk_growth * (pi.item_level - 1))),
            (mc.mc_base_def + (mc.mc_def_growth * (pi.item_level - 1))),
            mc.mc_max_sa, mc.mc_portrait_path, mc.mc_sprite_path
        FROM player_party_presets ppp
        JOIN player_inventories pi ON ppp.char_slot_1_inv_id = pi.inv_id
        JOIN master_characters mc  ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?
        UNION ALL
        SELECT 'Char Slot 2', pi.inv_id, pi.item_level, mc.mc_id, mc.mc_name, mc.mc_element,
            (mc.mc_base_hp  + (mc.mc_hp_growth  * (pi.item_level - 1))),
            (mc.mc_base_atk + (mc.mc_atk_growth * (pi.item_level - 1))),
            (mc.mc_base_def + (mc.mc_def_growth * (pi.item_level - 1))),
            mc.mc_max_sa, mc.mc_portrait_path, mc.mc_sprite_path
        FROM player_party_presets ppp
        JOIN player_inventories pi ON ppp.char_slot_2_inv_id = pi.inv_id
        JOIN master_characters mc  ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?
        UNION ALL
        SELECT 'Char Slot 3', pi.inv_id, pi.item_level, mc.mc_id, mc.mc_name, mc.mc_element,
            (mc.mc_base_hp  + (mc.mc_hp_growth  * (pi.item_level - 1))),
            (mc.mc_base_atk + (mc.mc_atk_growth * (pi.item_level - 1))),
            (mc.mc_base_def + (mc.mc_def_growth * (pi.item_level - 1))),
            mc.mc_max_sa, mc.mc_portrait_path, mc.mc_sprite_path
        FROM player_party_presets ppp
        JOIN player_inventories pi ON ppp.char_slot_3_inv_id = pi.inv_id
        JOIN master_characters mc  ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?
        `;

        const querySkills = `
        SELECT pi.inv_id, ms.ms_id, ms.ms_name AS name, ms.ms_category AS category,
            ms.ms_action_type AS type, ms.ms_target_type AS target_type, ms.ms_modifier_value AS modifier,
            ms.ms_cooldown AS cooldown, ms.ms_element AS element, 
            ms.trigger_delay, ms.trigger_dispel, ms.trigger_heal_pct, ms.hp_cost_pct,
            ms.ms_icon_path AS icon_path, ms.ms_vfx_path AS vfx_path,
            mse.mse_name AS effect_name, mse.mse_type AS effect_type, mse.modifier_target AS target_stat,
            mse.modifier_value AS effect_value, mse.mse_duration AS effect_duration, sse.effect_target AS effect_target, mse.mse_id AS mse_id
        FROM player_party_presets ppp
        JOIN player_inventories pi ON ppp.main_char_inv_id = pi.inv_id
        JOIN player_mc_skills pmcs ON ppp.ppp_id = pmcs.ppp_id
        JOIN item_skills its_mc ON pmcs.ms_id = its_mc.ms_id AND its_mc.item_id = 1 AND its_mc.item_type = 'Character'
        JOIN master_skills ms ON pmcs.ms_id = ms.ms_id
        LEFT JOIN skill_status_effects sse ON ms.ms_id = sse.ms_id
        LEFT JOIN master_status_effects mse ON sse.mse_id = mse.mse_id
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?
          AND pi.item_level >= its_mc.unlock_level 
          AND pi.limit_break_level >= its_mc.unlock_limit_break
        UNION ALL
        SELECT pi.inv_id, ms.ms_id, ms.ms_name AS name, ms.ms_category AS category,
            ms.ms_action_type AS type, ms.ms_target_type AS target_type, ms.ms_modifier_value AS modifier,
            ms.ms_cooldown AS cooldown, ms.ms_element AS element,
            ms.trigger_delay, ms.trigger_dispel, ms.trigger_heal_pct, ms.hp_cost_pct,
            ms.ms_icon_path AS icon_path, ms.ms_vfx_path AS vfx_path,
            mse.mse_name AS effect_name, mse.mse_type AS effect_type, mse.modifier_target AS target_stat,
            mse.modifier_value AS effect_value, mse.mse_duration AS effect_duration, sse.effect_target AS effect_target, mse.mse_id AS mse_id
        FROM player_party_presets ppp
        JOIN player_inventories pi ON pi.inv_id IN (ppp.char_slot_1_inv_id, ppp.char_slot_2_inv_id, ppp.char_slot_3_inv_id)
        JOIN item_skills its ON pi.master_item_id = its.item_id AND its.item_type = 'Character'
        JOIN master_skills ms ON its.ms_id = ms.ms_id
        LEFT JOIN skill_status_effects sse ON ms.ms_id = sse.ms_id
        LEFT JOIN master_status_effects mse ON sse.mse_id = mse.mse_id
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?
          AND pi.item_level >= its.unlock_level 
          AND pi.limit_break_level >= its.unlock_limit_break
        UNION ALL
        SELECT pi_mc.inv_id, ms.ms_id, ms.ms_name AS name, ms.ms_category AS category,
            ms.ms_action_type AS type, ms.ms_target_type AS target_type, ms.ms_modifier_value AS modifier,
            ms.ms_cooldown AS cooldown, ms.ms_element AS element,
            ms.trigger_delay, ms.trigger_dispel, ms.trigger_heal_pct, ms.hp_cost_pct,
            ms.ms_icon_path AS icon_path, ms.ms_vfx_path AS vfx_path,
            mse.mse_name AS effect_name, mse.mse_type AS effect_type, mse.modifier_target AS target_stat,
            mse.modifier_value AS effect_value, mse.mse_duration AS effect_duration, sse.effect_target AS effect_target, mse.mse_id AS mse_id
        FROM player_party_presets ppp
        JOIN player_inventories pi_mc ON ppp.main_char_inv_id = pi_mc.inv_id
        JOIN player_inventories pi_w1 ON ppp.weap_grid_1_inv_id = pi_w1.inv_id
        JOIN master_weapons mw ON pi_w1.master_item_id = mw.mw_id AND pi_w1.item_type = 'Weapon'
        JOIN master_skills ms ON mw.mw_special_attack_id = ms.ms_id
        LEFT JOIN skill_status_effects sse ON ms.ms_id = sse.ms_id
        LEFT JOIN master_status_effects mse ON sse.mse_id = mse.mse_id
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?
        UNION ALL
        SELECT pi.inv_id, ms.ms_id, ms.ms_name AS name, ms.ms_category AS category,
            ms.ms_action_type AS type, ms.ms_target_type AS target_type, ms.ms_modifier_value AS modifier,
            ms.ms_cooldown AS cooldown, ms.ms_element AS element,
            ms.trigger_delay, ms.trigger_dispel, ms.trigger_heal_pct, ms.hp_cost_pct,
            ms.ms_icon_path AS icon_path, ms.ms_vfx_path AS vfx_path,
            mse.mse_name AS effect_name, mse.mse_type AS effect_type, mse.modifier_target AS target_stat,
            mse.modifier_value AS effect_value, mse.mse_duration AS effect_duration, sse.effect_target AS effect_target, mse.mse_id AS mse_id
        FROM player_party_presets ppp
        JOIN player_inventories pi ON pi.inv_id IN (ppp.char_slot_1_inv_id, ppp.char_slot_2_inv_id, ppp.char_slot_3_inv_id)
        JOIN master_characters mc ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
        JOIN master_skills ms ON mc.mc_special_attack_id = ms.ms_id
        LEFT JOIN skill_status_effects sse ON ms.ms_id = sse.ms_id
        LEFT JOIN master_status_effects mse ON sse.mse_id = mse.mse_id
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?
        ORDER BY inv_id, ms_id, mse_id
        `;

        const queryMonsters = `
        SELECT mon.mon_id, mon.mon_name, mon.mon_type, mon.mon_element, mon.mon_base_hp, mon.mon_hp_growth,
            mon.mon_base_atk, mon.mon_atk_growth, mon.mon_base_def, mon.mon_def_growth, mon.mon_max_ca,
            mon.mon_icon_path, mon.mon_sprite_path, qe.monster_level, qe.wave_num, qe.override_element,
            mb.mb_id, mb.boss_phase, mb.base_utility, mb.score_modifiers,
            ms.ms_id AS skill_id, ms.ms_name AS skill_name, ms.ms_category AS skill_category, ms.ms_element AS skill_element,
            ms.ms_action_type AS skill_type, ms.ms_target_type AS skill_target_type, ms.ms_modifier_value AS skill_modifier,
            ms.ms_cooldown AS skill_cooldown, ms.ms_icon_path AS skill_icon_path, ms.ms_vfx_path AS skill_vfx_path,
            ms.trigger_delay AS skill_trigger_delay, ms.trigger_dispel AS skill_trigger_dispel, 
            ms.trigger_heal_pct AS skill_trigger_heal_pct, ms.hp_cost_pct AS skill_hp_cost_pct,
            mse.mse_name AS effect_name, mse.mse_type AS effect_type, mse.modifier_target AS target_stat,
            mse.modifier_value AS effect_value, mse.mse_duration AS effect_duration, sse.effect_target AS effect_target
        FROM quest_enemies qe
        JOIN master_monsters mon ON qe.mon_id = mon.mon_id
        LEFT JOIN monster_behavior mb ON mon.mon_id = mb.mon_id
        LEFT JOIN master_skills ms ON mb.ms_id = ms.ms_id
        LEFT JOIN skill_status_effects sse ON ms.ms_id = sse.ms_id
        LEFT JOIN master_status_effects mse ON sse.mse_id = mse.mse_id
        WHERE qe.mq_id = ?
        ORDER BY qe.wave_num, mon.mon_id, mb.mb_id, mse.mse_id
        `;

        const queryWeapons = `
        SELECT pi.inv_id, pi.item_level AS level, mw.mw_name AS name, mw.mw_element AS element,
            (mw.mw_base_hp + (mw.mw_hp_growth * (pi.item_level - 1))) AS calculated_hp,
            (mw.mw_base_atk + (mw.mw_atk_growth * (pi.item_level - 1))) AS calculated_atk,
            (CASE WHEN pi.inv_id = ppp.weap_grid_1_inv_id THEN 1 ELSE 0 END) AS is_main_weapon
        FROM player_party_presets ppp
        JOIN player_inventories pi ON pi.inv_id IN (
            ppp.weap_grid_1_inv_id, ppp.weap_grid_2_inv_id, ppp.weap_grid_3_inv_id, ppp.weap_grid_4_inv_id, ppp.weap_grid_5_inv_id
        )
        JOIN master_weapons mw ON pi.master_item_id = mw.mw_id AND pi.item_type = 'Weapon'
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?
        `;

        const queryWeaponPassives = `
        SELECT swm.stat_target, swm.element_condition, swm.modifier_value
        FROM player_party_presets ppp
        JOIN player_inventories pi ON pi.inv_id IN (
            ppp.weap_grid_1_inv_id, ppp.weap_grid_2_inv_id, ppp.weap_grid_3_inv_id, ppp.weap_grid_4_inv_id, ppp.weap_grid_5_inv_id
        )
        JOIN master_weapons mw ON pi.master_item_id = mw.mw_id AND pi.item_type = 'Weapon'
        JOIN item_skills its ON mw.mw_id = its.item_id AND its.item_type = 'Weapon'
        JOIN master_skills ms ON its.ms_id = ms.ms_id
        JOIN skill_weapon_modifiers swm ON ms.ms_id = swm.ms_id
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?
        `;

        const [
            [charRows], [skillRows], [monsterRows], [weaponRows], [weaponPassiveRows], [playerRows]
        ] = await Promise.all([
            db.query(queryCharacters, [playerId, presetSlot, playerId, presetSlot, playerId, presetSlot, playerId, presetSlot]),
            db.query(querySkills, [playerId, presetSlot, playerId, presetSlot, playerId, presetSlot, playerId, presetSlot]),
            db.query(queryMonsters, [questId]),
            db.query(queryWeapons, [playerId, presetSlot]),
            db.query(queryWeaponPassives, [playerId, presetSlot]),
            db.query('SELECT username, gender FROM players WHERE player_id = ?', [playerId])
        ]);

        if (charRows.length === 0) throw new Error('Party preset tidak ditemukan untuk player dan slot yang diberikan.');

        const playerInfo = playerRows && playerRows[0] ? playerRows[0] : { username: 'Main Character', gender: 'Male' };
        const username = playerInfo.username;
        const genderSuffix = (playerInfo.gender || 'Male').toLowerCase(); // 'male' or 'female'

        charRows.forEach(row => {
            if (row.role_slot === 'Main Character' || row.mc_id === 1) {
                row.name = username;
                if (row.portrait_path) row.portrait_path += `-${genderSuffix}`;
                if (row.sprite_path) row.sprite_path += `-${genderSuffix}`;
            }
        });

        // Group Skills
        const skillMap = new Map();
        skillRows.forEach(row => {
            const key = `${row.inv_id}:${row.ms_id}`;
            if (!skillMap.has(key)) {
                skillMap.set(key, {
                    _inv_id: row.inv_id, id: row.ms_id, name: row.name, category: row.category,
                    type: row.type, target_type: row.target_type, modifier: Number(row.modifier) || 0,
                    cooldown: row.cooldown, element: row.element,
                    trigger_delay: Boolean(row.trigger_delay), trigger_dispel: Boolean(row.trigger_dispel),
                    trigger_heal_pct: Number(row.trigger_heal_pct) || 0, hp_cost_pct: Number(row.hp_cost_pct) || 0,
                    icon_path: row.icon_path, vfx_path: row.vfx_path,
                    status_effects: []
                });
            }
            const effect = formatStatusEffect(row);
            if (effect) skillMap.get(key).status_effects.push(effect);
        });

        // Delegate stats calculation
        const baseStatsMap = GridCalculatorService.calculatePartyBaseStats(charRows, weaponRows, weaponPassiveRows);

        // Map Characters payload
        const characters = charRows.map(char => {
            const stats = baseStatsMap[char.inv_id];

            const charSkills = Array.from(skillMap.values())
                .filter(s => s._inv_id === char.inv_id)
                .map(({ _inv_id, ...skill }) => {
                    skill.current_cooldown = 0;
                    return skill;
                });

            let charPortrait = char.portrait_path;
            if (charPortrait && !charPortrait.endsWith('.png')) charPortrait += '.png';
            
            let charSprite = char.sprite_path;
            if (charSprite && !charSprite.endsWith('.png')) charSprite += '.png';

            let fullPortrait = null;
            if (charPortrait) {
                fullPortrait = charPortrait.replace('.png', '-full.png');
            }

            return {
                slot:    char.role_slot,
                mc_id:   char.mc_id,
                name:    char.name,
                element: stats.element,
                level:   char.level,
                final_stats: {
                    hp:     stats.final_hp,
                    atk:    stats.final_atk,
                    def:    stats.final_def,
                    crit:   stats.final_crit,
                    max_sa: stats.max_sa
                },
                current_hp: stats.final_hp,
                current_sa: 0,
                active_buffs: [],
                portrait_path: charPortrait,
                full_portrait_path: fullPortrait,
                sprite_path:   charSprite,
                skills: charSkills
            };
        });

        // Map Enemies per Wave
        const wavesMap = {};
        const behaviorMap = {};
        monsterRows.forEach(row => {
            const waveNum = row.wave_num || 1;
            if (!wavesMap[waveNum]) {
                wavesMap[waveNum] = {};
            }
            const monsterMap = wavesMap[waveNum];

            // Use a unique key combining mon_id and a potential instance identifier if multiple identical monsters exist.
            // Since quest_enemies might have multiple of same mon_id in same wave, let's group by mon_id.
            // Wait, what if there are 2 slimes in wave 1? The SQL query joins master_monsters, so it will return duplicates?
            // Actually, in quest_enemies, we don't have unique IDs per monster spawn yet. Let's just create an instance for each row?
            // Since the query groups them by mon_id, if there are two (1,1,1,1) rows, they will appear twice.
            // But behaviorMap relies on mon_id. For now, let's keep it simple: index them by array push.
            // Actually, let's just build it like before, but inside wavesMap.
            
            // To ensure uniqueness if multiple same monsters exist, let's generate a unique string key per row object or rely on mon_id.
            // Since the current code just uses mon_id as key, it would merge 2 slimes into 1 slime.
            // To support multiple slimes, we should create a unique enemy instance for each `quest_enemies` entry.
            // But wait, the query does `JOIN master_monsters`, so if there are 2 rows in quest_enemies, we get duplicate master_monsters.
            // If we use `mon_id` as key, they merge.
            // For now, let's stick to merging by mon_id per wave (meaning only 1 slime per wave).
            // To have multiple, they'd need different mon_id or we refactor enemy mapping. I will just stick to the existing behavior: 1 mon_id = 1 enemy per wave.
            
            if (!monsterMap[row.mon_id]) {
                const finalHp = (Number(row.mon_base_hp) || 0) + (Number(row.mon_hp_growth) || 0) * ((row.monster_level || 1) - 1);
                
                // Override element if provided
                const element = row.override_element || row.mon_element;
                
                // Suffix Element for Monster Sprite (e.g. -fire, -wind, -earth)
                let monsterSprite = row.mon_sprite_path;
                if (monsterSprite) {
                    if (element && element.toLowerCase() !== 'none' && element.toLowerCase() !== 'any') {
                        const elSuffix = element.toLowerCase();
                        if (monsterSprite.endsWith('.png')) {
                            monsterSprite = monsterSprite.replace('.png', `-${elSuffix}.png`);
                        } else {
                            monsterSprite = monsterSprite + `-${elSuffix}.png`;
                        }
                    } else if (!monsterSprite.endsWith('.png')) {
                        monsterSprite += '.png';
                    }
                }

                monsterMap[row.mon_id] = {
                    id: row.mon_id, name: row.mon_name, element: element, level: row.monster_level || 1,
                    is_boss: (row.mon_type === 'Boss'),
                    final_stats: {
                        hp: finalHp,
                        atk: (Number(row.mon_base_atk) || 0) + (Number(row.mon_atk_growth) || 0) * ((row.monster_level || 1) - 1),
                        def: (Number(row.mon_base_def) || 0) + (Number(row.mon_def_growth) || 0) * ((row.monster_level || 1) - 1)
                    },
                    current_hp: finalHp,
                    current_ca: 0,
                    mode_state: 'normal',
                    mode_bar: 0,
                    active_buffs: [],
                    caMax: Number(row.mon_max_ca) || 5, icon_path: row.mon_icon_path, sprite_path: monsterSprite,
                    ai_behaviors: []
                };
            }

            if (row.mb_id !== null && row.skill_id !== null) {
                if (!behaviorMap[row.mb_id]) {
                    let parsedModifiers = row.score_modifiers;
                    if (typeof parsedModifiers === 'string') {
                        try { parsedModifiers = JSON.parse(parsedModifiers); } catch (e) { parsedModifiers = {}; }
                    }

                    // Inherit override element for neutral/any skills or if it matches the monster's base element
                    let skillElement = row.skill_element;
                    if (row.override_element && (skillElement === 'Any' || skillElement === 'Neutral' || skillElement === row.mon_element)) {
                        skillElement = row.override_element;
                    }

                    const behaviorEntry = {
                        phase: row.boss_phase || 'Normal', base_utility: Number(row.base_utility) || 1.0,
                        modifiers: parsedModifiers || {},
                        skill: {
                            id: row.skill_id, name: row.skill_name, category: row.skill_category,
                            type: row.skill_type, target_type: row.skill_target_type || 'Single_Enemy',
                            modifier: Number(row.skill_modifier) || 0, cooldown: row.skill_cooldown,
                            element: skillElement,
                            current_cooldown: 0,
                            trigger_delay: Boolean(row.skill_trigger_delay), trigger_dispel: Boolean(row.skill_trigger_dispel),
                            trigger_heal_pct: Number(row.skill_trigger_heal_pct) || 0, hp_cost_pct: Number(row.skill_hp_cost_pct) || 0,
                            icon_path: row.skill_icon_path, vfx_path: row.skill_vfx_path, status_effects: []
                        }
                    };
                    behaviorMap[row.mb_id] = behaviorEntry;
                    wavesMap[row.wave_num || 1][row.mon_id].ai_behaviors.push(behaviorEntry);
                }
                const effect = formatStatusEffect(row);
                if (effect) behaviorMap[row.mb_id].skill.status_effects.push(effect);
            }
        });
        
        // Convert map to sorted array of waves
        const waveKeys = Object.keys(wavesMap).sort((a,b) => Number(a) - Number(b));
        const waves = waveKeys.map(k => Object.values(wavesMap[k]));
        
        if (waves.length === 0) throw new Error(`Tidak ada musuh yang ditemukan untuk questId: ${questId}`);
        const enemies = waves[0]; // Set first wave as current enemies

        // Potion Count (mat_id 6: Green Potion, mat_id 7: Full Potion)
        const [materialRow] = await db.query('SELECT mat_id, quantity FROM player_materials WHERE player_id = ? AND mat_id IN (6, 7)', [playerId]);
        let potionCount = 0;
        let fullPotionCount = 0;
        materialRow.forEach(mat => {
            if (mat.mat_id === 6) potionCount = mat.quantity;
            if (mat.mat_id === 7) fullPotionCount = mat.quantity;
        });

        // Construct Initial State
        const initialState = {
            quest_id: parseInt(questId),
            player_party: { characters },
            enemies: enemies,
            waves: waves,
            current_wave_index: 0,
            defeated_enemies: [],
            potion_count: potionCount,
            full_potion_count: fullPotionCount,
            heals_remaining: Math.min(3, potionCount),
            potions_used: 0,
            current_turn: 1
        };

        // [FASE 1: DISABLE DOUBLE INIT CHECK]
        // Guard: cegah double-init jika sudah ada sesi ACTIVE (Disabled for debugging forced refresh)
        /*
        const [existingActive] = await db.query(
            'SELECT bs_id FROM battle_sessions WHERE player_id = ? AND bs_status = \'ACTIVE\' LIMIT 1',
            [playerId]
        );
        if (existingActive.length > 0) {
            throw new Error('ACTIVE_SESSION_EXISTS: Pemain masih memiliki pertempuran aktif (bs_id: ' + existingActive[0].bs_id + '). Selesaikan dulu sebelum memulai yang baru.');
        }
        */

        // Create Database Anchor Record with status tracking
        const [insertRes] = await db.query(
            'INSERT INTO battle_sessions (player_id, mq_id, bs_status, started_at, remaining_time, battle_state_json) VALUES (?, ?, \'ACTIVE\', NOW(), 2700, ?)',
            [playerId, questId, JSON.stringify(initialState)]
        );
        const bsId = insertRes.insertId;

        // Append bs_id to state
        initialState.bs_id = bsId;

        // Store in RAM Cache (BattleMemoryStore)
        BattleMemoryStore.set(bsId, initialState);

        return initialState;
    }

    /**
     * Updates the session anchor with the latest state from the client,
     * then uses AiBehaviorService to compute the boss action.
     */
    async getAiDecision(bsId, battleStateSnapshot, bossSkills) {
        // 1. Pulihkan ai_behaviors asli dari server-side cache karena payload client sudah di-scrub
        let originalState = BattleMemoryStore.get(bsId);
        if (!originalState) {
            // RAM Cache miss (biasanya karena server restart/nodemon). Tarik dari DB.
            const [rows] = await db.query('SELECT battle_state_json FROM battle_sessions WHERE bs_id = ?', [bsId]);
            if (rows.length > 0 && rows[0].battle_state_json) {
                try { originalState = JSON.parse(rows[0].battle_state_json); } catch (e) { }
            }
        }

        // 2. Server Authority: BANGUN ULANG bossSkills murni dari data Server (Abaikan data Client)
        let trueBossSkills = [];
        if (originalState && originalState.enemies && originalState.enemies.length > 0) {
            trueBossSkills = (originalState.enemies[0].ai_behaviors || []).map(b => ({
                id: b.skill.id,
                phase: b.phase,
                base_utility: b.base_utility,
                score_modifiers: b.modifiers,
                skill: b.skill
            }));
        }

        // 3. JANGAN overwrite BattleMemoryStore dengan battleStateSnapshot dari client!
        // battleStateSnapshot HANYA berisi `{ boss, player_party }`, BUKAN full state!
        // Gunakan snapshot ini SECARA LANGSUNG untuk kalkulasi AI di turn ini.
        const selectedSkill = AiBehaviorService.calculateBossAction(battleStateSnapshot, trueBossSkills);
        return selectedSkill;
    }

    async finalizeBattle(bsId) {
        // Get the final state from RAM if we want to log it
        const finalState = BattleMemoryStore.get(bsId);

        // Mark database session as COMPLETED
        await db.query(
            'UPDATE battle_sessions SET bs_status = \'COMPLETED\', battle_state_json = ? WHERE bs_id = ?',
            [JSON.stringify(finalState || { status: "CLEARED" }), bsId]
        );

        // Remove from RAM
        BattleMemoryStore.delete(bsId);
    }

    /**
     * Cek apakah player punya battle session ACTIVE.
     * Hitung remaining_time berdasarkan elapsed dari started_at.
     * Jika waktu sudah habis, lazy-update ke FAILED.
     */
    async getActiveSession(playerId) {
        const [rows] = await db.query(
            'SELECT bs_id, mq_id, remaining_time, started_at, battle_state_json FROM battle_sessions WHERE player_id = ? AND bs_status = \'ACTIVE\' ORDER BY bs_id DESC LIMIT 1',
            [playerId]
        );
        if (rows.length === 0) return null;

        const session = rows[0];
        const now = Date.now();
        const startedAt = new Date(session.started_at).getTime();
        const elapsedSec = Math.floor((now - startedAt) / 1000);
        const adjustedRemaining = Math.max(0, 2700 - elapsedSec);

        // Jika waktu sudah habis, lazy-update ke FAILED
        if (adjustedRemaining <= 0) {
            await db.query(
                'UPDATE battle_sessions SET bs_status = \'FAILED\', remaining_time = 0 WHERE bs_id = ?',
                [session.bs_id]
            );
            BattleMemoryStore.delete(session.bs_id);
            return null;
        }

        let clientState = null;
        try {
            clientState = JSON.parse(session.battle_state_json);
            clientState = await this.rehydrateStateAssets(clientState, playerId);
        } catch (e) {
            clientState = JSON.parse(session.battle_state_json);
        }

        return {
            bs_id: session.bs_id,
            mq_id: session.mq_id,
            remaining_time: adjustedRemaining,
            battle_state_json: JSON.stringify(clientState)
        };
    }

    /**
     * Live Asset Re-Hydration:
     * Menyegarkan kembali path aset statis (portrait_path, full_portrait_path, sprite_path)
     * dari tabel master secara live pada saat sesi pertarungan dipulihkan (resume).
     * Mencegah data visual basi (stale assets) sekaligus menjaga keutuhan State Pertarungan (HP, Turn, Cooldown).
     */
    async rehydrateStateAssets(state, playerId) {
        if (!state) return state;

        try {
            // 1. Fetch Player Gender untuk suffix MC
            const [playerRows] = await db.query('SELECT gender FROM players WHERE player_id = ?', [playerId]);
            const genderSuffix = (playerRows && playerRows[0] && playerRows[0].gender ? playerRows[0].gender : 'Male').toLowerCase();

            // 2. Rehydrate Karakter (Party)
            if (state.player_party && Array.isArray(state.player_party.characters)) {
                const mcIds = state.player_party.characters.map(c => c.mc_id || c.id).filter(Boolean);
                if (mcIds.length > 0) {
                    const [charMaster] = await db.query(
                        'SELECT mc_id, mc_portrait_path, mc_sprite_path FROM master_characters WHERE mc_id IN (?)',
                        [mcIds]
                    );
                    const charMap = new Map();
                    charMaster.forEach(m => charMap.set(m.mc_id, m));

                    state.player_party.characters.forEach(c => {
                        const mcId = c.mc_id || c.id;
                        const master = charMap.get(mcId);
                        if (master) {
                            let pPath = master.mc_portrait_path;
                            let sPath = master.mc_sprite_path;

                            if (c.slot === 'Main Character' || mcId === 1) {
                                if (pPath) pPath += `-${genderSuffix}`;
                                if (sPath) sPath += `-${genderSuffix}`;
                            }

                            if (pPath && !pPath.endsWith('.png')) pPath += '.png';
                            if (sPath && !sPath.endsWith('.png')) sPath += '.png';

                            c.portrait_path = pPath;
                            c.full_portrait_path = pPath ? pPath.replace('.png', '-full.png') : null;
                            c.sprite_path = sPath;
                        }
                    });
                }
            }

            // 3. Rehydrate Musuh (Monsters)
            if (Array.isArray(state.enemies)) {
                const monIds = state.enemies.map(e => e.id || e.monster_id).filter(Boolean);
                if (monIds.length > 0) {
                    const [monMaster] = await db.query(
                        'SELECT mon_id, mon_sprite_path, mon_element FROM master_monsters WHERE mon_id IN (?)',
                        [monIds]
                    );
                    const monMap = new Map();
                    monMaster.forEach(m => monMap.set(m.mon_id, m));

                    state.enemies.forEach(e => {
                        const monId = e.id || e.monster_id;
                        const master = monMap.get(monId);
                        if (master) {
                            const element = e.element || master.mon_element;
                            let mSprite = master.mon_sprite_path;
                            if (mSprite) {
                                if (element && element.toLowerCase() !== 'none' && element.toLowerCase() !== 'any') {
                                    const elSuffix = element.toLowerCase();
                                    if (mSprite.endsWith('.png')) {
                                        mSprite = mSprite.replace('.png', `-${elSuffix}.png`);
                                    } else {
                                        mSprite = mSprite + `-${elSuffix}.png`;
                                    }
                                } else if (!mSprite.endsWith('.png')) {
                                    mSprite += '.png';
                                }
                            }
                            e.sprite_path = mSprite;
                        }
                    });
                }
            }
        } catch (err) {
            console.error('[rehydrateStateAssets] Error rehydrating session assets:', err.message);
        }

        return state;
    }

    /**
     * Process a batch of character actions (Tactical Command Queue) server-side.
     * Iterates through character_actions array (Slot 0 -> 1 -> 2 -> 3):
     * - Validates target HP. If target is dead, auto-retargets to an alive enemy in the wave.
     * - If ALL enemies in the wave/battle die early, STOPS BATCH ITERATION for remaining characters.
     * - Unexecuted character skills/SA are NOT put on cooldown / NOT consumed.
     * - Resolves cooldown decrements, DoT damage, and Enemy AI counter-attack at turn end.
     */
    async processTurnBatch(bsId, batchData) {
        let state = BattleMemoryStore.get(bsId);
        if (!state) {
            const [rows] = await db.query('SELECT battle_state_json FROM battle_sessions WHERE bs_id = ?', [bsId]);
            if (rows.length > 0 && rows[0].battle_state_json) {
                try { state = JSON.parse(rows[0].battle_state_json); } catch (e) { }
            }
        }

        if (!state) throw new Error('Battle session not found or expired');
        if (state.is_processing) {
            throw new Error('RACE_CONDITION: Action is already being processed');
        }
        state.is_processing = true;

        try {
            const events = [];
            const characterActions = batchData.character_actions || [];
            const executedSkillsThisTurn = new Set();
            
            // Helper function to resolve targets based on ms_target_type
            const resolveTargets = (sourceEntity, targetType, targetIndex, isEnemySource = false) => {
                const aliveEnemies = (state.enemies || []).filter(e => (e.current_hp !== undefined ? e.current_hp : e.hp) > 0);
                const aliveParty = (state.player_party.characters || []).filter(c => (c.current_hp !== undefined ? c.current_hp : c.hp) > 0);
                
                if (targetType === 'Self') {
                    return [{ entity: sourceEntity, type: isEnemySource ? 'enemy' : 'player', index: isEnemySource ? state.enemies.indexOf(sourceEntity) : -1 }];
                } else if (targetType === 'All_Enemies') {
                    return isEnemySource 
                        ? aliveParty.map(p => ({ entity: p, type: 'player', index: -1 })) 
                        : aliveEnemies.map(e => ({ entity: e, type: 'enemy', index: state.enemies.indexOf(e) }));
                } else if (targetType === 'All_Allies') {
                    return isEnemySource 
                        ? aliveEnemies.map(e => ({ entity: e, type: 'enemy', index: state.enemies.indexOf(e) }))
                        : aliveParty.map(p => ({ entity: p, type: 'player', index: -1 }));
                } else if (targetType === 'Single_Ally') {
                    if (isEnemySource) {
                        const tgt = aliveEnemies[targetIndex] || aliveEnemies[0];
                        return tgt ? [{ entity: tgt, type: 'enemy', index: state.enemies.indexOf(tgt) }] : [];
                    } else {
                        const tgt = aliveParty[targetIndex] || aliveParty[0];
                        return tgt ? [{ entity: tgt, type: 'player', index: -1 }] : [];
                    }
                } else { // Single_Enemy (Default)
                    if (isEnemySource) {
                        const tgt = aliveParty[targetIndex] || aliveParty[0];
                        return tgt ? [{ entity: tgt, type: 'player', index: -1 }] : [];
                    } else {
                        let tgt = (state.enemies || [])[targetIndex];
                        if (!tgt || (tgt.current_hp !== undefined ? tgt.current_hp : tgt.hp) <= 0) {
                            tgt = aliveEnemies[0];
                        }
                        return tgt ? [{ entity: tgt, type: 'enemy', index: state.enemies.indexOf(tgt) }] : [];
                    }
                }
            };

            const getEntityId = (targetObj) => {
                if (targetObj.type === 'enemy') return `enemy_${Math.max(0, targetObj.index)}`;
                return targetObj.entity.slot || targetObj.entity.id || 'mc';
            };

            // ==========================================
            // PHASE 1: PLAYER PHASE
            // ==========================================
            let waveCleared = false;
            for (const actionInfo of characterActions) {
                const { slot, action_type, skill_id, target_index } = actionInfo;
                if (!action_type || action_type === 'none') continue;

                const character = (state.player_party.characters || []).find(
                    c => c.slot === slot || c.id === slot || c.inv_id == slot || c.mc_id == slot
                );

                if (!character || (character.current_hp !== undefined ? character.current_hp : character.hp) <= 0) {
                    continue;
                }

                // Stun Check (Hanya disable aksi, JANGAN tick durasi di sini!)
                const isStunned = (character.active_buffs || []).some(b =>
                    (b.target_stat || '').toUpperCase() === 'STUN' ||
                    (b.effect_name || '').toUpperCase().includes('STUN')
                );
                if (isStunned) {
                    events.push({
                        type: 'stun_skip',
                        sourceId: character.slot || character.id || 'mc',
                        targetId: character.slot || character.id || 'mc',
                        skillName: 'STUNNED',
                        value: 0
                    });
                    continue; 
                }

                const sourceEntityId = character.slot || character.id || 'mc';

                // Evaluate Action Type
                let skillObj = null;
                if (action_type === 'basic_attack') {
                    skillObj = { name: 'Basic Attack', type: 'Damage', target_type: 'Single_Enemy', modifier: 1.0, element: character.element, status_effects: [] };
                } else if (action_type === 'special_attack') {
                    if ((character.current_sa || 0) < 100) continue; 
                    character.current_sa = 0; // Consume SA
                    state.aether_gauge = Math.min(100, (state.aether_gauge || 0) + 20); // +20% Aether
                    skillObj = (character.skills || []).find(s => (s.category || '').toLowerCase() === 'special') || {
                        name: 'Special Attack', type: 'Damage', target_type: 'Single_Enemy', modifier: 3.5, element: character.element, status_effects: []
                    };
                } else if (action_type === 'skill') {
                    const foundSkill = (character.skills || []).find(s => s.id == skill_id);
                    if (!foundSkill || (foundSkill.current_cooldown && foundSkill.current_cooldown > 0)) continue;
                    skillObj = foundSkill;
                    skillObj.current_cooldown = skillObj.cooldown || 0; // Set Cooldown
                    executedSkillsThisTurn.add(`${character.inv_id || character.slot}_${skillObj.id}`);
                }

                if (!skillObj) continue;

                // Execute Action based on ms_target_type
                const targets = resolveTargets(character, skillObj.target_type || 'Single_Enemy', target_index || 0, false);
                const sType = (skillObj.type || skillObj.action_type || '').toLowerCase(); // Note: DB mapping is 'type'
                
                // Track if SA gain was applied for basic attacks (so AoE basic doesn't give +20% per hit)
                let saGained = false;

                for (const tgtObj of targets) {
                    const targetEntity = tgtObj.entity;
                    const targetEntityId = getEntityId(tgtObj);

                    if (sType === 'damage') {
                        const calcResult = DamageCalculatorService.calculateDamage(character, targetEntity, skillObj);
                        targetEntity.current_hp = Math.max(0, (targetEntity.current_hp !== undefined ? targetEntity.current_hp : targetEntity.final_stats.hp) - calcResult.damage);

                        if (action_type === 'basic_attack' && !saGained) {
                            character.current_sa = Math.min(100, (character.current_sa || 0) + 20);
                            saGained = true;
                        }

                        if (targetEntity.is_boss) {
                            const threshold = (targetEntity.final_stats.hp || targetEntity.max_hp) * 0.20;
                            const currentState = targetEntity.mode_state || 'normal';

                            if (currentState === 'normal') {
                                targetEntity.mode_bar = (targetEntity.mode_bar !== undefined ? targetEntity.mode_bar : 0) + calcResult.damage;
                                if (targetEntity.mode_bar >= threshold) {
                                    targetEntity.mode_bar = threshold;
                                    targetEntity.pending_mode_transition = 'enraged';
                                }
                            } else if (currentState === 'enraged' && targetEntity.pending_mode_transition !== 'enraged') {
                                let currentModeBar = targetEntity.mode_bar !== undefined ? targetEntity.mode_bar : threshold;
                                targetEntity.mode_bar = currentModeBar - calcResult.damage;
                                if (targetEntity.mode_bar <= 0) {
                                    targetEntity.mode_bar = 0;
                                    targetEntity.pending_mode_transition = 'exhausted';
                                }
                            }
                        }

                        events.push({
                            type: 'damage',
                            sourceId: sourceEntityId,
                            targetId: targetEntityId,
                            value: calcResult.damage,
                            isCrit: calcResult.isCrit,
                            mitigation: calcResult.mitigationPercent,
                            skillName: skillObj.name,
                            elementMultiplier: calcResult.elementMultiplier,
                            sourceElement: skillObj.element || character.element || 'Neutral',
                            modeBar: targetEntity.mode_bar,
                            modeState: targetEntity.mode_state
                        });
                    } 
                    else if (sType === 'heal' || sType === 'support' || sType === 'cleanse') {
                        const triggerHealPct = parseFloat(skillObj.trigger_heal_pct) || (sType === 'heal' ? 0.25 : 0);
                        if (triggerHealPct > 0) {
                            const maxHp = targetEntity.final_stats ? targetEntity.final_stats.hp : 1000;
                            const healAmt = Math.floor(maxHp * triggerHealPct);
                            targetEntity.current_hp = Math.min((targetEntity.current_hp || maxHp) + healAmt, maxHp);

                            events.push({
                                type: 'heal',
                                sourceId: sourceEntityId,
                                targetId: targetEntityId,
                                value: healAmt,
                                skillName: skillObj.name
                            });
                        }
                        
                        if (sType === 'cleanse') {
                            if (targetEntity.active_buffs) {
                                // Remove all debuffs
                                for (let i = targetEntity.active_buffs.length - 1; i >= 0; i--) {
                                    if ((targetEntity.active_buffs[i].effect_type || '').toLowerCase() === 'debuff') {
                                        events.push({
                                            type: 'effect_removed',
                                            targetId: targetEntityId,
                                            effectName: targetEntity.active_buffs[i].effect_name || targetEntity.active_buffs[i].target_stat
                                        });
                                        targetEntity.active_buffs.splice(i, 1);
                                    }
                                }
                            }
                        }
                    }
                    else if (sType === 'revive') {
                        if (targetEntity.current_hp <= 0) {
                            const triggerHealPct = parseFloat(skillObj.trigger_heal_pct) || 0.3;
                            const maxHp = targetEntity.final_stats ? targetEntity.final_stats.hp : 1000;
                            const healAmt = Math.floor(maxHp * triggerHealPct);
                            targetEntity.current_hp = healAmt;

                            events.push({
                                type: 'heal',
                                sourceId: sourceEntityId,
                                targetId: targetEntityId,
                                value: healAmt,
                                skillName: skillObj.name
                            });
                        }
                    }
                }

                // Apply Status Effects independently based on their own `effect_target`
                if (skillObj.status_effects && Array.isArray(skillObj.status_effects)) {
                    skillObj.status_effects.forEach(eff => {
                        const isBuff = (eff.effect_type || '').toLowerCase() === 'buff';
                        const effTargetType = eff.effect_target || 'Target'; 
                        
                        let resolveType = 'Single_Enemy';
                        if (effTargetType === 'Self') resolveType = 'Self';
                        else if (effTargetType === 'Allies') resolveType = 'All_Allies';
                        else {
                            // Target inherits skill's target
                            resolveType = skillObj.target_type || 'Single_Enemy';
                        }
                        
                        const effTargets = resolveTargets(character, resolveType, target_index || 0, false);
                        
                        effTargets.forEach(tgtObj => {
                            const targetEntity = tgtObj.entity;
                            targetEntity.active_buffs = targetEntity.active_buffs || [];
                            targetEntity.active_buffs.push({ ...eff });

                            events.push({
                                type: 'effect_applied',
                                targetId: getEntityId(tgtObj),
                                sourceId: sourceEntityId,
                                skillName: skillObj.name,
                                effectName: eff.effect_name || eff.target_stat,
                                effectType: isBuff ? 'buff' : 'debuff'
                            });
                        });
                    });
                }

                // Check Wave Clear
                const prevWaveIndex = state.current_wave_index;
                this._checkWaveClear(state, events);
                const aliveEnemies = (state.enemies || []).filter(e => (e.current_hp !== undefined ? e.current_hp : e.hp) > 0);
                
                // Break if wave changed (went to next wave) OR if all enemies are dead (last wave)
                if (state.current_wave_index > prevWaveIndex || aliveEnemies.length === 0) {
                    waveCleared = true;
                    break;
                }
            }

            // ==========================================
            // PHASE 2: ENEMY PHASE
            // ==========================================
            const remainingAliveEnemies = (state.enemies || []).filter(e => (e.current_hp !== undefined ? e.current_hp : e.hp) > 0);
            if (!waveCleared && remainingAliveEnemies.length > 0) {
                events.push({ type: 'delay', delayMs: 500 });
                for (const enemy of remainingAliveEnemies) {
                    const isStunned = (enemy.active_buffs || []).some(b =>
                        (b.target_stat || '').toUpperCase() === 'STUN' ||
                        (b.effect_name || '').toUpperCase().includes('STUN')
                    );
                    if (isStunned) {
                        events.push({
                            type: 'stun_skip',
                            sourceId: `enemy_${state.enemies.indexOf(enemy)}`,
                            targetId: `enemy_${state.enemies.indexOf(enemy)}`,
                            skillName: 'STUNNED',
                            value: 0
                        });
                        continue;
                    }

                    const aliveParty = (state.player_party.characters || []).filter(c => (c.current_hp !== undefined ? c.current_hp : c.hp) > 0);
                    if (aliveParty.length === 0) break;

                    let caSkill = null;
                    if (enemy.is_boss) {
                        // Resolve pending mode transitions at the START of Enemy Turn
                        if (enemy.pending_mode_transition === 'enraged') {
                            enemy.mode_state = 'enraged';
                            enemy.enrage_turns = 3;
                            enemy.mode_changed_this_turn = true;
                            enemy.pending_mode_transition = null;
                            events.push({ type: 'enrage', targetId: `enemy_${state.enemies.indexOf(enemy)}` });
                        } else if (enemy.pending_mode_transition === 'exhausted') {
                            enemy.mode_state = 'exhausted';
                            enemy.exhaust_turns = 2;
                            enemy.enrage_turns = 0;
                            enemy.mode_changed_this_turn = true;
                            enemy.pending_mode_transition = null;
                            events.push({ type: 'break', targetId: `enemy_${state.enemies.indexOf(enemy)}` });
                        }

                        caSkill = AiBehaviorService.calculateBossAction(state, enemy.ai_behaviors || enemy.aiBehaviors);
                        if (!caSkill) {
                            const currentCa = enemy.current_ca !== undefined ? enemy.current_ca : 0;
                            const caMax = enemy.caMax !== undefined ? enemy.caMax : (enemy.final_stats && enemy.final_stats.caMax) !== undefined ? enemy.final_stats.caMax : 5;
                            const isExhausted = (enemy.mode_state || enemy.modeState) === 'exhausted';
                            
                            if (currentCa >= caMax && !isExhausted) {
                                const specialSkills = (enemy.ai_behaviors || enemy.aiBehaviors || []).filter(b => {
                                    const cat = (b.skill ? b.skill.category : b.category) || '';
                                    return cat.toLowerCase() === 'special';
                                });
                                if (specialSkills.length > 0) caSkill = specialSkills[Math.floor(Math.random() * specialSkills.length)];
                            }
                        }
                    } else {
                        const currentCa = enemy.current_ca !== undefined ? enemy.current_ca : 0;
                        const caMax = enemy.caMax !== undefined ? enemy.caMax : (enemy.final_stats && enemy.final_stats.caMax) !== undefined ? enemy.final_stats.caMax : 5;
                        const availableSkills = enemy.ai_behaviors || enemy.aiBehaviors || [];
                        if (currentCa >= caMax && availableSkills.length > 0) {
                            caSkill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
                        }
                    }

                    let enemySkill = null;
                    if (caSkill) {
                        enemySkill = caSkill.skill || caSkill;
                        // Record one-time use or HP trigger usage
                        if (!state.used_skills) state.used_skills = [];
                        if (!state.used_skills.includes(enemySkill.id)) state.used_skills.push(enemySkill.id);

                        if (!enemySkill.isHpTrigger) {
                            enemy.current_ca = 0; // Reset CA
                        }
                    } else {
                        enemySkill = { name: enemy.name ? `${enemy.name} Strike` : 'Monster Attack', type: 'Damage', target_type: 'Single_Enemy', modifier: 1.0, element: enemy.element || 'Neutral' };
                        const currentCa = enemy.current_ca !== undefined ? enemy.current_ca : 0;
                        const caMax = enemy.caMax !== undefined ? enemy.caMax : (enemy.final_stats && enemy.final_stats.caMax) !== undefined ? enemy.final_stats.caMax : 5;
                        const isExhausted = (enemy.mode_state || enemy.modeState) === 'exhausted';
                        if (!isExhausted) {
                            enemy.current_ca = Math.min(caMax, currentCa + 1);
                        }
                    }

                    let targetIndex = Math.floor(Math.random() * aliveParty.length);
                    if (caSkill && (caSkill.modifiers || caSkill.score_modifiers)) {
                        const smartTargetId = this._determineSmartTarget(aliveParty, caSkill.modifiers || caSkill.score_modifiers || {});
                        const sIdx = aliveParty.findIndex(p => (p.slot || p.id) === smartTargetId);
                        if (sIdx !== -1) targetIndex = sIdx;
                    }
                    
                    const targets = resolveTargets(enemy, enemySkill.target_type || 'Single_Enemy', targetIndex, true);
                    const sType = (enemySkill.type || enemySkill.action_type || 'damage').toLowerCase();
                    const sourceEntityId = `enemy_${state.enemies.indexOf(enemy)}`;

                    if (caSkill) {
                        const enemyName = enemy.name || 'ENEMY';
                        events.push({ type: 'log', message: `💀 ${enemyName.toUpperCase()} SPECIAL ATTACK: ${enemySkill.name}!` });
                    }

                    for (const tgtObj of targets) {
                        const targetEntity = tgtObj.entity;
                        const targetEntityId = getEntityId(tgtObj);

                        if (sType === 'damage') {
                            const calcResult = DamageCalculatorService.calculateDamage(enemy, targetEntity, enemySkill);
                            targetEntity.current_hp = Math.max(0, (targetEntity.current_hp !== undefined ? targetEntity.current_hp : targetEntity.final_stats.hp) - calcResult.damage);

                            if (tgtObj.type === 'player') {
                                targetEntity.current_sa = Math.min(100, (targetEntity.current_sa || 0) + 20);
                            }

                            events.push({
                                type: 'damage',
                                sourceId: sourceEntityId,
                                targetId: targetEntityId,
                                value: calcResult.damage,
                                isCrit: calcResult.isCrit,
                                mitigation: calcResult.mitigationPercent,
                                skillName: enemySkill.name,
                                elementMultiplier: calcResult.elementMultiplier,
                                sourceElement: enemySkill.element || enemy.element || 'Neutral'
                            });
                        } 
                        else if (sType === 'heal' || sType === 'support' || sType === 'cleanse') {
                            const triggerHealPct = parseFloat(enemySkill.trigger_heal_pct) || (sType === 'heal' ? 0.25 : 0);
                            if (triggerHealPct > 0) {
                                const maxHp = targetEntity.final_stats ? targetEntity.final_stats.hp : 1000;
                                const healAmt = Math.floor(maxHp * triggerHealPct);
                                targetEntity.current_hp = Math.min((targetEntity.current_hp || maxHp) + healAmt, maxHp);

                                events.push({
                                    type: 'heal',
                                    sourceId: sourceEntityId,
                                    targetId: targetEntityId,
                                    value: healAmt,
                                    skillName: enemySkill.name
                                });
                            }
                        }
                        
                        if (sType === 'cleanse') {
                            if (targetEntity.active_buffs) {
                                targetEntity.active_buffs = targetEntity.active_buffs.filter(b => (b.effect_type || b.type || '').toLowerCase() !== 'debuff');
                            }
                            events.push({
                                type: 'cleanse',
                                sourceId: sourceEntityId,
                                targetId: targetEntityId,
                                skillName: enemySkill.name
                            });
                        }

                        // Apply Status Effects for enemy skill
                        if (enemySkill.status_effects && Array.isArray(enemySkill.status_effects)) {
                            for (const eff of enemySkill.status_effects) {
                                if (!targetEntity.active_buffs) targetEntity.active_buffs = [];
                                targetEntity.active_buffs.push({
                                    effect_id: eff.id || eff.effect_id,
                                    effect_name: eff.name || eff.effect_name,
                                    effect_type: eff.type || eff.effect_type,
                                    target_stat: eff.target_stat,
                                    modifier_value: eff.modifier_value || eff.modifier,
                                    duration_turns: eff.duration_turns || eff.duration,
                                    is_dot: (eff.type || eff.effect_type || '').toLowerCase() === 'dot',
                                    is_new: true // Prevent ticking down on the turn it's applied
                                });
                                events.push({
                                    type: 'effect_applied',
                                    sourceId: sourceEntityId,
                                    targetId: targetEntityId,
                                    effectName: eff.name || eff.effect_name,
                                    effectType: eff.type || eff.effect_type
                                });
                            }
                        }
                    }
                }
            }

            // ==========================================
            // PHASE 3: END OF TURN PHASE (RESOLUTION)
            // ==========================================
            if (!waveCleared && remainingAliveEnemies.length > 0) {
                // 1. Calculate DoT (Poison/Burn/dll)
                const applyDoT = (entity, isEnemy) => {
                    const entityId = isEnemy ? `enemy_${state.enemies.indexOf(entity)}` : (entity.slot || entity.id);
                    if (entity.active_buffs && entity.active_buffs.length > 0) {
                        entity.active_buffs.forEach(buff => {
                            if ((buff.effect_type || '').toLowerCase() === 'dot') {
                                const maxHp = entity.final_stats ? entity.final_stats.hp : 1000;
                                const dotDamage = Math.floor(maxHp * (buff.value || 0.05));
                                entity.current_hp = Math.max(0, entity.current_hp - dotDamage);
                                events.push({
                                    type: 'damage',
                                    sourceId: entityId,
                                    targetId: entityId,
                                    value: dotDamage,
                                    isCrit: false,
                                    mitigation: 0,
                                    skillName: buff.effect_name || 'Poison/Burn',
                                    elementMultiplier: 1.0,
                                    sourceElement: 'Neutral'
                                });
                            }
                        });
                    }
                };

                (state.player_party.characters || []).filter(c => (c.current_hp !== undefined ? c.current_hp : c.hp) > 0).forEach(c => applyDoT(c, false));
                remainingAliveEnemies.filter(e => (e.current_hp !== undefined ? e.current_hp : e.hp) > 0).forEach(e => applyDoT(e, true));

                // Re-evaluate alive states after DoT damage
                const prevWaveIndexPhase3 = state.current_wave_index;
                this._checkWaveClear(state, events);
                
                // Jika wave berubah karena DoT, skip sisa Phase 3 karena _checkWaveClear sudah menghandle simulasi 1 Turn
                if (state.current_wave_index > prevWaveIndexPhase3) {
                    waveCleared = true;
                }
                
                if (!waveCleared) {
                    // 2. Tick Buffs/Debuffs (Kurangi durasi sebesar 1)
                const tickBuffs = (entity, isEnemy) => {
                    const entityId = isEnemy ? `enemy_${state.enemies.indexOf(entity)}` : (entity.slot || entity.id);
                    if (entity.active_buffs && entity.active_buffs.length > 0) {
                        for (let i = entity.active_buffs.length - 1; i >= 0; i--) {
                            const buff = entity.active_buffs[i];
                            const durKey = buff.duration !== undefined ? 'duration' : (buff.mse_duration !== undefined ? 'mse_duration' : (buff.duration_turns !== undefined ? 'duration_turns' : null));
                            if (durKey && buff[durKey] > 0) {
                                if (buff.is_new) {
                                    buff.is_new = false; // Skip ticking down this turn
                                } else {
                                    buff[durKey] -= 1;
                                    if (buff[durKey] <= 0) {
                                        events.push({
                                            type: 'effect_removed',
                                            targetId: entityId,
                                            effectName: buff.effect_name || buff.target_stat
                                        });
                                        entity.active_buffs.splice(i, 1);
                                    }
                                }
                            }
                        }
                    }
                };

                (state.player_party.characters || []).forEach(c => tickBuffs(c, false));
                remainingAliveEnemies.forEach(e => tickBuffs(e, true));

                // 3. Tick Cooldowns (kecuali skill yang baru dieksekusi)
                if (state.player_party && Array.isArray(state.player_party.characters)) {
                    state.player_party.characters.forEach(char => {
                        if (char.skills) {
                            char.skills.forEach(s => {
                                const execKey = `${char.inv_id || char.slot}_${s.id}`;
                                if (!executedSkillsThisTurn.has(execKey) && s.current_cooldown && s.current_cooldown > 0) {
                                    s.current_cooldown -= 1;
                                }
                            });
                        }
                    });
                }

                // 4. Turn Counter: Naikkan current_turn + 1
                state.current_turn = (state.current_turn || 1) + 1;
                }
            }

            // Re-hydrate live asset paths for client display
            if (state.player_id) {
                await this.rehydrateStateAssets(state, state.player_id);
            }

            state.is_processing = false;
            await db.query(
                `UPDATE battle_sessions SET battle_state_json = ? WHERE bs_id = ? AND bs_status = 'ACTIVE'`,
                [JSON.stringify(state), bsId]
            ).catch(e => console.error('[processTurnBatch] DB update error:', e));

            BattleMemoryStore.set(bsId, state);

            return { events, stateSnapshot: state };
        } catch (error) {
            state.is_processing = false;
            throw error;
        }
    }

    /**
     * Player menyerah. Set sesi ke FAILED, bersihkan RAM.
     * Stamina TIDAK dikembalikan (sudah dipotong di initBattle).
     */
    async surrenderSession(bsId) {
        await db.query(
            'UPDATE battle_sessions SET bs_status = \'FAILED\', remaining_time = 0 WHERE bs_id = ?',
            [bsId]
        );
        BattleMemoryStore.delete(bsId);
    }

    /**
     * Sinkronisasi state dari client ke server (Turn End).
     * BattleMemoryStore = primary layer (sync), MySQL = cadangan (fire-and-forget async).
     */
    syncState(bsId, stateJson, remainingTime) {
        // 1. Primary: update RAM cache langsung (sync)
        BattleMemoryStore.set(bsId, typeof stateJson === 'string' ? JSON.parse(stateJson) : stateJson);

        // 2. Secondary: fire-and-forget async DB write (tidak di-await)
        const jsonStr = typeof stateJson === 'string' ? stateJson : JSON.stringify(stateJson);
        db.query(
            'UPDATE battle_sessions SET battle_state_json = ?, remaining_time = ? WHERE bs_id = ? AND bs_status = \'ACTIVE\'',
            [jsonStr, remainingTime, bsId]
        ).catch(err => console.error('[syncState] Fire-and-forget DB write failed:', err.message));
    }

    /**
     * Active Session Garbage Collector.
     * Sweep database setiap 15 menit: semua battle_sessions dengan bs_status = 'ACTIVE'
     * yang sudah melewati 45 menit (2700 detik) sejak started_at akan di-batch update ke FAILED.
     */
    async runActiveSessionGC() {
        try {
            const [result] = await db.query(
                'UPDATE battle_sessions SET bs_status = \'FAILED\', remaining_time = 0 WHERE bs_status = \'ACTIVE\' AND TIMESTAMPDIFF(SECOND, started_at, NOW()) > 2700'
            );
            if (result.affectedRows > 0) {
                console.log(`[BattleService GC] Swept ${result.affectedRows} expired ACTIVE sessions to FAILED.`);
            }
        } catch (err) {
            console.error('[BattleService GC] Error during active session sweep:', err.message);
        }
    }

    /**
     * Helper to find an entity in the battle state
     */
    _findEntity(state, entityId) {
        if (entityId.startsWith('enemy_')) {
            const idx = parseInt(entityId.split('_')[1], 10);
            return state.enemies[idx];
        }
        return state.player_party.characters.find(c => c.slot === entityId || c.id === entityId || c.inv_id == entityId);
    }

    _checkWaveClear(state, events, isTurnEnd = false) {
        if (!state.enemies || !state.waves) return;
        const allDead = state.enemies.every(e => (e.current_hp !== undefined ? e.current_hp : e.hp) <= 0);
        
        if (allDead) {
            // Save defeated enemies for anti-cheat validation
            if (!state.defeated_enemies) state.defeated_enemies = [];
            state.enemies.forEach(e => state.defeated_enemies.push(e.id));
            
            // Check if there is a next wave
            if (state.current_wave_index + 1 < state.waves.length) {
                state.current_wave_index += 1;
                // Deep copy new wave to prevent reference mutation issues
                state.enemies = JSON.parse(JSON.stringify(state.waves[state.current_wave_index]));
                
                if (!isTurnEnd) {
                    // --- Simulate 1 Turn Elapsed for Player Party on Wave Transition ---
                    if (state.player_party && state.player_party.characters) {
                        state.player_party.characters.forEach(char => {
                            // Decrement active buffs
                            if (char.active_buffs && char.active_buffs.length > 0) {
                                for (let i = char.active_buffs.length - 1; i >= 0; i--) {
                                    const buff = char.active_buffs[i];
                                    const durKey = buff.mse_duration !== undefined ? 'mse_duration' : (buff.duration !== undefined ? 'duration' : null);
                                    if (durKey && buff[durKey] > 0) {
                                        buff[durKey] -= 1;
                                        if (buff[durKey] <= 0) {
                                            events.push({
                                                type: 'effect_removed',
                                                targetId: char.slot || char.id,
                                                effectName: buff.effect_name || buff.target_stat
                                            });
                                            char.active_buffs.splice(i, 1);
                                        }
                                    }
                                }
                            }
                            
                            // Decrement skill cooldowns
                            if (char.skills) {
                                char.skills.forEach(skill => {
                                    if (skill.current_cooldown && skill.current_cooldown > 0) {
                                        skill.current_cooldown -= 1;
                                    }
                                });
                            }
                        });
                    }
                    
                    // Increment turn counter because we effectively skipped the enemy's turn
                    state.current_turn = (state.current_turn || 1) + 1;
                }

                events.push({
                    type: 'wave_change',
                    waveNum: state.current_wave_index + 1
                });
            }
        }
    }

    /**
     * Process a battle action server-side (Phase 2-6)
     */
    async processAction(bsId, actionData) {
        let state = BattleMemoryStore.get(bsId);
        if (!state) {
            // Try to load from DB
            const [rows] = await db.query('SELECT battle_state_json FROM battle_sessions WHERE bs_id = ?', [bsId]);
            if (rows.length > 0 && rows[0].battle_state_json) {
                try { state = JSON.parse(rows[0].battle_state_json); } catch (e) { }
            }
        }

        if (!state) throw new Error('Battle session not found or expired');

        if (state.is_processing) {
            throw new Error('RACE_CONDITION: Action is already being processed');
        }
        state.is_processing = true;

        try {
            const events = [];
            const { sourceId, targetIds, actionType, skillId } = actionData;

            if (actionType === 'use_potion') {
                if (state.heals_remaining <= 0) throw new Error('No Green Potions remaining in this battle.');
                
                const target = this._findEntity(state, targetIds[0]);
                if (!target) throw new Error('Target not found for potion');
                if (target.current_hp <= 0) throw new Error('Cannot use Green Potion on a defeated character.');

                state.heals_remaining -= 1;
                state.potions_used = (state.potions_used || 0) + 1;
                
                const maxHp = target.final_stats ? target.final_stats.hp : target.max_hp;
                const healAmt = Math.floor(maxHp * 0.40);
                target.current_hp = Math.min((target.current_hp || maxHp) + healAmt, maxHp);

                events.push({
                    type: 'heal',
                    sourceId: sourceId,
                    targetId: targetIds[0],
                    value: healAmt,
                    skillName: 'Green Potion'
                });

                state.is_processing = false;
                db.query(`UPDATE battle_sessions SET battle_state_json = ? WHERE bs_id = ? AND bs_status = 'ACTIVE'`, [JSON.stringify(state), bsId]).catch(e => console.error(e));
                return { events, stateSnapshot: state };
            }

            if (actionType === 'revive_party') {
                if ((state.full_potion_count || 0) <= (state.full_potions_used || 0) || (state.full_potions_used || 0) >= 1) {
                    throw new Error('No Full Potions available or revive limit reached.');
                }

                // Consume potion in database
                await db.query('UPDATE player_materials SET quantity = GREATEST(0, quantity - 1) WHERE player_id = ? AND mat_id = 7', [state.player_id]);
                
                state.full_potions_used = (state.full_potions_used || 0) + 1;
                
                // Revive all party members
                state.player_party.characters.forEach(p => {
                    const maxHp = p.final_stats ? p.final_stats.hp : (p.max_hp || 1000);
                    p.current_hp = maxHp;
                    p.current_sa = 0;
                    p.active_buffs = [];
                    // Reset cooldowns
                    if (p.skills) {
                        p.skills.forEach(s => s.current_cooldown = 0);
                    }
                    
                    events.push({
                        type: 'revive',
                        targetId: p.slot || p.id,
                        value: maxHp
                    });
                });

                events.push({
                    type: 'log',
                    message: '🧪 Full Potion! Party revived at 100% HP!'
                });

                state.is_processing = false;
                db.query(`UPDATE battle_sessions SET battle_state_json = ? WHERE bs_id = ? AND bs_status = 'ACTIVE'`, [JSON.stringify(state), bsId]).catch(e => console.error(e));
                return { events, stateSnapshot: state };
            }

            if (actionType === 'aether_burst') {
                if ((state.aether_gauge || 0) < 100) throw new Error('Aether Burst not ready! Gauge must be 100%.');
                
                const attacker = this._findEntity(state, sourceId);
                const target = this._findEntity(state, targetIds[0] || 'enemy_0');
                if (!attacker || !target) throw new Error('Attacker or Target not found');

                state.aether_gauge = 0; // Consume gauge

                // Dummy skill for Aether Burst
                const aetherSkill = {
                    name: 'Aether Burst',
                    type: 'Damage',
                    modifier: 3.5,
                    element: attacker.element || 'Neutral'
                };

                const calcResult = DamageCalculatorService.calculateDamage(attacker, target, aetherSkill);
                target.current_hp = Math.max(0, (target.current_hp || target.final_stats.hp) - calcResult.damage);

                // Apply DEF Down 25% for 2 turns
                target.active_buffs = target.active_buffs || [];
                target.active_buffs.push({
                    effect_type: 'debuff',
                    effect_name: 'DEF Down',
                    target_stat: 'def',
                    modifier_value: -0.25,
                    duration_turns: 2
                });

                events.push({
                    type: 'damage',
                    sourceId: sourceId,
                    targetId: targetIds[0] || 'enemy_0',
                    value: calcResult.damage,
                    isCrit: calcResult.isCrit,
                    mitigation: calcResult.mitigationPercent,
                    skillName: '✦ Aether Burst',
                    elementMultiplier: calcResult.elementMultiplier,
                    sourceElement: aetherSkill.element
                });
                events.push({
                    type: 'effect_applied',
                    targetId: targetIds[0] || 'enemy_0',
                    sourceId: sourceId,
                    skillName: '✦ Aether Burst',
                    effectName: 'DEF Down (-25%)',
                    effectType: 'debuff'
                });

                this._checkWaveClear(state, events);

                state.is_processing = false;
                db.query(`UPDATE battle_sessions SET battle_state_json = ? WHERE bs_id = ? AND bs_status = 'ACTIVE'`, [JSON.stringify(state), bsId]).catch(e => console.error(e));
                return { events, stateSnapshot: state };
            }

            const attacker = this._findEntity(state, sourceId);
            if (!attacker) throw new Error('Attacker not found in state');

            const isAttackerStunned = (attacker.active_buffs || []).some(b => b.target_stat === 'STUN');
            if (isAttackerStunned) {
                events.push({
                    type: 'damage',
                    sourceId: sourceId,
                    targetId: targetIds && targetIds.length > 0 ? targetIds[0] : 'enemy_0',
                    value: 0,
                    isCrit: false,
                    mitigation: 0,
                    skillName: 'STUNNED',
                    elementMultiplier: 1,
                    sourceElement: 'Neutral'
                });
                
                this._checkWaveClear(state, events);
                state.is_processing = false;
                db.query(`UPDATE battle_sessions SET battle_state_json = ? WHERE bs_id = ? AND bs_status = 'ACTIVE'`, [JSON.stringify(state), bsId]).catch(e => console.error(e));
                return { events, stateSnapshot: state };
            }

            // Find the skill
            let skill = null;
            if (actionType === 'skill') {
                if (attacker.skills) {
                    skill = attacker.skills.find(s => s.id == skillId);
                    if (skill && (skill.category || '').toLowerCase() === 'special') {
                        attacker.current_sa = 0; // Reset Player SA
                        
                        // SA Chain Burst & Aether Gauge Tracking
                        if (!sourceId.startsWith('enemy_')) {
                            state.current_turn_sa_count = (state.current_turn_sa_count || 0) + 1;
                            if (state.current_turn_sa_count === 1) {
                                state.first_sa_element = attacker.element || 'Neutral';
                                state.first_sa_attacker_id = sourceId;
                            }
                            state.aether_gauge = Math.min(100, (state.aether_gauge || 0) + 10);
                        }
                    }
                } else if (attacker.ai_behaviors) {
                    const b = attacker.ai_behaviors.find(b => b.skill.id == skillId);
                    if (b) {
                        skill = b.skill;
                        if ((skill.category || '').toLowerCase() === 'special') {
                            attacker.current_ca = 0; // Reset Enemy CA
                        }
                    }
                }
                if (!skill) throw new Error('Skill not found for entity');
            } else if (actionType === 'attack') {
                // Generate a dummy basic attack skill
                skill = {
                    name: 'Basic Attack',
                    type: 'Damage',
                    modifier: 1.0,
                    element: attacker.element
                };
            }

            const targets = (targetIds || []).map(id => this._findEntity(state, id)).filter(t => t);

            for (const target of targets) {
                const sType = (skill.type || '').toLowerCase();

                // 1. Process Self HP Cost BEFORE anything else
                const hpCostPct = parseFloat(skill.hp_cost_pct) || 0;
                
                if (hpCostPct > 0 && attacker.current_hp > 0) {
                    const hpCost = Math.floor((attacker.final_stats ? attacker.final_stats.hp : 1000) * hpCostPct);
                    attacker.current_hp = Math.max(0, attacker.current_hp - hpCost);
                    
                    // Only emit cost once per skill, not per target
                    if (targets.indexOf(target) === 0) {
                        events.push({
                            type: 'damage',
                            sourceId: sourceId,
                            targetId: sourceId,
                            value: hpCost,
                            skillName: skill.name,
                            isCost: true
                        });
                    }
                }

                // 2. Process SA Gain (Once per skill)
                const saGain = parseInt(skill.ms_sa_gain) || 0;
                if (saGain > 0 && targets.indexOf(target) === 0 && !sourceId.startsWith('enemy_')) {
                    attacker.current_sa = Math.min(100, (attacker.current_sa || 0) + saGain);
                    events.push({
                        type: 'effect_applied',
                        targetId: sourceId,
                        sourceId: sourceId,
                        skillName: skill.name,
                        effectName: `+${saGain}% SA Bar`,
                        effectType: 'buff'
                    });
                }

                if (skill.trigger_delay > 0 && targetIds[targets.indexOf(target)].startsWith('enemy_')) {
                    if (target.current_ca > 0) {
                        target.current_ca -= 1;
                        events.push({ type: 'effect_applied', targetId: targetIds[targets.indexOf(target)], sourceId: sourceId, skillName: skill.name, effectName: 'Delay', effectType: 'debuff' });
                    }
                }

                if (skill.trigger_dispel > 0 && target.active_buffs) {
                    const buffs = target.active_buffs.filter(e => (e.effect_type || '').toLowerCase() === 'buff');
                    if (buffs.length > 0) {
                        // Remove the most recently applied buff (or random)
                        const removed = buffs.pop();
                        target.active_buffs = target.active_buffs.filter(b => b !== removed);
                        events.push({ type: 'effect_applied', targetId: targetIds[targets.indexOf(target)], sourceId: sourceId, skillName: skill.name, effectName: 'Dispel', effectType: 'debuff' });
                    }
                }

                const triggerHealPct = parseFloat(skill.trigger_heal_pct) || 0;
                if (triggerHealPct > 0 && target.current_hp > 0) {
                    const healAmt = Math.floor(target.final_stats.hp * triggerHealPct);
                    target.current_hp = Math.min((target.current_hp || target.final_stats.hp) + healAmt, target.final_stats.hp);
                    events.push({ type: 'heal', targetId: targetIds[targets.indexOf(target)], value: healAmt, skillName: skill.name });
                }

                if (sType === 'damage' || actionType === 'attack') {
                    // Execute 6-Phase Damage Calculation
                    const calcResult = DamageCalculatorService.calculateDamage(attacker, target, skill);

                    target.current_hp = Math.max(0, (target.current_hp || target.final_stats.hp) - calcResult.damage);
                    console.log(`[DEBUG] Damage Event: ${sourceId} -> ${targetIds[targets.indexOf(target)]}, skill: ${skill.name}, dmg: ${calcResult.damage}`);

                    // Update Enemy Mode Bar BEFORE pushing damage event
                    let modeTransitionedTo = null;
                    if (targetIds[targets.indexOf(target)].startsWith('enemy_') && target.is_boss) {
                        const threshold = (target.final_stats.hp || target.max_hp) * 0.20;
                        const isAttackSequence = actionData.isAttackSequence === true;
                        const currentState = target.mode_state || 'normal';

                        if (currentState === 'normal') {
                            target.mode_bar = (target.mode_bar !== undefined ? target.mode_bar : 0) + calcResult.damage;
                            if (target.mode_bar >= threshold) {
                                target.mode_bar = threshold;
                                if (isAttackSequence) {
                                    target.pending_mode_transition = 'enraged';
                                } else {
                                    target.mode_state = 'enraged';
                                    target.enrage_turns = 3;
                                    modeTransitionedTo = 'enraged';
                                    // enrage event will be pushed AFTER damage event
                                }
                            }
                        } else if (currentState === 'enraged') {
                            // If pending enraged is active, damage still doesn't reduce bar (locked until turn end)
                            if (target.pending_mode_transition !== 'enraged') {
                                let currentModeBar = target.mode_bar !== undefined ? target.mode_bar : threshold;
                                target.mode_bar = currentModeBar - calcResult.damage;
                                if (target.mode_bar <= 0) {
                                    target.mode_bar = 0;
                                    if (isAttackSequence) {
                                        target.pending_mode_transition = 'exhausted';
                                    } else {
                                        target.mode_state = 'exhausted';
                                        target.exhaust_turns = 2;
                                        target.enrage_turns = 0;
                                        modeTransitionedTo = 'exhausted';
                                        // break event will be pushed AFTER damage event
                                    }
                                }
                            }
                        }
                    }

                    events.push({
                        type: 'damage',
                        sourceId: sourceId,
                        targetId: targetIds[targets.indexOf(target)],
                        value: calcResult.damage,
                        isCrit: calcResult.isCrit,
                        mitigation: calcResult.mitigationPercent,
                        skillName: skill.name,
                        elementMultiplier: calcResult.elementMultiplier,
                        sourceElement: skill.element || (attacker ? attacker.element || 'Neutral' : 'Neutral'),
                        modeBar: target.mode_bar,
                        modeState: target.mode_state
                    });
                    
                    // Push mode transition events if triggered immediately (not pending)
                    if (targetIds[targets.indexOf(target)].startsWith('enemy_') && target.is_boss) {
                        if (modeTransitionedTo === 'enraged') {
                            events.push({ type: 'enrage', targetId: targetIds[targets.indexOf(target)] });
                        } else if (modeTransitionedTo === 'exhausted') {
                            events.push({ type: 'break', targetId: targetIds[targets.indexOf(target)] });
                        }
                    }

                    // CA Bar / SA Bar generation (Only on Basic Attacks)
                    if (actionType === 'attack') {
                        if (sourceId.startsWith('enemy_')) {
                            if (attacker.mode_state !== 'exhausted' && !actionData.skipCaGain) {
                                attacker.current_ca = Math.min(attacker.caMax, (attacker.current_ca || 0) + 1);
                            }
                        } else {
                            attacker.current_sa = Math.min(100, (attacker.current_sa || 0) + 20);
                        }
                    }
                } else if (sType === 'heal') {
                    const healAmt = Math.floor(target.final_stats.hp * (skill.modifier || 0.2));
                    target.current_hp = Math.min((target.current_hp || target.final_stats.hp) + healAmt, target.final_stats.hp);
                    events.push({
                        type: 'heal',
                        sourceId: sourceId,
                        targetId: targetIds[targets.indexOf(target)],
                        value: healAmt,
                        skillName: skill.name
                    });
                } else if (sType === 'cleanse') {
                    if (target.active_buffs) {
                        target.active_buffs = target.active_buffs.filter(e => (e.effect_type || '').toLowerCase() !== 'debuff');
                    }
                    events.push({
                        type: 'cleanse',
                        sourceId: sourceId,
                        targetId: targetIds[targets.indexOf(target)],
                        skillName: skill.name
                    });
                    if (skill.modifier > 0) {
                        const healAmt = Math.floor(target.final_stats.hp * skill.modifier);
                        target.current_hp = Math.min((target.current_hp || target.final_stats.hp) + healAmt, target.final_stats.hp);
                        events.push({ type: 'heal', targetId: targetIds[targets.indexOf(target)], value: healAmt, skillName: skill.name });
                    }
                } else if (sType === 'revive') {
                    if (target.current_hp <= 0) {
                        const healAmt = Math.floor(target.final_stats.hp * (skill.modifier || 0.3));
                        target.current_hp = healAmt;
                        events.push({
                            type: 'revive',
                            sourceId: sourceId,
                            targetId: targetIds[targets.indexOf(target)],
                            value: healAmt,
                            skillName: skill.name
                        });
                    }
                } else if (sType === 'support' || sType === 'buff' || sType === 'debuff') {
                    events.push({
                        type: 'support',
                        sourceId: sourceId,
                        targetId: targetIds[targets.indexOf(target)],
                        skillName: skill.name
                    });
                }
            } // end of targets loop

            // Apply status effects based on their specific effect_target
            if (skill && skill.status_effects && skill.status_effects.length > 0) {
                const isPlayerAttacking = !sourceId.startsWith('enemy_');
                const allies = isPlayerAttacking ? state.player_party.characters : state.enemies;
                const enemiesList = isPlayerAttacking ? state.enemies : state.player_party.characters;

                skill.status_effects.forEach(eff => {
                    let effectTargets = [];
                    const et = (eff.effect_target || 'Target').toLowerCase();

                    if (et === 'self') {
                        effectTargets = [attacker];
                    } else if (et === 'target' || et === 'single_enemy' || et === 'single_ally') {
                        effectTargets = targets;
                    } else if (et === 'allies' || et === 'self_party' || et === 'all_allies') {
                        effectTargets = allies;
                    } else if (et === 'all_enemies') {
                        effectTargets = enemiesList;
                    } else {
                        effectTargets = targets;
                    }

                    effectTargets.forEach(effTarget => {
                        if (effTarget && ((effTarget.current_hp !== undefined && effTarget.current_hp > 0) || (effTarget.hp !== undefined && effTarget.hp > 0))) {
                            if (!effTarget.active_buffs) effTarget.active_buffs = [];
                            const isEnemySource = String(sourceId).startsWith('enemy');
                            effTarget.active_buffs.push({ ...eff, applied_by_enemy_this_turn: isEnemySource });
                            
                            let tid = 'unknown';
                            if (effTarget.id !== undefined && state.enemies.find(e => e.id === effTarget.id)) {
                                tid = `enemy_${state.enemies.indexOf(effTarget)}`;
                            } else if (effTarget.slot) {
                                tid = effTarget.slot;
                            }
                            
                            events.push({
                                type: 'effect_applied',
                                targetId: tid,
                                sourceId: sourceId,
                                skillName: skill ? skill.name : 'Unknown Skill',
                                effectName: eff.effect_name || eff.target_stat,
                                effectType: eff.effect_type || 'buff'
                            });
                        }
                    });
                });
            }

            // Skill Cooldowns
            if (skill && skill.cooldown && skill.cooldown > 0) {
                skill.current_cooldown = skill.cooldown;
            }

            // Track Used Skills for AI One-Time Use logic
            if (skill && skill.id) {
                if (!state.used_skills) state.used_skills = [];
                if (!state.used_skills.includes(skill.id)) {
                    state.used_skills.push(skill.id);
                }
            }

            // Reset CA / SA Bar if special attack is used
            if (skill && (skill.category || '').toLowerCase() === 'special' && !actionData.skipCaReset) {
                if (sourceId.startsWith('enemy_')) {
                    attacker.current_ca = 0;
                } else {
                    attacker.current_sa = 0;
                }
            }

            this._checkWaveClear(state, events);

            state.is_processing = false;

            // Async persist
            // db.query('UPDATE battle_sessions SET battle_state_json = ? WHERE bs_id = ? AND bs_status = \\'ACTIVE\\'', [JSON.stringify(state), bsId]).catch(e => console.error(e));
            db.query(`UPDATE battle_sessions SET battle_state_json = ? WHERE bs_id = ? AND bs_status = 'ACTIVE'`, [JSON.stringify(state), bsId]).catch(e => console.error(e));


            return {
                events: events,
                stateSnapshot: state
            };
        } catch (err) {
            state.is_processing = false;
            throw err;
        }
    }

    async processTurnEnd(bsId) {
        let state = BattleMemoryStore.get(bsId);
        if (!state) {
            // Try to load from DB
            const [rows] = await db.query('SELECT battle_state_json FROM battle_sessions WHERE bs_id = ?', [bsId]);
            if (rows.length > 0 && rows[0].battle_state_json) {
                try { state = JSON.parse(rows[0].battle_state_json); } catch (e) { }
            }
        }
        if (!state) throw new Error("ACTIVE_SESSION_NOT_FOUND");
        const events = [];

        const processDoT = (entity, entityId, isEnemy) => {
            if (!entity || (entity.current_hp !== undefined ? entity.current_hp : entity.hp) <= 0) return;
            
            const maxHp = entity.final_stats ? entity.final_stats.hp : (entity.max_hp || entity.maxHp || 1000);
            const allDoT = (entity.active_buffs || []).filter(e => e.target_stat === 'POISON');
            
            const groups = [
                { type: 'Poison', effects: allDoT.filter(e => !(e.effect_name || '').toLowerCase().includes('burn')) },
                { type: 'Burn', effects: allDoT.filter(e => (e.effect_name || '').toLowerCase().includes('burn')) }
            ];

            groups.forEach(group => {
                if (group.effects.length === 0) return;
                
                let totalPct = 0;
                group.effects.forEach(eff => {
                    totalPct += Math.abs(Number(eff.value) || 0.05);
                });
                
                if (totalPct > 0) {
                    const totalDmg = Math.floor(totalPct * maxHp);
                    const curHp = entity.current_hp !== undefined ? entity.current_hp : entity.hp;
                    entity.current_hp = Math.max(0, curHp - totalDmg);
                    
                    events.push({
                        type: 'damage',
                        sourceId: entityId, // Self-inflicted
                        targetId: entityId,
                        value: totalDmg,
                        skillName: group.type, // "Poison" or "Burn"
                        isDoT: true,
                        effectName: group.type,
                        isCrit: false,
                        mitigation: 0
                    });

                    // DoT Death Resolution Guardrail
                    if (entity.current_hp <= 0) {
                        events.push({
                            type: 'log',
                            message: `💀 ${entity.name || entity.charName || 'Entity'} died from ${group.type}!`
                        });
                    }
                }
            });
        };

        if (state.enemies) {
            state.enemies.forEach((enemy, idx) => processDoT(enemy, `enemy_${idx}`, true));
        }
        if (state.player_party && state.player_party.characters) {
            state.player_party.characters.forEach((char) => processDoT(char, char.slot, false));
        }
        // --- SA Chain Burst Trigger ---
        if ((state.current_turn_sa_count || 0) >= 2) {
            let chainMult = 1.2;
            if (state.current_turn_sa_count === 3) chainMult = 1.5;
            if (state.current_turn_sa_count >= 4) chainMult = 2.0;

            const attacker = this._findEntity(state, state.first_sa_attacker_id);
            const target = state.enemies && state.enemies[0];
            
            if (attacker && target && target.current_hp > 0) {
                const chainSkill = {
                    name: `SA Chain Burst`,
                    type: 'Damage',
                    modifier: chainMult,
                    element: state.first_sa_element || 'Neutral'
                };
                
                const calcResult = DamageCalculatorService.calculateDamage(attacker, target, chainSkill);
                target.current_hp = Math.max(0, (target.current_hp || target.final_stats.hp) - calcResult.damage);
                
                events.push({
                    type: 'damage',
                    sourceId: attacker.slot || attacker.id,
                    targetId: 'enemy_0',
                    value: calcResult.damage,
                    isCrit: calcResult.isCrit,
                    mitigation: calcResult.mitigationPercent,
                    skillName: `💥 SA Chain Burst (${state.current_turn_sa_count}x)`,
                    elementMultiplier: calcResult.elementMultiplier,
                    sourceElement: chainSkill.element
                });
            }
        }
        
        // Reset SA tracking at end of turn
        state.current_turn_sa_count = 0;
        state.first_sa_element = null;
        state.first_sa_attacker_id = null;
        // ------------------------------

        if (state.enemies) {
            for (const enemy of state.enemies) {
                if (enemy.is_boss) {
                    // Prevent ticking down if mode just changed this turn
                    if (enemy.mode_changed_this_turn) {
                        enemy.mode_changed_this_turn = false;
                    } else {
                        // 1. Tick turn counts for mode transitions
                        if (enemy.mode_state === 'enraged') {
                            enemy.enrage_turns = (enemy.enrage_turns || 3) - 1;
                            if (enemy.enrage_turns <= 0) {
                                // User rule: Time out Enraged -> Back to Normal (NOT exhausted)
                                enemy.mode_state = 'normal';
                                enemy.mode_bar = 0;
                                enemy.enrage_turns = 0;
                                events.push({ type: 'effect_applied', targetId: 'enemy_0', effectName: 'Enrage Timeout', effectType: 'buff' });
                            }
                        } else if (enemy.mode_state === 'exhausted') {
                            enemy.exhaust_turns = (enemy.exhaust_turns || 2) - 1;
                            if (enemy.exhaust_turns <= 0) {
                                enemy.mode_state = 'normal';
                                enemy.mode_bar = 0;
                                enemy.exhaust_turns = 0;
                                events.push({ type: 'effect_applied', targetId: 'enemy_0', effectName: 'Recovered', effectType: 'buff' });
                            }
                        }
                    }
                }
            }
        }

        // 3. Tick active buffs duration for everyone
        const tickBuffs = (entity, entityId) => {
            if (entity.active_buffs && entity.active_buffs.length > 0) {
                for (let i = entity.active_buffs.length - 1; i >= 0; i--) {
                    const buff = entity.active_buffs[i];
                    if (buff.applied_by_enemy_this_turn) {
                        buff.applied_by_enemy_this_turn = false;
                        continue;
                    }
                    const durKey = buff.mse_duration !== undefined ? 'mse_duration' : (buff.duration !== undefined ? 'duration' : null);
                    if (durKey && buff[durKey] > 0) {
                        buff[durKey] -= 1;
                        if (buff[durKey] <= 0) {
                            events.push({
                                type: 'effect_removed',
                                targetId: entityId,
                                effectName: buff.effect_name || buff.target_stat
                            });
                            entity.active_buffs.splice(i, 1);
                        }
                    }
                }
            }
        };

        if (state.enemies) {
            state.enemies.forEach((enemy, idx) => tickBuffs(enemy, `enemy_${idx}`));
        }
        if (state.player_party && state.player_party.characters) {
            state.player_party.characters.forEach(char => {
                tickBuffs(char, char.slot);
                // Tick down skill cooldowns
                if (char.skills) {
                    char.skills.forEach(skill => {
                        if (skill.current_cooldown > 0) {
                            skill.current_cooldown -= 1;
                        }
                    });
                }
            });
        }

        this._checkWaveClear(state, events);

        state.current_turn = (state.current_turn || 1) + 1;

        // Async persist
        db.query(`UPDATE battle_sessions SET battle_state_json = ? WHERE bs_id = ? AND bs_status = 'ACTIVE'`, [JSON.stringify(state), bsId]).catch(e => console.error(e));

        return {
            events: events,
            stateSnapshot: state
        };
    }

    /**
     * Determines the smartest target for the enemy based on skill modifiers.
     * @param {Array} alive - Array of alive player characters.
     * @param {Object} modifiers - The skill's score_modifiers.
     * @returns {String} The target slot/id.
     */
    _determineSmartTarget(alive, modifiers) {
        if (!alive || alive.length === 0) return null;
        if (!modifiers) return alive[Math.floor(Math.random() * alive.length)].slot || alive[0].id;

        // 1. Target Lowest HP (Execute)
        if (modifiers.party_lowest_hp_missing_pct || modifiers.Target_Lowest_HP) {
            let targets = [];
            let highestMissing = -1;
            alive.forEach(p => {
                const max = p.max_hp !== undefined ? p.max_hp : p.maxHp;
                const cur = p.current_hp !== undefined ? p.current_hp : p.hp;
                const missing = max > 0 ? (max - cur) / max : 0;
                
                // Allow a tiny margin of floating point error
                if (missing > highestMissing + 0.001) {
                    highestMissing = missing;
                    targets = [p];
                } else if (Math.abs(missing - highestMissing) <= 0.001) {
                    targets.push(p);
                }
            });
            const chosen = targets[Math.floor(Math.random() * targets.length)];
            return chosen.slot || chosen.id;
        }

        // 2. Target Highest HP (Tank Buster)
        if (modifiers.party_highest_hp_pct) {
            let targets = [];
            let highestHpPct = -1;
            alive.forEach(p => {
                const max = p.max_hp !== undefined ? p.max_hp : p.maxHp;
                const cur = p.current_hp !== undefined ? p.current_hp : p.hp;
                const pct = max > 0 ? cur / max : 0;
                
                if (pct > highestHpPct + 0.001) {
                    highestHpPct = pct;
                    targets = [p];
                } else if (Math.abs(pct - highestHpPct) <= 0.001) {
                    targets.push(p);
                }
            });
            const chosen = targets[Math.floor(Math.random() * targets.length)];
            return chosen.slot || chosen.id;
        }

        // 3. Target Highest Buffs (Punisher)
        if (modifiers.party_buff_count) {
            let targets = [];
            let highestBuffs = -1;
            alive.forEach(p => {
                const buffs = (p.active_buffs || p.activeEffects || []).filter(e => (e.effect_type || e.type || '').toLowerCase() === 'buff').length;
                
                if (buffs > highestBuffs) {
                    highestBuffs = buffs;
                    targets = [p];
                } else if (buffs === highestBuffs) {
                    targets.push(p);
                }
            });
            const chosen = targets[Math.floor(Math.random() * targets.length)];
            return chosen.slot || chosen.id;
        }

        // Fallback: Random
        return alive[Math.floor(Math.random() * alive.length)].slot || alive[0].id;
    }

    async processEnemyTurn(bsId) {
        let state = BattleMemoryStore.get(bsId);
        if (!state) {
            const [rows] = await db.query('SELECT battle_state_json FROM battle_sessions WHERE bs_id = ?', [bsId]);
            if (rows.length > 0 && rows[0].battle_state_json) {
                try { state = JSON.parse(rows[0].battle_state_json); } catch (e) { }
            }
        }
        if (!state) throw new Error("ACTIVE_SESSION_NOT_FOUND");
        
        let allEvents = [];
        
        for (let enemyIdx = 0; enemyIdx < state.enemies.length; enemyIdx++) {
            const enemy = state.enemies[enemyIdx];
            if (!enemy || (enemy.current_hp !== undefined ? enemy.current_hp : enemy.hp) <= 0) {
                continue; // Skip dead enemies
            }
            
            const sourceId = `enemy_${enemyIdx}`;

            // 0. Skip if stunned
            const isStunned = enemy.active_buffs && enemy.active_buffs.some(e => e.target_stat === 'STUN');
            if (isStunned) {
                const enemyName = enemy.name || 'ENEMY';
                allEvents.push({ type: 'log', message: `⚡ ${enemyName.toUpperCase()} is STUNNED and skips their turn!` });
                continue;
            }
            
            // 1. Resolve pending mode transitions at the START of Enemy Turn
            if (enemy.is_boss) {
                if (enemy.pending_mode_transition === 'enraged') {
                    enemy.mode_state = 'enraged';
                    enemy.enrage_turns = 3;
                    enemy.mode_changed_this_turn = true;
                    enemy.pending_mode_transition = null;
                    allEvents.push({ type: 'enrage', targetId: sourceId });
                } else if (enemy.pending_mode_transition === 'exhausted') {
                    enemy.mode_state = 'exhausted';
                    enemy.exhaust_turns = 2;
                    enemy.enrage_turns = 0;
                    enemy.mode_changed_this_turn = true;
                    enemy.pending_mode_transition = null;
                    allEvents.push({ type: 'break', targetId: sourceId });
                }
            }

            const AiBehaviorService = require('./AiBehaviorService');
            let caSkill = null;
            
            if (enemy.is_boss) {
                // 1. Determine AI Action for Boss
                caSkill = AiBehaviorService.calculateBossAction(state, enemy.ai_behaviors || enemy.aiBehaviors);
                
                // --- FALLBACK MECHANISM ---
                if (!caSkill) {
                    const currentCa = enemy.current_ca !== undefined ? enemy.current_ca : 0;
                    const caMax = enemy.caMax !== undefined ? enemy.caMax : (enemy.final_stats && enemy.final_stats.caMax) !== undefined ? enemy.final_stats.caMax : 5;
                    const isExhausted = (enemy.mode_state || enemy.modeState) === 'exhausted';
                    
                    if (currentCa >= caMax && !isExhausted) {
                        const phase = (enemy.mode_state || enemy.modeState || 'Normal').trim().toLowerCase();
                        console.warn(`[AI WARNING] Boss ID ${enemy.id} has no valid Special Skill mapped for Phase '${phase}' or logic failed. Using Random Fallback.`);
                        
                        const specialSkills = (enemy.ai_behaviors || enemy.aiBehaviors || []).filter(b => {
                            const skill = b.skill || b;
                            const cat = skill.category || '';
                            return cat.toLowerCase() === 'special';
                        });
                        
                        if (specialSkills.length > 0) {
                            caSkill = specialSkills[Math.floor(Math.random() * specialSkills.length)];
                        }
                    }
                }
            } else {
                // Normal Monster Logic: Cast a random skill from their behavior list if CA is full
                const currentCa = enemy.current_ca !== undefined ? enemy.current_ca : 0;
                const caMax = enemy.caMax !== undefined ? enemy.caMax : (enemy.final_stats && enemy.final_stats.caMax) !== undefined ? enemy.final_stats.caMax : 5;
                
                const availableSkills = enemy.ai_behaviors || enemy.aiBehaviors || [];
                
                if (currentCa >= caMax && availableSkills.length > 0) {
                    caSkill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
                }
            }
            
            if (caSkill) {
                // CA Action
                let targetIds = [];
                const tType = (caSkill.skill ? caSkill.skill.target_type : caSkill.target_type).toLowerCase();
                const alivePlayers = (state.player_party.characters || []).filter(p => (p.current_hp !== undefined ? p.current_hp : p.hp) > 0);
                const aliveEnemies = (state.enemies || []).filter(e => (e.current_hp !== undefined ? e.current_hp : e.hp) > 0);
                
                if (tType === 'all_allies' || tType === 'single_ally' || tType === 'self') {
                    if (tType === 'all_allies') {
                        targetIds = aliveEnemies.map((e) => `enemy_${state.enemies.indexOf(e)}`);
                    } else if (tType === 'self') {
                        targetIds = [sourceId];
                    } else {
                        targetIds = [sourceId]; // Default to self
                    }
                } else {
                    if (tType === 'all_enemies') {
                        targetIds = alivePlayers.map(p => p.slot || p.id);
                    } else {
                        if (alivePlayers.length > 0) {
                            const modifiers = caSkill.modifiers || caSkill.score_modifiers || {};
                            const smartTarget = this._determineSmartTarget(alivePlayers, modifiers);
                            targetIds = [smartTarget];
                        }
                    }
                }
                
                if (targetIds.length > 0) {
                    const actionData = { 
                        sourceId: sourceId, 
                        targetIds, 
                        actionType: 'skill', 
                        skillId: caSkill.skill ? caSkill.skill.id : caSkill.id,
                        skipCaReset: caSkill.isHpTrigger === true
                    };
                    const res = await this.processAction(bsId, actionData);
                    const enemyName = enemy.name || 'ENEMY';
                    allEvents.push({ type: 'log', message: `💀 ${enemyName.toUpperCase()} SPECIAL ATTACK: ${caSkill.skill ? caSkill.skill.name : caSkill.name}!` });
                    allEvents.push(...res.events);
                    state = res.stateSnapshot;
                }
            } else {
                // Basic Attack(s)
                let attacksCount = 1;
                const isCaMax = (enemy.current_ca || 0) >= (enemy.caMax !== undefined ? enemy.caMax : (enemy.final_stats && enemy.final_stats.caMax) !== undefined ? enemy.final_stats.caMax : 5);
                if ((enemy.mode_state === 'enraged' || enemy.modeState === 'enraged') && !isCaMax && Math.random() < 0.3) {
                    attacksCount = 2;
                }
                
                for (let i = 0; i < attacksCount; i++) {
                    let targetIds = [];
                    const alive = (state.player_party.characters || []).filter(p => (p.current_hp !== undefined ? p.current_hp : p.hp) > 0);
                    if (alive.length > 0) {
                        if ((enemy.mode_state === 'enraged' || enemy.modeState === 'enraged') && Math.random() < 0.5) {
                            const smartTarget = this._determineSmartTarget(alive, { party_lowest_hp_missing_pct: 1 });
                            targetIds = [smartTarget];
                        } else {
                            targetIds = [alive[Math.floor(Math.random() * alive.length)].slot || alive[0].id];
                        }
                    }
                    
                    const isExhausted = (enemy.mode_state === 'exhausted' || enemy.modeState === 'exhausted');
                    const actionData = { sourceId: sourceId, targetIds, actionType: 'attack', skillId: null, skipCaGain: (i > 0) || isExhausted };
                    const res = await this.processAction(bsId, actionData);
                    
                    if (i === 1) {
                        const enemyName = enemy.name || 'ENEMY';
                        allEvents.push({ type: 'log', message: `🔥 ${enemyName.toUpperCase()} DOUBLE ATTACK!` });
                    }
                    allEvents.push(...res.events);
                    state = res.stateSnapshot;
                }
            }
        }
        
        return { events: allEvents, stateSnapshot: state };
    }
}

const battleServiceInstance = new BattleService();

// Start Active Session GC: setiap 15 menit
setInterval(() => battleServiceInstance.runActiveSessionGC(), 15 * 60 * 1000);

module.exports = battleServiceInstance;
