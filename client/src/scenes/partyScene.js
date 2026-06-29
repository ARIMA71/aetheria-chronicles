import Phaser from 'phaser';
import { THEME } from '../main.js';
import { checkSession } from '../utils/auth.js';

const W = 450, H = 800, CX = 225;

export default class PartyScene extends Phaser.Scene {
    constructor() { super('PartyScene'); }

    create() {
        if (!checkSession(this)) return;

        this.add.rectangle(CX, H / 2, W, H, THEME.BG);

        // Top Bar
        this.add.rectangle(CX, 30, W, 60, THEME.PANEL, THEME.PANEL_ALPHA).setStrokeStyle(1, THEME.BORDER);
        this.add.text(CX, 30, 'PARTY MANAGEMENT', { fontSize: '15px', fontStyle: 'bold', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit', letterSpacing: 2 }).setOrigin(0.5);

        // Back button
        const backBtn = this.add.circle(40, 30, 18, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        this.add.text(40, 30, '←', { fontSize: '16px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        backBtn.on('pointerdown', () => this.scene.start('QuestScene'));

        // Placeholder content
        this.add.rectangle(CX, H / 2, W - 40, 500, THEME.PANEL, 0.4).setStrokeStyle(1, THEME.BORDER);
        this.add.text(CX, H / 2 - 30, '[ PARTY MANAGEMENT ]', { fontSize: '14px', color: THEME.TEXT_MUTED, fontFamily: 'Outfit' }).setOrigin(0.5);
        this.add.text(CX, H / 2 + 10, 'Fitur ini sedang dalam pengembangan.\nGunakan Preset Slot di Pre-Battle Modal.', { fontSize: '10px', color: THEME.TEXT_SECONDARY, fontFamily: 'Outfit', align: 'center' }).setOrigin(0.5);
    }
}
