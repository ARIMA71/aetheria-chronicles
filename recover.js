const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\elsan\\.gemini\\antigravity\\brain\\673f52c4-9740-40d7-9b1c-d9cd82ee2459\\.system_generated\\logs\\overview.txt';

if (!fs.existsSync(logPath)) {
    console.error('Log file not found:', logPath);
    process.exit(1);
}

const log = fs.readFileSync(logPath, 'utf8');
console.log('Read log file, size:', log.length);

const targetFiles = [
    'c:/Users/elsan/aetheria-chronicles/server/controllers/battleController.js',
    'c:/Users/elsan/aetheria-chronicles/server/services/BattleService.js',
    'c:/Users/elsan/aetheria-chronicles/client/src/scenes/battleScene.js',
    'c:/Users/elsan/aetheria-chronicles/client/src/scenes/victoryScene.js'
];

for (const tf of targetFiles) {
    const normalized = tf.replace(/\\/g, '/');
    const searchStr = `File Path: \`file:///${normalized}\``;
    
    // Find the LAST occurrence of the file view in the log (most recent state)
    let idx = log.lastIndexOf(searchStr);
    
    if (idx !== -1) {
        console.log('Found log entry for', tf);
        
        // Find the start of the code lines
        const startMarker = 'The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.\n';
        let codeStart = log.indexOf(startMarker, idx);
        
        if (codeStart !== -1) {
            codeStart += startMarker.length;
            
            // Find the end of the code lines
            const endMarker1 = '\nThe above content shows the entire, complete file contents';
            const endMarker2 = '\nThe above content does NOT show the entire file contents';
            
            let codeEnd1 = log.indexOf(endMarker1, codeStart);
            let codeEnd2 = log.indexOf(endMarker2, codeStart);
            
            let codeEnd = -1;
            if (codeEnd1 !== -1 && codeEnd2 !== -1) codeEnd = Math.min(codeEnd1, codeEnd2);
            else if (codeEnd1 !== -1) codeEnd = codeEnd1;
            else if (codeEnd2 !== -1) codeEnd = codeEnd2;
            
            if (codeEnd !== -1) {
                const rawLines = log.substring(codeStart, codeEnd).split('\n');
                const cleanLines = rawLines.map(line => {
                    const match = line.match(/^\d+:\s?(.*)$/);
                    return match ? match[1] : line;
                });
                
                const finalCode = cleanLines.join('\n');
                // Use the correct local path for writing
                const localPath = path.resolve(tf);
                fs.writeFileSync(localPath, finalCode);
                console.log(`✅ Successfully recovered ${localPath} (${cleanLines.length} lines)`);
            } else {
                console.log(`❌ Could not find end marker for ${tf}`);
            }
        }
    } else {
        console.log(`❌ Could not find log entry for ${tf}`);
    }
}
