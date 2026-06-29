const fs = require('fs');
const path = 'C:\\Users\\elsan\\.gemini\\antigravity\\brain\\673f52c4-9740-40d7-9b1c-d9cd82ee2459\\.system_generated\\logs\\overview.txt';
const log = fs.readFileSync(path, 'utf8');

// The file contents usually appear after a diff_block or write_to_file input.
// I will just use regex or string matching.
console.log('Log size:', log.length);
let bcIndex = log.indexOf('battleController.js');
let found = 0;
while (bcIndex !== -1) {
    found++;
    bcIndex = log.indexOf('battleController.js', bcIndex + 1);
}
console.log('battleController.js mentions:', found);
