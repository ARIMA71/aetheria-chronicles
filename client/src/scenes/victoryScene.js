import Phaser from 'phaser';
import { THEME } from '../main.js';
import { checkSession } from '../utils/auth.js';
import BattleApi from '../services/BattleApi.js';

const W = 450, H = 800, CX = 225, CY = 400;

export default class VictoryScene extends Phaser.Scene {
    constructor() {
        super('VictoryScene');
    }

    init(data) {
        this.questId = data.questId || 5;
        this.playerId = data.playerId || 1;
        this.potionsUsed = data.potionsUsed || 0;
        this.fullPotionsUsed = data.fullPotionsUsed || 0;
        this.bsId = data.bsId || null;
    }

    create() {
        if (!checkSession(this)) return;

        // Dim the background battle scene
        const overlay = this.add.rectangle(CX, CY, W, H, 0x000000, 0.75).setInteractive();
        overlay.on('pointerdown', (pointer, x, y, event) => {
            event.stopPropagation();
        });

        // Main Panel background
        const panel = this.add.rectangle(CX, CY, 380, 520, THEME.PANEL, 0.95);
        panel.setStrokeStyle(1, THEME.GOLD);

        // Title text
        this.add.text(CX, CY - 210, "QUEST CLEARED", {
            fontSize: "26px",
            color: "#D4A017",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif"
        }).setOrigin(0.5);

        // Decorative sub-line
        this.add.text(CX, CY - 180, "★ VICTORY ★", {
            fontSize: "12px",
            color: "#D4A017",
            fontStyle: "bold",
            letterSpacing: 4
        }).setOrigin(0.5);

        // Divider
        const divider = this.add.graphics();
        divider.lineStyle(1, THEME.BORDER, 1);
        divider.lineBetween(CX - 150, CY - 155, CX + 150, CY - 155);

        // Loading message
        const loadingText = this.add.text(CX, CY - 40, "Menghitung hasil...", {
            fontSize: "16px",
            color: THEME.TEXT_SECONDARY,
            fontStyle: "italic"
        }).setOrigin(0.5);

        // Spin animation placeholder using graphics
        const spinCircle = this.add.circle(CX, CY + 20, 20, THEME.PANEL, 0);
        spinCircle.setStrokeStyle(2, THEME.GOLD);
        this.tweens.add({
            targets: spinCircle,
            angle: 360,
            duration: 1200,
            repeat: -1
        });

        // Trigger POST /api/battle/result
        const payload = {
            bsId: this.bsId,
            playerId: this.playerId,
            questId: this.questId,
            potionsUsed: this.potionsUsed,
            fullPotionsUsed: this.fullPotionsUsed
        };
        
        BattleApi.saveBattleResult(payload)
        .then(res => {
            loadingText.destroy();
            spinCircle.destroy();

            if (res.status === "success") {
                this.showRewards(res.data.obtained_rewards || []);
            } else {
                this.showError(res.message || "Failed to process battle results.");
            }
        })
        .catch(err => {
            loadingText.destroy();
            spinCircle.destroy();
            this.showError("Connection Error: " + err.message);
        });
    }

    showRewards(rewards) {
        // Section Header
        this.add.text(CX, CY - 130, "OBTAINED LOOT", {
            fontSize: "13px",
            color: THEME.TEXT_SECONDARY,
            fontStyle: "bold",
            letterSpacing: 2
        }).setOrigin(0.5);

        if (rewards.length === 0) {
            this.add.text(CX, CY - 40, "No rewards dropped.", {
                fontSize: "14px",
                color: THEME.TEXT_MUTED,
                fontStyle: "italic"
            }).setOrigin(0.5);
            this.showReturnButton();
            return;
        }

        // Layout list of rewards
        let startY = CY - 90;
        const spacing = 52;

        rewards.forEach((item, index) => {
            const yPos = startY + index * spacing;
            if (yPos > CY + 140) return;

            // Draw a subtle background for each item row
            const rowBg = this.add.rectangle(CX, yPos, 330, 44, THEME.BG, 0.6);
            rowBg.setStrokeStyle(1, THEME.BORDER);

            let typeColor = "#458B74"; // Muted Sea Green for Material
            let namePrefix = "";

            if (item.reward_type === 'Currency') {
                typeColor = "#D4A017"; // Muted Gold
                namePrefix = "🪙 ";
            } else if (item.reward_type === 'Weapon') {
                typeColor = "#94A3B8"; // Cool Grey for Weapon
                namePrefix = `⚔️ [${item.rarity || 'R'}] `;
            } else if (item.reward_type === 'Character') {
                typeColor = "#A78BFA"; // Muted Purple for Character
                namePrefix = `👤 [${item.rarity || 'R'}] `;
            }

            // Item Name
            const nameText = this.add.text(CX - 150, yPos - 8, namePrefix + item.name, {
                fontSize: "13px",
                color: typeColor,
                fontStyle: "bold"
            }).setOrigin(0, 0.5);

            // Sub text or description
            let subInfo = "";
            if (item.reward_type === 'Weapon' || item.reward_type === 'Character') {
                subInfo = `Element: ${item.element || 'Any'}`;
                if (item.description) {
                    subInfo += ` | ${item.description}`;
                }
            } else {
                subInfo = item.description || "Material reward";
            }

            this.add.text(CX - 150, yPos + 10, subInfo, {
                fontSize: "9px",
                color: THEME.TEXT_SECONDARY
            }).setOrigin(0, 0.5);

            // Quantity
            this.add.text(CX + 150, yPos, `x${item.quantity}`, {
                fontSize: "14px",
                color: THEME.TEXT_PRIMARY,
                fontStyle: "bold"
            }).setOrigin(1, 0.5);
        });

        this.showReturnButton();
    }

    showError(msg) {
        this.add.text(CX, CY - 20, "ERROR OCCURRED", {
            fontSize: "16px",
            color: "#CD5C5C",
            fontStyle: "bold"
        }).setOrigin(0.5);

        this.add.text(CX, CY + 20, msg, {
            fontSize: "12px",
            color: "#CD5C5C",
            align: "center",
            wordWrap: { width: 320 }
        }).setOrigin(0.5);

        this.showReturnButton();
    }

    showReturnButton() {
        const btnY = CY + 190;

        // Button background
        const btn = this.add.rectangle(CX, btnY, 240, 44, THEME.PANEL).setInteractive();
        btn.setStrokeStyle(1, THEME.BORDER);

        // Button label
        const btnText = this.add.text(CX, btnY, "RETURN TO MENU", {
            fontSize: "14px",
            color: THEME.TEXT_PRIMARY,
            fontStyle: "bold",
            letterSpacing: 1
        }).setOrigin(0.5);

        // Hover events
        btn.on('pointerover', () => {
            btn.setFillStyle(0x334155);
        });
        btn.on('pointerout', () => {
            btn.setFillStyle(THEME.PANEL);
        });

        // Click event to return to menu
        btn.on('pointerdown', () => {
            this.scene.stop('BattleScene');
            this.scene.stop('VictoryScene');
            this.scene.start('LoadingScene', { targetScene: 'QuestScene' });
        });
    }
}
