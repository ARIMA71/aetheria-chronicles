/**
 * Unit Test: LevelingSystem.js
 * White-box testing untuk modul kalkulasi leveling karakter, senjata, dan rank.
 *
 * Tujuan (XP - Testing Driven):
 * Memverifikasi akurasi formula EXP kumulatif, batas level per rarity,
 * dan fungsi threshold progress bar secara terisolasi tanpa koneksi database.
 */

const LevelingSystem = require('../utils/LevelingSystem');

// Inisialisasi tabel EXP sebelum semua test dijalankan
beforeAll(() => {
    LevelingSystem.init();
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: getCharMaxLevel
// ─────────────────────────────────────────────────────────────────────────────
describe('LevelingSystem.getCharMaxLevel()', () => {
    test('Main Character (mc_id=1) memiliki base 40, +20 per LB', () => {
        expect(LevelingSystem.getCharMaxLevel(1, 'SSR', 0)).toBe(40);
        expect(LevelingSystem.getCharMaxLevel(1, 'SR', 1)).toBe(60);
    });

    test('Karakter SSR memiliki max level 40 pada LB0 dan 80 pada LB2', () => {
        expect(LevelingSystem.getCharMaxLevel(10, 'SSR', 0)).toBe(40);
        expect(LevelingSystem.getCharMaxLevel(10, 'SSR', 1)).toBe(60);
        expect(LevelingSystem.getCharMaxLevel(10, 'SSR', 2)).toBe(80);
    });

    test('Karakter SR memiliki max level 30 pada LB0 dan 70 pada LB2', () => {
        expect(LevelingSystem.getCharMaxLevel(5, 'SR', 0)).toBe(30);
        expect(LevelingSystem.getCharMaxLevel(5, 'SR', 1)).toBe(50);
        expect(LevelingSystem.getCharMaxLevel(5, 'SR', 2)).toBe(70);
    });

    test('Rarity tidak dikenal (fallback) menggunakan base 20, +20 per LB', () => {
        expect(LevelingSystem.getCharMaxLevel(99, 'N', 0)).toBe(20);
        expect(LevelingSystem.getCharMaxLevel(99, 'N', 1)).toBe(40);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: getWeaponMaxLevel
// ─────────────────────────────────────────────────────────────────────────────
describe('LevelingSystem.getWeaponMaxLevel()', () => {
    test('Senjata SSR: max level 100', () => {
        expect(LevelingSystem.getWeaponMaxLevel('SSR')).toBe(100);
    });

    test('Senjata SR: max level 80', () => {
        expect(LevelingSystem.getWeaponMaxLevel('SR')).toBe(80);
    });

    test('Senjata R: max level 60', () => {
        expect(LevelingSystem.getWeaponMaxLevel('R')).toBe(60);
    });

    test('Rarity tidak dikenal (fallback) mengembalikan 1', () => {
        expect(LevelingSystem.getWeaponMaxLevel('N')).toBe(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: calculateCurrentLevel - Karakter
// ─────────────────────────────────────────────────────────────────────────────
describe('LevelingSystem.calculateCurrentLevel() — Karakter', () => {
    const MAX_LEVEL = 60;

    test('EXP = 0 → Level 1 (level awal)', () => {
        expect(LevelingSystem.calculateCurrentLevel(0, MAX_LEVEL, 'Character')).toBe(1);
    });

    test('EXP tepat di threshold Level 2 → Level 2', () => {
        // floor(50 * 2^1.6) = floor(50 * 3.031) = floor(151.57) = 151
        const expForLevel2 = Math.floor(50 * Math.pow(2, 1.6));
        expect(LevelingSystem.calculateCurrentLevel(expForLevel2, MAX_LEVEL, 'Character')).toBe(2);
    });

    test('EXP satu di bawah threshold Level 2 → Level 1', () => {
        const expForLevel2 = Math.floor(50 * Math.pow(2, 1.6));
        expect(LevelingSystem.calculateCurrentLevel(expForLevel2 - 1, MAX_LEVEL, 'Character')).toBe(1);
    });

    test('EXP sangat besar (di atas max cap) → mengembalikan maxLevel', () => {
        expect(LevelingSystem.calculateCurrentLevel(999999999, MAX_LEVEL, 'Character')).toBe(MAX_LEVEL);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: calculateCurrentLevel - Senjata
// ─────────────────────────────────────────────────────────────────────────────
describe('LevelingSystem.calculateCurrentLevel() — Senjata', () => {
    const MAX_LEVEL = 100;

    test('EXP = 0 → Level 1', () => {
        expect(LevelingSystem.calculateCurrentLevel(0, MAX_LEVEL, 'Weapon')).toBe(1);
    });

    test('EXP tepat di threshold Level 2 → Level 2', () => {
        // floor(20 * 2^1.5) = floor(20 * 2.828) = floor(56.56) = 56
        const expForLevel2 = Math.floor(20 * Math.pow(2, 1.5));
        expect(LevelingSystem.calculateCurrentLevel(expForLevel2, MAX_LEVEL, 'Weapon')).toBe(2);
    });

    test('EXP satu di bawah threshold Level 2 → Level 1', () => {
        const expForLevel2 = Math.floor(20 * Math.pow(2, 1.5));
        expect(LevelingSystem.calculateCurrentLevel(expForLevel2 - 1, MAX_LEVEL, 'Weapon')).toBe(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: calculateCurrentLevel - Player Rank
// ─────────────────────────────────────────────────────────────────────────────
describe('LevelingSystem.calculateCurrentLevel() — Player Rank', () => {
    test('EXP = 0 → Rank 1', () => {
        expect(LevelingSystem.calculateCurrentLevel(0, 100, 'Rank')).toBe(1);
    });

    test('EXP tepat di threshold Rank 2 → Rank 2', () => {
        // floor(100 * 2^1.8) = floor(100 * 3.482) = floor(348.2) = 348
        const expForRank2 = Math.floor(100 * Math.pow(2, 1.8));
        expect(LevelingSystem.calculateCurrentLevel(expForRank2, 100, 'Rank')).toBe(2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6: getExpThresholds
// ─────────────────────────────────────────────────────────────────────────────
describe('LevelingSystem.getExpThresholds()', () => {
    test('Level 1 karakter: current_base = 0, next_level ada isinya', () => {
        const result = LevelingSystem.getExpThresholds(1, 60, 'Character');
        expect(result.current_level_base_exp).toBe(0);
        expect(result.next_level_exp).toBeGreaterThan(0);
    });

    test('Level sama dengan maxLevel: next_level_exp = current_level_base_exp (tidak bisa naik lagi)', () => {
        const result = LevelingSystem.getExpThresholds(60, 60, 'Character');
        expect(result.next_level_exp).toBe(result.current_level_base_exp);
    });

    test('current_level_base_exp selalu lebih kecil dari next_level_exp (kecuali di max level)', () => {
        const result = LevelingSystem.getExpThresholds(10, 60, 'Character');
        expect(result.current_level_base_exp).toBeLessThan(result.next_level_exp);
    });
});
