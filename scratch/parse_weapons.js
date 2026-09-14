const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, '..', 'Tables db_aetheria.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const target = 'insert  into `master_weapons`';
const idx = sql.indexOf(target);
const endIdx = sql.indexOf(';\r\n', idx) !== -1 ? sql.indexOf(';\r\n', idx) : sql.indexOf(';\n', idx);
const text = sql.substring(idx, endIdx);
const lines = text.split('\n').filter(l => l.trim().startsWith('('));

lines.forEach((l, i) => {
    console.log(`${i+1}:`, l.trim().substring(0, 90));
});
