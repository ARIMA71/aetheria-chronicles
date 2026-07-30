/**
 * benchmark.js — Aetheria Chronicles Performance Benchmark
 * ─────────────────────────────────────────────────────────
 * Mengukur KPI performa mekanisme inti game:
 *   1. AI Decision Time (AiBehaviorService)
 *   2. Damage Calculation (DamageCalculatorService)
 *   3. Leveling System (LevelingSystem)
 *   4. HTTP API Response Time (endpoint live)
 *
 * Jalankan: node benchmark.js
 * Pastikan server berjalan di port 3000 untuk bagian API test.
 */

'use strict';

// Muat variabel dari .env agar tidak terjadi error Access Denied saat import file yang butuh DB
require('dotenv').config();

const { performance } = require('perf_hooks');
const http = require('http');

const AiBehaviorService    = require('./services/AiBehaviorService');
const DamageCalculatorService = require('./services/DamageCalculatorService');
const LevelingSystem       = require('./utils/LevelingSystem');

// Gunakan BattleMemoryStore mock atau inisiasi manual untuk hindari overhead setInterval jika di-require utuh
const BattleService        = require('./services/BattleService');

LevelingSystem.init();

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
function calcStats(timings) {
    const sorted = [...timings].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const avg = sum / n;
    const p95 = sorted[Math.ceil(n * 0.95) - 1];
    return {
        min: sorted[0],
        avg,
        max: sorted[n - 1],
        p95
    };
}

function fmtMs(val) {
    if (val === undefined || val === null) return ' N/A  ';
    if (val < 0.1) return '< 0.1 ms';
    return `${val.toFixed(3)} ms`;
}

