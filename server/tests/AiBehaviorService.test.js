/**
 * Unit Test: AiBehaviorService.js
 * White-box testing untuk modul AI Behavior Tree + Utility Scoring.
 *
 * Tujuan (XP - Testing Driven):
 * Memverifikasi logika seleksi skill AI (phase filtering, cooldown filter,
 * HP override trigger, dan utility score calculation) secara terisolasi.
 * Semua data menggunakan mock JSON — tidak ada koneksi database.
 */

const AiBehaviorService = require('../services/AiBehaviorService');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Mock battle state builder
// ─────────────────────────────────────────────────────────────────────────────
const createBattleState = ({
    enemyHpPct = 1.0,
    partyHpPct = 1.0,
    partyBuffs = 0,
    partyDebuffs = 0,
    bossBuffs = 0,
    bossDebuffs = 0,
    modeState = 'normal'
} = {}) => {
    const bossMaxHp = 100000;
    const charMaxHp = 10000;
    return {
        player_party: {
            characters: [
                {
                    current_hp: charMaxHp * partyHpPct,
                    max_hp: charMaxHp,
                    active_buffs: [
                        ...Array(partyBuffs).fill({ effect_type: 'buff', target_stat: 'ATK', value: 0.1 }),
                        ...Array(partyDebuffs).fill({ effect_type: 'debuff', target_stat: 'ATK', value: -0.1 })
                    ]
                }
            ]
        },
        enemies: [{
            current_hp: bossMaxHp * enemyHpPct,
            final_stats: { hp: bossMaxHp },
            mode_state: modeState,
            current_ca: 0,
            caMax: 5,
            active_buffs: [
                ...Array(bossBuffs).fill({ effect_type: 'buff', target_stat: 'ATK', value: 0.1 }),
                ...Array(bossDebuffs).fill({ effect_type: 'debuff', target_stat: 'ATK', value: -0.1 })
            ]
        }]
    };
};

