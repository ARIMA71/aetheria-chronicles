/**
 * CombatManager.js
 * Handles pure calculations for damage, element multipliers, and status effects.
 */

export default class CombatManager {
    /**
     * Calculates the mitigated damage with elemental advantage.
     * @param {number} rawDmg - Base damage (ATK * modifier)
     * @param {object} attacker - Attacker entity
     * @param {object} target - Target entity
     * @param {object} enemyRef - Reference to the enemy/boss object to distinguish roles
     * @returns {number} Final integer damage
     */
    static calcMitigatedDmg(rawDmg, attacker, target, enemyRef) {
        const isTargetEnemy = (target === enemyRef);
        const targetDef = target.getStat('DEF');

        // Scale DEF if enemy is in exhausted mode
        const effectiveDef = (isTargetEnemy && enemyRef.modeState === 'exhausted')
            ? targetDef * 0.7
            : targetDef;

        const mitigation = effectiveDef / (effectiveDef + 500);
        let dmg = rawDmg * (1 - mitigation);

        // Calculate elemental advantage
        const mult = CombatManager.getElementMultiplier(attacker.element, target.element);
        dmg *= mult;

        return Math.max(Math.floor(dmg), 1);
    }

    /**
     * Gets the multiplier based on element relationships.
     * Fire > Wind > Earth > Fire
     * Strong: +50% (1.5), Weak: -25% (0.75)
     */
    static getElementMultiplier(attackerElement, defenderElement) {
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
     * Applies status effects to targets and handles special overrides (HP Sacrifice, Ult Boost).
     * @param {object} caster - Entity casting the skill
     * @param {object} skill - The skill configuration object
     * @param {Array} statusEffects - Array of status effect objects
     * @param {Array} players - Array of player entities
     * @param {object} enemy - The enemy/boss entity
     * @param {Function} logCallback - Function to log messages to the game UI
     * @param {Function} refreshHudCallback - Function to refresh the enemy HUD UI
     */
    static applyStatusEffects(caster, skill, statusEffects, players, enemy, logCallback, refreshHudCallback) {
        if (!statusEffects || !statusEffects.length) return;

        statusEffects.forEach(eff => {
            let targets = [];
            if (eff.effect_target === 'Self') {
                targets = [caster];
            } else {
                const targetType = (skill.target_type || '').toLowerCase();
                const isCasterPlayer = (caster !== enemy);

                if (isCasterPlayer) {
                    if (targetType === 'all_allies') {
                        targets = players.filter(pl => pl.hp > 0);
                    } else if (targetType === 'self') {
                        targets = [caster];
                    } else {
                        targets = [enemy];
                    }
                } else {
                    if (targetType === 'all_allies' || targetType === 'self') {
                        targets = [enemy];
                    } else {
                        targets = players.filter(pl => pl.hp > 0);
                    }
                }
            }

            targets.forEach(tgt => {
                // --- CUSTOM HANDLING FOR DELAY & SA BOOST (target_stat = 'ULT') ---
                if (eff.target_stat === 'ULT') {
                    const value = Number(eff.value) || 0;
                    if (tgt === enemy) {
                        const oldBar = enemy.caBar;
                        enemy.caBar = Math.max(0, Math.min(enemy.caMax, enemy.caBar + value));
                        if (refreshHudCallback) refreshHudCallback();
                        if (value < 0) {
                            logCallback(`✨ ${skill.name}: Drained ${oldBar - enemy.caBar} Charge Bar segment(s) from ${tgt.charName}!`);
                        } else if (value > 0) {
                            logCallback(`✨ ${skill.name}: Boosted ${tgt.charName}'s Charge Bar by ${enemy.caBar - oldBar} segment(s)!`);
                        }
                    } else {
                        const changeAmt = value * 100;
                        tgt.specialBar = Math.max(0, Math.min(tgt.specialMax, tgt.specialBar + changeAmt));
                        tgt.refreshVisual();
                        if (value < 0) {
                            logCallback(`✨ ${skill.name}: Reduced ${tgt.charName}'s SA Bar by ${Math.abs(changeAmt)}%!`);
                        } else if (value > 0) {
                            logCallback(`✨ ${skill.name}: Boosted ${tgt.charName}'s SA Bar by ${changeAmt}%!`);
                        }
                    }
                    return;
                }

                // --- CUSTOM HANDLING FOR HP SACRIFICE (target_stat = 'HP' with negative value) ---
                if (eff.target_stat === 'HP' && Number(eff.value) < 0) {
                    const value = Number(eff.value);
                    const sacrificeDmg = Math.floor(Math.abs(value) * tgt.maxHp);
                    tgt.hp = Math.max(0, tgt.hp - sacrificeDmg);
                    tgt.refreshVisual();
                    logCallback(`✨ ${skill.name}: ${tgt.charName} sacrificed ${sacrificeDmg} HP!`);
                    return;
                }

                tgt.addEffect(eff);
                tgt.refreshVisual();
                if (eff.effect_name) {
                    logCallback(`${skill.name} inflicts ${eff.effect_name} on ${tgt.charName}`);
                }
            });
        });
    }

    /**
     * Executes the AI Fallback sequence.
     * Updates the local state to ensure the snapshot integrity for the next turn.
     * @param {object} enemy - The enemy/boss object
     * @param {boolean} isCaReady - Whether CA bar is full and enemy is not exhausted
     * @returns {object} The chosen fallback behavior/skill
     */
    static getAiFallbackAction(enemy, isCaReady) {
        const behaviors = enemy.aiBehaviors || [];
        
        let chosenBehavior = null;
        if (isCaReady) {
            // Force a damage skill to reset CA
            const damageSkills = behaviors.filter(b => b.skill && (b.skill.type || '').toLowerCase() === 'damage');
            if (damageSkills.length > 0) {
                chosenBehavior = damageSkills[Math.floor(Math.random() * damageSkills.length)];
            }
        } 
        
        // If CA is not ready, or no damage skill found, fallback to basic attack (or random normal skill)
        if (!chosenBehavior) {
            // We want a utility=0 or random basic skill. Let's just pick any skill, or we return null to force Basic Attack.
            // Returning null makes battleScene fall back to executeEnemyBasicAttack.
            return null;
        }

        return chosenBehavior;
    }
}
