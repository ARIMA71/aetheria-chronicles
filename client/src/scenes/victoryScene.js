import Phaser from 'phaser';

const W = 450, H = 800, CX = 225, CY = 400;

export default class VictoryScene extends Phaser.Scene {
    constructor() {
        super('VictoryScene');
    }

    init(data) {
        this.questId = data.questId || 5;
        this.playerId = data.playerId || 1;
        this.potionsUsed = data.potionsUsed || 0;
    }

    create() {
        // Dim the background battle scene
        const overlay = this.add.rectangle(CX, CY, W, H, 0x000000, 0.75).setInteractive();
        overlay.on('pointerdown', (pointer, x, y, event) => {
            event.stopPropagation();
        });

        // Main Panel background
        const panel = this.add.rectangle(CX, CY, 380, 520, 0x0a0f1d, 0.95);
        panel.setStrokeStyle(3, 0xf1c40f);

        // Title text
        this.add.text(CX, CY - 210, "QUEST CLEARED", {
            fontSize: "26px",
            color: "#f1c40f",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif"
        }).setOrigin(0.5);

        // Decorative sub-line
        this.add.text(CX, CY - 180, "★ VICTORY ★", {
            fontSize: "12px",
            color: "#e6c229",
            fontStyle: "bold",
            letterSpacing: 4
        }).setOrigin(0.5);

        // Divider
        const divider = this.add.graphics();
        divider.lineStyle(1, 0x3a4f66, 1);
        divider.lineBetween(CX - 150, CY - 155, CX + 150, CY - 155);

        // Loading message
        const loadingText = this.add.text(CX, CY - 40, "Menghitung hasil...", {
            fontSize: "16px",
            color: "#8899aa",
            fontStyle: "italic"
        }).setOrigin(0.5);

        // Spin animation placeholder using graphics
        const spinCircle = this.add.circle(CX, CY + 20, 20, 0x1f4068, 0);
        spinCircle.setStrokeStyle(3, 0xf1c40f);
        this.tweens.add({
            targets: spinCircle,
            angle: 360,
            duration: 1200,
            repeat: -1
        });

        // Trigger POST /api/battle/result
        fetch("http://localhost:3000/api/battle/result", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                playerId: this.playerId,
                questId: this.questId,
                potionsUsed: this.potionsUsed
            })
        })
        .then(r => r.json())
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
            color: "#8899aa",
            fontStyle: "bold",
            letterSpacing: 2
        }).setOrigin(0.5);

        if (rewards.length === 0) {
            this.add.text(CX, CY - 40, "No rewards dropped.", {
                fontSize: "14px",
                color: "#667788",
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
            if (yPos > CY + 140) return; // Prevent overflowing outside panel

            // Draw a subtle background for each item row
            const rowBg = this.add.rectangle(CX, yPos, 330, 44, 0x131a2e, 0.6);
            rowBg.setStrokeStyle(1, 0x1f2d44);

            let typeColor = "#a8e6cf"; // Greenish for Material
            let namePrefix = "";

            if (item.reward_type === 'Currency') {
                typeColor = "#ffd54f"; // Yellow for Gold
                namePrefix = "🪙 ";
            } else if (item.reward_type === 'Weapon') {
                typeColor = "#64b5f6"; // Blue for Weapon
                namePrefix = `⚔️ [${item.rarity || 'R'}] `;
            } else if (item.reward_type === 'Character') {
                typeColor = "#ba68c8"; // Purple for Character
                namePrefix = `👤 [${item.rarity || 'R'}] `;
            }

            // Item Name
            const nameText = this.add.text(CX - 150, yPos - 8, namePrefix + item.name, {
                fontSize: "13px",
                color: typeColor,
                fontStyle: "bold"
            }).setOrigin(0, 0.5);

            // Sub text or description (e.g. element / unlock status)
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
                color: "#8899aa"
            }).setOrigin(0, 0.5);

            // Quantity
            this.add.text(CX + 150, yPos, `x${item.quantity}`, {
                fontSize: "14px",
                color: "#ffffff",
                fontStyle: "bold"
            }).setOrigin(1, 0.5);
        });

        this.showReturnButton();
    }

    showError(msg) {
        this.add.text(CX, CY - 20, "ERROR OCCURRED", {
            fontSize: "16px",
            color: "#e74c3c",
            fontStyle: "bold"
        }).setOrigin(0.5);

        this.add.text(CX, CY + 20, msg, {
            fontSize: "12px",
            color: "#ff8a80",
            align: "center",
            wordWrap: { width: 320 }
        }).setOrigin(0.5);

        this.showReturnButton();
    }

    showReturnButton() {
        const btnY = CY + 190;

        // Button background
        const btn = this.add.rectangle(CX, btnY, 240, 44, 0x1f4068).setInteractive();
        btn.setStrokeStyle(1.5, 0x3282b8);

        // Button label
        const btnText = this.add.text(CX, btnY, "RETURN TO MENU", {
            fontSize: "14px",
            color: "#ffffff",
            fontStyle: "bold",
            letterSpacing: 1
        }).setOrigin(0.5);

        // Hover events
        btn.on('pointerover', () => {
            btn.setFillStyle(0x3282b8);
        });
        btn.on('pointerout', () => {
            btn.setFillStyle(0x1f4068);
        });

        // Click event to return to menu/restart scene
        btn.on('pointerdown', () => {
            this.scene.stop('BattleScene');
            this.scene.stop('VictoryScene');
            this.scene.start('BattleScene');
        });
    }
}
