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
            'SELECT stamina, stamina_last_updated FROM players WHERE player_id = ?',
            [playerId]
        );
        if (playerRows.length === 0) return;

        const player = playerRows[0];
        const maxStamina = 100; // Default max stamina

        if (player.stamina < maxStamina) {
            const lastUpdated = new Date(player.stamina_last_updated).getTime();
            const now = Date.now();
            const elapsed = Math.floor((now - lastUpdated) / 1000);

            // Refill to max after 5 minutes (300 seconds)
            if (elapsed >= 300) {
                await connOrDb.query(
                    'UPDATE players SET stamina = ?, stamina_last_updated = CURRENT_TIMESTAMP WHERE player_id = ?',
                    [maxStamina, playerId]
                );
                console.log(`[staminaService] Automatically refilled stamina to max (100) for player ID: ${playerId}.`);
            }
        }
    } catch (err) {
        console.error('[staminaService.checkAndRegenStamina] Error:', err);
    }
};
