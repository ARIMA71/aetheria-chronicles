require('dotenv').config();
const http = require('http');

function request(path, body) {
    return new Promise((resolve, reject) => {
        const bodyStr = JSON.stringify(body);
        const req = http.request({
            hostname: 'localhost', port: 3000, path, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
        });
        req.on('error', reject);
        req.write(bodyStr);
        req.end();
    });
}

async function run() {
    const testUser = `player_${Date.now()}`;

    console.log('\n========== TEST 1: REGISTER ==========');
    const reg = await request('/api/auth/register', { username: testUser, password: 'pass123' });
    console.log(`HTTP ${reg.status}:`, JSON.stringify(reg.body, null, 2));

    console.log('\n========== TEST 2: LOGIN SUKSES ==========');
    const login = await request('/api/auth/login', { username: testUser, password: 'pass123' });
    console.log(`HTTP ${login.status}:`, JSON.stringify(login.body, null, 2));
    if (login.body.token) {
        console.log('✅ JWT Token diterima:', login.body.token.substring(0, 40) + '...');
    } else {
        console.log('❌ JWT Token TIDAK ditemukan!');
    }

    console.log('\n========== TEST 3: LOGIN SALAH PASSWORD ==========');
    const loginFail = await request('/api/auth/login', { username: testUser, password: 'wrongpass' });
    console.log(`HTTP ${loginFail.status}:`, JSON.stringify(loginFail.body, null, 2));

    console.log('\n========== TEST 4: REGISTER USERNAME DUPLIKAT ==========');
    const regDup = await request('/api/auth/register', { username: testUser, password: 'pass123' });
    console.log(`HTTP ${regDup.status}:`, JSON.stringify(regDup.body, null, 2));

    console.log('\n========== TEST 5: REGISTER PASSWORD TERLALU PENDEK ==========');
    const regShort = await request('/api/auth/register', { username: `short_${Date.now()}`, password: '123' });
    console.log(`HTTP ${regShort.status}:`, JSON.stringify(regShort.body, null, 2));

    process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
