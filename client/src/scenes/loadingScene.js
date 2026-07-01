import Phaser from 'phaser';
import { THEME } from '../main.js';

export default class LoadingScene extends Phaser.Scene {
    constructor() {
        super('LoadingScene');
    }

    init(data) {
        this.targetScene = data.targetScene || 'MainMenuScene';
        this.targetData = data.targetData || {};
        this.minLoadTimeMs = data.minLoadTimeMs || 800;
    }

    create() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const CX = W / 2;
        const CY = H / 2;

        // Background
        this.add.rectangle(0, 0, W, H, THEME.BG).setOrigin(0);

        // Center Title/Logo
        this.add.text(CX, CY - 20, 'AETHERIA', {
            fontSize: '24px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: THEME.TEXT_PRIMARY,
            letterSpacing: 6
        }).setOrigin(0.5);

        this.add.text(CX, CY + 10, 'CHRONICLES', {
            fontSize: '14px',
            fontFamily: 'Outfit',
            color: THEME.AETHER,
            letterSpacing: 4
        }).setOrigin(0.5);

        // Bottom right loading text
        const loadingText = this.add.text(W - 20, H - 20, 'Loading', {
            fontSize: '14px',
            fontStyle: 'italic',
            fontFamily: 'Outfit',
            color: THEME.TEXT_MUTED
        }).setOrigin(1, 1);

        // Dot animation
        this.time.addEvent({
            delay: 400,
            repeat: -1,
            callback: () => {
                let txt = loadingText.text;
                if (txt === 'Loading...') txt = 'Loading';
                else txt += '.';
                loadingText.setText(txt);
            }
        });

        // Delay sebelum pindah ke scene berikutnya
        this.time.delayedCall(this.minLoadTimeMs, () => {
            this.scene.start(this.targetScene, this.targetData);
        });
    }
}