function printTable(rows) {
    const colWidths = [30, 12, 12, 12, 12];
    const headers   = ['Komponen', 'Min', 'Avg', 'Max', 'P95 (95th)'];

    const sep = (char = '─') =>
        '╠' + colWidths.map(w => char.repeat(w + 2)).join('╬') + '╣';

    const topBorder  = '╔' + colWidths.map(w => '═'.repeat(w + 2)).join('╦') + '╗';
    const headSep    = '╠' + colWidths.map(w => '═'.repeat(w + 2)).join('╬') + '╣';
    const botBorder  = '╚' + colWidths.map(w => '═'.repeat(w + 2)).join('╩') + '╝';

    const padCell = (str, w) => String(str).padEnd(w);
    const row = (cells) => '║ ' + cells.map((c, i) => padCell(c, colWidths[i])).join(' ║ ') + ' ║';

    console.log('\n');
    console.log(topBorder);
    console.log('║' + ' AETHERIA CHRONICLES — PERFORMANCE BENCHMARK REPORT'.padEnd(colWidths.reduce((a, b) => a + b, 0) + colWidths.length * 3) + '║');
    console.log(headSep);
    console.log(row(headers));
    console.log(sep('═').replace(/╠/,'╠').replace(/╣/,'╣'));

    rows.forEach((r, i) => {
        console.log(row([r.name, fmtMs(r.min), fmtMs(r.avg), fmtMs(r.max), fmtMs(r.p95)]));
        if (i < rows.length - 1) console.log(sep());
    });

    console.log(botBorder);
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_BATTLE_STATE = {
    player_party: {
        characters: [
            { current_hp: 8500, max_hp: 10000, active_buffs: [{ effect_type: 'buff', target_stat: 'ATK', value: 0.2 }] },
            { current_hp: 6000, max_hp: 10000, active_buffs: [] },
            { current_hp: 9000, max_hp: 10000, active_buffs: [{ effect_type: 'debuff', target_stat: 'DEF', value: -0.1 }] },
            { current_hp: 4500, max_hp: 10000, active_buffs: [] }
        ]
    },
    enemies: [{
        current_hp: 45000,
        final_stats: { hp: 100000 },
        mode_state: 'normal',
        current_ca: 5,
        caMax: 5,
        active_buffs: []
    }]
};

const MOCK_BOSS_SKILLS = [
    {
        phase: 'Normal', base_utility: 1.2, currentCooldown: 0, cooldownCount: 0,
        score_modifiers: { party_total_hp_pct: 0.7, party_buff_count: -0.2 },
        modifiers: {},
        skill: { id: 1, name: 'Typhoon', type: 'Damage', modifier: 2.5, element: 'Wind' }
    },
    {
        phase: 'Normal', base_utility: 0.6, currentCooldown: 0, cooldownCount: 0,
        score_modifiers: { party_buff_count: 0.25, party_debuff_count: -0.1 },
        modifiers: {},
        skill: { id: 2, name: 'Flute', type: 'Debuff', modifier: 0, element: 'Wind' }
    },
    {
        phase: 'Normal', base_utility: 0.3, currentCooldown: 0, cooldownCount: 0,
        score_modifiers: { party_lowest_hp_missing_pct: 1.5 },
        modifiers: {},
        skill: { id: 3, name: 'Mending Tide', type: 'Heal', modifier: 0.3, element: 'Wind' }
    }
];

const MOCK_ATTACKER = {
    final_stats: { atk: 5500, hp: 12000, def: 800 },
    element: 'Fire', mode_state: 'normal', active_buffs: []
};

const MOCK_TARGET = {
    final_stats: { atk: 3200, hp: 100000, def: 3200 },
    element: 'Wind', mode_state: 'normal', active_buffs: []
};

const MOCK_SKILL = { name: 'Inferno Slash', type: 'Damage', modifier: 2.5, element: 'Fire' };

// ─────────────────────────────────────────────────────────────────────────────
// BENCHMARK RUNNERS
// ─────────────────────────────────────────────────────────────────────────────
function runLogicBenchmark(label, fn, iterations = 10000) {
    console.log(`  ⏱  Benchmarking: ${label} (${iterations.toLocaleString()} iterasi)...`);
    const timings = [];
    for (let i = 0; i < iterations; i++) {
        const t0 = performance.now();
        fn();
        timings.push(performance.now() - t0);
    }
    return { name: label, ...calcStats(timings) };
}

function httpRequest(options, body) {
    return new Promise((resolve, reject) => {
        const start = performance.now();
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ duration: performance.now() - start, status: res.statusCode }));
        });
        req.on('error', reject);
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        if (body) req.write(body);
        req.end();
    });
}

