import Phaser from 'phaser';
import { THEME } from '../main.js';
import { playGlobalBGM } from '../utils/audioManager.js';

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
        this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0);

        if (this.sound.get('sfx_battleReady') || this.cache.audio.exists('sfx_battleReady')) {
            this.sound.play('sfx_battleReady', { volume: 0.8 });
        }

        const bgmKey = this.battleData ? (this.battleData.bgmKey || 'bgm_normalbattle') : 'bgm_normalbattle';
        playGlobalBGM(this, bgmKey);

        // decorative lines removed per user request

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
                        targets: [readyText],
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
