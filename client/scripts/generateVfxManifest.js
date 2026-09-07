/**
 * generateVfxManifest.js
 * 
 * Scans the client/assets/vfx directory, reads PNG dimensions,
 * detects frame sizes, and outputs vfxManifest.json.
 * 
 * Usage: node client/scripts/generateVfxManifest.js
 */
const fs = require('fs');
const path = require('path');

// PNG dimension reader (reads IHDR chunk)
function getPngDimensions(filePath) {
    const buf = fs.readFileSync(filePath);
    // PNG IHDR starts at byte 16 (after 8-byte signature + 4-byte length + 4-byte type)
    if (buf.toString('ascii', 1, 4) !== 'PNG') {
        throw new Error(`Not a PNG file: ${filePath}`);
    }
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return { width, height };
}

// Detect frame dimensions based on spritesheet layout
function detectFrames(fileName, width, height) {
    // Check if filename has embedded dimensions like "Effect_Impact_1_291x301.png"
    const dimMatch = fileName.match(/_(\d+)x(\d+)\.png$/i);
    if (dimMatch) {
        const fw = parseInt(dimMatch[1]);
        const fh = parseInt(dimMatch[2]);
        const cols = Math.round(width / fw);
        const rows = Math.round(height / fh);
        return { frameWidth: fw, frameHeight: fh, totalFrames: cols * rows };
    }

    // For horizontal strip spritesheets (height is small, width is large)
    // These are single-row strips where frameHeight = totalHeight
    // and frameWidth is approximately equal to frameHeight (square-ish)
    if (height <= 200) {
        // Single-row horizontal strip
        const frameHeight = height;
        // Try to find the best frameWidth that divides evenly
        // Most of these sprites are roughly square or use height as width
        let frameWidth = frameHeight;
        let totalFrames = Math.floor(width / frameWidth);

        // If it doesn't divide evenly, try common widths
        if (width % frameWidth !== 0) {
            // Try finding a clean divisor close to height
            for (let fw = frameHeight + 8; fw >= frameHeight - 8; fw--) {
                if (fw > 0 && width % fw === 0) {
                    frameWidth = fw;
                    totalFrames = width / fw;
                    break;
                }
            }
            // If still no exact match, just use height as width
            if (width % frameWidth !== 0) {
                totalFrames = Math.round(width / frameWidth);
            }
        }
        return { frameWidth, frameHeight, totalFrames };
    }

    // For grid-based spritesheets (large images with multiple rows)
    // These typically have a fixed number of columns (usually 6)
    const gridCols = 6;
    const frameWidth = Math.round(width / gridCols);
    const frameHeight = frameWidth; // Assume square frames
    const gridRows = Math.round(height / frameHeight);
    const totalFrames = gridCols * gridRows;
    return { frameWidth, frameHeight, totalFrames };
}

const VFX_DIR = path.join(__dirname, '..', 'assets', 'vfx');
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'vfxManifest.json');

const manifest = {
    exact: {},   // Single-file VFX (charBasicAtk, buff, heal, etc.)
    rolling: {}  // Rolling VFX grouped by element folder (skillFire, skillWind, skillEarth)
};

// Process root-level PNG files (exact VFX)
const rootFiles = fs.readdirSync(VFX_DIR);
rootFiles.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (ext !== '.png') return;

    const filePath = path.join(VFX_DIR, file);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return;

    const key = path.basename(file, '.png');
    const { width, height } = getPngDimensions(filePath);
    const { frameWidth, frameHeight, totalFrames } = detectFrames(file, width, height);

    manifest.exact[key] = {
        path: `assets/vfx/${file}`,
        width,
        height,
        frameWidth,
        frameHeight,
        totalFrames
    };

    console.log(`[EXACT] ${key}: ${width}x${height} -> ${frameWidth}x${frameHeight} (${totalFrames} frames)`);
});

// Process subdirectories (rolling VFX)
rootFiles.forEach(dir => {
    const dirPath = path.join(VFX_DIR, dir);
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) return;

    // Only process skill element folders
    if (!dir.startsWith('skill')) return;

    manifest.rolling[dir] = [];
    const subFiles = fs.readdirSync(dirPath);

    subFiles.forEach(file => {
        const ext = path.extname(file).toLowerCase();
        if (ext !== '.png') return;

        const filePath = path.join(dirPath, file);
        const key = `${dir}_${path.basename(file, '.png').replace(/\s+/g, '_')}`;
        const { width, height } = getPngDimensions(filePath);
        const { frameWidth, frameHeight, totalFrames } = detectFrames(file, width, height);

        manifest.rolling[dir].push({
            key,
            path: `assets/vfx/${dir}/${file}`,
            width,
            height,
            frameWidth,
            frameHeight,
            totalFrames
        });

        console.log(`[ROLLING] ${key}: ${width}x${height} -> ${frameWidth}x${frameHeight} (${totalFrames} frames)`);
    });
});

// Write manifest
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
console.log(`\n✅ VFX Manifest written to: ${OUTPUT_FILE}`);
console.log(`   Exact VFX: ${Object.keys(manifest.exact).length}`);
console.log(`   Rolling categories: ${Object.keys(manifest.rolling).length}`);
Object.entries(manifest.rolling).forEach(([cat, items]) => {
    console.log(`     - ${cat}: ${items.length} variants`);
});
