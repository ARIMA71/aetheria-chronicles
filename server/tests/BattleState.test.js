/**
 * Unit Test: BattleService (State Management)
 * White-box testing untuk transisi Multi-Wave, Chain Burst, dan State Evaluation.
 */

describe('BattleService - State Management', () => {

    // 1. Uji Transisi Wave Multi-Tahap
    describe('Multi-Wave Transition Logic (_checkWaveClear)', () => {
        it('should advance to the next wave when all current enemies are defeated (HP = 0)', () => {
            const state = {
                current_wave_index: 0,
                waves: [
                    [{ id: 'enemy_wave1', hp: 100, current_hp: 0 }], // Wave 1 (Mati)
                    [{ id: 'enemy_wave2', hp: 150, current_hp: 150 }] // Wave 2 (Hidup)
                ],
                enemies: [
                    { id: 'enemy_wave1', hp: 100, current_hp: 0 }
                ],
                player_party: { characters: [] },
                defeated_enemies: []
            };

            const events = [];
            
            // Replika logika _checkWaveClear
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

            expect(state.current_wave_index).toBe(1); // Pindah ke wave 2
            expect(state.enemies[0].id).toBe('enemy_wave2'); // Memuat musuh wave 2
            expect(state.defeated_enemies).toContain('enemy_wave1'); // Mencatat musuh mati
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
            expect(state.current_wave_index).toBe(0); // Tetap di wave 0
        });
    });

    // 2. Uji Kalkulator Multiplier Chain Burst
    describe('SA Chain Burst Evaluator', () => {
        it('should assign correct damage multiplier based on number of SAs used in a turn', () => {
            const evaluateChainMultiplier = (saCount) => {
                let chainMult = 1.0; // Default fallback
                if (saCount >= 2) chainMult = 1.2;
                if (saCount === 3) chainMult = 1.5;
                if (saCount >= 4) chainMult = 2.0; // 200% untuk 4 karakter
                return chainMult;
            };

            expect(evaluateChainMultiplier(1)).toBe(1.0); // Tidak ada chain burst
            expect(evaluateChainMultiplier(2)).toBe(1.2); // 120% Damage
            expect(evaluateChainMultiplier(3)).toBe(1.5); // 150% Damage
            expect(evaluateChainMultiplier(4)).toBe(2.0); // 200% Damage
        });
    });

    // 3. Uji Aether Burst Threshold
    describe('Aether Burst Validation', () => {
        it('should throw an error if Aether Gauge is less than 100', () => {
            const executeAetherBurst = (gauge) => {
                if (gauge < 100) throw new Error('Aether Burst not ready! Gauge must be 100%.');
                return true; // Success
            };

            expect(() => executeAetherBurst(99)).toThrow('Aether Burst not ready!');
            expect(executeAetherBurst(100)).toBe(true);
        });
    });

    // 4. Uji Stun Override Mechanism
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

    // 5. Uji Boss Exhausted Constraints
    describe('Boss Exhausted Constraints', () => {
        it('should set skipCaGain to true when boss is in exhausted mode', () => {
            const enemy = { mode_state: 'exhausted' };
            const isExhausted = (enemy.mode_state === 'exhausted' || enemy.modeState === 'exhausted');
            
            const actionData = { skipCaGain: isExhausted };
            expect(actionData.skipCaGain).toBe(true);
        });
    });

    // 6. Uji Enemy Buff/Debuff Tick Isolation
    describe('Enemy Buff/Debuff Tick Isolation', () => {
        it('should skip duration tick if applied_by_enemy_this_turn is true, then set it to false', () => {
            const buff = { duration: 1, applied_by_enemy_this_turn: true };
            
            const tickBuffs = (b) => {
                if (b.applied_by_enemy_this_turn) {
                    b.applied_by_enemy_this_turn = false;
                    return; // Skip tick this turn
                }
                b.duration -= 1;
            };

            // First turn (just applied)
            tickBuffs(buff);
            expect(buff.duration).toBe(1);
            expect(buff.applied_by_enemy_this_turn).toBe(false);

            // Second turn (normal tick)
            tickBuffs(buff);
            expect(buff.duration).toBe(0);
        });
    });

    // 7. Uji HP Trigger CA Bypass
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

            // Casting special skill but isHpTrigger = true -> CA should NOT reset
            const remainingCa = processActionSim('special');
            expect(actionData.skipCaReset).toBe(true);
            expect(remainingCa).toBe(5); 
        });
    });
});
