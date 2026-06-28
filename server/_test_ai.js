/**
 * AI Calculator Test Suite
 * Validates calculateBossAction under various conditions.
 */

const AiBehaviorService = require('./services/AiBehaviorService');

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exit(1);
    }
    console.log(`✅ PASS: ${message}`);
}

function runTests() {
    console.log('=== RUNNING BOSS AI CALCULATOR TESTS ===\n');

    // -------------------------------------------------------------------------
    // Test Case 1: Normal calculation and Fallback weights (preventing NaN)
    // -------------------------------------------------------------------------
    const battleState1 = {
        player_party: {
            characters: [
                { hp: 1000, maxHp: 2000, activeEffects: [{ effect_type: 'Buff' }] }, // 50% HP, 1 Buff
                { hp: 500, maxHp: 1000, activeEffects: [{ effect_type: 'Debuff' }] } // 50% HP, 1 Debuff
            ]
        },
        boss: {
            hp: 80000,
            maxHp: 100000,
            phase: 'Normal',
            activeEffects: [{ effect_type: 'Debuff' }] // 1 Debuff
        }
    };

    const skills1 = [
        {
            id: 1,
            phase: 'Normal',
            base_utility: 1.0,
            score_modifiers: {
                party_total_hp_pct: 0.5
            }
        },
        {
            id: 2,
            phase: 'Normal',
            base_utility: 0.5,
            score_modifiers: {
                party_debuff_count: 1.5,
                some_non_existing_key: 3.0 // Must fallback to 0 to prevent NaN
            }
        }
    ];

    // Skill 1 score: 1.0 + (0.5 * 0.5) = 1.25
    // Skill 2 score: 0.5 + (1 * 1.5) = 2.0
    const choice1 = AiBehaviorService.calculateBossAction(battleState1, skills1);
    assert(choice1 !== null, 'Should return a skill choice.');
    assert(choice1.id === 2, `Should choose Skill 2 (Score: 2.0) over Skill 1 (Score: 1.25). Got Skill ${choice1 ? choice1.id : 'null'}`);

    // -------------------------------------------------------------------------
    // Test Case 2: Cooldown & One-Time Use checks
    // -------------------------------------------------------------------------
    // Set Skill 2 on cooldown
    skills1[1].currentCooldown = 1;
    const choice2 = AiBehaviorService.calculateBossAction(battleState1, skills1);
    assert(choice2 !== null, 'Should return a skill choice when one is on cooldown.');
    assert(choice2.id === 1, `Should fallback to Skill 1 since Skill 2 is on cooldown. Got Skill ${choice2 ? choice2.id : 'null'}`);

    // One-time use check
    skills1[1].currentCooldown = 0;
    skills1[1].score_modifiers.One_Time_Use = true;
    skills1[1].used = true; // marked as used
    const choice2b = AiBehaviorService.calculateBossAction(battleState1, skills1);
    assert(choice2b !== null, 'Should return a skill choice when one is marked as used.');
    assert(choice2b.id === 1, `Should exclude Skill 2 because it is one-time use and already used. Got Skill ${choice2b ? choice2b.id : 'null'}`);

    // Reset Skill 2
    skills1[1].used = false;

    // -------------------------------------------------------------------------
    // Test Case 3: HP Trigger Absolute Override
    // -------------------------------------------------------------------------
    // Boss is at 40% HP (0.4)
    const battleState3 = {
        player_party: {
            characters: [{ hp: 1000, maxHp: 1000 }]
        },
        boss: {
            hp: 40000,
            maxHp: 100000,
            phase: 'Normal'
        }
    };

    const skills3 = [
        {
            id: 3,
            phase: 'Normal',
            base_utility: 0.1,
            score_modifiers: {
                override_hp_trigger: 0.5
            }
        },
        {
            id: 4,
            phase: 'Normal',
            base_utility: 5.0,
            score_modifiers: {}
        }
    ];

    // Skill 3 is ready and boss HP is at 40% (<= 50% override threshold).
    // It should trigger override, bypassing Skill 4 which has high base utility.
    const choice3 = AiBehaviorService.calculateBossAction(battleState3, skills3);
    assert(choice3 !== null, 'Should choose override skill.');
    assert(choice3.id === 3, `Should execute Skill 3 via absolute override (HP Trigger). Got Skill ${choice3 ? choice3.id : 'null'}`);

    // -------------------------------------------------------------------------
    // Test Case 4: Multiple HP Trigger Priority (lowest trigger first)
    // -------------------------------------------------------------------------
    // Boss is at 20% HP (0.2)
    const battleState4 = {
        player_party: {
            characters: [{ hp: 1000, maxHp: 1000 }]
        },
        boss: {
            hp: 20000,
            maxHp: 100000,
            phase: 'Normal'
        }
    };

    const skills4 = [
        {
            id: 5,
            phase: 'Normal',
            base_utility: 1.0,
            score_modifiers: {
                override_hp_trigger: 0.3 // more critical threshold
            }
        },
        {
            id: 6,
            phase: 'Normal',
            base_utility: 0.5,
            score_modifiers: {
                override_hp_trigger: 0.5
            }
        }
    ];

    // Both triggers are active (0.2 <= 0.3 and 0.2 <= 0.5).
    // The lowest threshold (0.3) should be prioritized.
    const choice4 = AiBehaviorService.calculateBossAction(battleState4, skills4);
    assert(choice4 !== null, 'Should return a skill choice when multiple triggers are active.');
    assert(choice4.id === 5, `Should prioritize the more critical HP trigger threshold (Skill 5 over Skill 6). Got Skill ${choice4 ? choice4.id : 'null'}`);

    // -------------------------------------------------------------------------
    // Test Case 5: isCaReady is false (normal skills should be skipped)
    // -------------------------------------------------------------------------
    const battleState5 = {
        player_party: { characters: [] },
        boss: {
            hp: 100000,
            maxHp: 100000,
            phase: 'Normal',
            isCaReady: false
        }
    };
    const skills5 = [
        { id: 7, phase: 'Normal', base_utility: 1.0, score_modifiers: {} }
    ];
    const choice5 = AiBehaviorService.calculateBossAction(battleState5, skills5);
    assert(choice5 === null, `Should return null when CA is not ready and no HP override is triggered. Got ${choice5}`);

    // -------------------------------------------------------------------------
    // Test Case 6: isCaReady is false, but HP trigger is active (should execute)
    // -------------------------------------------------------------------------
    const battleState6 = {
        player_party: { characters: [] },
        boss: {
            hp: 30000,
            maxHp: 100000,
            phase: 'Normal',
            isCaReady: false
        }
    };
    const skills6 = [
        { id: 8, phase: 'Normal', base_utility: 1.0, score_modifiers: {} }, // normal skill
        { id: 9, phase: 'Normal', base_utility: 0.0, score_modifiers: { override_hp_trigger: 0.5 } } // override
    ];
    const choice6 = AiBehaviorService.calculateBossAction(battleState6, skills6);
    assert(choice6 !== null, 'Should execute override even if CA is not ready.');
    assert(choice6.id === 9, `Should execute Skill 9 via override. Got Skill ${choice6 ? choice6.id : 'null'}`);

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

runTests();
