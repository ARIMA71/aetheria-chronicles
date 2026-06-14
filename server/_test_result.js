require('dotenv').config();
const http = require('http');

const body = JSON.stringify({ playerId: 1, questId: 5 });

const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/battle/result',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        console.log('Status:', json.status);
        console.log('Message:', json.message);
        console.log('\n=== OBTAINED REWARDS ===');
        if (json.data && json.data.obtained_rewards) {
            if (json.data.obtained_rewards.length === 0) {
                console.log('  (Tidak ada item yang didapatkan kali ini — RNG miss)');
            }
            json.data.obtained_rewards.forEach((r, i) => {
                console.log(`\n  [${i + 1}] ${r.reward_type}: ${r.name}`);
                console.log(`      Qty: ${r.quantity} | Rarity: ${r.rarity || '-'} | Element: ${r.element || '-'}`);
                if (r.description) console.log(`      Desc: ${r.description}`);
            });
        } else {
            console.log('  No data returned.');
        }
        console.log('\n=== RAW JSON ===');
        console.log(JSON.stringify(json, null, 2));
        process.exit(0);
    });
});

req.write(body);
req.end();
