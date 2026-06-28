/**
 * DamageCalculatorService
 * Handles formulas for calculating damage, elemental advantages, and mitigations.
 * Note: Under Option B (Client-Driven State Snapshot), this is currently a skeleton 
 * preparing for future Full Server-Authoritative migrations.
 */

class DamageCalculatorService {
    /**
     * Calculates final damage considering DEF and element modifiers.
     * @param {number} rawDamage - Base attack power (e.g. ATK * skill modifier)
     * @param {object} attacker - The attacking entity (Player/Enemy)
     * @param {object} defender - The defending entity (Player/Enemy)
     * @returns {number} Final mitigated damage
     */
    calculateMitigatedDamage(rawDamage, attacker, defender) {
        // Element Advantage Table
        const elements = {
            'Fire': { weakTo: 'Wind', strongTo: 'Earth' },
            'Wind': { weakTo: 'Earth', strongTo: 'Fire' },
            'Earth': { weakTo: 'Fire', strongTo: 'Wind' },
            'Any': { weakTo: null, strongTo: null }
        };

        const attElem = attacker.element || 'None';
        const defElem = defender.element || 'None';
        
        let elemMultiplier = 1.0;
        if (elements[attElem] && elements[attElem].strongTo === defElem) {
            elemMultiplier = 1.25; // Super Effective
        } else if (elements[defElem] && elements[defElem].strongTo === attElem) {
            elemMultiplier = 0.75; // Not very effective
        }

        // Def Mitigation formula: Damage = Raw * (100 / (100 + DEF))
        const defStat = (defender.final_stats && defender.final_stats.def) || defender.def || 100;
        const mitigated = rawDamage * (100 / (100 + defStat));

        return Math.floor(mitigated * elemMultiplier);
    }
}

module.exports = new DamageCalculatorService();
