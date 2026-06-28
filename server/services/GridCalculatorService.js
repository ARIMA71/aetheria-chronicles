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
    calculatePartyStats(charRows, weaponRows, weaponPassiveRows, skillMap) {
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

        // Map Characters and apply Passives
        const characters = charRows.map(char => {
            const charSkills = Array.from(skillMap.values())
                .filter(s => s._inv_id === char.inv_id)
                .map(({ _inv_id, ...skill }) => skill); // omit internal _inv_id

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

        return characters;
    }
}

module.exports = new GridCalculatorService();
