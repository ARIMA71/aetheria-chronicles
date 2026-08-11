const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000/api';
const PLAYER_ID = 1; // Assuming test player ID

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runGachaStressTest() {
    console.log("=== GACHA STRESS TEST (100 PULLS) ===");
    const results = {
        success: 0,
        failed: 0,
        times: [],
        errors: []
    };

    for (let i = 0; i < 100; i++) {
        const start = performance.now();
        try {
            const res = await fetch(`${API_URL}/gacha/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId: PLAYER_ID,
                    drawType: '1x',
                    elementPool: 'All'
                })
            });
            const data = await res.json();
            const end = performance.now();
            
            if (data.status === 'success' || (data.status === 'error' && data.message.includes('Diamond tidak cukup'))) {
                results.success++;
                results.times.push(end - start);
            } else {
                results.failed++;
                results.errors.push(data.message || 'Unknown error');
            }
        } catch (e) {
            results.failed++;
            results.errors.push(e.message);
        }
        await delay(50); // Small delay to avoid completely overwhelming the local port
    }

    const avgTime = results.times.reduce((a, b) => a + b, 0) / (results.times.length || 1);
    console.log(`Gacha Test Completed.`);
    console.log(`Success: ${results.success}, Failed: ${results.failed}`);
    console.log(`Average Response Time: ${avgTime.toFixed(2)} ms`);
    console.log(`Max Time: ${Math.max(...(results.times.length ? results.times : [0])).toFixed(2)} ms`);
    if (results.errors.length > 0) {
        console.log(`Errors encountered:`, [...new Set(results.errors)].slice(0, 3));
    }
    console.log("=====================================\n");
}

async function runBattleStressTest() {
    console.log("=== BATTLE STRESS TEST (50 BATTLES) ===");
    const results = {
        success: 0,
        failed: 0,
        initTimes: [],
        actionTimes: [],
        errors: []
    };

    for (let i = 0; i < 50; i++) {
        try {
            // 1. Get active session to surrender if any
            const resActive = await fetch(`${API_URL}/battle/active/${PLAYER_ID}`);
            const dataActive = await resActive.json();
            if (dataActive.status === 'success' && dataActive.data) {
                await fetch(`${API_URL}/battle/surrender`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bsId: dataActive.data.bs_id, playerId: PLAYER_ID })
                });
            }

            // 2. Init Battle
            const startInit = performance.now();
            const resInit = await fetch(`${API_URL}/battle/init`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: PLAYER_ID, questId: 5, presetSlot: 1 }) // Test quest
            });
            const dataInit = await resInit.json();
            const endInit = performance.now();
            
            if (dataInit.status !== 'success') {
                throw new Error(dataInit.message || 'Failed Init');
            }
            results.initTimes.push(endInit - startInit);
            
            const bsId = dataInit.data.bs_id;
            const playerSlot = dataInit.data.player_party.characters[0].slot;
            const enemyId = dataInit.data.enemies[0].slot || 'enemy_0';

            // 3. Perform 3 Actions per battle
            for (let act = 0; act < 3; act++) {
                const startAct = performance.now();
                const resAct = await fetch(`${API_URL}/battle/action`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        bsId: bsId,
                        actionData: {
                            sourceId: playerSlot,
                            targetIds: [enemyId],
                            actionType: 'attack',
                            isAttackSequence: true
                        }
                    })
                });
                const dataAct = await resAct.json();
                const endAct = performance.now();
                
                if (dataAct.status !== 'success') {
                    throw new Error(dataAct.message || 'Failed Action');
                }
                results.actionTimes.push(endAct - startAct);
            }

            // Surrender to clean up for next loop
            await fetch(`${API_URL}/battle/surrender`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bsId: bsId, playerId: PLAYER_ID })
            });

            results.success++;
        } catch (e) {
            results.failed++;
            results.errors.push(e.message);
        }
    }

    const avgInit = results.initTimes.reduce((a, b) => a + b, 0) / (results.initTimes.length || 1);
    const avgAct = results.actionTimes.reduce((a, b) => a + b, 0) / (results.actionTimes.length || 1);
    
    console.log(`Battle Test Completed.`);
    console.log(`Success: ${results.success}, Failed: ${results.failed}`);
    console.log(`Average Init Time: ${avgInit.toFixed(2)} ms`);
    console.log(`Average Action Time: ${avgAct.toFixed(2)} ms`);
    if (results.errors.length > 0) {
        console.log(`Errors encountered:`, [...new Set(results.errors)].slice(0, 3));
    }
    console.log("=====================================\n");
}

async function main() {
    console.log("Starting Stress Tests...");
    await runGachaStressTest();
    await runBattleStressTest();
    console.log("Done.");
}

main();
