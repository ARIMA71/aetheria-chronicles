/**
 * Authentication and Session Utility for Aetheria Chronicles
 */

import { stopGlobalBGM } from './audioManager.js';

const API_BASE = 'http://localhost:3000';
const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
const AUTO_REFRESH_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

let idleTimer = null;
let afkRefreshTimer = null;

export function initIdleManager(gameInstance) {
    function resetTimers() {
        // If the AFK overlay is already showing, don't reset unless they refresh
        if (document.getElementById('afk-overlay')) return;

        updateActivity();
        
        if (idleTimer) clearTimeout(idleTimer);
        
        // Disable AFK timeout if the player hasn't logged in (e.g. AuthScene)
        if (!localStorage.getItem('aetheria_token')) return;
        
        idleTimer = setTimeout(() => {
            showAfkOverlay(gameInstance);
        }, INACTIVITY_TIMEOUT);
    }

    // Listen for any interaction on the window to reset the timer
    window.addEventListener('pointerdown', resetTimers);
    window.addEventListener('keydown', resetTimers);
    window.addEventListener('touchstart', resetTimers);
    
    // Start the timer initially
    resetTimers();
}

function showAfkOverlay(gameInstance) {
    // 1. Suspend the Phaser game loop to save resources
    if (gameInstance && gameInstance.loop) {
        gameInstance.loop.sleep();
        // Also mute all audio
        if (gameInstance.sound) gameInstance.sound.mute = true;
    }

    // 2. Clear volatile session data so reload guarantees return to AuthScene
    localStorage.removeItem('aetheria_token');
    localStorage.removeItem('aetheria_player');
    localStorage.removeItem('aetheria_last_activity');

    // 3. Create the Blocking HTML Overlay
    const overlay = document.createElement('div');
    overlay.id = 'afk-overlay';
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.95)', // Deep Slate theme color
        zIndex: '99999',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#ffffff',
        fontFamily: "'Outfit', sans-serif"
    });

    const title = document.createElement('h1');
    title.innerText = 'SESSION TIMEOUT';
    title.style.color = '#ef4444';
    title.style.marginBottom = '10px';
    title.style.letterSpacing = '2px';

    const desc = document.createElement('p');
    desc.innerText = 'Anda telah AFK terlalu lama. Aktivitas dihentikan.';
    desc.style.marginBottom = '30px';
    desc.style.fontSize = '18px';
    desc.style.color = '#94a3b8';

    const btn = document.createElement('button');
    btn.innerText = 'REFRESH BROWSER';
    Object.assign(btn.style, {
        padding: '12px 24px',
        fontSize: '16px',
        fontWeight: 'bold',
        backgroundColor: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        transition: 'background 0.2s'
    });
    btn.onmouseover = () => btn.style.backgroundColor = '#2563eb';
    btn.onmouseout = () => btn.style.backgroundColor = '#3b82f6';
    btn.onclick = () => window.location.reload();

    overlay.appendChild(title);
    overlay.appendChild(desc);
    overlay.appendChild(btn);
    document.body.appendChild(overlay);

    // 4. Start auto-refresh timer (15 minutes after AFK alert shows)
    afkRefreshTimer = setTimeout(() => {
        window.location.reload();
    }, AUTO_REFRESH_TIMEOUT);
}

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
        let savedScene = localStorage.getItem('aetheria_current_scene') || 'MainMenuScene';
        let savedData = {};
        
        // Never jump straight to BattleScene from local storage. The local data is stale.
        // Go to MainMenuScene instead, which will handle proper auto-resume via server.
        if (savedScene === 'BattleScene') {
            savedScene = 'MainMenuScene';
        } else {
            try {
                const dataStr = localStorage.getItem('aetheria_scene_data');
                if (dataStr) savedData = JSON.parse(dataStr);
            } catch (e) {}
        }
        
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
        stopGlobalBGM(scene);
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

export function getPlayerId() {
    const raw = localStorage.getItem('aetheria_player');
    if (!raw) return null;
    try {
        const player = JSON.parse(raw);
        return player.player_id;
    } catch (e) {
        return null;
    }
}

export function getPlayerUsername() {
    const raw = localStorage.getItem('aetheria_player');
    if (!raw) return 'Main Character';
    try {
        const player = JSON.parse(raw);
        return player.username || 'Main Character';
    } catch (e) {
        return 'Main Character';
    }
}


