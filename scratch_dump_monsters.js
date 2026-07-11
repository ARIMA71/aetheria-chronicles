const fs = require('fs');
const sql = fs.readFileSync('Tables db_aetheria.sql', 'utf8');
const match = sql.match(/CREATE TABLE `master_monsters`[\s\S]*?;/);
console.log(match ? match[0] : 'not found');
