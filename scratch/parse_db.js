const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, '..', 'Tables db_aetheria.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

function parseTable(tableName) {
    const target = 'insert  into `' + tableName + '`';
    const idx = sql.indexOf(target);
    if (idx === -1) {
        console.log('Not found:', tableName);
        return [];
    }
    const endIdx = sql.indexOf(';\r\n', idx) !== -1 ? sql.indexOf(';\r\n', idx) : sql.indexOf(';\n', idx);
    const text = sql.substring(idx, endIdx);
    const lines = text.split('\n').filter(l => l.trim().startsWith('('));
    return lines;
}

console.log('=== CHARACTERS ===');
const chars = parseTable('master_characters');
console.log('Total Chars:', chars.length);
let ssrC = 0, srC = 0;
chars.forEach((l, index) => {
    const isSSR = l.includes("'SSR'");
    const isSR = l.includes("'SR'");
    if (isSSR) ssrC++;
    if (isSR) srC++;
});
console.log(`SSR Characters: ${ssrC}`);
console.log(`SR Characters: ${srC}`);

console.log('\n=== WEAPONS ===');
const weapons = parseTable('master_weapons');
console.log('Total Weapons:', weapons.length);
let ssrW = 0, srW = 0, rW = 0;
weapons.forEach((l) => {
    // split by comma or inspect rarity field
    if (l.includes("'SSR'")) ssrW++;
    else if (l.includes("'SR'")) srW++;
    else if (l.includes("'R'")) rW++;
});
console.log(`SSR Weapons: ${ssrW}`);
console.log(`SR Weapons: ${srW}`);
console.log(`R Weapons: ${rW}`);

console.log('\n=== QUESTS / STAGES ===');
const quests = parseTable('master_quests');
console.log('Total Quests:', quests.length);

quests.forEach((q, i) => {
    console.log(`Quest ${i+1}:`, q.trim().substring(0, 60));
});
