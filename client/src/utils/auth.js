/**
 * Authentication and Session Utility for Aetheria Chronicles
 */

const API_BASE = 'http://localhost:3000';
const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds

/**
 * Checks the player's active session and updates the inactivity timer.
 * For AuthScene: if a valid session exists, redirects to MainMenuScene.
 * For game scenes: if the session has expired or is invalid, clears it and redirects to AuthScene.
 * 
 * @param {Phaser.Scene} scene - The active Phaser scene
 * @returns {boolean} True if the session is currently valid, false otherwise.
 */
export function checkSession(scene) {
    const token = localStorage.getItem('aetheria_token');
    const playerRaw = localStorage.getItem('aetheria_player');
    const lastActivity = localStorage.getItem('aetheria_last_activity');
    const now = Date.now();

    const isAuthScene = scene.scene.key === 'AuthScene';

    // 1. Check if token or player data is missing
    if (!token || !playerRaw || !lastActivity) {
        if (!isAuthScene) {
            clearSession(scene);
        }
        return false;
    }

    // 2. Check if inactivity limit of 10 minutes is exceeded
    const inactiveDuration = now - parseInt(lastActivity, 10);
    if (inactiveDuration >= INACTIVITY_TIMEOUT) {
        console.warn('Session expired due to inactivity.');
        clearSession(scene);
        return false;
    }

    // 3. Update the activity timer for this scene transition
    localStorage.setItem('aetheria_last_activity', now.toString());

    // 4. If we are in the login/register screen, skip it and go to the last active scene
    if (isAuthScene) {
        const savedScene = localStorage.getItem('aetheria_current_scene') || 'MainMenuScene';
        let savedData = {};
        try {
            const dataStr = localStorage.getItem('aetheria_scene_data');
            if (dataStr) savedData = JSON.parse(dataStr);
        } catch (e) {}
        
        scene.scene.start(savedScene, savedData);
        return true;
    }

    // 5. In the background, perform an async validation of the JWT signature on the server.
    // This runs asynchronously so it doesn't block transitions, but prevents tampered sessions.
    verifyTokenOnServer(token).then(isValid => {
        if (!isValid) {
            console.error('Session JWT verification failed on server.');
            clearSession(scene);
        }
    });

    return true;
}

/**
 * Force logout the player: clears all authentication tokens/data
 * and redirects to the AuthScene.
 * 
 * @param {Phaser.Scene} scene - The active Phaser scene
 */
export function clearSession(scene) {
    localStorage.removeItem('aetheria_token');
    localStorage.removeItem('aetheria_player');
    localStorage.removeItem('aetheria_last_activity');
    
    if (scene && scene.scene.key !== 'AuthScene') {
        // Stop current scene and go back to login/title screen
        scene.scene.start('AuthScene');
    }
}

/**
 * Update the activity timestamp manually (useful during long scenes or pages).
 */
export function updateActivity() {
    localStorage.setItem('aetheria_last_activity', Date.now().toString());
}

/**
 * Helper to call the backend token verification endpoint
 */
async function verifyTokenOnServer(token) {
    try {
        const res = await fetch(`${API_BASE}/api/auth/verify`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!res.ok) {
            return false;
        }

        const data = await res.json();
        return data.status === 'success';
    } catch (err) {
        // If connection fails, assume valid for offline fallback/resilience
        console.error('Failed to contact auth server for verification:', err);
        return true;
    }
}
/**
 * Simpan scene aktif saat ini beserta datanya ke localStorage.
 * Ini digunakan agar saat page refresh, player kembali ke state terakhirnya.
 */
export function saveCurrentScene(sceneKey, data = {}) {
    localStorage.setItem('aetheria_current_scene', sceneKey);
    localStorage.setItem('aetheria_scene_data', JSON.stringify(data));
}
