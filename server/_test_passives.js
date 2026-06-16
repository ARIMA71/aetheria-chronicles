require('dotenv').config();
const http = require('http');

const body = JSON.stringify({ playerId: 1, questId: 5, presetSlot: 1 });

const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/battle/init',
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
        if (json.status === 'success') {
            console.log('=== CHARACTERS ===');
            json.data.player_party.characters.forEach(c => {
                console.log(`${c.name} (Lv${c.level}): HP=${c.final_stats.hp} ATK=${c.final_stats.atk} DEF=${c.final_stats.def} CRIT=${c.final_stats.crit} SA=${c.final_stats.max_sa}`);
            });
            console.log('\n=== ENEMIES ===');
            json.data.enemies.forEach(e => {
                console.log(`${e.name} (Lv${e.level}): HP=${e.final_stats.hp} ATK=${e.final_stats.atk} DEF=${e.final_stats.def}`);
            });
        } else {
            console.error('ERROR:', json.message);
        }
        process.exit(0);
    });
});

req.write(body);
req.end();
