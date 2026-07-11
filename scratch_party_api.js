const http = require('http');

const request = (options, postData) => {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) {
                    resolve(data);
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
};

const runTests = async () => {
    const playerId = 1;
    console.log(`\n--- Testing Party Settings API for Player ${playerId} ---`);

    // 1. GET /api/party/:playerId
    console.log('\n[1] GET /api/party/1 (getPartyPresets)');
    let res = await request({
        hostname: 'localhost',
        port: 3000,
        path: `/api/party/${playerId}`,
        method: 'GET'
    });
    console.log(JSON.stringify(res, null, 2));

    // 2. GET /api/party/:playerId/inventory/all
    console.log('\n[2] GET /api/party/1/inventory/all (getPlayerInventory)');
    res = await request({
        hostname: 'localhost',
        port: 3000,
        path: `/api/party/${playerId}/inventory/all`,
        method: 'GET'
    });
    console.log(`Found ${res.data?.characters?.length} Characters and ${res.data?.weapons?.length} Weapons`);

    // 3. GET /api/party/:playerId/mc-skills/all
    console.log('\n[3] GET /api/party/1/mc-skills/all (getMcSkills)');
    res = await request({
        hostname: 'localhost',
        port: 3000,
        path: `/api/party/${playerId}/mc-skills/all`,
        method: 'GET'
    });
    console.log(`Found ${res.data?.length} MC Skills`);

    // 4. PUT /api/party/:playerId/1 (Save Party Preset 1)
    console.log('\n[4] PUT /api/party/1/1 (savePartyPreset 1)');
    const postData = JSON.stringify({
        char_slot_1_inv_id: 102,
        char_slot_2_inv_id: 103,
        char_slot_3_inv_id: 105,
        weap_grid_1_inv_id: 201, // Main weapon
        weap_grid_2_inv_id: 202,
        weap_grid_3_inv_id: 206,
        weap_grid_4_inv_id: 207,
        weap_grid_5_inv_id: null,
        mc_skills: [2, 3, 5, 8] // Armor break, Dark Haze, Dispel, Revive
    });

    res = await request({
        hostname: 'localhost',
        port: 3000,
        path: `/api/party/${playerId}/1`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, postData);
    console.log(JSON.stringify(res, null, 2));

    // Refetch to see changes
    console.log('\n[5] Refetch GET /api/party/1');
    res = await request({
        hostname: 'localhost',
        port: 3000,
        path: `/api/party/${playerId}`,
        method: 'GET'
    });
    const preset1 = res.data?.find(p => p.preset_slot === 1);
    console.log('Preset 1 weapons:', preset1.weap_grid_1_inv_id, preset1.weap_grid_2_inv_id, preset1.weap_grid_3_inv_id, preset1.weap_grid_4_inv_id, preset1.weap_grid_5_inv_id);
    console.log('Preset 1 skills:', preset1.mc_skills);
};

runTests();
