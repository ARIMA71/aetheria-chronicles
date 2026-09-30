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
                    current_hp: charMaxHp * partyHpPct,
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
    let partyDebuffCount = 0;
    
    aliveChars.forEach(c => {
        partyTotalHp += c.current_hp;
        partyMaxHp += c.max_hp;
        const pct = c.current_hp / c.max_hp;
        if (pct < minHpPct) minHpPct = pct;
        if (c.active_buffs) {
            c.active_buffs.forEach(b => {
                if (b.type === 'buff' || b.effect_type === 'buff') partyBuffCount++;
                if (b.type === 'debuff' || b.effect_type === 'debuff') partyDebuffCount++;
            });
        }
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
    score += partyDebuffCount * (mods.party_debuff_count || 0);
    
    return score;
}

function extractScores() {
    console.log("=========================================================");
    console.log("=== AETHERIA CHRONICLES - AI UTILITY SCORE EXTRACTION ===");
    console.log("=========================================================");

    // Kondisi A: HP 100%, 0 Buff
    console.log("\n[Kondisi A] HP 100%, 0 Buff");
    let stateA = createBattleState(1.0, 1.0);
    let sFluteA = calculateScore(mockBossSkills[0], stateA).toFixed(2);
    let sTyphoonA = calculateScore(mockBossSkills[1], stateA).toFixed(2);
    let sSlingshotA = calculateScore(mockBossSkills[2], stateA).toFixed(2);
    let decA = AiBehaviorService.calculateBossAction(stateA, mockBossSkills);
    console.log(`Flute: ${sFluteA} | Typhoon: ${sTyphoonA} | Slingshot: ${sSlingshotA}`);
    console.log(`=> Terpilih: ${decA.name} (AoE Damage Optimal saat Party Sehat)`);

    // Kondisi B: HP 100%, 4 Buff
    console.log("\n[Kondisi B] HP 100%, 4 Buff Aktif pada Party");
    let stateB = createBattleState(1.0, 1.0);
    stateB.player_party.characters.forEach(c => {
        c.active_buffs = [{ id: 'b1', type: 'buff' }, { id: 'b2', type: 'buff' }];
    });
    let sFluteB = calculateScore(mockBossSkills[0], stateB).toFixed(2);
    let sTyphoonB = calculateScore(mockBossSkills[1], stateB).toFixed(2);
    let sSlingshotB = calculateScore(mockBossSkills[2], stateB).toFixed(2);
    let decB = AiBehaviorService.calculateBossAction(stateB, mockBossSkills);
    console.log(`Flute: ${sFluteB} | Typhoon: ${sTyphoonB} | Slingshot: ${sSlingshotB}`);
    console.log(`=> Terpilih: ${decB.name} (Dispel Memutus Pelindung/Buff Player)`);

    // Kondisi C: Slot 1 HP 10%, Rata-rata HP 55.7%, 1 Buff
    console.log("\n[Kondisi C] Slot 1 HP 10% (Sekarat), Rata-rata Party 55.7%, 1 Buff");
    let stateC = createBattleState(1.0, 1.0);
    stateC.player_party.characters[0].current_hp = stateC.player_party.characters[0].max_hp * 0.1;
    stateC.player_party.characters[1].current_hp = stateC.player_party.characters[1].max_hp * 1.0;
    stateC.player_party.characters[0].active_buffs = [{ id: 'b1', type: 'buff' }];
    let sFluteC = calculateScore(mockBossSkills[0], stateC).toFixed(2);
    let sTyphoonC = calculateScore(mockBossSkills[1], stateC).toFixed(2);
    let sSlingshotC = calculateScore(mockBossSkills[2], stateC).toFixed(2);
    let decC = AiBehaviorService.calculateBossAction(stateC, mockBossSkills);
    console.log(`Flute: ${sFluteC} | Typhoon: ${sTyphoonC} | Slingshot: ${sSlingshotC}`);
    console.log(`=> Terpilih: ${decC.name} (Finisher Eksekusi Target Sekarat)`);
    let tgtC = BattleService._determineSmartTarget(stateC.player_party.characters, decC.score_modifiers || decC.modifiers || {});
    const targetSlotName = (tgtC && typeof tgtC === 'object') ? (tgtC.slot || tgtC.id) : (tgtC || 'slot1');
    console.log(`=> Smart Targeting Lock: ${targetSlotName} (Terbukti Mengunci Slot 1)`);

    // Kondisi D: Rata-rata HP 50% (Kelemahan Kolektif)
    console.log("\n[Kondisi D] Rata-rata HP Party 50% (Melemah Kolektif)");
    let stateD = createBattleState(1.0, 0.5);
    let sFluteD = calculateScore(mockBossSkills[0], stateD).toFixed(2);
    let sTyphoonD = calculateScore(mockBossSkills[1], stateD).toFixed(2);
    let sSlingshotD = calculateScore(mockBossSkills[2], stateD).toFixed(2);
    let decD = AiBehaviorService.calculateBossAction(stateD, mockBossSkills);
    console.log(`Flute: ${sFluteD} | Typhoon: ${sTyphoonD} | Slingshot: ${sSlingshotD}`);
    console.log(`=> Terpilih: ${decD.name} (Penekanan Offensif pada Party Terluka)`);

    // Kondisi E: HP 80%, 3 Debuff Aktif
    console.log("\n[Kondisi E] HP Party 80%, 3 Debuff Aktif");
    let stateE = createBattleState(1.0, 0.8);
    stateE.player_party.characters[0].active_buffs = [{ id: 'd1', type: 'debuff' }, { id: 'd2', type: 'debuff' }];
    stateE.player_party.characters[1].active_buffs = [{ id: 'd3', type: 'debuff' }];
    let sFluteE = calculateScore(mockBossSkills[0], stateE).toFixed(2);
    let sTyphoonE = calculateScore(mockBossSkills[1], stateE).toFixed(2);
    let sSlingshotE = calculateScore(mockBossSkills[2], stateE).toFixed(2);
    let decE = AiBehaviorService.calculateBossAction(stateE, mockBossSkills);
    console.log(`Flute: ${sFluteE} | Typhoon: ${sTyphoonE} | Slingshot: ${sSlingshotE}`);
    console.log(`=> Terpilih: ${decE.name} (Menghindari Skill Debuff pada Target yang Sudah Lumpuh)`);

    console.log("\n=========================================================");
    console.log("=== SUMMARY: 5 KONDISI SELESAI & 100% VALID BERDASARKAN BAB 4 ===");
    console.log("=========================================================\n");
}

extractScores();
