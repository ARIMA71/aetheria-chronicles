const db = require('../config/db');

/**
 * Checks if the player's stamina is below max and if 5 minutes (300 seconds)
 * have passed since it was last updated. If so, immediately refills it to max (100).
 * 
 * @param {number} playerId - The ID of the player
 * @param {object} connOrDb - Knex connection or db pool reference
 */
exports.checkAndRegenStamina = async (playerId, connOrDb = db) => {
    try {
        const [playerRows] = await connOrDb.query(
            'SELECT stamina, stamina_last_updated, player_level FROM players WHERE player_id = ?',
            [playerId]
        );
        if (playerRows.length === 0) return;

        const player = playerRows[0];
        const maxStamina = Math.min(200, 50 + ((player.player_level - 1) * 5)); // Cap dinamis 50 (+5 per lvl), Max 200
        const HARD_CAP = 999;   // Hard cap absolut di DB

        // Jika stamina sudah melampaui HARD_CAP (karena data lama/testing), kita pangkas
        if (player.stamina > HARD_CAP) {
            await connOrDb.query('UPDATE players SET stamina = ? WHERE player_id = ?', [HARD_CAP, playerId]);
            player.stamina = HARD_CAP;
        }

        if (player.stamina < maxStamina) {
            const lastUpdated = new Date(player.stamina_last_updated).getTime();
            const now = Date.now();
            const elapsedSeconds = Math.floor((now - lastUpdated) / 1000);

            // Regen FULL (langsung mentok cap) setiap 5 menit (300 detik)
            if (elapsedSeconds >= 300) {
                const regenStam = maxStamina - player.stamina;
                const newStamina = maxStamina;
                
                await connOrDb.query(
                    `UPDATE players 
                     SET stamina = ?, 
                         stamina_last_updated = CURRENT_TIMESTAMP 
                     WHERE player_id = ?`,
                    [newStamina, playerId]
                );
                console.log(`[staminaService] Refilled +${regenStam} stamina to reach Max Cap for player ID: ${playerId}. New Stamina: ${newStamina}`);
            }
        }
    } catch (err) {
        console.error('[staminaService.checkAndRegenStamina] Error:', err);
    }
};
