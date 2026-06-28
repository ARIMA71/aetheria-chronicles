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
            this.MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
            
            // Run Garbage Collector every 30 minutes
            this.gcInterval = setInterval(() => this.runGarbageCollection(), 30 * 60 * 1000);
            
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
     * Routine to clean up abandoned sessions to prevent memory leaks.
     */
    runGarbageCollection() {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [bsId, session] of this.store.entries()) {
            if (now - session.lastAccessed > this.MAX_AGE_MS) {
                // Sesi sudah kadaluarsa (lebih dari 1 jam tidak ada aktivitas)
                this.store.delete(bsId);
                cleanedCount++;
                
                // Note: For Skripsi completeness, you might want to call a DB query here 
                // to set the status of this bsId to 'ABANDONED' in MySQL, but for now 
                // removing it from RAM is sufficient to prevent leaks.
                console.log(`[BattleMemoryStore GC] Cleared abandoned session: ${bsId}`);
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`[BattleMemoryStore GC] Cleaned ${cleanedCount} sessions. Current Map Size: ${this.store.size}`);
        }
    }
}

// Export as a single instance (Singleton Pattern)
const instance = new BattleMemoryStore();
Object.freeze(instance);
module.exports = instance;
