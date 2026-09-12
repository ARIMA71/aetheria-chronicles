import Phaser from 'phaser';
import { THEME } from '../main.js';
import { checkSession } from '../utils/auth.js';
import BattleApi from '../services/BattleApi.js';

const W = 480, H = 800, CX = 240, CY = 400;

export default class DefeatScene extends Phaser.Scene {
    constructor() {
        super('DefeatScene');
    }

    init(data) {
        this.questId = data.questId || 5;
        this.playerId = data.playerId || 1;
        this.isRetreat = data.isRetreat || false;
        this.bsId = data.bsId || null;
    }

    preload() {
        if (!this.textures.exists('bg_card_x100')) {
            this.load.image('bg_card_x100', 'assets/ui/card/Card X100.png');
        }
        if (!this.textures.exists('bg_card_x12')) {
            this.load.image('bg_card_x12', 'assets/ui/card/Card X12.png');
        }
        if (!this.textures.exists('btn_a_normal')) {
            this.load.image('btn_a_normal', 'assets/ui/button/A/Normal.png');
        }
        if (!this.textures.exists('btn_a_hover')) {
            this.load.image('btn_a_hover', 'assets/ui/button/A/Hover.png');
        }
        if (!this.textures.exists('btn_b_normal')) {
            this.load.image('btn_b_normal', 'assets/ui/button/B/Button Normal 1.png');
        }
        if (!this.textures.exists('btn_b_hover')) {
            this.load.image('btn_b_hover', 'assets/ui/button/B/Button Hover 1.png');
        }
    }

    create() {
        if (!checkSession(this)) return;

        this.cameras.main.setBounds(0, 0, W, H);
        this.cameras.main.setScroll(0, 0);

        // Play defeat BGM
        import('../utils/audioManager.js').then(({ playGlobalBGM, stopGlobalBGM }) => {
            stopGlobalBGM();
            playGlobalBGM(this, 'bgm_defeat');
        });

        // Clear the active session in DB
        if (this.bsId) {
            BattleApi.surrenderBattle(this.bsId, this.playerId).catch(e => console.error("Failed to surrender battle in DB:", e));
        }

        // Dim the background battle scene with darker overlay (transparency 88%)
        const sysW = this.scale.width;
        const sysH = this.scale.height;
        const overlay = this.add.rectangle(sysW / 2, sysH / 2, sysW, sysH, 0x000000, 0).setInteractive();
        overlay.on('pointerdown', (pointer, x, y, event) => {
            event.stopPropagation();
        });

        this.tweens.add({
            targets: overlay,
            fillAlpha: 0.88,
            duration: 350,
            ease: 'Power2'
        });

        // Create Container for Modal Content (starts off-screen at top)
        const modalContainer = this.add.container(0, -650);

        // Main Panel Background (Card X100 with Red Tint for Defeat/Retreat)
        let panel;
        if (this.textures.exists('bg_card_x100')) {
            panel = this.add.image(CX, CY, 'bg_card_x100').setDisplaySize(400, 560);
            panel.setTint(0xef4444);
        } else {
            panel = this.add.rectangle(CX, CY, 400, 560, 0x0d1420, 0.95).setStrokeStyle(1.5, 0xef4444);
        }
        modalContainer.add(panel);

        // Title text
        const titleText = this.isRetreat ? "RETREATED" : "WIPEOUT";
        const titleObj = this.add.text(CX, CY - 215, titleText, {
            fontSize: "26px",
            color: "#ff8a80",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif"
        }).setOrigin(0.5);
        titleObj.setShadow(0, 2, "rgba(0,0,0,0.8)", 4);

        // Decorative sub-line
        const subTitleObj = this.add.text(CX, CY - 186, this.isRetreat ? "★ RETREAT ★" : "★ DEFEAT ★", {
            fontSize: "11px",
            color: "#ff8a80",
            fontStyle: "bold",
            letterSpacing: 4,
            fontFamily: "Outfit, Inter, sans-serif"
        }).setOrigin(0.5);

        // Divider
        const dividerObj = this.add.rectangle(CX, CY - 164, 320, 1, 0xef4444).setAlpha(0.35);

        modalContainer.add([titleObj, subTitleObj, dividerObj]);

        // Stamina Info Box (Card X12 Red Tint)
        let stamBg;
        if (this.textures.exists('bg_card_x12')) {
            stamBg = this.add.image(CX, CY - 128, 'bg_card_x12').setDisplaySize(340, 46);
            stamBg.setTint(0xef4444);
        } else {
            stamBg = this.add.rectangle(CX, CY - 128, 340, 46, 0x2a0d0d).setStrokeStyle(1, 0xef4444);
        }

        const stamTxt = this.add.text(CX, CY - 128, "☠️ Stamina Hangus (Tidak Dikembalikan)", {
            fontSize: "11px",
            color: "#ff8a80",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif"
        }).setOrigin(0.5);

        modalContainer.add([stamBg, stamTxt]);

        // Tips Section Header
        const tipsHeaderObj = this.add.text(CX, CY - 74, "TIPS UNTUK MENJADI LEBIH KUAT", {
            fontSize: "10px",
            color: "#8899aa",
            fontStyle: "bold",
            letterSpacing: 2,
            fontFamily: "Outfit, Inter, sans-serif"
        }).setOrigin(0.5);

        modalContainer.add(tipsHeaderObj);

        // Upgrade Tips List
        const tips = [
            "Naikkan level senjata Anda menggunakan Weapon Whetstone di menu Inventory!",
            "Tingkatkan level karakter Anda menggunakan Enhance Crystal!",
            "Perhatikan elemen karakter! Gunakan elemen yang unggul atas elemen musuh!",
            "Gunakan skill support (Buff/Heal) untuk bertahan lebih lama!",
            "Gunakan Aether Burst saat gauge terisi penuh untuk memberikan damage besar!"
        ];

        // Layout tips as horizontal cards (Card X12 Container)
        let startY = CY - 30;
        const spacing = 58;

        tips.forEach((tip, index) => {
            const yPos = startY + index * spacing;
            if (yPos > CY + 130) return;

            let rowBg;
            if (this.textures.exists('bg_card_x12')) {
                rowBg = this.add.image(CX, yPos, 'bg_card_x12').setDisplaySize(340, 50);
                rowBg.setTint(0x334155);
            } else {
                rowBg = this.add.rectangle(CX, yPos, 340, 50, 0x0f172a, 0.8).setStrokeStyle(1, 0x1e293b);
            }

            // Lightbulb emoji for tips
            const tipIcon = this.add.text(CX - 148, yPos, "💡", {
                fontSize: "16px"
            }).setOrigin(0, 0.5);

            // Tip description text
            const tipTxt = this.add.text(CX - 120, yPos, tip, {
                fontSize: "9.5px",
                color: "#e2e8f0",
                wordWrap: { width: 250 },
                lineSpacing: 2,
                fontFamily: "Outfit, Inter, sans-serif"
            }).setOrigin(0, 0.5);

            modalContainer.add([rowBg, tipIcon, tipTxt]);
        });

        // Add action buttons to modalContainer
        this.showButtons(modalContainer);

        // Slide-in Animation from Top
        this.tweens.add({
            targets: modalContainer,
            y: 0,
            duration: 480,
            ease: 'Back.easeOut',
            easeParams: [0.7]
        });
    }

