const db = require('../config/db');
const GridCalculatorService = require('./GridCalculatorService');
const AiBehaviorService = require('./AiBehaviorService');
const BattleMemoryStore = require('../cache/BattleMemoryStore');

// Helper formatting status effect from DB
function formatStatusEffect(row, prefix = '') {
    const name = row[`${prefix}effect_name`];
    if (!name) return null;
    return {
        effect_name:   name,
        effect_type:   row[`${prefix}effect_type`]   || null,
        target_stat:   row[`${prefix}target_stat`]   || null,
        value:         Number(row[`${prefix}effect_value`]) || 0,
        duration:      row[`${prefix}effect_duration`] !== undefined ? row[`${prefix}effect_duration`] : null,
        effect_target: row[`${prefix}effect_target`]  || null
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
            ms.ms_cooldown AS cooldown, ms.ms_element AS element, ms.ms_icon_path AS icon_path, ms.ms_vfx_path AS vfx_path,
            mse.mse_name AS effect_name, mse.mse_type AS effect_type, mse.modifier_target AS target_stat,
            mse.modifier_value AS effect_value, mse.mse_duration AS effect_duration, sse.effect_target AS effect_target, mse.mse_id AS mse_id
        FROM player_party_presets ppp
        JOIN player_inventories pi ON ppp.main_char_inv_id = pi.inv_id
        JOIN player_mc_skills pmcs ON ppp.ppp_id = pmcs.ppp_id
        JOIN master_skills ms ON pmcs.ms_id = ms.ms_id
        LEFT JOIN skill_status_effects sse ON ms.ms_id = sse.ms_id
        LEFT JOIN master_status_effects mse ON sse.mse_id = mse.mse_id
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?
        UNION ALL
        SELECT pi.inv_id, ms.ms_id, ms.ms_name AS name, ms.ms_category AS category,
            ms.ms_action_type AS type, ms.ms_target_type AS target_type, ms.ms_modifier_value AS modifier,
            ms.ms_cooldown AS cooldown, ms.ms_element AS element, ms.ms_icon_path AS icon_path, ms.ms_vfx_path AS vfx_path,
            mse.mse_name AS effect_name, mse.mse_type AS effect_type, mse.modifier_target AS target_stat,
            mse.modifier_value AS effect_value, mse.mse_duration AS effect_duration, sse.effect_target AS effect_target, mse.mse_id AS mse_id
        FROM player_party_presets ppp
        JOIN player_inventories pi ON pi.inv_id IN (ppp.char_slot_1_inv_id, ppp.char_slot_2_inv_id, ppp.char_slot_3_inv_id)
        JOIN item_skills its ON pi.master_item_id = its.item_id AND its.item_type = 'Character'
        JOIN master_skills ms ON its.ms_id = ms.ms_id
        LEFT JOIN skill_status_effects sse ON ms.ms_id = sse.ms_id
        LEFT JOIN master_status_effects mse ON sse.mse_id = mse.mse_id
        WHERE ppp.player_id = ? AND ppp.preset_slot = ?
        UNION ALL
        SELECT pi_mc.inv_id, ms.ms_id, ms.ms_name AS name, ms.ms_category AS category,
            ms.ms_action_type AS type, ms.ms_target_type AS target_type, ms.ms_modifier_value AS modifier,
            ms.ms_cooldown AS cooldown, ms.ms_element AS element, ms.ms_icon_path AS icon_path, ms.ms_vfx_path AS vfx_path,
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
            ms.ms_cooldown AS cooldown, ms.ms_element AS element, ms.ms_icon_path AS icon_path, ms.ms_vfx_path AS vfx_path,
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
        SELECT mon.mon_id, mon.mon_name, mon.mon_element, mon.mon_base_hp, mon.mon_hp_growth,
            mon.mon_base_atk, mon.mon_atk_growth, mon.mon_base_def, mon.mon_def_growth, mon.mon_max_ca,
            mon.mon_icon_path, mon.mon_sprite_path, qe.monster_level,
            mb.mb_id, mb.boss_phase, mb.base_utility, mb.score_modifiers,
            ms.ms_id AS skill_id, ms.ms_name AS skill_name, ms.ms_category AS skill_category,
            ms.ms_action_type AS skill_type, ms.ms_target_type AS skill_target_type, ms.ms_modifier_value AS skill_modifier,
            ms.ms_cooldown AS skill_cooldown, ms.ms_icon_path AS skill_icon_path, ms.ms_vfx_path AS skill_vfx_path,
            mse.mse_name AS effect_name, mse.mse_type AS effect_type, mse.modifier_target AS target_stat,
            mse.modifier_value AS effect_value, mse.mse_duration AS effect_duration, sse.effect_target AS effect_target
        FROM quest_enemies qe
        JOIN master_monsters mon ON qe.mon_id = mon.mon_id
        LEFT JOIN monster_behavior mb ON mon.mon_id = mb.mon_id
        LEFT JOIN master_skills ms ON mb.ms_id = ms.ms_id
        LEFT JOIN skill_status_effects sse ON ms.ms_id = sse.ms_id
        LEFT JOIN master_status_effects mse ON sse.mse_id = mse.mse_id
        WHERE qe.mq_id = ?
        ORDER BY mon.mon_id, mb.mb_id, mse.mse_id
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
            [charRows], [skillRows], [monsterRows], [weaponRows], [weaponPassiveRows]
        ] = await Promise.all([
            db.query(queryCharacters, [playerId, presetSlot, playerId, presetSlot, playerId, presetSlot, playerId, presetSlot]),
            db.query(querySkills, [playerId, presetSlot, playerId, presetSlot, playerId, presetSlot, playerId, presetSlot]),
            db.query(queryMonsters, [questId]),
            db.query(queryWeapons, [playerId, presetSlot]),
            db.query(queryWeaponPassives, [playerId, presetSlot])
        ]);

        if (charRows.length === 0) throw new Error('Party preset tidak ditemukan untuk player dan slot yang diberikan.');

        // Group Skills
        const skillMap = new Map();
        skillRows.forEach(row => {
            const key = `${row.inv_id}:${row.ms_id}`;
            if (!skillMap.has(key)) {
                skillMap.set(key, {
                    _inv_id: row.inv_id, id: row.ms_id, name: row.name, category: row.category,
                    type: row.type, target_type: row.target_type, modifier: Number(row.modifier) || 0,
                    cooldown: row.cooldown, element: row.element, icon_path: row.icon_path, vfx_path: row.vfx_path,
                    status_effects: []
                });
            }
            const effect = formatStatusEffect(row);
            if (effect) skillMap.get(key).status_effects.push(effect);
        });

        // Delegate to GridCalculatorService
        const characters = GridCalculatorService.calculatePartyStats(charRows, weaponRows, weaponPassiveRows, skillMap);

        // Map Enemies
        const monsterMap = {};
        const behaviorMap = {};
        monsterRows.forEach(row => {
            if (!monsterMap[row.mon_id]) {
                monsterMap[row.mon_id] = {
                    id: row.mon_id, name: row.mon_name, element: row.mon_element, level: row.monster_level || 1,
                    final_stats: {
                        hp:  (Number(row.mon_base_hp) || 0) + (Number(row.mon_hp_growth) || 0) * ((row.monster_level || 1) - 1),
                        atk: (Number(row.mon_base_atk) || 0) + (Number(row.mon_atk_growth) || 0) * ((row.monster_level || 1) - 1),
                        def: (Number(row.mon_base_def) || 0) + (Number(row.mon_def_growth) || 0) * ((row.monster_level || 1) - 1)
                    },
                    caMax: Number(row.mon_max_ca) || 5, icon_path: row.mon_icon_path, sprite_path: row.mon_sprite_path,
                    ai_behaviors: []
                };
            }

            if (row.mb_id !== null && row.skill_id !== null) {
                if (!behaviorMap[row.mb_id]) {
                    let parsedModifiers = row.score_modifiers;
                    if (typeof parsedModifiers === 'string') {
                        try { parsedModifiers = JSON.parse(parsedModifiers); } catch (e) { parsedModifiers = {}; }
                    }

                    const behaviorEntry = {
                        phase: row.boss_phase || 'Normal', base_utility: Number(row.base_utility) || 1.0,
                        modifiers: parsedModifiers || {},
                        skill: {
                            id: row.skill_id, name: row.skill_name, category: row.skill_category,
                            type: row.skill_type, target_type: row.skill_target_type || 'Single_Enemy',
                            modifier: Number(row.skill_modifier) || 0, cooldown: row.skill_cooldown,
                            icon_path: row.skill_icon_path, vfx_path: row.skill_vfx_path, status_effects: []
                        }
                    };
                    behaviorMap[row.mb_id] = behaviorEntry;
                    monsterMap[row.mon_id].ai_behaviors.push(behaviorEntry);
                }
                const effect = formatStatusEffect(row);
                if (effect) behaviorMap[row.mb_id].skill.status_effects.push(effect);
            }
        });
        const enemies = Object.values(monsterMap);
        if (enemies.length === 0) throw new Error(`Tidak ada musuh yang ditemukan untuk questId: ${questId}`);

        // Potion Count (mat_id 6: Green Potion, mat_id 8: Full Potion)
        const [materialRow] = await db.query('SELECT mat_id, quantity FROM player_materials WHERE player_id = ? AND mat_id IN (6, 8)', [playerId]);
        let potionCount = 0;
        let fullPotionCount = 0;
        materialRow.forEach(mat => {
            if (mat.mat_id === 6) potionCount = mat.quantity;
            if (mat.mat_id === 8) fullPotionCount = mat.quantity;
        });

        // Construct Initial State
        const initialState = {
            quest_id: parseInt(questId),
            player_party: { characters },
            enemies,
            potion_count: potionCount,
            full_potion_count: fullPotionCount
        };

        // Create Database Anchor Record
        const [insertRes] = await db.query(
            'INSERT INTO battle_sessions (player_id, mq_id, battle_state_json) VALUES (?, ?, ?)',
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
        // Option B: Client-Driven State Snapshot
        // The frontend sends its latest battleState, we anchor it to RAM,
        // then the AiBehaviorService computes using it.
        
        // 1. Anchor state to RAM to keep server cache fresh
        BattleMemoryStore.set(bsId, battleStateSnapshot);
        
        // 2. Fetch the newly saved state (it gets lastAccessed updated)
        const updatedState = BattleMemoryStore.get(bsId);

        // 3. Compute AI decision
        const selectedSkill = AiBehaviorService.calculateBossAction(updatedState, bossSkills);
        return selectedSkill;
    }

    async finalizeBattle(bsId) {
        // Get the final state from RAM if we want to log it
        const finalState = BattleMemoryStore.get(bsId);

        // Note: Actual item drop calculation logic is handled in the controller (from saveBattleResult), 
        // we can leave that in the controller or move it here. Let's just do memory cleanup for this method for now, 
        // since the controller will handle the MySQL transaction for rewards.
        
        // Mark database session as completed
        await db.query(
            'UPDATE battle_sessions SET battle_state_json = ? WHERE bs_id = ?',
            [JSON.stringify(finalState || { status: "CLEARED" }), bsId]
        );

        // Remove from RAM
        BattleMemoryStore.delete(bsId);
    }
}

module.exports = new BattleService();
