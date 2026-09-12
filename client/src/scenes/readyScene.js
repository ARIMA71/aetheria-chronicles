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
            fontSize: "56px",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif",
            color: "#38bdf8",
            letterSpacing: 8,
            stroke: "#000000",
            strokeThickness: 8,
            shadow: { offsetX: 0, offsetY: 4, color: '#000000', blur: 12, stroke: true, fill: true }
        }).setOrigin(0.5).setDepth(200).setAlpha(0).setScale(2.5);

        if (this.cameras && this.cameras.main) {
            this.cameras.main.shake(200, 0.006);
        }

        // Phase 1: Heavy impact slam from 2.5x to 1.0x
        this.tweens.add({
            targets: readyText,
            scale: 1.0,
            alpha: 1,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Phase 2: Slow expansion creep
                this.tweens.add({
                    targets: readyText,
                    scale: 1.15,
                    duration: 600,
                    ease: 'Sine.easeInOut',
                    onComplete: () => {
                        // Phase 3: Explosive exit zoom and fade out
                        this.tweens.add({
                            targets: readyText,
                            alpha: 0,
                            scale: 1.7,
                            duration: 250,
                            ease: 'Power2.easeIn',
                            onComplete: () => {
                                this.scene.start('BattleScene', this.battleData);
                            }
                        });
                    }
                });
            }
        });
    }
}
