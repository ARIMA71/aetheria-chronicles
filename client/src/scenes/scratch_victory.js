import Phaser from 'phaser';
import { THEME } from '../main.js';
import { checkSession } from '../utils/auth.js';
import BattleApi from '../services/BattleApi.js';

const W = 480, H = 800, CX = 240, CY = 400;

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

        // Reset camera bounds just in case
        this.cameras.main.setBounds(0, 0, W, H);
        this.cameras.main.setScroll(0, 0);

        // Dim the background battle scene
        // Make it very tall to cover scrolling
        const overlay = this.add.rectangle(CX, CY, W, 3000, 0x000000, 0.75).setInteractive();

        // Main Panel background (height will be adjusted dynamically or just visually omitted since we scroll)
        // Let's use a full screen dark panel
        const bg = this.add.rectangle(CX, CY, W, 3000, THEME.BG, 0.95);

        // Title text
        this.add.text(CX, 50, "QUEST CLEARED", {
            fontSize: "26px",
            color: "#D4A017",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif"
        }).setOrigin(0.5);

        this.add.text(CX, 80, "★ VICTORY ★", {
            fontSize: "12px",
            color: "#D4A017",
            fontStyle: "bold",
            letterSpacing: 4
        }).setOrigin(0.5);

        const divider = this.add.graphics();
        divider.lineStyle(1, THEME.BORDER, 1);
        divider.lineBetween(CX - 150, 105, CX + 150, 105);

        // Loading message
        this.loadingText = this.add.text(CX, 200, "Menghitung hasil...", {
            fontSize: "16px",
            color: THEME.TEXT_SECONDARY,
            fontStyle: "italic"
        }).setOrigin(0.5);

        this.spinCircle = this.add.circle(CX, 240, 20, THEME.PANEL, 0);
        this.spinCircle.setStrokeStyle(2, THEME.GOLD);
        this.tweens.add({
            targets: this.spinCircle,
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
            this.loadingText.destroy();
            this.spinCircle.destroy();

            if (res.status === "success") {
                this.renderVictoryData(res.data);
            } else {
                this.showError(res.message || "Failed to process battle results.");
            }
        })
        .catch(err => {
            this.loadingText.destroy();
            this.spinCircle.destroy();
            this.showError("Connection Error: " + err.message);
        });

        // Setup Drag to Scroll
        let isDragging = false;
        let startY = 0;
        let startCamY = 0;

        this.input.on('pointerdown', (pointer) => {
            isDragging = true;
            startY = pointer.y;
            startCamY = this.cameras.main.scrollY;
        });

        this.input.on('pointermove', (pointer) => {
            if (isDragging) {
                const dy = pointer.y - startY;
                this.cameras.main.scrollY = startCamY - dy;
            }
        });

        this.input.on('pointerup', () => {
            isDragging = false;
        });
    }

    renderVictoryData(data) {
        const expData = data.exp_data || {};
        const rewards = data.obtained_rewards || [];
        
        let cursorY = 140;

        // 1. SEGMENT ATAS (PLAYER RANK)
        const playerObj = JSON.parse(localStorage.getItem('player') || '{}');
        const username = playerObj.username || 'Player';

        // Username (Left)
        this.add.text(40, cursorY, username, {
            fontSize: "14px", color: THEME.TEXT_PRIMARY, fontStyle: "bold"
        }).setOrigin(0, 0.5);

        // Rank (Right)
        const rankText = this.add.text(W - 40, cursorY, `Rank ${expData.player_rank}`, {
            fontSize: "14px", color: THEME.GOLD, fontStyle: "bold"
        }).setOrigin(1, 0.5);

        cursorY += 25;

        // Player Rank Progress Bar (Wide)
        const rankBarW = W - 80;
        const rankBarBg = this.add.rectangle(40, cursorY, rankBarW, 14, 0x334155).setOrigin(0, 0.5);
        const rankBarFill = this.add.rectangle(40, cursorY, 0, 14, 0x10B981).setOrigin(0, 0.5);

        // Rank Animation Logic
        const pTotal = expData.player_total_exp || 0;
        const pBase = expData.player_current_level_base_exp || 0;
        const pNext = expData.player_next_level_exp || 1;
        const pGained = expData.base_exp || 0;
        const pOldTotal = Math.max(0, pTotal - pGained);
        
        this.animateProgressBar(rankBarFill, rankText, rankBarW, pOldTotal, pTotal, pBase, pNext, expData.player_rank, 'Rank');

        cursorY += 50;

        // 2. SEGMENT TENGAH (PARTY EXP)
        this.add.text(CX, cursorY, "PARTY EXPERIENCE", {
            fontSize: "12px", color: THEME.TEXT_SECONDARY, letterSpacing: 2
        }).setOrigin(0.5);
        
        cursorY += 40;

        const party = expData.party_exp_details || [];
        const cW = 58, gap = 15, total = party.length;
        const totalW = (total * cW) + ((total - 1) * gap);
        const startX = (W - totalW) / 2 + (cW / 2);

        party.forEach((char, i) => {
            const px = startX + i * (cW + gap);

            // Portrait Background (same as battleScene)
            const portBg = this.add.rectangle(px, cursorY, 58, 58, THEME.PANEL, 0.7);
            portBg.setStrokeStyle(1, THEME.BORDER);
            
            // Name initals or short name
            const shortName = char.name ? char.name.substring(0, 5) : '?';
            this.add.text(px, cursorY, shortName, { 
                fontSize: "12px", color: THEME.TEXT_SECONDARY 
            }).setOrigin(0.5);

            // Level Text
            const lvlTxt = this.add.text(px, cursorY + 40, `Lv ${char.current_level}`, {
                fontSize: "11px", color: "#FFFFFF", fontStyle: "bold"
            }).setOrigin(0.5);

            // Mini EXP Bar
            const barW = 50;
            const barBg = this.add.rectangle(px, cursorY + 52, barW, 6, 0x334155).setOrigin(0.5);
            const barFill = this.add.rectangle(px - barW/2, cursorY + 52, 0, 6, 0x06B6D4).setOrigin(0, 0.5);

            // Animate Char Bar
            const cTotal = char.total_exp;
            const cBase = char.current_level_base_exp;
            const cNext = char.next_level_exp;
            const cOld = Math.max(0, cTotal - pGained);

            this.animateProgressBar(barFill, lvlTxt, barW, cOld, cTotal, cBase, cNext, char.current_level, 'Lv');
        });

        cursorY += 90;

        // Divider
        const div2 = this.add.graphics();
        div2.lineStyle(1, THEME.BORDER, 1);
        div2.lineBetween(CX - 150, cursorY, CX + 150, cursorY);
        cursorY += 30;

        // 3. SEGMENT BAWAH (LOOT GRID)
        this.add.text(CX, cursorY, "OBTAINED LOOT", {
            fontSize: "12px", color: THEME.TEXT_SECONDARY, letterSpacing: 2
        }).setOrigin(0.5);
        cursorY += 30;

        if (rewards.length === 0) {
            this.add.text(CX, cursorY + 20, "No rewards dropped.", {
                fontSize: "14px", color: THEME.TEXT_MUTED, fontStyle: "italic"
            }).setOrigin(0.5);
            cursorY += 60;
        } else {
            // Grid config: 4 columns
            const cols = 4;
            const boxSize = 65;
            const padding = 15;
            const gridW = (cols * boxSize) + ((cols - 1) * padding);
            const gridStartX = (W - gridW) / 2 + (boxSize / 2);

            rewards.forEach((item, index) => {
                const col = index % cols;
                const row = Math.floor(index / cols);
                
                const ix = gridStartX + col * (boxSize + padding);
                const iy = cursorY + row * (boxSize + padding) + (boxSize / 2);

                const itemBg = this.add.rectangle(ix, iy, boxSize, boxSize, THEME.PANEL, 0.8);
                
                let borderColor = THEME.BORDER;
                if (item.reward_type === 'Currency') borderColor = 0xD4A017;
                else if (item.reward_type === 'Weapon') borderColor = 0x94A3B8;
                else if (item.reward_type === 'Character') borderColor = 0xA78BFA;

                itemBg.setStrokeStyle(1, borderColor);

                // Placeholder icon text
                let iconTxt = "📦";
                if (item.reward_type === 'Currency') iconTxt = "🪙";
                else if (item.reward_type === 'Weapon') iconTxt = "⚔️";
                else if (item.reward_type === 'Character') iconTxt = "👤";

                this.add.text(ix, iy - 10, iconTxt, { fontSize: "20px" }).setOrigin(0.5);

                // Quantity
                this.add.text(ix, iy + 15, `x${item.quantity}`, {
                    fontSize: "12px", color: "#fff", fontStyle: "bold"
                }).setOrigin(0.5);
            });

            const rows = Math.ceil(rewards.length / cols);
            cursorY += rows * (boxSize + padding) + 20;
        }

        cursorY += 20;

        // CONTINUE BUTTON
        const btn = this.add.rectangle(CX, cursorY, 240, 44, THEME.PANEL).setInteractive();
        btn.setStrokeStyle(1, THEME.BORDER);
        this.add.text(CX, cursorY, "CONTINUE", {
            fontSize: "14px", color: THEME.TEXT_PRIMARY, fontStyle: "bold", letterSpacing: 1
        }).setOrigin(0.5);

        btn.on('pointerover', () => btn.setFillStyle(0x334155));
        btn.on('pointerout', () => btn.setFillStyle(THEME.PANEL));
        btn.on('pointerdown', (pointer, x, y, event) => {
            event.stopPropagation(); // Prevent drag from firing
            this.scene.stop('BattleScene');
            this.scene.stop('VictoryScene');
            this.scene.start('LoadingScene', { targetScene: 'QuestScene' });
        });

        cursorY += 80; // Add some bottom padding

        // Update Camera Bounds dynamically based on total height
        const totalHeight = Math.max(H, cursorY);
        this.cameras.main.setBounds(0, 0, W, totalHeight);
    }

    animateProgressBar(fillRect, textObj, fullWidth, oldExp, newExp, baseExp, nextExp, finalLevel, labelPrefix) {
        // If they leveled up (oldExp < baseExp), we do a two-stage animation
        if (oldExp < baseExp) {
            // Level Up scenario!
            // First, animate the old level's bar to 100%
            // Since we don't have the previous level's base and next thresholds easily, 
            // we'll just simulate filling to 100%
            const startWidth = 0; // Or estimate
            fillRect.width = startWidth;

            this.tweens.add({
                targets: fillRect,
                width: fullWidth,
                duration: 600,
                ease: 'Quad.easeIn',
                onComplete: () => {
                    // Flash Level Up text
                    const origText = textObj.text;
                    textObj.setText("LEVEL UP!");
                    textObj.setColor("#D4A017"); // Gold
                    
                    this.tweens.add({
                        targets: textObj,
                        scaleX: 1.2, scaleY: 1.2,
                        yoyo: true,
                        duration: 200,
                        onComplete: () => {
                            textObj.setText(`${labelPrefix} ${finalLevel}`);
                            textObj.setColor("#FFFFFF");
                        }
                    });

                    // Reset bar to 0 and fill to new percentage
                    fillRect.width = 0;
                    const newRatio = Math.min(1, Math.max(0, (newExp - baseExp) / (nextExp - baseExp)));
                    this.tweens.add({
                        targets: fillRect,
                        width: fullWidth * newRatio,
                        duration: 800,
                        ease: 'Quad.easeOut'
                    });
                }
            });
        } else {
            // Normal scenario, no level up
            const oldRatio = Math.min(1, Math.max(0, (oldExp - baseExp) / (nextExp - baseExp)));
            const newRatio = Math.min(1, Math.max(0, (newExp - baseExp) / (nextExp - baseExp)));
            
            fillRect.width = fullWidth * oldRatio;
            this.tweens.add({
                targets: fillRect,
                width: fullWidth * newRatio,
                duration: 1000,
                ease: 'Quad.easeOut'
            });
        }
    }

    showError(msg) {
        this.add.text(CX, 200, "ERROR OCCURRED", {
            fontSize: "16px", color: "#CD5C5C", fontStyle: "bold"
        }).setOrigin(0.5);

        this.add.text(CX, 240, msg, {
            fontSize: "12px", color: "#CD5C5C", align: "center", wordWrap: { width: 320 }
        }).setOrigin(0.5);

        const btn = this.add.rectangle(CX, 300, 240, 44, THEME.PANEL).setInteractive();
        btn.setStrokeStyle(1, THEME.BORDER);
        this.add.text(CX, 300, "RETURN TO MENU", {
            fontSize: "14px", color: THEME.TEXT_PRIMARY, fontStyle: "bold", letterSpacing: 1
        }).setOrigin(0.5);

        btn.on('pointerdown', () => {
            this.scene.stop('BattleScene');
            this.scene.stop('VictoryScene');
            this.scene.start('LoadingScene', { targetScene: 'QuestScene' });
        });
    }
}
