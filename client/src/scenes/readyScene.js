import Phaser from 'phaser';
import { THEME } from '../main.js';

export default class ReadyScene extends Phaser.Scene {
    constructor() {
        super('ReadyScene');
    }

    init(data) {
        this.battleData = data;
    }

    create() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const CX = W / 2;
        const CY = H / 2;

        // Background
        this.add.rectangle(0, 0, W, H, THEME.BG).setOrigin(0);

        // Decorative Lines
        const topBg = this.add.rectangle(CX, CY, W, 80, THEME.PANEL).setAlpha(0);
        this.tweens.add({
            targets: topBg,
            alpha: 1,
            duration: 300,
            ease: 'Power2'
        });

        // "READY" Text
        const readyText = this.add.text(CX, CY, "READY", {
            fontSize: "42px",
            fontStyle: "bold",
            fontFamily: "Outfit",
            color: THEME.TEXT_PRIMARY,
            letterSpacing: 8
        }).setOrigin(0.5).setAlpha(0).setScale(0.5);

        // Tween for READY text (zoom in & fade)
        this.tweens.add({
            targets: readyText,
            scale: 1,
            alpha: 1,
            duration: 400,
            ease: 'Back.out',
            onComplete: () => {
                // Wait briefly, then move to BattleScene
                this.time.delayedCall(800, () => {
                    // Fade out
                    this.tweens.add({
                        targets: [readyText, topBg],
                        alpha: 0,
                        duration: 300,
                        onComplete: () => {
                            this.scene.start('BattleScene', this.battleData);
                        }
                    });
                });
            }
        });
    }
}
