const http = require('http');

function post(path, body) {
    return new Promise((resolve, reject) => {
        const bodyStr = JSON.stringify(body);
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyStr)
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        req.write(bodyStr);
        req.end();
    });
}

async function run() {
    console.log('Sending request to /api/battle/ai-decision...');
    const res = await post('/api/battle/ai-decision', {
        bsId: 1,
        battleState: {
            player_party: {
                characters: [
                    { hp: 1000, maxHp: 2000, activeEffects: [] }
                ]
            },
            boss: {
                hp: 80000,
                maxHp: 100000,
                phase: 'Normal',
                isCaReady: false
            }
        },
        bossSkills: [
            { id: 8, phase: 'Normal', base_utility: 1.0, score_modifiers: {} },
            { id: 9, phase: 'Normal', base_utility: 0.0, score_modifiers: { override_hp_trigger: 0.5 } }
        ]
    });

    console.log('Response status:', res.status);
    console.log('Response body:', JSON.stringify(res.body, null, 2));

    if (res.status === 200 && res.body.status === 'success' && res.body.data.selected_skill.id === 9) {
        console.log('✅ PASS: Route /api/battle/ai-decision successfully returned correct decision.');
        process.exit(0);
    } else {
        console.log('❌ FAIL: Route returned incorrect response.');
        process.exit(1);
    }
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
