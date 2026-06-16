import Phaser from 'phaser';
import AuthScene from './scenes/authScene.js';
import MainMenuScene from './scenes/mainMenuScene.js';
import BattleScene from './scenes/battleScene.js';
import VictoryScene from './scenes/victoryScene.js';
import DefeatScene from './scenes/defeatScene.js';

// =========================================================
// Aetherial Cyber-Dark Theme — Centralized Color Config
// Semua scene merujuk ke objek ini agar mudah di-tweak.
// =========================================================
export const THEME = {
    // Base
    BG:             0x0F172A,   // Deep Slate — background utama
    PANEL:          0x1E293B,   // Dark Slate — container / panel
    PANEL_ALPHA:    0.8,        // Transparansi default panel

    // Borders / Lines
    BORDER:         0x334155,   // Slate Grey — garis tepi
    DIVIDER:        0x334155,   // Divider lines

    // Accents
    HEALTH:         0x458B74,   // Muted Sea Green
    DAMAGE:         0xCD5C5C,   // Indian Red
    DANGER:         0xB22222,   // Firebrick (HP kritis, enemy)
    GOLD:           0xD4A017,   // Muted Gold — SA bar, highlight
    AETHER:         0x6366F1,   // Indigo — Aether gauge
    INFO:           0x64748B,   // Slate 500 — label sekunder

    // Text
    TEXT_PRIMARY:   '#F8FAFC',  // Off-White
    TEXT_SECONDARY: '#94A3B8',  // Cool Grey
    TEXT_MUTED:     '#64748B',  // Slate 500

    // Element Colors (dipertahankan untuk gameplay)
    ELEM_FIRE:      0xCD5C5C,
    ELEM_WIND:      0x458B74,
    ELEM_EARTH:     0xD4A017,
};

const config = {
    type: Phaser.AUTO,
    parent: 'game-wrapper',
    width: 450,
    height: 800,
    backgroundColor: '#0F172A',
    dom: {
        createContainer: true
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 450,
        height: 800
    },
    scene: [AuthScene, MainMenuScene, BattleScene, VictoryScene, DefeatScene]
};

new Phaser.Game(config);