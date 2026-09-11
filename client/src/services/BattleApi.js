/**
 * BattleApi.js
 * Handles all network requests for the battle scene.
 */

const API_BASE = "http://localhost:3000/api/battle";

export default class BattleApi {
    /**
     * Initializes the battle session on the server.
     * @param {number} questId
     * @param {number} playerId
     * @returns {Promise<object>} JSON response from server
     */
    static async initBattle(questId, playerId, presetSlot = 1) {
        try {
            const res = await fetch(`${API_BASE}/init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ questId, playerId, presetSlot })
            });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error("Failed to init battle:", error);
            throw error;
        }
    }



    /**
     * Saves the final battle result (victory/defeat) to the server.
     * @param {object} payload - The result data
     * @returns {Promise<object>} JSON response from server
     */
    static async saveBattleResult(payload) {
        try {
            const res = await fetch(`${API_BASE}/result`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error("Failed to save battle result:", error);
            throw error;
        }
    }

    /**
     * Cek apakah player punya battle session ACTIVE.
     * @param {number} playerId
     * @returns {Promise<object>} JSON response
     */
    static async checkActiveBattle(playerId) {
        try {
            const res = await fetch(`${API_BASE}/active/${playerId}`);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error("Failed to check active battle:", error);
            return { status: 'error', data: { has_active: false } };
        }
    }



    /**
     * Player menyerah. Sesi diubah ke FAILED. Stamina hangus.
     * @param {number|string} bsId
     * @param {number} playerId
     * @returns {Promise<object>} JSON response
     */
    static async surrenderBattle(bsId, playerId) {
        try {
            const res = await fetch(`${API_BASE}/surrender`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bsId, playerId })
            });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error("Failed to surrender battle:", error);
            throw error;
        }
    }



    /**
     * Executes a batch of player actions.
     * @param {number|string} bsId
     * @param {Array} character_actions - Array of { slot, action_type, skill_id, target_index }
     * @returns {Promise<object>}
     */
    static async processTurnBatch(bsId, character_actions) {
        const t0 = performance.now();
        try {
            const res = await fetch(`${API_BASE}/process-turn`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bsId, character_actions })
            });
            const duration = (performance.now() - t0).toFixed(1);
            window.__lastApiLatency = `${duration}ms`;
            if (typeof window.logBenchmark === 'function') {
                window.logBenchmark('POST /api/battle/process-turn', res.status + (res.ok ? ' OK' : ' FAIL'), duration);
            }
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return await res.json();
        } catch (error) {
            const duration = (performance.now() - t0).toFixed(1);
            window.__lastApiLatency = `${duration}ms (Err)`;
            if (typeof window.logBenchmark === 'function') {
                window.logBenchmark('POST /api/battle/process-turn', 'ERROR', duration);
            }
            throw error;
        }
    }
}
