const mysql = require('mysql2/promise');
const DamageCalculatorService = require('./services/DamageCalculatorService');
const GridCalculatorService = require('./services/GridCalculatorService');

async function simulate() {
    const db = await mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'db_aetheria'
    });

    try {
        // Fetch SSR Wind Characters
        const [chars] = await db.query(`SELECT * FROM master_characters WHERE mc_element = 'Wind'`);
        
        // Fetch SSR Wind Weapons
        const [weaps] = await db.query(`SELECT * FROM master_weapons WHERE mw_element = 'Wind'`);
        
        // Fetch Golem Stage 7 (mon_id 8)
        const [monsters] = await db.query(`SELECT * FROM master_monsters WHERE mon_id = 8`);
        
        console.log("Characters:", chars.map(c => c.mc_name + " (" + c.mc_rarity + ")").join(', '));
        console.log("Weapons:", weaps.map(w => w.mw_name + " (" + w.mw_rarity + ")").join(', '));
        console.log("Monster:", monsters[0].mon_name);
        
        // Just print raw stats of an SSR character at lv 60
        const ssrChar = chars.find(c => c.mc_rarity === 'SSR');
        if (ssrChar) {
            const atk60 = ssrChar.mc_base_atk + (ssrChar.mc_atk_growth * 59);
            console.log(ssrChar.mc_name, "ATK at Lv 60:", atk60);
        }

        // SSR Weapon at lv 100
        const ssrWeap = weaps.find(w => w.mw_rarity === 'SSR');
        if (ssrWeap) {
            const atk100 = ssrWeap.mw_base_atk + (ssrWeap.mw_atk_growth * 99);
            console.log(ssrWeap.mw_name, "ATK at Lv 100:", atk100);
        }
        
    } catch(e) {
        console.error(e);
    }
    db.end();
}
simulate();