    showButtons(modalContainer) {
        const btnY = CY + 185;

        // Button 1: TRY AGAIN
        const btnLeftX = CX - 85;
        let btnLeft;
        if (this.textures.exists('btn_a_normal')) {
            btnLeft = this.add.image(btnLeftX, btnY, 'btn_a_normal').setDisplaySize(145, 42).setInteractive({ useHandCursor: true });
            btnLeft.setTint(0xef4444);
        } else {
            btnLeft = this.add.rectangle(btnLeftX, btnY, 145, 42, 0x7f1d1d).setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0xef4444);
        }

        const btnLeftTxt = this.add.text(btnLeftX, btnY, "TRY AGAIN", {
            fontSize: "11px",
            color: "#ffffff",
            fontStyle: "bold",
            letterSpacing: 1,
            fontFamily: "Outfit, Inter, sans-serif"
        }).setOrigin(0.5);

        btnLeft.on('pointerover', () => {
            if (this.textures.exists('btn_a_hover')) btnLeft.setTexture('btn_a_hover');
            btnLeft.setTint(0xff6666);
            btnLeft.setScale(1.03 * (145 / btnLeft.width), 1.03 * (42 / btnLeft.height));
        });
        btnLeft.on('pointerout', () => {
            if (this.textures.exists('btn_a_normal')) btnLeft.setTexture('btn_a_normal');
            btnLeft.setTint(0xef4444);
            btnLeft.setDisplaySize(145, 42);
        });
        btnLeft.on('pointerdown', () => {
            this.scene.stop('BattleScene');
            this.scene.stop('DefeatScene');
            this.sound.stopAll();
            this.scene.start('LoadingScene', { targetScene: 'QuestScene' });
        });

        // Button 2: MAIN MENU
        const btnRightX = CX + 85;
        let btnRight;
        if (this.textures.exists('btn_b_normal')) {
            btnRight = this.add.image(btnRightX, btnY, 'btn_b_normal').setDisplaySize(145, 42).setInteractive({ useHandCursor: true });
            btnRight.setTint(0x38bdf8);
        } else {
            btnRight = this.add.rectangle(btnRightX, btnY, 145, 42, 0x1e293b).setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x38bdf8);
        }

        const btnRightTxt = this.add.text(btnRightX, btnY, "MAIN MENU", {
            fontSize: "11px",
            color: "#ffffff",
            fontStyle: "bold",
            letterSpacing: 1,
            fontFamily: "Outfit, Inter, sans-serif"
        }).setOrigin(0.5);

        btnRight.on('pointerover', () => {
            if (this.textures.exists('btn_b_hover')) btnRight.setTexture('btn_b_hover');
            btnRight.setTint(0x7dd3fc);
            btnRight.setScale(1.03 * (145 / btnRight.width), 1.03 * (42 / btnRight.height));
        });
        btnRight.on('pointerout', () => {
            if (this.textures.exists('btn_b_normal')) btnRight.setTexture('btn_b_normal');
            btnRight.setTint(0x38bdf8);
            btnRight.setDisplaySize(145, 42);
        });
        btnRight.on('pointerdown', () => {
            this.scene.stop('BattleScene');
            this.scene.stop('DefeatScene');
            this.sound.stopAll();
            this.scene.start('LoadingScene', { targetScene: 'MainMenuScene' });
        });

        if (modalContainer) {
            modalContainer.add([btnLeft, btnLeftTxt, btnRight, btnRightTxt]);
        }
    }
}
