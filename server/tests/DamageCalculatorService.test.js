/**
 * Unit Test: DamageCalculatorService.js
 * White-box testing untuk modul kalkulasi damage 6-fase.
 * Semua input menggunakan mock object — tidak ada koneksi DB atau HTTP.
 */

const DamageCalculatorService = require('../services/DamageCalculatorService');

// Helpers
const mockAttacker = (atk = 3000, element = 'Fire', mode = 'normal', buffs = []) => ({
    final_stats: { atk, hp: 10000, def: 500 },
    element, mode_state: mode, active_buffs: buffs
});
const mockTarget = (def = 1300, element = 'Wind', mode = 'normal', buffs = []) => ({
    final_stats: { atk: 1000, hp: 50000, def },
    element, mode_state: mode, active_buffs: buffs
});
const mockSkill = (modifier = 1.0, element = 'Neutral') => ({
    name: 'Test Skill', type: 'Damage', modifier, element
});

// ── Suite 1: Elemental Multiplier ────────────────────────────────────────────
describe('getElementMultiplier()', () => {
    test('Fire > Wind → 1.5', () => expect(DamageCalculatorService.getElementMultiplier('Fire', 'Wind')).toBe(1.5));
    test('Wind > Earth → 1.5', () => expect(DamageCalculatorService.getElementMultiplier('Wind', 'Earth')).toBe(1.5));
    test('Earth > Fire → 1.5', () => expect(DamageCalculatorService.getElementMultiplier('Earth', 'Fire')).toBe(1.5));
    test('Wind < Fire → 0.75', () => expect(DamageCalculatorService.getElementMultiplier('Wind', 'Fire')).toBe(0.75));
    test('Earth < Wind → 0.75', () => expect(DamageCalculatorService.getElementMultiplier('Earth', 'Wind')).toBe(0.75));
    test('Fire < Earth → 0.75', () => expect(DamageCalculatorService.getElementMultiplier('Fire', 'Earth')).toBe(0.75));
    test('Fire vs Fire → neutral 1.0', () => expect(DamageCalculatorService.getElementMultiplier('Fire', 'Fire')).toBe(1.0));
    test('null element → neutral 1.0', () => expect(DamageCalculatorService.getElementMultiplier(null, 'Fire')).toBe(1.0));
});

// ── Suite 2: DEF Mitigation Cap ──────────────────────────────────────────────
describe('calculateDamage() — Mitigasi DEF', () => {
    test('DEF ≥ 6500 → cap mitigasi 80%, damage selalu > 0', () => {
        const attacker = mockAttacker(3000, 'Neutral');
        const target = mockTarget(9999, 'Neutral');
        const skill = mockSkill(1.0, 'Neutral');
        for (let i = 0; i < 100; i++) {
            expect(DamageCalculatorService.calculateDamage(attacker, target, skill).damage).toBeGreaterThanOrEqual(1);
        }
    });

    test('Damage selalu >= 1 (hard floor) bahkan ATK=1, DEF=99999', () => {
        const attacker = mockAttacker(1, 'Neutral');
        const target = mockTarget(99999, 'Neutral');
        const skill = mockSkill(0.01, 'Neutral');
        for (let i = 0; i < 100; i++) {
            expect(DamageCalculatorService.calculateDamage(attacker, target, skill).damage).toBeGreaterThanOrEqual(1);
        }
    });
});

// ── Suite 3: Buff/Debuff Stat Mutation ───────────────────────────────────────
describe('calculateCurrentStat() — Buff/Debuff', () => {
    test('Tanpa efek: stat tidak berubah', () => {
        expect(DamageCalculatorService.calculateCurrentStat(3000, 'ATK', [])).toBe(3000);
    });
    test('Buff ATK +30% → 3900', () => {
        const buffs = [{ target_stat: 'ATK', effect_type: 'buff', value: 0.3 }];
        expect(DamageCalculatorService.calculateCurrentStat(3000, 'ATK', buffs)).toBe(3900);
    });
    test('Debuff ATK -25% → 2250', () => {
        const debuffs = [{ target_stat: 'ATK', effect_type: 'debuff', value: -0.25 }];
        expect(DamageCalculatorService.calculateCurrentStat(3000, 'ATK', debuffs)).toBe(2250);
    });
    test('Debuff ekstrem tidak membuat stat negatif (floor ke 0)', () => {
        const debuffs = [{ target_stat: 'ATK', effect_type: 'debuff', value: -10.0 }];
        expect(DamageCalculatorService.calculateCurrentStat(3000, 'ATK', debuffs)).toBeGreaterThanOrEqual(0);
    });
});

// ── Suite 4: Boss Mode State ──────────────────────────────────────────────────
describe('calculateDamage() — Boss Mode State', () => {
    test('Mode Enraged: rata-rata damage lebih tinggi ~20% dari normal', () => {
        const normalAttacker   = mockAttacker(3000, 'Neutral', 'normal');
        const enragedAttacker  = mockAttacker(3000, 'Neutral', 'enraged');
        const target = mockTarget(0, 'Neutral');
        const skill = mockSkill(1.0, 'Neutral');
        let sumN = 0, sumE = 0;
        for (let i = 0; i < 500; i++) {
            sumN += DamageCalculatorService.calculateDamage(normalAttacker, target, skill).damage;
            sumE += DamageCalculatorService.calculateDamage(enragedAttacker, target, skill).damage;
        }
        expect(sumE / sumN).toBeGreaterThan(1.10);
        expect(sumE / sumN).toBeLessThan(1.35);
    });

    test('Mode Exhausted (target): menerima lebih banyak damage dari target normal', () => {
        const attacker = mockAttacker(3000, 'Neutral', 'normal');
        const normalTarget    = mockTarget(2000, 'Neutral', 'normal');
        const exhaustedTarget = mockTarget(2000, 'Neutral', 'exhausted');
        const skill = mockSkill(1.0, 'Neutral');
        let sumN = 0, sumE = 0;
        for (let i = 0; i < 500; i++) {
            sumN += DamageCalculatorService.calculateDamage(attacker, normalTarget, skill).damage;
            sumE += DamageCalculatorService.calculateDamage(attacker, exhaustedTarget, skill).damage;
        }
        expect(sumE / sumN).toBeGreaterThan(1.05);
    });

    test('Skill modifier lebih besar → damage rata-rata lebih tinggi', () => {
        const attacker = mockAttacker(3000, 'Neutral');
        const target = mockTarget(0, 'Neutral');
        let sumWeak = 0, sumStrong = 0;
        for (let i = 0; i < 500; i++) {
            sumWeak   += DamageCalculatorService.calculateDamage(attacker, target, mockSkill(1.0, 'Neutral')).damage;
            sumStrong += DamageCalculatorService.calculateDamage(attacker, target, mockSkill(3.0, 'Neutral')).damage;
        }
        expect(sumStrong / sumWeak).toBeGreaterThan(2.0);
    });
});
