process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = '';
process.env.DB_NAME = 'db_aetheria';

const db = require('c:/Users/elsan/aetheria-chronicles/server/config/db');
const GridCalculatorService = require('c:/Users/elsan/aetheria-chronicles/server/services/GridCalculatorService');

async function test() {
    const playerId = 1;
    const presetSlot = 2;

    const queryCharacters = `
    SELECT 'Main Character' AS role_slot, pi.inv_id, pi.item_level AS level, mc.mc_id, mc.mc_name AS name, mc.mc_element AS element,
        (mc.mc_base_hp  + (mc.mc_hp_growth  * (pi.item_level - 1))) AS base_hp,
        (mc.mc_base_atk + (mc.mc_atk_growth * (pi.item_level - 1))) AS base_atk,
        (mc.mc_base_def + (mc.mc_def_growth * (pi.item_level - 1))) AS base_def,
        mc.mc_max_sa AS max_sa
    FROM player_party_presets ppp
    JOIN player_inventories pi ON ppp.main_char_inv_id = pi.inv_id
    JOIN master_characters mc ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
    WHERE ppp.player_id = ? AND ppp.preset_slot = ?
    UNION ALL
    SELECT 'Char Slot 1', pi.inv_id, pi.item_level, mc.mc_id, mc.mc_name, mc.mc_element,
        (mc.mc_base_hp  + (mc.mc_hp_growth  * (pi.item_level - 1))),
        (mc.mc_base_atk + (mc.mc_atk_growth * (pi.item_level - 1))),
        (mc.mc_base_def + (mc.mc_def_growth * (pi.item_level - 1))),
        mc.mc_max_sa
    FROM player_party_presets ppp
    JOIN player_inventories pi ON ppp.char_slot_1_inv_id = pi.inv_id
    JOIN master_characters mc  ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
    WHERE ppp.player_id = ? AND ppp.preset_slot = ?
    UNION ALL
    SELECT 'Char Slot 2', pi.inv_id, pi.item_level, mc.mc_id, mc.mc_name, mc.mc_element,
        (mc.mc_base_hp  + (mc.mc_hp_growth  * (pi.item_level - 1))),
        (mc.mc_base_atk + (mc.mc_atk_growth * (pi.item_level - 1))),
        (mc.mc_base_def + (mc.mc_def_growth * (pi.item_level - 1))),
        mc.mc_max_sa
    FROM player_party_presets ppp
    JOIN player_inventories pi ON ppp.char_slot_2_inv_id = pi.inv_id
    JOIN master_characters mc  ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
    WHERE ppp.player_id = ? AND ppp.preset_slot = ?
    UNION ALL
    SELECT 'Char Slot 3', pi.inv_id, pi.item_level, mc.mc_id, mc.mc_name, mc.mc_element,
        (mc.mc_base_hp  + (mc.mc_hp_growth  * (pi.item_level - 1))),
        (mc.mc_base_atk + (mc.mc_atk_growth * (pi.item_level - 1))),
        (mc.mc_base_def + (mc.mc_def_growth * (pi.item_level - 1))),
        mc.mc_max_sa
    FROM player_party_presets ppp
    JOIN player_inventories pi ON ppp.char_slot_3_inv_id = pi.inv_id
    JOIN master_characters mc  ON pi.master_item_id = mc.mc_id AND pi.item_type = 'Character'
    WHERE ppp.player_id = ? AND ppp.preset_slot = ?
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

    const [charRows] = await db.query(queryCharacters, [playerId, presetSlot, playerId, presetSlot, playerId, presetSlot, playerId, presetSlot]);
    const [weaponRows] = await db.query(queryWeapons, [playerId, presetSlot]);
    const [weaponPassiveRows] = await db.query(queryWeaponPassives, [playerId, presetSlot]);

    console.log("--- CHAR ROWS ---");
    console.log(charRows);
    console.log("--- WEAPON ROWS ---");
    console.log(weaponRows);
    console.log("--- WEAPON PASSIVE ROWS ---");
    console.log(weaponPassiveRows);

    const statsMap = GridCalculatorService.calculatePartyBaseStats(charRows, weaponRows, weaponPassiveRows);
    console.log("--- GRID CALCULATOR RESULTS ---");
    console.log(statsMap);

    process.exit(0);
}

test();
