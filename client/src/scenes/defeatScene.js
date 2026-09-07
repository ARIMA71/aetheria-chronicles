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

    create() {
        if (!checkSession(this)) return;

        this.cameras.main.setBounds(0, 0, W, H);
        this.cameras.main.setScroll(0, 0);

        this.sound.stopAll();

        if (this.sound.get('sfx_defeat') || this.cache.audio.exists('sfx_defeat')) {
            this.sound.play('sfx_defeat', { volume: 0.8 });
        }

        // Clear the active session in DB
        if (this.bsId) {
            BattleApi.surrenderBattle(this.bsId, this.playerId).catch(e => console.error("Failed to surrender battle in DB:", e));
        }

        // Dim the background battle scene
        const sysW = this.scale.width;
        const sysH = this.scale.height;
        const overlay = this.add.rectangle(sysW / 2, sysH / 2, sysW, sysH, 0x000000, 0.75).setInteractive();
        overlay.on('pointerdown', (pointer, x, y, event) => {
            event.stopPropagation();
        });

        // Main Panel background (Deep Red style for defeat/retreat)
        const panel = this.add.rectangle(CX, CY, 380, 520, THEME.PANEL, 0.95);
        panel.setStrokeStyle(1, THEME.DAMAGE);

        // Title text
        const titleText = this.isRetreat ? "RETREATED" : "WIPEOUT";
        this.add.text(CX, CY - 210, titleText, {
            fontSize: "26px",
            color: "#CD5C5C",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif"
        }).setOrigin(0.5);

        // Decorative sub-line
        this.add.text(CX, CY - 180, this.isRetreat ? "★ RETREAT ★" : "★ DEFEAT ★", {
            fontSize: "12px",
            color: "#CD5C5C",
            fontStyle: "bold",
            letterSpacing: 4
        }).setOrigin(0.5);

        // Divider
        const divider = this.add.graphics();
        divider.lineStyle(1, THEME.BORDER, 1);
        divider.lineBetween(CX - 150, CY - 155, CX + 150, CY - 155);

        // Stamina Info Box
        const stamBg = this.add.rectangle(CX, CY - 120, 330, 48, THEME.BG);
        stamBg.setStrokeStyle(1, THEME.BORDER);

        this.add.text(CX, CY - 120, "☠️ Stamina Hangus (Tidak Dikembalikan)", {
            fontSize: "11px",
            color: "#CD5C5C",
            fontStyle: "bold"
        }).setOrigin(0.5);

        // Tips Section Header
        this.add.text(CX, CY - 60, "TIPS UNTUK MENJADI LEBIH KUAT", {
            fontSize: "11px",
            color: THEME.TEXT_SECONDARY,
            fontStyle: "bold",
            letterSpacing: 2
        }).setOrigin(0.5);

        // Upgrade Tips List
        const tips = [
            "Naikkan level senjata Anda menggunakan Weapon Whetstone di menu Inventory!",
            "Tingkatkan level karakter Anda menggunakan Enhance Crystal!",
            "Perhatikan elemen karakter! Gunakan elemen yang unggul atas elemen musuh!",
            "Gunakan skill support (Buff/Heal) untuk bertahan lebih lama!",
            "Gunakan Aether Burst saat gauge terisi penuh untuk memberikan damage besar!"
        ];

        // Layout tips as horizontal cards
        let startY = CY - 20;
        const spacing = 62;

        tips.forEach((tip, index) => {
            const yPos = startY + index * spacing;
            if (yPos > CY + 140) return;

            const rowBg = this.add.rectangle(CX, yPos, 330, 52, THEME.BG, 0.6);
            rowBg.setStrokeStyle(1, THEME.BORDER);

            // Lightbulb emoji for tips
            this.add.text(CX - 150, yPos, "💡", {
                fontSize: "18px"
            }).setOrigin(0, 0.5);

            // Tip description text
            this.add.text(CX - 120, yPos, tip, {
                fontSize: "10px",
                color: THEME.TEXT_PRIMARY,
                wordWrap: { width: 250 },
                lineSpacing: 2
            }).setOrigin(0, 0.5);
        });

        // Add action buttons
        this.showButtons();
    }

    showButtons() {
        const btnY = CY + 175;

        // Button 1: TRY AGAIN
        const btnLeftX = CX - 85;
        const btnLeft = this.add.rectangle(btnLeftX, btnY, 150, 44, THEME.DAMAGE).setInteractive();
        btnLeft.setStrokeStyle(1, THEME.BORDER);

        this.add.text(btnLeftX, btnY, "TRY AGAIN", {
            fontSize: "12px",
            color: THEME.TEXT_PRIMARY,
            fontStyle: "bold",
            letterSpacing: 1
        }).setOrigin(0.5);

        btnLeft.on('pointerover', () => btnLeft.setFillStyle(THEME.DANGER));
        btnLeft.on('pointerout', () => btnLeft.setFillStyle(THEME.DAMAGE));
        btnLeft.on('pointerdown', () => {
            this.scene.stop('BattleScene');
            this.scene.stop('DefeatScene');
            this.sound.stopAll();
            this.scene.start('LoadingScene', { targetScene: 'QuestScene' });
        });

        // Button 2: RETURN TO MENU
        const btnRightX = CX + 85;
        const btnRight = this.add.rectangle(btnRightX, btnY, 150, 44, THEME.PANEL).setInteractive();
        btnRight.setStrokeStyle(1, THEME.BORDER);

        this.add.text(btnRightX, btnY, "MAIN MENU", {
            fontSize: "12px",
            color: THEME.TEXT_PRIMARY,
            fontStyle: "bold",
            letterSpacing: 1
        }).setOrigin(0.5);

        btnRight.on('pointerover', () => btnRight.setFillStyle(0x334155));
        btnRight.on('pointerout', () => btnRight.setFillStyle(THEME.PANEL));
        btnRight.on('pointerdown', () => {
            this.scene.stop('BattleScene');
            this.scene.stop('DefeatScene');
            this.sound.stopAll();
            this.scene.start('LoadingScene', { targetScene: 'MainMenuScene' });
        });
    }
}
