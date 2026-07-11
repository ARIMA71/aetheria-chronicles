const fs = require('fs');
const content = fs.readFileSync('./client/src/scenes/battleScene.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
    if (/mode|enrage|boss/i.test(line)) {
        console.log(`${i + 1}: ${line.trim()}`);
    }
});