const createSkillBehavior = (overrides = {}) => ({
    phase: 'Normal',
    base_utility: 1.0,
    modifiers: {},
    score_modifiers: {},
    currentCooldown: 0,
    cooldownCount: 0,
    skill: { id: Math.floor(Math.random() * 9000) + 1, name: 'Test Skill', type: 'Damage' },
    ...overrides
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: Edge Cases
// ─────────────────────────────────────────────────────────────────────────────
describe('AiBehaviorService.calculateBossAction() — Edge Cases', () => {
    test('Mengembalikan null jika bossSkills kosong', () => {
        const state = createBattleState();
        expect(AiBehaviorService.calculateBossAction(state, [])).toBeNull();
    });

    test('Mengembalikan null jika battleState null', () => {
        expect(AiBehaviorService.calculateBossAction(null, [createSkillBehavior()])).toBeNull();
    });

    test('Mengembalikan null jika semua skill masih cooldown (CA tidak ready)', () => {
        const state = createBattleState();
        // CA tidak penuh → skill non-override tidak lolos filter
        const skill = createSkillBehavior({ currentCooldown: 0 });
        // boss current_ca = 0, caMax = 5 → CA tidak ready
        expect(AiBehaviorService.calculateBossAction(state, [skill])).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: Cooldown Filter
// ─────────────────────────────────────────────────────────────────────────────
describe('AiBehaviorService — Cooldown Filter (Tahap 3)', () => {
    // Buat state dengan CA penuh agar skill bisa masuk kandidat
    const createFullCaState = () => {
        const state = createBattleState();
        state.enemies[0].current_ca = 5; // CA penuh
        state.enemies[0].caMax = 5;
        return state;
    };

    test('Skill dengan currentCooldown > 0 tidak dipilih', () => {
        const state = createFullCaState();
        const skillOnCooldown = createSkillBehavior({ currentCooldown: 2 });
        // Skill kedua yang ready
        const skillReady = createSkillBehavior({ currentCooldown: 0, base_utility: 99 });
        const result = AiBehaviorService.calculateBossAction(state, [skillOnCooldown, skillReady]);
        // Harus memilih skillReady, bukan skillOnCooldown
        expect(result).not.toBeNull();
        expect(result.base_utility).toBe(99);
    });

    test('Jika semua skill cooldown → return null', () => {
        const state = createFullCaState();
        const allCooldown = [
            createSkillBehavior({ currentCooldown: 3 }),
            createSkillBehavior({ currentCooldown: 1 })
        ];
        expect(AiBehaviorService.calculateBossAction(state, allCooldown)).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: HP Override Trigger (Tahap 4)
// ─────────────────────────────────────────────────────────────────────────────
describe('AiBehaviorService — HP Override Trigger (Tahap 4)', () => {
    test('Skill override dipilih jika boss_hp_pct ≤ threshold, mengabaikan utility score', () => {
        const state = createBattleState({ enemyHpPct: 0.45 }); // HP 45%

        const overrideSkill = createSkillBehavior({
            base_utility: 0.1,  // utility rendah
            score_modifiers: { override_hp_trigger: 0.5 }, // trigger saat HP ≤ 50%
            modifiers: { override_hp_trigger: 0.5 }
        });
        const normalSkill = createSkillBehavior({
            base_utility: 10.0  // utility sangat tinggi tapi tidak ada override
        });

        // Buat CA penuh dan set enemy HP rendah
        state.enemies[0].current_ca = 5;
        state.enemies[0].caMax = 5;

        const result = AiBehaviorService.calculateBossAction(state, [normalSkill, overrideSkill]);
        expect(result).not.toBeNull();
        // Override harus diprioritaskan meskipun utility lebih rendah
        expect(result.score_modifiers?.override_hp_trigger || result.modifiers?.override_hp_trigger).toBeDefined();
    });

    test('Skill override TIDAK dipilih jika HP masih di atas threshold', () => {
        const state = createBattleState({ enemyHpPct: 0.80 }); // HP 80%, threshold 50%
        state.enemies[0].current_ca = 5;
        state.enemies[0].caMax = 5;

        const overrideSkill = createSkillBehavior({
            base_utility: 0.1,
            score_modifiers: { override_hp_trigger: 0.5 },
            modifiers: { override_hp_trigger: 0.5 }
        });
        const normalSkill = createSkillBehavior({ base_utility: 5.0 });

        const result = AiBehaviorService.calculateBossAction(state, [normalSkill, overrideSkill]);
        // Karena HP 80% > threshold 50%, override tidak aktif
        // normalSkill dengan utility 5.0 harus dipilih
        if (result !== null) {
            expect(result.base_utility).toBe(5.0);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: Utility Score Calculation (Tahap 5 — Core Formula)
// ─────────────────────────────────────────────────────────────────────────────
describe('AiBehaviorService — Utility Score Calculation (Tahap 5)', () => {
    const createFullCaStateWithHp = (enemyHpPct = 0.5) => {
        const state = createBattleState({ enemyHpPct });
        state.enemies[0].current_ca = 5;
        state.enemies[0].caMax = 5;
        return state;
    };

    test('Skill dengan base_utility lebih tinggi dipilih jika bobot sama', () => {
        const state = createFullCaStateWithHp();
        const lowSkill  = createSkillBehavior({ base_utility: 1.0 });
        const highSkill = createSkillBehavior({ base_utility: 5.0 });
        const result = AiBehaviorService.calculateBossAction(state, [lowSkill, highSkill]);
        expect(result).not.toBeNull();
        expect(result.base_utility).toBe(5.0);
    });

    test('Bobot vektor party_total_hp_pct mempengaruhi score secara proporsional', () => {
        // Skill A: lebih suka saat HP party tinggi (bobot positif)
        const skillA = createSkillBehavior({
            base_utility: 1.0,
            score_modifiers: { party_total_hp_pct: 3.0 } // naik saat HP party tinggi
        });
        // Skill B: netral
        const skillB = createSkillBehavior({ base_utility: 2.0 });

        // Saat HP party = 100%: Score A = 1.0 + 1.0 * 3.0 = 4.0 > Score B = 2.0 → A dipilih
        const stateHighHp = createFullCaStateWithHp(0.5); // enemy HP (bukan party)
        stateHighHp.player_party.characters[0].current_hp = 10000;
        stateHighHp.player_party.characters[0].max_hp = 10000;

        const resultHighPartyHp = AiBehaviorService.calculateBossAction(stateHighHp, [skillA, skillB]);
        // Ketika HP party tinggi (100%), skill A harus menang
        expect(resultHighPartyHp).not.toBeNull();
        expect(resultHighPartyHp.score_modifiers?.party_total_hp_pct).toBeDefined();
    });

    test('Bobot negatif mengurangi score skill sesuai kondisi', () => {
        // Skill A: tidak suka saat party punya banyak buff (bobot negatif)
        const skillA = createSkillBehavior({
            base_utility: 5.0,
            score_modifiers: { party_buff_count: -3.0 }
        });
        // Skill B: utility lebih rendah tapi tidak terpengaruh buff
        const skillB = createSkillBehavior({ base_utility: 3.0 });

        // State dengan 2 buff di party → skill A: 5.0 + 2 * (-3.0) = -1.0 < skill B: 3.0
        const state = createFullCaStateWithHp(0.5);
        state.player_party.characters[0].active_buffs = [
            { effect_type: 'buff', target_stat: 'ATK', value: 0.1 },
            { effect_type: 'buff', target_stat: 'DEF', value: 0.1 }
        ];

        const result = AiBehaviorService.calculateBossAction(state, [skillA, skillB]);
        expect(result).not.toBeNull();
        // Skill B harus menang karena buff count menghukum skill A
        expect(result.base_utility).toBe(3.0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: Phase Filtering
// ─────────────────────────────────────────────────────────────────────────────
describe('AiBehaviorService — Phase Filtering (Tahap 2)', () => {
    const createFullCaState = (modeState = 'normal') => {
        const state = createBattleState({ modeState });
        state.enemies[0].current_ca = 5;
        state.enemies[0].caMax = 5;
        return state;
    };

    test('Skill phase Enraged tidak dipilih saat boss dalam fase Normal', () => {
        const state = createFullCaState('normal');
        const enragedSkill = createSkillBehavior({ phase: 'Enraged', base_utility: 99 });
        const normalSkill  = createSkillBehavior({ phase: 'Normal',  base_utility: 1  });
        const result = AiBehaviorService.calculateBossAction(state, [enragedSkill, normalSkill]);
        if (result !== null) {
            expect(result.phase).not.toBe('Enraged');
        }
    });
});
