require('dotenv').config();
const http = require('http');

function post(path, body) {
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

function get(path, token) {
    return new Promise((resolve, reject) => {
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const req = http.request({
            hostname: 'localhost', port: 3000, path, method: 'GET',
            headers
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
        });
        req.on('error', reject);
        req.end();
    });
}

async function run() {
    const testUser = `verify_user_${Date.now()}`;

    console.log('--- Registering user ---');
    await post('/api/auth/register', { username: testUser, password: 'password123' });

    console.log('--- Logging in user ---');
    const loginRes = await post('/api/auth/login', { username: testUser, password: 'password123' });
    const token = loginRes.body.token;
    console.log('Obtained token:', token.substring(0, 30) + '...');

    console.log('\n=== Test Case 1: Valid Token ===');
    const verifyValid = await get('/api/auth/verify', token);
    console.log(`HTTP ${verifyValid.status}:`, verifyValid.body);
    if (verifyValid.status === 200 && verifyValid.body.status === 'success') {
        console.log('✅ PASS: Token successfully verified.');
    } else {
        console.log('❌ FAIL: Token verification failed.');
    }

    console.log('\n=== Test Case 2: Invalid/Corrupted Token ===');
    const verifyInvalid = await get('/api/auth/verify', token + 'corrupted');
    console.log(`HTTP ${verifyInvalid.status}:`, verifyInvalid.body);
    if (verifyInvalid.status === 401 && verifyInvalid.body.status === 'error') {
        console.log('✅ PASS: Properly rejected corrupted token.');
    } else {
        console.log('❌ FAIL: Failed to reject corrupted token.');
    }

    console.log('\n=== Test Case 3: Missing Token ===');
    const verifyMissing = await get('/api/auth/verify', null);
    console.log(`HTTP ${verifyMissing.status}:`, verifyMissing.body);
    if (verifyMissing.status === 401 && verifyMissing.body.status === 'error') {
        console.log('✅ PASS: Properly rejected missing token.');
    } else {
        console.log('❌ FAIL: Failed to reject missing token.');
    }

    process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
