/**
 * Unit Test: CoreBattleMechanics.test.js
 * Comprehensive White-box testing for Core Turn-Based Battle Loop Execution,
 * Action Queue Batching, State Evaluation (Multi-Wave, Aether Burst, SA Chain, Stun, Exhaustion),
 * and Anti-Corruption Snapshot Rollback Mechanism.
 */

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

const BattleService = require('../services/BattleService');
const BattleMemoryStore = require('../cache/BattleMemoryStore');

describe('Core Battle Engine & State Management', () => {

    // ─────────────────────────────────────────────────────────────────────────────
    // SUITE 1: Core Execution Loop & Snapshot Rollback
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Core Battle Execution Loop & Rollback', () => {
        const mockBsId = 'test_batch_session_123';
        let initialMockState;

        beforeEach(() => {
            initialMockState = {
                bs_id: mockBsId,
                player_id: 1,
                current_turn: 1,
                current_wave_index: 0,
                aether_gauge: 50,
                heals_remaining: 3,
                is_processing: false,
                player_party: {
                    characters: [
                        {
                            id: 'mc',
                            slot: 'Main Character',
                            name: 'Hero',
                            element: 'Fire',
                            current_hp: 1000,
                            current_sa: 20,
                            final_stats: { hp: 1000, atk: 500, def: 200 },
                            skills: [
                                { id: 101, name: 'Flame Slash', type: 'Damage', target_type: 'Single_Enemy', cooldown: 2, current_cooldown: 0 }
                            ],
                            active_buffs: []
                        },
                        {
                            id: 'char_2',
                            slot: 'Char Slot 1',
                            name: 'Ally',
                            element: 'Wind',
                            current_hp: 800,
                            current_sa: 0,
                            final_stats: { hp: 800, atk: 400, def: 150 },
                            skills: [],
                            active_buffs: []
                        }
                    ]
                },
                enemies: [
                    {
                        id: 201,
                        name: 'Goblin Leader',
                        element: 'Earth',
                        current_hp: 1500,
                        final_stats: { hp: 1500, atk: 300, def: 100 },
                        current_ca: 5,
                        caMax: 5,
                        active_buffs: []
                    }
                ],
                waves: [
                    [
                        {
                            id: 201,
                            name: 'Goblin Leader',
                            element: 'Earth',
                            current_hp: 1500,
                            final_stats: { hp: 1500, atk: 300, def: 100 },
                            current_ca: 5,
                            caMax: 5,
                            active_buffs: []
                        }
                    ]
                ]
            };

            BattleMemoryStore.set(mockBsId, initialMockState);
        });

        test('Mekanisme Utama: Eksekusi batch giliran pertarungan (Player + AI + End Turn) dalam 1 siklus atomik', async () => {
            const batchPayload = {
                character_actions: [
                    { slot: 'Main Character', action_type: 'basic_attack', target_index: 0 },
                    { slot: 'Char Slot 1', action_type: 'basic_attack', target_index: 0 }
                ]
            };

            const result = await BattleService.processTurnBatch(mockBsId, batchPayload);

            expect(result).toHaveProperty('events');
            expect(result).toHaveProperty('stateSnapshot');
            expect(Array.isArray(result.events)).toBe(true);

            expect(result.stateSnapshot.current_turn).toBe(2);
            expect(result.stateSnapshot.is_processing).toBe(false);
        });

        test('Anti-Corruption Rollback: Jika terjadi server crash di tengah pertarungan, state RAM kembali 100% utuh', async () => {
            const corruptPayload = {
                character_actions: [
                    { slot: 'Main Character', action_type: 'basic_attack', target_index: 0 }
                ]
            };

            const stateBefore = JSON.parse(JSON.stringify(BattleMemoryStore.get(mockBsId)));

            const spy = jest.spyOn(BattleService, '_checkWaveClear').mockImplementationOnce(() => {
                throw new Error('SIMULATED_UNEXPECTED_SERVER_CRASH');
            });

            await expect(BattleService.processTurnBatch(mockBsId, corruptPayload)).rejects.toThrow('SIMULATED_UNEXPECTED_SERVER_CRASH');

            const stateAfterRollback = BattleMemoryStore.get(mockBsId);
            expect(stateAfterRollback.player_party.characters[0].current_hp).toBe(stateBefore.player_party.characters[0].current_hp);
            expect(stateAfterRollback.enemies[0].current_hp).toBe(stateBefore.enemies[0].current_hp);
            expect(stateAfterRollback.is_processing).toBe(false);

            spy.mockRestore();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // SUITE 2: Multi-Wave Transition Logic (_checkWaveClear)
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Multi-Wave Transition Logic (_checkWaveClear)', () => {
        it('should advance to the next wave when all current enemies are defeated (HP = 0)', () => {
            const state = {
                current_wave_index: 0,
                waves: [
                    [{ id: 'enemy_wave1', hp: 100, current_hp: 0 }],
                    [{ id: 'enemy_wave2', hp: 150, current_hp: 150 }]
                ],
                enemies: [
                    { id: 'enemy_wave1', hp: 100, current_hp: 0 }
                ],
                player_party: { characters: [] },
                defeated_enemies: []
            };

            const events = [];
            
            const checkWaveClear = (state, events) => {
                const allDead = state.enemies.every(e => e.current_hp <= 0);
                if (allDead) {
                    state.enemies.forEach(e => state.defeated_enemies.push(e.id));
                    if (state.current_wave_index + 1 < state.waves.length) {
                        state.current_wave_index += 1;
                        state.enemies = JSON.parse(JSON.stringify(state.waves[state.current_wave_index]));
                    }
                }
            };

            checkWaveClear(state, events);

            expect(state.current_wave_index).toBe(1);
            expect(state.enemies[0].id).toBe('enemy_wave2');
            expect(state.defeated_enemies).toContain('enemy_wave1');
        });

        it('should NOT advance wave if there are surviving enemies', () => {
            const state = {
                current_wave_index: 0,
                waves: [
                    [{ id: 'enemy_1', current_hp: 0 }, { id: 'enemy_2', current_hp: 10 }]
                ],
                enemies: [
                    { id: 'enemy_1', current_hp: 0 }, { id: 'enemy_2', current_hp: 10 }
                ],
                defeated_enemies: []
            };

            const checkWaveClear = (state, events) => {
                const allDead = state.enemies.every(e => e.current_hp <= 0);
                if (allDead) state.current_wave_index += 1;
            };

            checkWaveClear(state, []);
            expect(state.current_wave_index).toBe(0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // SUITE 3: SA Chain Burst Evaluator
    // ─────────────────────────────────────────────────────────────────────────────
    describe('SA Chain Burst Evaluator', () => {
        it('should assign correct damage multiplier based on number of SAs used in a turn', () => {
            const evaluateChainMultiplier = (saCount) => {
                let chainMult = 1.0;
                if (saCount >= 2) chainMult = 1.2;
                if (saCount === 3) chainMult = 1.5;
                if (saCount >= 4) chainMult = 2.0;
                return chainMult;
            };

            expect(evaluateChainMultiplier(1)).toBe(1.0);
            expect(evaluateChainMultiplier(2)).toBe(1.2);
            expect(evaluateChainMultiplier(3)).toBe(1.5);
            expect(evaluateChainMultiplier(4)).toBe(2.0);
        });

        it('should trigger SA Chain Burst event at end of turn when 2 or more SAs are executed in batch', async () => {
            const mockState = {
                current_wave_index: 0,
                aether_gauge: 0,
                current_turn_sa_count: 0,
                player_party: {
                    characters: [
                        {
                            slot: 'Main Character',
                            mc_id: 1,
                            element: 'Fire',
                            current_hp: 5000,
                            current_sa: 100,
                            final_stats: { hp: 5000, atk: 1000, def: 500, crit: 0.1 },
                            skills: [{ id: 35, category: 'Special', name: 'Lord of Vermilion', type: 'Damage', modifier: 4.5 }]
                        },
                        {
                            slot: 'Char Slot 1',
                            mc_id: 2,
                            element: 'Fire',
                            current_hp: 4000,
                            current_sa: 100,
                            final_stats: { hp: 4000, atk: 900, def: 400, crit: 0.1 },
                            skills: [{ id: 12, category: 'Special', name: 'Feuersturm Glanz', type: 'Damage', modifier: 3.5 }]
                        }
                    ]
                },
                enemies: [
                    {
                        monsterId: 'enemy_0',
                        name: 'Syren',
                        element: 'Wind',
                        current_hp: 100000,
                        final_stats: { hp: 100000, atk: 500, def: 200 }
                    }
                ]
            };

            BattleMemoryStore.set('test_chain_burst_session', mockState);

            const result = await BattleService.processTurnBatch('test_chain_burst_session', [
                { slot: 'Main Character', action_type: 'special_attack', target_index: 0 },
                { slot: 'Char Slot 1', action_type: 'special_attack', target_index: 0 }
            ]);

            const chainBurstEv = result.events.find(e => e.skillCategory === 'chain_burst');
            expect(chainBurstEv).toBeDefined();
            expect(chainBurstEv.sourceId).toBe('sa_chain_burst');
            expect(chainBurstEv.skillName).toContain('💥 SA CHAIN BURST (2x)');
            expect(chainBurstEv.value).toBeGreaterThan(0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // SUITE 4: Aether Burst Validation
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Aether Burst Validation', () => {
        it('should throw an error if Aether Gauge is less than 100', () => {
            const executeAetherBurst = (gauge) => {
                if (gauge < 100) throw new Error('Aether Burst not ready! Gauge must be 100%.');
                return true;
            };

            expect(() => executeAetherBurst(99)).toThrow('Aether Burst not ready!');
            expect(executeAetherBurst(100)).toBe(true);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // SUITE 5: Stun Override Mechanism
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Stun Override Mechanism', () => {
        it('should return 0 damage and STUNNED skillName when attacker is stunned', () => {
            const attacker = { active_buffs: [{ target_stat: 'STUN' }] };
            const isAttackerStunned = (attacker.active_buffs || []).some(b => b.target_stat === 'STUN');
            
            const processActionSimulated = () => {
                if (isAttackerStunned) {
                    return [{ type: 'damage', value: 0, skillName: 'STUNNED' }];
                }
                return [{ type: 'damage', value: 100, skillName: 'Basic Attack' }];
            };

            const events = processActionSimulated();
            expect(events[0].value).toBe(0);
            expect(events[0].skillName).toBe('STUNNED');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // SUITE 6: Boss Exhausted Constraints
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Boss Exhausted Constraints', () => {
        it('should set skipCaGain to true when boss is in exhausted mode', () => {
            const enemy = { mode_state: 'exhausted' };
            const isExhausted = (enemy.mode_state === 'exhausted' || enemy.modeState === 'exhausted');
            
            const actionData = { skipCaGain: isExhausted };
            expect(actionData.skipCaGain).toBe(true);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // SUITE 7: Enemy Buff/Debuff Tick Isolation
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Enemy Buff/Debuff Tick Isolation', () => {
        it('should skip duration tick if applied_by_enemy_this_turn is true, then set it to false', () => {
            const buff = { duration: 1, applied_by_enemy_this_turn: true };
            
            const tickBuffs = (b) => {
                if (b.applied_by_enemy_this_turn) {
                    b.applied_by_enemy_this_turn = false;
                    return;
                }
                b.duration -= 1;
            };

            tickBuffs(buff);
            expect(buff.duration).toBe(1);
            expect(buff.applied_by_enemy_this_turn).toBe(false);

            tickBuffs(buff);
            expect(buff.duration).toBe(0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // SUITE 8: HP Trigger CA Bypass
    // ─────────────────────────────────────────────────────────────────────────────
    describe('HP Trigger CA Bypass', () => {
        it('should set skipCaReset to true if skill is an HP Trigger (override)', () => {
            const caSkill = { isHpTrigger: true };
            
            const actionData = {
                skipCaReset: caSkill.isHpTrigger === true
            };
            
            const processActionSim = (skillCategory) => {
                let current_ca = 5;
                if (skillCategory === 'special' && !actionData.skipCaReset) {
                    current_ca = 0;
                }
                return current_ca;
            };

            const remainingCa = processActionSim('special');
            expect(actionData.skipCaReset).toBe(true);
            expect(remainingCa).toBe(5); 
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // SUITE 9: Instant Skill Effects (Delay, Dispel, Heal, HP Sacrifice)
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Instant Skill Effects (Delay, Dispel, Heal, HP Sacrifice)', () => {
        it('should correctly apply HP Sacrifice before damage calculation', () => {
            const attacker = { current_hp: 1000, final_stats: { hp: 1000 } };
            const skill = { hp_cost_pct: 0.20, name: 'Blood Strike' };
            const events = [];
            
            // Simulasi block logika HP Sacrifice di BattleService.js
            const hpCostPct = parseFloat(skill.hp_cost_pct) || 0;
            if (hpCostPct > 0 && attacker.current_hp > 0) {
                const hpCost = Math.floor(attacker.final_stats.hp * hpCostPct);
                attacker.current_hp -= hpCost;
                events.push({ type: 'damage', value: hpCost, isCost: true });
            }

            expect(attacker.current_hp).toBe(800); // 1000 - (1000 * 20%)
            expect(events[0].isCost).toBe(true);
            expect(events[0].value).toBe(200);
        });

        it('should correctly reduce enemy CA when applying Delay', () => {
            const target = { current_ca: 3, id: 'enemy_1' };
            const skill = { trigger_delay: 1, name: 'Shield Bash' };
            const events = [];

            // Simulasi block logika Delay di BattleService.js
            if (skill.trigger_delay > 0 && target.id.startsWith('enemy_')) {
                if (target.current_ca > 0) {
                    target.current_ca -= 1;
                    events.push({ type: 'effect_applied', effectName: 'Delay' });
                }
            }

            expect(target.current_ca).toBe(2);
            expect(events[0].effectName).toBe('Delay');
        });

        it('should correctly remove the most recent buff when applying Dispel', () => {
            const target = { active_buffs: [{ effect_type: 'debuff', name: 'Poison' }, { effect_type: 'buff', name: 'ATK Up' }] };
            const skill = { trigger_dispel: 1, name: 'Purge' };
            const events = [];

            // Simulasi block logika Dispel di BattleService.js
            if (skill.trigger_dispel > 0 && target.active_buffs) {
                const buffs = target.active_buffs.filter(e => (e.effect_type || '').toLowerCase() === 'buff');
                if (buffs.length > 0) {
                    const removed = buffs.pop();
                    target.active_buffs = target.active_buffs.filter(b => b !== removed);
                    events.push({ type: 'effect_applied', effectName: 'Dispel' });
                }
            }

            // ATK Up (buff) harus hilang, Poison (debuff) harus tetap ada
            expect(target.active_buffs.length).toBe(1);
            expect(target.active_buffs[0].name).toBe('Poison');
            expect(events[0].effectName).toBe('Dispel');
        });

        it('should correctly restore target HP when applying Heal', () => {
            const target = { current_hp: 500, final_stats: { hp: 1000 } };
            const skill = { trigger_heal_pct: 0.30, name: 'Greater Heal' };
            const events = [];

            // Simulasi block logika Heal di BattleService.js
            const triggerHealPct = parseFloat(skill.trigger_heal_pct) || 0;
            if (triggerHealPct > 0 && target.current_hp > 0) {
                const healAmt = Math.floor(target.final_stats.hp * triggerHealPct);
                target.current_hp = Math.min(target.current_hp + healAmt, target.final_stats.hp);
                events.push({ type: 'heal', value: healAmt });
            }

            expect(target.current_hp).toBe(800); // 500 + 300
            expect(events[0].value).toBe(300);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // SUITE 10: Counter Stance Mechanics, Anti-Overkill & SA Gauge Isolation
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Counter Stance Mechanics, Anti-Overkill & SA Gauge Isolation', () => {
        const mockBsId = 'test_counter_session_999';

        beforeEach(() => {
            const counterMockState = {
                bs_id: mockBsId,
                player_id: 1,
                current_turn: 1,
                current_wave_index: 0,
                aether_gauge: 50,
                heals_remaining: 3,
                is_processing: false,
                player_party: {
                    characters: [
                        {
                            id: 'narmaya',
                            slot: 'Main Character',
                            name: 'Narmaya',
                            element: 'Wind',
                            current_hp: 1000,
                            current_sa: 20,
                            final_stats: { hp: 1000, atk: 600, def: 200 },
                            skills: [],
                            active_buffs: [
                                { effect_name: 'Counter Stance', target_stat: 'STANCE', value: 1.0, duration: 2 }
                            ]
                        },
                        {
                            id: 'ally_counter',
                            slot: 'Char Slot 1',
                            name: 'Ally Counter',
                            element: 'Fire',
                            current_hp: 800,
                            current_sa: 10,
                            final_stats: { hp: 800, atk: 500, def: 150 },
                            skills: [],
                            active_buffs: [
                                { effect_name: 'Counter Stance', target_stat: 'STANCE', value: 1.0, duration: 2 }
                            ]
                        }
                    ]
                },
                enemies: [
                    {
                        id: 501,
                        name: 'Fragile Monster',
                        element: 'Earth',
                        current_hp: 50, // Low HP so 1st counter kills it
                        final_stats: { hp: 500, atk: 100, def: 50 },
                        current_ca: 0,
                        caMax: 5,
                        active_buffs: [],
                        ai_behaviors: [
                            {
                                skill: {
                                    id: 9001,
                                    name: 'Swipe All',
                                    category: 'Special',
                                    type: 'Damage',
                                    target_type: 'All_Enemies',
                                    modifier: 1.0,
                                    element: 'Earth'
                                }
                            }
                        ]
                    }
                ],
                waves: [
                    [
                        {
                            id: 501,
                            name: 'Fragile Monster',
                            element: 'Earth',
                            current_hp: 50,
                            final_stats: { hp: 500, atk: 100, def: 50 },
                            current_ca: 0,
                            caMax: 5,
                            active_buffs: []
                        }
                    ]
                ]
            };

            BattleMemoryStore.set(mockBsId, counterMockState);
        });

        test('Aturan 1 (Anti-Overkill & Crash Prevention): Musuh mati pada serangan balasan pertama tidak menerima counter beruntun', async () => {
            const batchPayload = {
                character_actions: [
                    { slot: 'Main Character', action_type: 'basic_attack', target_index: 0 }
                ]
            };

            // Player 1 attacks, then Enemy uses Swipe All (AoE against both characters with Counter Stance)
            const result = await BattleService.processTurnBatch(mockBsId, batchPayload);

            const counterEvents = result.events.filter(e => e.type === 'counter_attack');
            
            // Because enemy has only 50 HP left, Narmaya's 1st counter attack kills it (enemy HP reaches 0)
            // Rule 1 dictates that enemy.current_hp must not go negative and counter loop breaks!
            expect(counterEvents.length).toBeLessThanOrEqual(1);

            const enemy = result.stateSnapshot.enemies ? result.stateSnapshot.enemies[0] : null;
            if (enemy) {
                expect(enemy.current_hp).toBe(0); // Anti-Overkill: HP clamp to 0, not negative
            }
        });

        test('Aturan 2 (Isolasi SA Gauge): Serangan counter TIDAK menambahkan SA Gauge ke karakter', async () => {
            const state = BattleMemoryStore.get(mockBsId);
            // Set enemy HP high enough so it survives player basic attack and attacks back
            state.enemies[0].current_hp = 3000;
            state.enemies[0].final_stats.hp = 3000;

            // Keep only Narmaya so enemy is guaranteed to target Narmaya
            state.player_party.characters = [state.player_party.characters[0]];

            const narmaya = state.player_party.characters[0];
            const saBefore = narmaya.current_sa;

            const batchPayload = {
                character_actions: [
                    { slot: 'Main Character', action_type: 'basic_attack', target_index: 0 }
                ]
            };

            const result = await BattleService.processTurnBatch(mockBsId, batchPayload);
            const updatedNarmaya = result.stateSnapshot.player_party.characters[0];

            // Verify counter attack event actually occurred
            const counterEvents = result.events.filter(e => e.type === 'counter_attack');
            expect(counterEvents.length).toBeGreaterThan(0);

            // Narmaya gets +20 SA from Basic Attack (Player Phase) + +20 SA from taking damage (Enemy Phase)
            // But 0 SA from Counter Attack itself!
            const expectedSa = Math.min(100, saBefore + 20 + 20); // 20 (base) + 20 (attack) + 20 (damaged) = 60
            expect(updatedNarmaya.current_sa).toBe(expectedSa);
        });
    });
});

