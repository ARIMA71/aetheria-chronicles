/**
 * Unit Test: Smart Targeting System — BattleService._determineSmartTarget()
 *
 * Tujuan (XP - Testing Driven):
 * Memverifikasi logika pemilihan target AI musuh secara terisolasi.
 * Mencakup semua cabang logika (Execute, Tank Buster, Punisher, Fallback)
 * baik untuk skenario CA Action (Special Skill) maupun Basic Attack (Enraged).
 *
 * Semua data menggunakan mock object di memori — tidak ada koneksi database.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SETUP: Isolasi BattleService tanpa koneksi DB
// ─────────────────────────────────────────────────────────────────────────────

// Mock seluruh dependency eksternal agar tidak mencoba connect ke DB
jest.mock('../config/db', () => ({
    query: jest.fn().mockResolvedValue([[], []]),
    getConnection: jest.fn().mockResolvedValue({
        query: jest.fn().mockResolvedValue([[], []]),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn()
    })
}));

jest.mock('../cache/BattleMemoryStore', () => ({
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
    delete: jest.fn()
}));

jest.mock('../services/GridCalculatorService', () => ({
    calculatePartyStats: jest.fn().mockReturnValue([])
}));

jest.mock('../services/DamageCalculatorService', () => ({
    calculateDamage: jest.fn().mockReturnValue({ damage: 100, isCrit: false, mitigationPercent: 0.1 })
}));

jest.mock('../services/AiBehaviorService', () => ({
    calculateBossAction: jest.fn().mockReturnValue(null)
}));

// Mencegah setInterval di dalam BattleService terus berjalan dan menahan proses Jest (Open Handle)
jest.useFakeTimers();

const BattleService = require('../services/BattleService');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Mock character builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Membuat karakter mock dengan slot, HP, dan buff opsional.
 */
