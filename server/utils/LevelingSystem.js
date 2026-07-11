const LevelingSystem = {
    CHAR_EXP_CUMULATIVE_TABLE: [0, 0], // Index = Level (Index 1 = Lvl 1, Base EXP 0)
    WEAPON_EXP_CUMULATIVE_TABLE: [0, 0],
    PLAYER_RANK_CUMULATIVE_TABLE: [0, 0],

    // Dijalankan sekali saat server start (misal di app.js atau index.js)
    init: function() {
        // Pengaman (Idempotency): Hentikan fungsi jika array sudah terisi 
        // (mencegah penumpukan data saat hot-reload Nodemon)
        if (this.CHAR_EXP_CUMULATIVE_TABLE.length > 2) return;

        let charTotal = 0;
        let weaponTotal = 0;
        let rankTotal = 0;

        // Karakter maksimal level 50 (SSR) atau 60 jika ada ekspansi
        for (let i = 2; i <= 60; i++) {
            charTotal += Math.floor(50 * Math.pow(i, 1.6));
            this.CHAR_EXP_CUMULATIVE_TABLE.push(charTotal);
        }

        // Senjata maksimal level 100
        for (let i = 2; i <= 100; i++) {
            weaponTotal += Math.floor(20 * Math.pow(i, 1.5));
            this.WEAPON_EXP_CUMULATIVE_TABLE.push(weaponTotal);
        }

        // Rank maksimal 100
        for (let i = 2; i <= 100; i++) {
            rankTotal += Math.floor(100 * Math.pow(i, 1.8));
            this.PLAYER_RANK_CUMULATIVE_TABLE.push(rankTotal);
        }
    },

    // Menentukan batas maksimal level berdasarkan rarity
    // Batas level mutlak
    getCharMaxLevel: function(mcId, rarity, limitBreakLevel = 0) {
        if (mcId === 1) { 
            // Main Character absolut mentok di level 20
            return 20; 
        }
        if (rarity === 'SSR') {
            return 60; 
        }
        if (rarity === 'SR') {
            return 50; 
        }
        return 1; // Fallback
    },

    getWeaponMaxLevel: function(rarity) {
        if (rarity === 'SSR') return 100;
        if (rarity === 'SR') return 80;
        if (rarity === 'R') return 60;
        return 1; // Fallback
    },

    // Fungsi pencari Level Real-Time berdasarkan Total EXP
    calculateCurrentLevel: function(totalExp, maxLevel, type = 'Character') {
        let calculatedLevel = 1;
        const table = type === 'Character' ? this.CHAR_EXP_CUMULATIVE_TABLE : 
                      type === 'Weapon' ? this.WEAPON_EXP_CUMULATIVE_TABLE : 
                      this.PLAYER_RANK_CUMULATIVE_TABLE;
        
        // Pencarian linear cepat (Sangat optimal untuk array size <= 100)
        for (let i = 2; i <= maxLevel; i++) {
            if (totalExp >= table[i]) {
                calculatedLevel = i;
            } else {
                break; // Berhenti jika EXP tidak cukup untuk level berikutnya
            }
        }
        return calculatedLevel;
    },

    // Mendapatkan batas bawah (base) dan batas atas (next) EXP untuk keperluan rendering Progress Bar di Frontend
    getExpThresholds: function(currentLevel, maxLevel, type = 'Character') {
        const table = type === 'Character' ? this.CHAR_EXP_CUMULATIVE_TABLE : 
                      type === 'Weapon' ? this.WEAPON_EXP_CUMULATIVE_TABLE : 
                      this.PLAYER_RANK_CUMULATIVE_TABLE;
        
        return {
            current_level_base_exp: table[currentLevel] || 0,
            next_level_exp: currentLevel < maxLevel ? table[currentLevel + 1] : (table[currentLevel] || 0)
        };
    }
};

module.exports = LevelingSystem;
