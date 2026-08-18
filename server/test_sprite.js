require('dotenv').config({ path: './.env' });
const db = require('./config/db');
db.query('SELECT qe.mon_id, mon.mon_name, mon.mon_element, qe.override_element, mon.mon_sprite_path FROM quest_enemies qe JOIN master_monsters mon ON qe.mon_id = mon.mon_id')
.then(([rows]) => {
    console.log('Raw DB Rows:');
    console.log(rows);
    console.log('\n--- Hasil Modifikasi di BattleService ---');
    rows.forEach(row => {
        const el = row.override_element || row.mon_element;
        let sprite = row.mon_sprite_path;
        if (sprite && el && el.toLowerCase() !== 'none' && el.toLowerCase() !== 'any') {
            const elSuffix = el.toLowerCase();
            if (sprite.endsWith('.png')) {
                sprite = sprite.replace('.png', '-' + elSuffix + '.png');
            } else {
                sprite += '-' + elSuffix;
            }
        }
        console.log(`Monster: ${row.mon_name}`);
        console.log(`Original Path: ${row.mon_sprite_path}`);
        console.log(`Elemen: ${el}`);
        console.log(`Resulting Path: ${sprite}`);
        console.log('---------------------------------------');
    });
    process.exit();
}).catch(console.error);
