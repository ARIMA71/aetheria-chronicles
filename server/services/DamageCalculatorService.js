/**
 * DamageCalculatorService
 * Handles the 6-Phase combat logic for Server-Authoritative calculations.
 */

class DamageCalculatorService {
    /**
     * Phase 2: Dynamic Buff/Debuff Calculation
     */
    calculateCurrentStat(baseStat, targetStatName, activeEffects) {
        if (!activeEffects || activeEffects.length === 0) return baseStat;

        let buffMultiplier = 0;
        let debuffMultiplier = 0;

        activeEffects.forEach(eff => {
            if (eff.target_stat === targetStatName) {
                const val = Number(eff.value) || 0;
                const type = (eff.effect_type || '').toLowerCase();
                
                if (type === 'buff') {
                    buffMultiplier += val;
                } else if (type === 'debuff') {
                    debuffMultiplier += Math.abs(val);
                } else {
                    // Fallback if effect_type is missing but it's a stat modifier
                    if (val > 0) buffMultiplier += val;
                    else debuffMultiplier += Math.abs(val);
                }
            }
        });

        // Current = Base * (1 + sum(buffs) - sum(debuffs))
        const finalStat = baseStat * (1 + buffMultiplier - debuffMultiplier);
        return Math.max(0, finalStat);
    }

    /**
     * Get elemental multiplier
     */
    getElementMultiplier(attackerElement, defenderElement) {
        if (!attackerElement || !defenderElement) return 1.0;
        const ae = attackerElement.trim().toLowerCase();
        const de = defenderElement.trim().toLowerCase();

        if (ae === de) return 1.0;

        if (
            (ae === 'fire' && de === 'wind') ||
            (ae === 'wind' && de === 'earth') ||
            (ae === 'earth' && de === 'fire')
        ) {
            return 1.5;
        }

        if (
            (ae === 'wind' && de === 'fire') ||
            (ae === 'earth' && de === 'wind') ||
            (ae === 'fire' && de === 'earth')
        ) {
            return 0.75;
        }

        return 1.0; // Neutral
    }

    /**
     * Executes the 6-Phase Damage Calculation
     * @param {object} attacker - Entity object (Player/Enemy)
     * @param {object} target - Entity object
     * @param {object} skill - Skill object
     * @returns {object} Final damage details
     */
    calculateDamage(attacker, target, skill) {
        let baseAtk = attacker.final_stats ? attacker.final_stats.atk : (attacker.base_atk || 1);
        if (isNaN(baseAtk) || baseAtk <= 0) baseAtk = 1;
        
        let baseDef = target.final_stats ? target.final_stats.def : (target.base_def || 1);
        if (isNaN(baseDef) || baseDef <= 0) baseDef = 1;
        
        const baseCrit = 0.05; // 5% base crit rate for now, adjust if you have a CRIT stat

        // Specific rule for enemy mode stat modifiers
        if (attacker.mode_state === 'enraged') {
            baseAtk *= 1.2; // 20% ATK up
        } else if (attacker.mode_state === 'exhausted') {
            baseAtk *= 0.8; // 20% ATK down
        }

        if (target.mode_state === 'exhausted') {
            baseDef *= 0.8; // 20% DEF down
        }

        // Phase 2: Dynamic Stat Mutation
        const currentAtk = this.calculateCurrentStat(baseAtk, 'ATK', attacker.active_buffs || []);
        const currentDef = this.calculateCurrentStat(baseDef, 'DEF', target.active_buffs || []);

        // Phase 3: Skill Multiplier
        const modifier = Number(skill.modifier) || 1.0;
        const rawSkillDamage = currentAtk * modifier;

        // Phase 4: Elemental Advantage
        const elemMultiplier = this.getElementMultiplier(skill.element || attacker.element, target.element);
        const elementalDamage = rawSkillDamage * elemMultiplier;

        // Phase 5: Linear Mitigation (max 80%)
        const mitigation = Math.min(0.80, currentDef / 6500);
        const mitigatedDamage = elementalDamage * (1 - mitigation);

        // Phase 6: Critical & RNG Variance
        let isCrit = false;
        
        // Critical Check (Increase chance with CRIT buffs)
        let currentCritRate = this.calculateCurrentStat(baseCrit, 'CRIT', attacker.active_buffs || []);
        if (Math.random() <= currentCritRate) {
            isCrit = true;
        }

        // Apply Crit Damage Multiplier (User requested 1.5x)
        let finalDamage = mitigatedDamage;
        if (isCrit) {
            finalDamage *= 1.5;
        }

        // RNG Variance +/- 5%
        const variance = 0.95 + (Math.random() * 0.10); 
        finalDamage *= variance;

        // Hard Floor
        finalDamage = Math.max(1, Math.floor(finalDamage));

        return {
            damage: finalDamage,
            isCrit,
            elementMultiplier: elemMultiplier,
            mitigationPercent: Math.round(mitigation * 100)
        };
    }
}

module.exports = new DamageCalculatorService();