async function runApiBenchmark(label, options, body, iterations = 30) {
    console.log(`  🌐 Benchmarking API: ${label} (${iterations} requests)...`);
    const timings = [];
    const bodyStr = JSON.stringify(body);
    for (let i = 0; i < iterations; i++) {
        try {
            const result = await httpRequest({
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(bodyStr)
                }
            }, bodyStr);
            timings.push(result.duration);
        } catch (err) {
            // Jika server tidak berjalan, skip
        }
    }
    if (timings.length === 0) {
        console.log(`    ⚠️  Server tidak dapat dihubungi — pastikan server berjalan di port 3000`);
        return { name: label, min: null, avg: null, max: null, p95: null };
    }
    return { name: label, ...calcStats(timings) };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n══════════════════════════════════════════════════════');
    console.log('  AETHERIA CHRONICLES — PERFORMANCE BENCHMARK');
    console.log('  Tanggal:', new Date().toLocaleString('id-ID'));
    console.log('══════════════════════════════════════════════════════');
    console.log('\n[1/3] Logic Benchmarks (Pure JavaScript, tanpa DB)...');

    const results = [];

    // 1. AI Decision
    results.push(runLogicBenchmark(
        'AI Decision (AiBehaviorService)',
        () => AiBehaviorService.calculateBossAction(MOCK_BATTLE_STATE, MOCK_BOSS_SKILLS),
        10000
    ));

    // 2. Damage Calculation
    results.push(runLogicBenchmark(
        'Damage Calc (DamageCalculatorSvc)',
        () => DamageCalculatorService.calculateDamage(MOCK_ATTACKER, MOCK_TARGET, MOCK_SKILL),
        10000
    ));

    // 3. Smart Targeting (BattleService)
    results.push(runLogicBenchmark(
        'Smart Targeting (BattleService)',
        () => BattleService._determineSmartTarget(MOCK_BATTLE_STATE.player_party.characters, { party_lowest_hp_missing_pct: 2.0 }),
        10000
    ));

    // 4. Leveling
    results.push(runLogicBenchmark(
        'Level Calc (LevelingSystem)',
        () => LevelingSystem.calculateCurrentLevel(Math.floor(Math.random() * 5000000), 60, 'Character'),
        10000
    ));

    // 5. EXP Thresholds
    results.push(runLogicBenchmark(
        'EXP Thresholds (LevelingSystem)',
        () => LevelingSystem.getExpThresholds(Math.ceil(Math.random() * 59) + 1, 60, 'Character'),
        10000
    ));

    // 6. Gacha RNG Logic
    const bannerItems = [
        { mw_rarity: 'SSR', drop_chance: 0.02 },
        { mw_rarity: 'SR', drop_chance: 0.18 },
        { mw_rarity: 'R', drop_chance: 0.80 }
    ];
    const getRandomItemWeighted = (itemsPool) => {
        const totalWeight = itemsPool.reduce((sum, item) => sum + item.drop_chance, 0);
        let random = Math.random() * totalWeight;
        for (const item of itemsPool) {
            if (random < item.drop_chance) return item;
            random -= item.drop_chance;
        }
        return itemsPool[itemsPool.length - 1];
    };
    results.push(runLogicBenchmark(
        'Gacha RNG (Monte Carlo Pick)',
        () => getRandomItemWeighted(bannerItems),
        10000
    ));

    // 7. Battle Wave Check
    results.push(runLogicBenchmark(
        'Battle Wave Check (BattleSvc)',
        () => {
            const state = {
                current_wave_index: 0,
                waves: [[{ id: 'e1', current_hp: 0 }], [{ id: 'e2', current_hp: 100 }]],
                enemies: [{ id: 'e1', current_hp: 0 }],
                defeated_enemies: [],
                player_party: { characters: [] }
            };
            BattleService._checkWaveClear(state, []);
        },
        10000
    ));

    console.log('\n[2/3] API Benchmarks (HTTP ke localhost:3000)...');
    const apiBase = { hostname: 'localhost', port: 3000, method: 'POST' };

    // GET /api/party (lightweight)
    const partyResult = await runApiBenchmark(
        'GET /api/party/1',
        { ...apiBase, method: 'GET', path: '/api/party/1' },
        null,
        30
    );
    results.push(partyResult);

    console.log('\n[3/3] Generating report...');
    printTable(results);

    // KPI Analysis
    console.log('\n📊 ANALISIS KPI vs TARGET PROPOSAL:');
    console.log('─────────────────────────────────────────────────────');
    const aiResult = results[0];
    if (aiResult.avg !== null) {
        const aiPass = aiResult.p95 <= 500;
        console.log(`  AI Decision Time (P95): ${fmtMs(aiResult.p95).trim()} — Target: ≤ 500ms — ${aiPass ? '✅ LULUS' : '❌ GAGAL'}`);
    }
    if (partyResult.avg !== null) {
        const apiPass = partyResult.p95 <= 1000;
        console.log(`  API Response (P95):     ${fmtMs(partyResult.p95).trim()} — Target: < 1000ms — ${apiPass ? '✅ LULUS' : '❌ GAGAL'}`);
    } else {
        console.log(`  API Response: ⚠️  Tidak dapat diukur (server tidak berjalan)`);
    }
    console.log('─────────────────────────────────────────────────────');
    console.log('\n  💡 Salin tabel di atas ke Bab 4 skripsi sebagai bukti KPI.');
    console.log('  💡 Jalankan ulang dengan server aktif untuk mendapatkan data API lengkap.\n');
    
    // Matikan proses secara paksa agar setInterval dari BattleService tidak menahan benchmark
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
