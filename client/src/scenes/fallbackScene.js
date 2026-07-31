import Phaser from 'phaser';
import { THEME } from '../main.js';

const W = 480, H = 800, CX = 240;

export default class FallbackScene extends Phaser.Scene {
    constructor() {
        super('FallbackScene');
    }

    init(data) {
        this.errorMessage = data.message || "Oops! Ada kesalahan kecil pada sistem, silakan coba lagi.";
        this.previousScene = data.previousScene || 'MainMenuScene';
    }

    create() {
        // 1. Background Gelap
        this.add.rectangle(CX, H / 2, W, H, THEME.BG);

        // 2. Container Panel
        const panelW = 320;
        const panelH = 200;
        const panel = this.add.rectangle(CX, H / 2, panelW, panelH, THEME.PANEL, 0.9);
        panel.setStrokeStyle(2, THEME.DANGER); // Garis merah untuk indikasi error, tapi halus

        // 3. Ikon / Judul
        this.add.text(CX, H / 2 - 60, "⚠️ PERHATIAN", {
            fontSize: '16px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: '#FFD700'
        }).setOrigin(0.5);

        // 4. Pesan Error (Teks Penenang)
        this.add.text(CX, H / 2 - 10, this.errorMessage, {
            fontSize: '12px',
            fontFamily: 'Outfit',
            color: THEME.TEXT_PRIMARY,
            align: 'center',
            wordWrap: { width: panelW - 40 }
        }).setOrigin(0.5);

        // 5. Tombol "KEMBALI" (Kembali ke Scene sebelumnya)
        this._createButton(CX - 70, H / 2 + 60, 120, 35, 'KEMBALI', () => {
            this.scene.start('LoadingScene', { targetScene: this.previousScene });
        }, THEME.PANEL, THEME.BORDER);

        // 6. Tombol "REFRESH" (Reload Browser)
        this._createButton(CX + 70, H / 2 + 60, 120, 35, 'REFRESH', () => {
            window.location.reload();
        }, 0x7f1d1d, THEME.DANGER);
    }

    _createButton(x, y, w, h, label, onClick, bgColor, borderColor) {
        const btn = this.add.rectangle(x, y, w, h, bgColor);
        btn.setStrokeStyle(1, borderColor);
        btn.setInteractive({ useHandCursor: true });

        const text = this.add.text(x, y, label, {
            fontSize: '12px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: THEME.TEXT_PRIMARY
        }).setOrigin(0.5);

        btn.on('pointerover', () => btn.setFillStyle(0x334155));
        btn.on('pointerout', () => btn.setFillStyle(bgColor));
        btn.on('pointerdown', onClick);
    }
}
