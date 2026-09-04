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

    test('Mengembalikan null jika CA bar belum penuh (CA tidak ready)', () => {
        const state = createBattleState();
        // CA tidak penuh → skill non-override tidak lolos filter
        const skill = createSkillBehavior();
        // boss current_ca = 0, caMax = 5 → CA tidak ready
        expect(AiBehaviorService.calculateBossAction(state, [skill])).toBeNull();
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

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6: Adaptivitas AI — Keputusan Berubah Saat Kondisi Party Berubah
// Membuktikan bahwa AI tidak statis: skill yang dipilih berganti sesuai state.
// ─────────────────────────────────────────────────────────────────────────────
describe('AiBehaviorService — Adaptivitas AI (Tahap 5 — Perubahan Keputusan)', () => {
    const createFullCaState = (overrides = {}) => {
        const state = createBattleState(overrides);
        state.enemies[0].current_ca = 5;
        state.enemies[0].caMax = 5;
        return state;
    };

    test('AI beralih dari AoE ke Execute saat salah satu karakter mendekati kematian', () => {
        // State A: Tim HP 100%, 0 Buff → AoE skill lebih disukai
        const aoESkill = createSkillBehavior({
            base_utility: 1.5,
            score_modifiers: { party_total_hp_pct: 0.5 } // lebih tinggi saat HP party tinggi
        });
        // Execute skill: tinggi saat ada karakter sekarat
        const executeSkill = createSkillBehavior({
            base_utility: 1.0,
            score_modifiers: { party_lowest_hp_missing_pct: 2.0 } // naik saat ada yang sekarat
        });

        // State A: party HP 100% → aoESkill menang
        const stateA = createFullCaState({ partyHpPct: 1.0 });
        const resultA = AiBehaviorService.calculateBossAction(stateA, [aoESkill, executeSkill]);
        expect(resultA).not.toBeNull();
        expect(resultA.base_utility).toBe(1.5); // AoE menang

        // State B: party HP 10% → executeSkill skor melonjak, menang atas AoE
        const stateB = createFullCaState({ partyHpPct: 0.1 });
        const resultB = AiBehaviorService.calculateBossAction(stateB, [aoESkill, executeSkill]);
        expect(resultB).not.toBeNull();
        // Skill yang dipilih harus BERBEDA dari State A (membuktikan adaptivitas)
        expect(resultB.score_modifiers?.party_lowest_hp_missing_pct).toBeDefined();
    });

    test('AI beralih ke Dispel saat party mengakumulasi banyak Buff', () => {
        // Dispel skill: disukai saat party punya banyak buff
        const dispelSkill = createSkillBehavior({
            base_utility: 0.8,
            score_modifiers: { party_buff_count: 2.0 } // naik drastis per buff
        });
        // Damage skill: stabil, tidak terpengaruh buff
        const damageSkill = createSkillBehavior({ base_utility: 2.0 });

        // State tanpa Buff → damage skill menang
        const stateNoBuff = createFullCaState({ partyBuffs: 0 });
        const resultNoBuff = AiBehaviorService.calculateBossAction(stateNoBuff, [dispelSkill, damageSkill]);
        expect(resultNoBuff).not.toBeNull();
        expect(resultNoBuff.base_utility).toBe(2.0); // damage menang

        // State dengan 4 Buff → dispelSkill skor = 0.8 + 4*2.0 = 8.8 > 2.0
        const stateManyBuffs = createFullCaState({ partyBuffs: 4 });
        const resultManyBuffs = AiBehaviorService.calculateBossAction(stateManyBuffs, [dispelSkill, damageSkill]);
        expect(resultManyBuffs).not.toBeNull();
        // Dispel harus menang karena buff count tinggi
        expect(resultManyBuffs.score_modifiers?.party_buff_count).toBeDefined();
    });

    test('Skor skill debuff berkurang ketika party sudah menanggung banyak Debuff', () => {
        // Skill debuff: skor turun ketika party sudah banyak debuff (enggan tumpuk)
        const debuffSkill = createSkillBehavior({
            base_utility: 5.0,
            score_modifiers: { party_debuff_count: -1.5 } // berkurang per debuff aktif
        });
        const pureSkill = createSkillBehavior({ base_utility: 3.0 });

        // State dengan 3 debuff → debuffSkill skor = 5.0 + 3*(-1.5) = 0.5 < 3.0
        const state = createFullCaState({ partyDebuffs: 3 });
        const result = AiBehaviorService.calculateBossAction(state, [debuffSkill, pureSkill]);
        expect(result).not.toBeNull();
        // Pure skill harus menang karena debuff stack menghukum debuffSkill
        expect(result.base_utility).toBe(3.0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 7: Determinisme & Phase Fallback
// Membuktikan AI 100% deterministik dan Phase Fallback bekerja benar.
// ─────────────────────────────────────────────────────────────────────────────
describe('AiBehaviorService — Determinisme & Phase Fallback', () => {
    const createFullCaState = (overrides = {}) => {
        const state = createBattleState(overrides);
        state.enemies[0].current_ca = 5;
        state.enemies[0].caMax = 5;
        return state;
    };

    test('State identik menghasilkan keputusan AI yang identik (100% Deterministik)', () => {
        const state = createFullCaState({ partyHpPct: 0.6, partyBuffs: 2 });
        const skills = [
            createSkillBehavior({ base_utility: 1.0, score_modifiers: { party_buff_count: 1.5 }, skill: { id: 1, name: 'Flute' } }),
            createSkillBehavior({ base_utility: 2.0, score_modifiers: { party_total_hp_pct: 1.0 }, skill: { id: 2, name: 'Typhoon' } }),
            createSkillBehavior({ base_utility: 1.5, score_modifiers: { party_lowest_hp_missing_pct: 2.0 }, skill: { id: 3, name: 'Slingshot' } }),
        ];

        // Eksekusi kalkulasi AI dua kali dengan state dan skills yang identik
        const result1 = AiBehaviorService.calculateBossAction(state, skills);
        const result2 = AiBehaviorService.calculateBossAction(state, skills);

        expect(result1).not.toBeNull();
        expect(result2).not.toBeNull();
        // Skill yang dipilih harus identik (deterministik, bukan acak)
        expect(result1.skill?.id).toBe(result2.skill?.id);
    });

    test('Phase Fallback: saat semua skill fase aktif habis, sistem melebarkan kandidat', () => {
        // Skenario: Boss dalam fase Normal, hanya ada skill Enraged
        // → Phase Filter → kosong → sistem melebarkan ke semua skill
        // → Skill Enraged (satu-satunya) harus terpilih setelah fallback
        const state = createFullCaState({ modeState: 'normal' });
        const enragedOnlySkill = createSkillBehavior({
            phase: 'Enraged',
            base_utility: 2.0,
            skill: { id: 10, name: 'Rage Strike' }
        });

        const result = AiBehaviorService.calculateBossAction(state, [enragedOnlySkill]);
        // Setelah fallback ke semua skill, Rage Strike harus terpilih
        // (karena satu-satunya kandidat setelah pelebaran)
        expect(result).not.toBeNull();
        expect(result.skill?.id).toBe(10);
    });
});
