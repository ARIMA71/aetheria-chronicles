import Phaser from 'phaser';
import AuthScene from './scenes/authScene.js';
import MainMenuScene from './scenes/mainMenuScene.js';
import BattleScene from './scenes/battleScene.js';
import VictoryScene from './scenes/victoryScene.js';
import DefeatScene from './scenes/defeatScene.js';
import FallbackScene from './scenes/fallbackScene.js';
import QuestScene from './scenes/questScene.js';
import PartyScene from './scenes/partyScene.js';
import LoadingScene from './scenes/loadingScene.js';
import ReadyScene from './scenes/readyScene.js';
import InventoryScene from './scenes/inventoryScene.js';
import CharacterDetailScene from './scenes/characterDetailScene.js';
import WeaponDetailScene from './scenes/weaponDetailScene.js';
import GachaScene from './scenes/gachaScene.js';
import { initIdleManager } from './utils/auth.js';

class GlobalClickSoundPlugin extends Phaser.Plugins.ScenePlugin {
    boot() {
        this.systems.events.on('create', this.onCreate, this);
    }
    onCreate() {
        this.scene.input.on('gameobjectdown', (pointer, gameObject) => {
            // Abaikan jika gameObject diset disableClickSound, atau overlay / panel besar
            if (gameObject.disableClickSound) return;
            if (gameObject.width >= 400 || gameObject.height >= 400) return;

            const isSfxOn = localStorage.getItem('sfx_on') !== 'false';
            if (!isSfxOn) return;

            // Coba mainkan SFX
            let sfx = this.scene.sound.get('sfx_select');
            if (!sfx && this.scene.cache.audio.exists('sfx_select')) {
                sfx = this.scene.sound.add('sfx_select');
                sfx.addMarker({ name: 'click', start: 0, duration: 1.0 });
            }
            if (sfx) sfx.play('click');
        });
    }
}

// =========================================================
// Aetherial Cyber-Dark Theme — Centralized Color Config
// Semua scene merujuk ke objek ini agar mudah di-tweak.
// =========================================================
export const THEME = {
    // Base
    BG: 0x0F172A,   // Deep Slate — background utama
    PANEL: 0x1E293B,   // Dark Slate — container / panel
    PANEL_ALPHA: 0.8,        // Transparansi default panel

    // Borders / Lines
    BORDER: 0x334155,   // Slate Grey — garis tepi
    DIVIDER: 0x334155,   // Divider lines

    // Accents
    HEALTH: 0x458B74,   // Muted Sea Green
    DAMAGE: 0xCD5C5C,   // Indian Red
    DANGER: 0xB22222,   // Firebrick (HP kritis, enemy)
    GOLD: 0xD4A017,   // Muted Gold — SA bar, highlight
    AETHER: 0x6366F1,   // Indigo — Aether gauge
    INFO: 0x64748B,   // Slate 500 — label sekunder

    // Text
    TEXT_PRIMARY: '#F8FAFC',  // Off-White
    TEXT_SECONDARY: '#94A3B8',  // Cool Grey
    TEXT_MUTED: '#64748B',  // Slate 500

    // Element Colors (dipertahankan untuk gameplay)
    ELEM_FIRE: 0xCD5C5C,
    ELEM_WIND: 0x458B74,
    ELEM_EARTH: 0xD4A017,
};