const createChar = ({ slot = 'main', currentHp = 10000, maxHp = 10000, buffs = [] } = {}) => ({
    slot,
    current_hp: currentHp,
    max_hp: maxHp,
    active_buffs: buffs
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: Prioritas 1 — Execute (Target Lowest HP)
// ─────────────────────────────────────────────────────────────────────────────
describe('_determineSmartTarget — Prioritas 1: Execute (Lowest HP Missing)', () => {
    test('Memilih karakter dengan HP paling sedikit tersisa', () => {
        const alive = [
            createChar({ slot: 'main',  currentHp: 9000, maxHp: 10000 }), // missing 10%
            createChar({ slot: 'slot1', currentHp: 3000, maxHp: 10000 }), // missing 70% <-- target
            createChar({ slot: 'slot2', currentHp: 7000, maxHp: 10000 }), // missing 30%
        ];
        const modifiers = { party_lowest_hp_missing_pct: 1.5 };

        const result = BattleService._determineSmartTarget(alive, modifiers);

        expect(result).toBe('slot1');
    });

    test('Memilih karakter dengan HP 1 (hampir mati) di antara banyak karakter', () => {
        const alive = [
            createChar({ slot: 'main',  currentHp: 5000, maxHp: 10000 }),
            createChar({ slot: 'slot1', currentHp: 1,    maxHp: 10000 }), // hampir mati <-- target
            createChar({ slot: 'slot2', currentHp: 8000, maxHp: 10000 }),
        ];
        const modifiers = { party_lowest_hp_missing_pct: 2.0 };

        const result = BattleService._determineSmartTarget(alive, modifiers);

        expect(result).toBe('slot1');
    });

    test('Dengan modifier Target_Lowest_HP (nama alternatif), juga berfungsi', () => {
        const alive = [
            createChar({ slot: 'main',  currentHp: 9500, maxHp: 10000 }),
            createChar({ slot: 'slot1', currentHp: 2000, maxHp: 10000 }), // <-- target
        ];
        const modifiers = { Target_Lowest_HP: true };

        const result = BattleService._determineSmartTarget(alive, modifiers);

        expect(result).toBe('slot1');
    });

    test('Jika dua karakter sama-sama sekarat (tie), salah satu dari keduanya dipilih', () => {
        const alive = [
            createChar({ slot: 'main',  currentHp: 2000, maxHp: 10000 }), // missing 80%
            createChar({ slot: 'slot1', currentHp: 2000, maxHp: 10000 }), // missing 80% (tie)
            createChar({ slot: 'slot2', currentHp: 9000, maxHp: 10000 }), // missing 10%
        ];
        const modifiers = { party_lowest_hp_missing_pct: 1.0 };

        const result = BattleService._determineSmartTarget(alive, modifiers);

        // Salah satu dari dua karakter dengan HP terendah yang identik
        expect(['main', 'slot1']).toContain(result);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: Prioritas 2 — Tank Buster (Target Highest HP)
// ─────────────────────────────────────────────────────────────────────────────
describe('_determineSmartTarget — Prioritas 2: Tank Buster (Highest HP)', () => {
    test('Memilih karakter dengan persentase HP tertinggi', () => {
        const alive = [
            createChar({ slot: 'main',  currentHp: 5000, maxHp: 10000 }), // 50%
            createChar({ slot: 'slot1', currentHp: 9500, maxHp: 10000 }), // 95% <-- target
            createChar({ slot: 'slot2', currentHp: 7000, maxHp: 10000 }), // 70%
        ];
        const modifiers = { party_highest_hp_pct: 1.0 };

        const result = BattleService._determineSmartTarget(alive, modifiers);

        expect(result).toBe('slot1');
    });

    test('Memilih karakter dengan HP penuh saat yang lain sudah terluka', () => {
        const alive = [
            createChar({ slot: 'main',  currentHp: 6000, maxHp: 10000 }),
            createChar({ slot: 'slot1', currentHp: 10000, maxHp: 10000 }), // 100% <-- target
        ];
        const modifiers = { party_highest_hp_pct: 0.5 };

        const result = BattleService._determineSmartTarget(alive, modifiers);

        expect(result).toBe('slot1');
    });

    test('Tank Buster tidak aktif jika modifier party_lowest_hp_missing_pct juga ada (Prioritas 1 menang)', () => {
        const alive = [
            createChar({ slot: 'main',  currentHp: 1000, maxHp: 10000 }), // 10% HP, missing 90%
            createChar({ slot: 'slot1', currentHp: 9000, maxHp: 10000 }), // 90% HP
        ];
        // Kedua modifier ada, tapi party_lowest_hp_missing_pct harus menang (Prioritas 1)
        const modifiers = { party_lowest_hp_missing_pct: 1.0, party_highest_hp_pct: 1.0 };

        const result = BattleService._determineSmartTarget(alive, modifiers);

        // Harus memilih 'main' (HP paling rendah), bukan 'slot1' (HP paling tinggi)
        expect(result).toBe('main');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: Prioritas 3 — Punisher (Target Highest Buffs)
// ─────────────────────────────────────────────────────────────────────────────
describe('_determineSmartTarget — Prioritas 3: Punisher (Highest Buff Count)', () => {
    const makeBuff = () => ({ effect_type: 'buff', target_stat: 'ATK', value: 0.1 });

    test('Memilih karakter dengan jumlah buff terbanyak', () => {
        const alive = [
            createChar({ slot: 'main',  buffs: [makeBuff()] }),         // 1 buff
            createChar({ slot: 'slot1', buffs: [makeBuff(), makeBuff(), makeBuff()] }), // 3 buff <-- target
            createChar({ slot: 'slot2', buffs: [makeBuff(), makeBuff()] }), // 2 buff
        ];
        const modifiers = { party_buff_count: 0.3 };

        const result = BattleService._determineSmartTarget(alive, modifiers);

        expect(result).toBe('slot1');
    });

    test('Memilih karakter bahkan jika yang lain tidak punya buff sama sekali', () => {
        const alive = [
            createChar({ slot: 'main',  buffs: [] }),
            createChar({ slot: 'slot1', buffs: [makeBuff()] }), // 1 buff <-- target
        ];
        const modifiers = { party_buff_count: 0.2 };

        const result = BattleService._determineSmartTarget(alive, modifiers);

        expect(result).toBe('slot1');
    });

    test('Debuff tidak dihitung sebagai buff oleh punisher', () => {
        const debuff = { effect_type: 'debuff', target_stat: 'DEF', value: -0.1 };
        const alive = [
            createChar({ slot: 'main',  buffs: [debuff, debuff, debuff] }), // 0 buff, 3 debuff
            createChar({ slot: 'slot1', buffs: [makeBuff()] }),             // 1 buff <-- target
        ];
        const modifiers = { party_buff_count: 0.5 };

        const result = BattleService._determineSmartTarget(alive, modifiers);

        expect(result).toBe('slot1');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: Fallback — Random Target
// ─────────────────────────────────────────────────────────────────────────────
describe('_determineSmartTarget — Fallback: Random Target', () => {
    test('Jika modifier kosong ({}), tetap mengembalikan salah satu karakter hidup', () => {
        const alive = [
            createChar({ slot: 'main' }),
            createChar({ slot: 'slot1' }),
        ];
        const modifiers = {};

        const result = BattleService._determineSmartTarget(alive, modifiers);

        expect(['main', 'slot1']).toContain(result);
    });

    test('Jika modifier null, tetap mengembalikan karakter (tidak crash)', () => {
        const alive = [
            createChar({ slot: 'main' }),
        ];

        const result = BattleService._determineSmartTarget(alive, null);

        expect(result).toBe('main');
    });

    test('Jika hanya 1 karakter hidup, selalu memilih karakter itu', () => {
        const alive = [createChar({ slot: 'slot2', currentHp: 500, maxHp: 10000 })];
        const modifiers = { party_lowest_hp_missing_pct: 1.0 };

        const result = BattleService._determineSmartTarget(alive, modifiers);

        expect(result).toBe('slot2');
    });

    test('Jika alive kosong, mengembalikan null (tidak crash)', () => {
        const result = BattleService._determineSmartTarget([], { party_lowest_hp_missing_pct: 1.0 });

        expect(result).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: Skenario Boss Enraged — Basic Attack Smart Targeting
// ─────────────────────────────────────────────────────────────────────────────
describe('Smart Targeting — Basic Attack saat Boss Enraged', () => {
    /**
     * Test ini memvalidasi LOGIKA dari apa yang terjadi saat
     * 50% chance smart targeting aktif pada basic attack enraged.
     * Kita test _determineSmartTarget secara langsung dengan
     * modifier { party_lowest_hp_missing_pct: 1 }, yang identik
     * dengan apa yang di-inject oleh processEnemyTurn saat Enraged.
     */
    test('Saat enraged + smart targeting aktif: membidik karakter dengan HP terendah', () => {
        const alive = [
            createChar({ slot: 'main',  currentHp: 8000, maxHp: 10000 }), // 80% HP
            createChar({ slot: 'slot1', currentHp: 1500, maxHp: 10000 }), // 15% HP <-- target
            createChar({ slot: 'slot2', currentHp: 5000, maxHp: 10000 }), // 50% HP
        ];
        // Modifier yang di-inject saat Enraged basic attack: { party_lowest_hp_missing_pct: 1 }
        const enragedModifier = { party_lowest_hp_missing_pct: 1 };

        const result = BattleService._determineSmartTarget(alive, enragedModifier);

        expect(result).toBe('slot1');
    });

    test('Saat semua karakter HP penuh, enraged smart targeting memilih salah satu secara acak', () => {
        const alive = [
            createChar({ slot: 'main',  currentHp: 10000, maxHp: 10000 }),
            createChar({ slot: 'slot1', currentHp: 10000, maxHp: 10000 }),
            createChar({ slot: 'slot2', currentHp: 10000, maxHp: 10000 }),
        ];
        const enragedModifier = { party_lowest_hp_missing_pct: 1 };

        const result = BattleService._determineSmartTarget(alive, enragedModifier);

        expect(['main', 'slot1', 'slot2']).toContain(result);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6: Skenario CA Action (Special Skill Single-Target)
// ─────────────────────────────────────────────────────────────────────────────
describe('Smart Targeting — CA Action Single-Target (Skenario Syren "Slingshot")', () => {
    test('Skill dengan modifier Execute: membidik karakter paling sekarat', () => {
        const alive = [
            createChar({ slot: 'main',  currentHp: 9000, maxHp: 10000 }),
            createChar({ slot: 'slot1', currentHp: 500,  maxHp: 10000 }), // <-- target
            createChar({ slot: 'slot2', currentHp: 6000, maxHp: 10000 }),
        ];
        // Score modifiers dari "Slingshot" Syren di DB
        const slingshot_modifiers = { party_lowest_hp_missing_pct: 2.0 };

        const result = BattleService._determineSmartTarget(alive, slingshot_modifiers);

        expect(result).toBe('slot1');
    });

    test('Skill dengan modifier Tank Buster: membidik karakter paling sehat', () => {
        const alive = [
            createChar({ slot: 'main',  currentHp: 3000, maxHp: 10000 }),
            createChar({ slot: 'slot1', currentHp: 9800, maxHp: 10000 }), // <-- target
            createChar({ slot: 'slot2', currentHp: 5500, maxHp: 10000 }),
        ];
        const tankbuster_modifiers = { party_highest_hp_pct: 1.5 };

        const result = BattleService._determineSmartTarget(alive, tankbuster_modifiers);

        expect(result).toBe('slot1');
    });

    test('Skill tanpa modifier targeting: target acak dari karakter hidup', () => {
        const alive = [
            createChar({ slot: 'main' }),
            createChar({ slot: 'slot1' }),
            createChar({ slot: 'slot2' }),
        ];
        // Skill dengan score_modifiers hanya berisi vector non-targeting
        const neutral_modifiers = { boss_hp_pct: 0.5 };

        const result = BattleService._determineSmartTarget(alive, neutral_modifiers);

        // Harus mengembalikan salah satu dari karakter yang ada (fallback random)
        expect(['main', 'slot1', 'slot2']).toContain(result);
        expect(result).not.toBeNull();
    });
});
