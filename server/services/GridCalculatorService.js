/**
 * GridCalculatorService
 * Handles the calculation of base stats and weapon grid passive multipliers.
 */

class GridCalculatorService {
    /**
     * Calculates the final stats of characters based on weapon grid passives.
     * 
     * @param {Array} charRows - Character data rows from DB.
     * @param {Array} weaponRows - Weapon grid data rows from DB.
     * @param {Array} weaponPassiveRows - Passive skill rows from DB.
     * @param {Map} skillMap - Map of skills with their status effects.
     * @returns {Array} List of processed character objects.
     */
    calculatePartyBaseStats(charRows, weaponRows, weaponPassiveRows) {
        // Calculate Grid Base (Raw Stat sum)
        let totalGridHp = 0;
        let totalGridAtk = 0;
        (weaponRows || []).forEach(wp => {
            totalGridHp += Number(wp.calculated_hp) || 0;
            totalGridAtk += Number(wp.calculated_atk) || 0;
        });

        // Get main weapon element for MC
        const mainWeapon = (weaponRows || []).find(w => w.is_main_weapon === 1);
        const mainWeaponElement = mainWeapon ? mainWeapon.element : 'Fire';

        const statsMap = {};
        charRows.forEach(char => {
            // Base stat = character growth stat + flat weapon grid stats
            const rawHp  = (Number(char.base_hp)  || 0) + totalGridHp;
            const rawAtk = (Number(char.base_atk) || 0) + totalGridAtk;
            const rawDef = Number(char.base_def)   || 500;

            // MC inherits main weapon element
            const charElement = char.element === 'Any' ? mainWeaponElement : char.element;

            // Calculate Passive Percentage Bonuses
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

            statsMap[char.inv_id] = {
                element: charElement,
                final_hp: Math.floor(rawHp  * (1 + personalPassive.HP)),
                final_atk: Math.floor(rawAtk * (1 + personalPassive.ATK)),
                final_def: Math.floor(rawDef * (1 + personalPassive.DEF)),
                final_crit: Number((0.1 + (personalPassive.CRIT || 0)).toFixed(4)),
                max_sa: Number(char.max_sa) || 100
            };
        });

        return statsMap;
    }
}

module.exports = new GridCalculatorService();
