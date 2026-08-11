require('dotenv').config({ path: '../.env' });
const AiBehaviorService = require('../services/AiBehaviorService');
const BattleService = require('../services/BattleService');

const createBattleState = (enemyHpPct, partyHpPct) => {
    const bossMaxHp = 100000;
    const charMaxHp = 10000;
    return {
        player_party: {
            characters: [
                {
                    slot: 'slot1',
                    id: 'char_1',
                    current_hp: charMaxHp * partyHpPct,
                    max_hp: charMaxHp,
                    active_buffs: []
                },
                {
                    slot: 'slot2',
                    id: 'char_2',
                    current_hp: charMaxHp * 1.0, // Full HP
                    max_hp: charMaxHp,
                    active_buffs: []
                }
            ]
        },
        enemies: [{
            slot: 'enemy_0',
            id: 'boss_1',
            current_hp: bossMaxHp * enemyHpPct,
            final_stats: { hp: bossMaxHp },
            mode_state: 'normal',
            current_ca: 5,
            caMax: 5,
            active_buffs: []
        }]
    };
};

const mockBossSkills = [
    {
        name: 'Flute',
        phase: 'Normal',
        currentCooldown: 0,
        base_utility: 0.6,
        modifiers: { party_buff_count: 0.25, party_debuff_count: -0.1 }
    },
    {
        name: 'Typhoon',
        phase: 'Normal',
        currentCooldown: 0,
        base_utility: 1.0,
        modifiers: { party_buff_count: -0.2, party_total_hp_pct: 0.7 }
    },
    {
        name: 'Slingshot',
        phase: 'Normal',
        currentCooldown: 0,
        base_utility: 1.0,
        modifiers: { party_lowest_hp_missing_pct: 2.0, Target_Lowest_HP: true }
    }
];

function calculateScore(skill, state) {
    const aliveChars = state.player_party.characters.filter(c => c.current_hp > 0);
    const boss = state.enemies[0];
    const boss_hp_pct = boss.current_hp / (boss.final_stats.hp || boss.max_hp);
    
    let partyTotalHp = 0, partyMaxHp = 0;
    let minHpPct = 1.0;
    let partyBuffCount = 0;
    
    aliveChars.forEach(c => {
        partyTotalHp += c.current_hp;
        partyMaxHp += c.max_hp;
        const pct = c.current_hp / c.max_hp;
        if (pct < minHpPct) minHpPct = pct;
        if (c.active_buffs) partyBuffCount += c.active_buffs.length;
    });
    const party_total_hp_pct = partyTotalHp / partyMaxHp;
    const party_lowest_hp_missing_pct = 1.0 - minHpPct;
    
    const baseUtility = Number(skill.base_utility) || 0;
    const mods = skill.score_modifiers || skill.modifiers || {};
    let score = baseUtility;
    
    score += party_total_hp_pct * (mods.party_total_hp_pct || 0);
    score += party_lowest_hp_missing_pct * (mods.party_lowest_hp_missing_pct || 0);
    score += boss_hp_pct * (mods.boss_hp_pct || 0);
    score += partyBuffCount * (mods.party_buff_count || 0);
    
    return score;
}

function extractScores() {
    console.log("=== PENGUJIAN ALGORITMA AI (4.7.3) ===");
    console.log("---------------------------------------------------------");
    console.log("Skenario 1: Party HP 100%, 0 Buff");
    
    let state1 = createBattleState(1.0, 1.0);
    console.log("Utility Flute | Utility Typhoon | Utility Slingshot");
    
    let scoreAttack1 = calculateScore(mockBossSkills[0], state1).toFixed(2);
    let scoreAoE1 = calculateScore(mockBossSkills[1], state1).toFixed(2);
    let scoreHeal1 = calculateScore(mockBossSkills[2], state1).toFixed(2);
    
    console.log(`     ${scoreAttack1}      |    ${scoreAoE1}    |     ${scoreHeal1}`);
    
    let decision1 = AiBehaviorService.calculateBossAction(state1, mockBossSkills);
    console.log(`=> Skill Terpilih: ${decision1.name}`);
    
    console.log("\n---------------------------------------------------------");
    console.log("Skenario 2: Party HP 100%, Party Memiliki 4 Buff");
    
    let state2 = createBattleState(1.0, 1.0);
    state2.player_party.characters.forEach(c => {
        // Add 2 buffs per character (Total 4 buffs in party)
        c.active_buffs = [{ id: 'b1', type: 'buff' }, { id: 'b2', type: 'buff' }];
    });
    console.log("Utility Flute | Utility Typhoon | Utility Slingshot");
    
    let scoreAttack2 = calculateScore(mockBossSkills[0], state2).toFixed(2);
    let scoreAoE2 = calculateScore(mockBossSkills[1], state2).toFixed(2);
    let scoreHeal2 = calculateScore(mockBossSkills[2], state2).toFixed(2);
    
    console.log(`     ${scoreAttack2}      |    ${scoreAoE2}    |     ${scoreHeal2}`);
    
    let decision2 = AiBehaviorService.calculateBossAction(state2, mockBossSkills);
    console.log(`=> Skill Terpilih: ${decision2.name}`);

    console.log("\n---------------------------------------------------------");
    console.log("Skenario 3: Party HP Sekarat (Slot 1 sisa 10%), Party Memiliki 1 Buff");
    
    let state3 = createBattleState(1.0, 0.55); // Doesn't matter much for partyHpPct, we override below
    state3.player_party.characters[0].current_hp = state3.player_party.characters[0].max_hp * 0.1; // 10%
    state3.player_party.characters[1].current_hp = state3.player_party.characters[1].max_hp * 1.0; // 100%
    state3.player_party.characters[0].active_buffs = [{ id: 'b1', type: 'buff' }]; // 1 Buff
    console.log("Utility Flute | Utility Typhoon | Utility Slingshot");
    
    let scoreAttack3 = calculateScore(mockBossSkills[0], state3).toFixed(2);
    let scoreAoE3 = calculateScore(mockBossSkills[1], state3).toFixed(2);
    let scoreHeal3 = calculateScore(mockBossSkills[2], state3).toFixed(2);
    
    console.log(`     ${scoreAttack3}      |    ${scoreAoE3}    |     ${scoreHeal3}`);
    
    let decision3 = AiBehaviorService.calculateBossAction(state3, mockBossSkills);
    console.log(`=> Skill Terpilih: ${decision3.name}`);
    
    // Simulate Smart Targeting
    let target = BattleService._determineSmartTarget(state3.player_party.characters, decision3.score_modifiers || decision3.modifiers || {});
    console.log(`=> Smart Targeting Memilih Target: ${target} (Harusnya slot1 karena HP sekarat)`);
    
    console.log("=========================================================\n");
}

extractScores();
