const LevelingSystem = require('./server/utils/LevelingSystem.js');
LevelingSystem.init();

console.log("Characters:");
console.log("SSR (60):", LevelingSystem.CHAR_EXP_CUMULATIVE_TABLE[60]);
console.log("SR (50):", LevelingSystem.CHAR_EXP_CUMULATIVE_TABLE[50]);

console.log("Weapons:");
console.log("SSR (100):", LevelingSystem.WEAPON_EXP_CUMULATIVE_TABLE[100]);
console.log("SR (80):", LevelingSystem.WEAPON_EXP_CUMULATIVE_TABLE[80]);
console.log("R (60):", LevelingSystem.WEAPON_EXP_CUMULATIVE_TABLE[60]);