const config = {
    type: Phaser.AUTO,
    parent: 'game-content',
    width: 480,
    height: 830,
    backgroundColor: '#000000',
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    roundPixels: true,
    dom: {
        createContainer: true
    },
    input: {
        mouse: {
            preventDefaultWheel: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
        width: 480,
        height: 830
    },
    plugins: {
        scene: [
            { key: 'GlobalClickSoundPlugin', plugin: GlobalClickSoundPlugin, mapping: 'clickSoundPlugin' }
        ]
    },
    scene: [AuthScene, MainMenuScene, QuestScene, PartyScene, BattleScene, VictoryScene, DefeatScene, FallbackScene, LoadingScene, ReadyScene, InventoryScene, CharacterDetailScene, WeaponDetailScene, GachaScene]
};

const game = new Phaser.Game(config);

// ── Portability Benchmark: Standalone High-Visibility FPS Counter ──
(function setupFPSBenchmark() {
    let fpsCounter = document.getElementById('fps-benchmark-counter');
    if (!fpsCounter) {
        fpsCounter = document.createElement('div');
        fpsCounter.id = 'fps-benchmark-counter';
        fpsCounter.style.cssText = `
            position: fixed;
            top: 15px;
            right: 15px;
            background: rgba(15, 23, 42, 0.92);
            color: #22c55e;
            border: 2px solid #22c55e;
            padding: 8px 16px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 15px;
            font-weight: bold;
            border-radius: 8px;
            z-index: 9999999;
            box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
            pointer-events: none;
            user-select: none;
            letter-spacing: 1px;
        `;
        document.body.appendChild(fpsCounter);
    }

    let frameCount = 0;
    let lastTime = performance.now();

    game.events.on('step', () => {
        frameCount++;
        const now = performance.now();
        const delta = now - lastTime;

        if (delta >= 500) { // Update 2x per second
            const currentFps = Math.round((frameCount * 1000) / delta);
            frameCount = 0;
            lastTime = now;

            window.__currentFps = currentFps;

            if (fpsCounter) {
                const color = currentFps >= 50 ? '#22c55e' : (currentFps >= 30 ? '#eab308' : '#ef4444');
                fpsCounter.style.color = color;
                fpsCounter.style.borderColor = color;
                fpsCounter.style.boxShadow = `0 4px 15px ${color}66`;
                const pingText = window.__lastApiLatency ? ` | 📡 API: ${window.__lastApiLatency}` : '';
                fpsCounter.innerText = `⚡ ${currentFps} FPS${pingText}`;
            }
        }
    });
})();

// ── Global Benchmark History Logger (Accessible via DevTools Console) ──
window.__benchmarkHistory = [];
window.logBenchmark = function (endpoint, status, durationMs) {
    const timeStr = new Date().toLocaleTimeString();
    const fps = window.__currentFps || 60;
    const entry = {
        Time: timeStr,
        Endpoint: endpoint,
        Status: status,
        Latency: `${durationMs} ms`,
        FPS: `${fps} FPS`
    };
    window.__benchmarkHistory.push(entry);

    console.groupCollapsed(`📊 [BENCHMARK] ${endpoint} — ${durationMs} ms (${status}) | ${fps} FPS`);
    console.log(`⏱️ Timestamp : ${timeStr}`);
    console.log(`🌐 Endpoint  : ${endpoint}`);
    console.log(`🟢 Status    : ${status}`);
    console.log(`📡 Latency   : ${durationMs} ms`);
    console.log(`⚡ Frame Rate: ${fps} FPS`);
    console.groupEnd();
};

// Initialize Global AFK Idle Manager
initIdleManager(game);

// Global DOM Click Listener untuk menangkap klik pada HTML Modals (seperti form Login/Register)
document.addEventListener('click', (e) => {
    // Jika targetnya adalah <button> HTML atau child dari <button>
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        const isSfxOn = localStorage.getItem('sfx_on') !== 'false';
        if (!isSfxOn) return;

        const activeScenes = game.scene.getScenes(true);
        if (activeScenes.length > 0) {
            const scene = activeScenes[0];
            let sfx = scene.sound.get('sfx_select');
            if (!sfx && scene.cache.audio.exists('sfx_select')) {
                sfx = scene.sound.add('sfx_select');
                sfx.addMarker({ name: 'click', start: 0, duration: 1.0 });
            }
            if (sfx) sfx.play('click');
        }
    }
});

// Vite HMR Cleanup (Mencegah canvas ganda saat hot-reload)
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        if (game) {
            game.destroy(true);
        }
    });
}