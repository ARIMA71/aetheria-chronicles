/**
 * BattleMemoryStore
 * Singleton in-memory cache to store active battle sessions.
 * 
 * Includes:
 * - Garbage Collection (cleans abandoned sessions > 1 hour)
 * - Hard Limit Protection (max 1000 sessions) to prevent Out-Of-Memory attacks.
 */

class BattleMemoryStore {
    constructor() {
        if (!BattleMemoryStore.instance) {
            this.store = new Map();
            this.MAX_SESSIONS = 1000;
            // GC interval is now orchestrated by BattleService
            BattleMemoryStore.instance = this;
        }
        return BattleMemoryStore.instance;
    }

    /**
     * Set or update a battle session in RAM.
     * @param {string|number} bsId - The Battle Session ID (from MySQL auto-increment).
     * @param {object} state - The complete state of the battle.
     */
    set(bsId, state) {
        // HARD LIMIT CHECK
        if (this.store.size >= this.MAX_SESSIONS && !this.store.has(String(bsId))) {
            // Try to force a GC run to free up space
            this.runGarbageCollection();
            
            // If still full, reject to prevent Node.js Out-Of-Memory crash
            if (this.store.size >= this.MAX_SESSIONS) {
                console.error(`[BattleMemoryStore] CRITICAL: Hard limit reached (${this.MAX_SESSIONS}). Cannot allocate new session!`);
                throw new Error('SERVER_BUSY: The battle server is currently at maximum capacity. Please try again later.');
            }
        }

        this.store.set(String(bsId), {
            ...state,
            lastAccessed: Date.now()
        });
    }

    /**
     * Get a battle session from RAM.
     * @param {string|number} bsId - The Battle Session ID.
     * @returns {object|null} The battle state or null if not found.
     */
    get(bsId) {
        const session = this.store.get(String(bsId));
        if (session) {
            // Update lastAccessed timestamp
            session.lastAccessed = Date.now();
            return session;
        }
        return null;
    }

    /**
     * Delete a battle session (e.g., when battle ends or player escapes).
     * @param {string|number} bsId - The Battle Session ID.
     */
    delete(bsId) {
        this.store.delete(String(bsId));
    }

    /**
     * Dapatkan semua sesi yang sudah melampaui batas waktu inactivity.
     * @param {number} maxAgeMs - Waktu maksimal (dalam ms) sebelum dianggap expired.
     */
    getExpiredSessions(maxAgeMs) {
        const now = Date.now();
        const expiredIds = [];
        for (const [bsId, session] of this.store.entries()) {
            if (now - session.lastAccessed > maxAgeMs) {
                expiredIds.push(bsId);
            }
        }
        return expiredIds;
    }

    /**
     * Dapatkan array dari semua bsId yang saat ini aktif di memory.
     */
    getActiveSessionIds() {
        return Array.from(this.store.keys());
    }
}

// Export as a single instance (Singleton Pattern)
const instance = new BattleMemoryStore();
Object.freeze(instance);
module.exports = instance;
