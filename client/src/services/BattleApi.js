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
    static async initBattle(questId, playerId) {
        try {
            const res = await fetch(`${API_BASE}/init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ questId, playerId })
            });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error("Failed to init battle:", error);
            throw error;
        }
    }

    /**
     * Fetches AI decision for the boss based on the current battle state.
     * @param {number|string} bsId - Battle Session ID
     * @param {object} battleState - Current state snapshot
     * @param {Array} bossSkills - Array of AI behaviors
     * @returns {Promise<object>} JSON response from server
     */
    static async getAiDecision(bsId, battleState, bossSkills) {
        try {
            const res = await fetch(`${API_BASE}/ai-decision`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bsId, battleState, bossSkills })
            });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error("Failed to fetch AI decision:", error);
            throw error; // Will be caught by caller to trigger AI Fallback
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
}
