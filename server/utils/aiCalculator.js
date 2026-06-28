/**
 * AI Calculator for Aetheria Chronicles Boss Enemies
 * Utility-driven Behavior Tree AI logic.
 */

/**
 * Calculates the best skill for the boss to execute.
 * 
 * @param {object} battleState - The real-time state of the battle.
 * @param {Array} bossSkills - List of boss skills / behavior rules from the database.
 * @returns {object|null} The selected skill behavior object.
 */
function calculateBossAction(battleState, bossSkills) {
    if (!battleState || !bossSkills || bossSkills.length === 0) {
        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. EXTRACT 8 PATENT VECTORS FROM BATTLE STATE
    // ─────────────────────────────────────────────────────────────────────────
    const characters = (battleState.player_party && battleState.player_party.characters) || [];
    
    // Vector 1: party_total_hp_pct
    let totalCurrentHp = 0;
    let totalMaxHp = 0;
    characters.forEach(c => {
        totalCurrentHp += (c.current_hp !== undefined ? c.current_hp : c.hp) || 0;
        totalMaxHp += (c.max_hp !== undefined ? c.max_hp : c.maxHp) || 0;
    });
    const party_total_hp_pct = totalMaxHp > 0 ? totalCurrentHp / totalMaxHp : 0;

    // Vector 2: party_lowest_hp_missing_pct
    let party_lowest_hp_missing_pct = 0;
    characters.forEach(c => {
        const cur = (c.current_hp !== undefined ? c.current_hp : c.hp) || 0;
        const max = (c.max_hp !== undefined ? c.max_hp : c.maxHp) || 0;
        if (max > 0) {
            const missing = (max - cur) / max;
            if (missing > party_lowest_hp_missing_pct) {
                party_lowest_hp_missing_pct = missing;
            }
        }
    });

    // Vector 3: party_highest_hp_pct
    let party_highest_hp_pct = 0;
    characters.forEach(c => {
        const cur = (c.current_hp !== undefined ? c.current_hp : c.hp) || 0;
        const max = (c.max_hp !== undefined ? c.max_hp : c.maxHp) || 0;
        if (max > 0) {
            const ratio = cur / max;
            if (ratio > party_highest_hp_pct) {
                party_highest_hp_pct = ratio;
            }
        }
    });

    // Helper to count buffs/debuffs
    const getEffectCounts = (effectsList) => {
        let buffs = 0;
        let debuffs = 0;
        (effectsList || []).forEach(eff => {
            const type = (eff.effect_type || eff.type || '').toLowerCase();
            if (type === 'buff') buffs++;
            else if (type === 'debuff') debuffs++;
        });
        return { buffs, debuffs };
    };

    // Vector 4 & 5: party_buff_count & party_debuff_count
    let party_buff_count = 0;
    let party_debuff_count = 0;
    characters.forEach(c => {
        const effects = c.activeEffects || c.active_effects || [];
        const { buffs, debuffs } = getEffectCounts(effects);
        party_buff_count += buffs;
        party_debuff_count += debuffs;
    });

    // Boss references
    const boss = battleState.boss || {};
    const bossCur = (boss.current_hp !== undefined ? boss.current_hp : boss.hp) || 0;
    const bossMax = (boss.max_hp !== undefined ? boss.max_hp : boss.maxHp) || 0;
    
    // Vector 6: boss_hp_pct
    const boss_hp_pct = bossMax > 0 ? bossCur / bossMax : 0;

    // Vector 7 & 8: boss_buff_count & boss_debuff_count
    const bossEffects = boss.activeEffects || boss.active_effects || [];
    const { buffs: boss_buff_count, debuffs: boss_debuff_count } = getEffectCounts(bossEffects);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. PHASE FILTERING
    // ─────────────────────────────────────────────────────────────────────────
    const currentPhase = (boss.phase || boss.modeState || 'Normal').trim().toLowerCase();
    
    const phaseSkills = bossSkills.filter(s => {
        const skillPhase = (s.phase || s.boss_phase || 'Normal').trim().toLowerCase();
        return skillPhase === currentPhase;
    });
    
    // Fallback to all skills if none matches current phase
    const candidateSkills = phaseSkills.length > 0 ? phaseSkills : bossSkills;

    // ─────────────────────────────────────────────────────────────────────────
    // 3. AVAILABILITY FILTER (COOLDOWN & ONE-TIME USE CHECKS)
    // ─────────────────────────────────────────────────────────────────────────
    const readySkills = candidateSkills.filter(s => {
        // Check cooldown
        const cooldown = s.currentCooldown !== undefined ? s.currentCooldown : s.cooldownCount;
        if (cooldown > 0) return false;

        // Check one-time use
        const mods = s.score_modifiers || s.modifiers || {};
        const isOneTime = mods.One_Time_Use === true || mods.one_time_use === true;
        if (isOneTime) {
            if (s.used === true) return false;
            
            // Check in list of used skill IDs in battleState
            const usedSkills = battleState.usedSkills || battleState.used_skills || [];
            const skillId = s.skill_id !== undefined ? s.skill_id : (s.skill && s.skill.id) !== undefined ? s.skill.id : s.id;
            
            if (Array.isArray(usedSkills) && usedSkills.includes(skillId)) return false;
            if (usedSkills instanceof Set && usedSkills.has(skillId)) return false;
        }

        // If CA is not ready, exclude normal skills (non-override skills)
        const isOverride = mods.override_hp_trigger !== undefined || mods.Trigger_HP_Threshold !== undefined;
        if (!isOverride) {
            const isCaReadyVal = boss.is_ca_ready !== undefined ? boss.is_ca_ready :
                                 boss.isCaReady !== undefined ? boss.isCaReady :
                                 battleState.isCaReady !== undefined ? battleState.isCaReady :
                                 battleState.is_ca_ready !== undefined ? battleState.is_ca_ready :
                                 true;
            const isCaReady = isCaReadyVal === true || isCaReadyVal === 1;
            if (!isCaReady) return false;
        }

        return true;
    });

    if (readySkills.length === 0) {
        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. ABSOLUTE HP OVERRIDE TRIGGER
    // ─────────────────────────────────────────────────────────────────────────
    const activeOverrides = readySkills.filter(s => {
        const mods = s.score_modifiers || s.modifiers || {};
        const trigger = mods.override_hp_trigger !== undefined ? mods.override_hp_trigger : mods.Trigger_HP_Threshold;
        if (trigger !== undefined && trigger !== null) {
            return boss_hp_pct <= Number(trigger);
        }
        return false;
    });

    if (activeOverrides.length > 0) {
        // Prioritize: lowest trigger threshold first (most critical), then highest base_utility
        activeOverrides.sort((a, b) => {
            const triggerA = Number((a.score_modifiers || a.modifiers || {}).override_hp_trigger || (a.score_modifiers || a.modifiers || {}).Trigger_HP_Threshold);
            const triggerB = Number((b.score_modifiers || b.modifiers || {}).override_hp_trigger || (b.score_modifiers || b.modifiers || {}).Trigger_HP_Threshold);
            if (triggerA !== triggerB) {
                return triggerA - triggerB;
            }
            const baseA = Number(a.base_utility !== undefined ? a.base_utility : a.baseUtility) || 0;
            const baseB = Number(b.base_utility !== undefined ? b.base_utility : b.baseUtility) || 0;
            return baseB - baseA;
        });
        return activeOverrides[0];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. UTILITY CALCULATIONS
    // ─────────────────────────────────────────────────────────────────────────
    let bestSkill = null;
    let maxScore = -Infinity;

    readySkills.forEach(s => {
        const baseUtility = Number(s.base_utility !== undefined ? s.base_utility : s.baseUtility) || 0;
        const mods = s.score_modifiers || s.modifiers || {};

        let score = baseUtility;

        // Loop through 8 patented battle conditions and apply weights
        const vectorKeys = [
            'party_total_hp_pct',
            'party_lowest_hp_missing_pct',
            'party_highest_hp_pct',
            'party_buff_count',
            'party_debuff_count',
            'boss_hp_pct',
            'boss_buff_count',
            'boss_debuff_count'
        ];

        vectorKeys.forEach(key => {
            let val = 0;
            if (key === 'party_total_hp_pct') val = party_total_hp_pct;
            else if (key === 'party_lowest_hp_missing_pct') val = party_lowest_hp_missing_pct;
            else if (key === 'party_highest_hp_pct') val = party_highest_hp_pct;
            else if (key === 'party_buff_count') val = party_buff_count;
            else if (key === 'party_debuff_count') val = party_debuff_count;
            else if (key === 'boss_hp_pct') val = boss_hp_pct;
            else if (key === 'boss_buff_count') val = boss_buff_count;
            else if (key === 'boss_debuff_count') val = boss_debuff_count;

            // MANDATORY RULE: Fallback to 0 if key is undefined in JSON modifiers
            const weight = mods[key] !== undefined ? mods[key] : 0;
            score += val * weight;
        });

        if (score > maxScore) {
            maxScore = score;
            bestSkill = s;
        }
    });

    return bestSkill;
}

module.exports = {
    calculateBossAction
};
