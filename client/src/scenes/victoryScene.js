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

        // Victory BGM is already playing from BattleScene via playGlobalBGM('bgm_victory')

        // Solid background since we transition completely from BattleScene
        const sysW = this.scale.width;
        const sysH = this.scale.height;
        this.add.rectangle(sysW / 2, sysH / 2, sysW, 4000, THEME.BG, 1.0).setInteractive();

        // Title text
        this.add.text(CX, 60, "QUEST CLEARED", {
            fontSize: "26px",
            color: "#D4A017",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif"
        }).setOrigin(0.5);

        this.add.text(CX, 90, "★ VICTORY ★", {
            fontSize: "12px",
            color: "#D4A017",
            fontStyle: "bold",
            letterSpacing: 4
        }).setOrigin(0.5);

        const divider = this.add.graphics();
        divider.lineStyle(1, THEME.BORDER, 1);
        divider.lineBetween(CX - 150, 115, CX + 150, 115);

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
        
        let cursorY = 160;

        // 1. SEGMENT ATAS (PLAYER RANK)
        const playerObj = JSON.parse(localStorage.getItem('player') || '{}');
        const username = playerObj.username || 'Player';

        // Username (Left)
        this.add.text(35, cursorY, username, {
            fontSize: "14px", color: THEME.TEXT_PRIMARY, fontStyle: "bold"
        }).setOrigin(0, 0.5);

        // Rank (Right)
        const rankText = this.add.text(W - 35, cursorY, `Rank ${expData.player_rank}`, {
            fontSize: "14px", color: THEME.GOLD, fontStyle: "bold"
        }).setOrigin(1, 0.5);

        cursorY += 25;

        // Player Rank Progress Bar (Wide)
        const rankBarW = W - 70;
        const rankBarBg = this.add.rectangle(35, cursorY, rankBarW, 14, 0x334155).setOrigin(0, 0.5);
        const rankBarFill = this.add.rectangle(35, cursorY, 0, 14, 0x10B981).setOrigin(0, 0.5);

        // Rank Animation Logic
        const pTotal = expData.player_total_exp || 0;
        const pBase = expData.player_current_level_base_exp || 0;
        const pNext = expData.player_next_level_exp || 1;
        const pGained = expData.base_exp || 0;
        const pOldTotal = Math.max(0, pTotal - pGained);
        const isPlayerMax = expData.player_rank >= 100;
        
        this.animateProgressBar(rankBarFill, rankText, rankBarW, pOldTotal, pTotal, pBase, pNext, expData.player_rank, 'Rank', isPlayerMax);

        cursorY += 60;

        // 2. SEGMENT TENGAH (PARTY EXP)
        this.add.text(CX, cursorY, "PARTY EXPERIENCE", {
            fontSize: "12px", color: THEME.TEXT_SECONDARY, letterSpacing: 2
        }).setOrigin(0.5);
        
        cursorY += 50;

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

            // Level Text (bold white)
            const lvlTxt = this.add.text(px, cursorY + 45, `Lv ${char.current_level}`, {
                fontSize: "12px", color: "#FFFFFF", fontStyle: "bold"
            }).setOrigin(0.5);

            // Mini EXP Bar
            const barW = 56;
            const barBg = this.add.rectangle(px, cursorY + 60, barW, 6, 0x334155).setOrigin(0.5);
            const barFill = this.add.rectangle(px - barW/2, cursorY + 60, 0, 6, 0x06B6D4).setOrigin(0, 0.5);

            // Animate Char Bar
            const cTotal = char.total_exp;
            const cBase = char.current_level_base_exp;
            const cNext = char.next_level_exp;
            const cOld = Math.max(0, cTotal - pGained);
            const isCharMax = char.current_level >= char.max_level;
            const wasAlreadyMax = char.old_level >= char.max_level;

            this.animateProgressBar(barFill, lvlTxt, barW, cOld, cTotal, cBase, cNext, char.current_level, 'Lv', isCharMax, wasAlreadyMax);
        });

        cursorY += 100;

        // Divider
        const div2 = this.add.graphics();
        div2.lineStyle(1, THEME.BORDER, 1);
        div2.lineBetween(CX - 150, cursorY, CX + 150, cursorY);
        cursorY += 40;

        // 3. SEGMENT BAWAH (LOOT GRID)
        this.add.text(CX, cursorY, "OBTAINED LOOT", {
            fontSize: "12px", color: THEME.TEXT_SECONDARY, letterSpacing: 2
        }).setOrigin(0.5);
        cursorY += 40;

        if (rewards.length === 0) {
            this.add.text(CX, cursorY + 20, "No rewards dropped.", {
                fontSize: "14px", color: THEME.TEXT_MUTED, fontStyle: "italic"
            }).setOrigin(0.5);
            cursorY += 80;
        } else {
            // Grid config: max 4 columns
            const maxCols = 4;
            const boxSize = 75;
            const padding = 15;

            rewards.forEach((item, index) => {
                const row = Math.floor(index / maxCols);
                const colInRow = index % maxCols;
                
                // Calculate centering specifically for this row
                const itemsInThisRow = Math.min(maxCols, rewards.length - row * maxCols);
                const rowW = (itemsInThisRow * boxSize) + ((itemsInThisRow - 1) * padding);
                const rowStartX = (W - rowW) / 2 + (boxSize / 2);
                
                const ix = rowStartX + colInRow * (boxSize + padding);
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

                this.add.text(ix, iy - 14, iconTxt, { fontSize: "24px" }).setOrigin(0.5);
                
                // Short name
                const itemName = item.name ? item.name.substring(0, 10) : "";
                this.add.text(ix, iy + 8, itemName, { fontSize: "9px", color: "#ccc" }).setOrigin(0.5);

                // Quantity
                this.add.text(ix, iy + 22, `x${item.quantity}`, {
                    fontSize: "12px", color: "#fff", fontStyle: "bold"
                }).setOrigin(0.5);
            });

            const rows = Math.ceil(rewards.length / maxCols);
            cursorY += rows * (boxSize + padding) + 20;
        }

        cursorY += 30;

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
            this.sound.stopAll();
            this.scene.start('LoadingScene', { targetScene: 'QuestScene' });
        });

        cursorY += 80; // Add some bottom padding

        // Update Camera Bounds dynamically based on total height
        const totalHeight = Math.max(H, cursorY);
        this.cameras.main.setBounds(0, 0, W, totalHeight);
        
        // Setup newly unlocked characters and skills queue
        this.unlockQueue = [];
        
        // Priority 1: Characters
        rewards.filter(r => r.is_new_unlock).forEach(char => {
            this.unlockQueue.push({ type: 'character', data: char });
        });
        
        // Priority 2: Skills
        if (expData && expData.party_exp_details) {
            expData.party_exp_details.forEach(detail => {
                if (detail.new_skills && detail.new_skills.length > 0) {
                    detail.new_skills.forEach(skillName => {
                        this.unlockQueue.push({ type: 'skill', data: { charName: detail.name, skillName: skillName } });
                    });
                }
            });
        }

        if (this.unlockQueue.length > 0) {
            this.time.delayedCall(500, () => this.showNextUnlockModal());
        }
    }

    showNextUnlockModal() {
        if (!this.unlockQueue || this.unlockQueue.length === 0) return;

        const item = this.unlockQueue.shift();
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const CX = W / 2;
        const scrollY = this.cameras.main.scrollY;

        // Container for the modal
        const modal = this.add.container(0, scrollY).setDepth(100);

        // Dark overlay
        const overlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.8).setInteractive();
        modal.add(overlay);

        // Modal BG
        const bg = this.add.rectangle(CX, H / 2, 300, 400, THEME.BG, 1);
        bg.setStrokeStyle(2, 0xD4A017); // Gold border
        modal.add(bg);

        if (item.type === 'character') {
            const char = item.data;
            // Title
            modal.add(this.add.text(CX, H / 2 - 160, "NEW CHARACTER UNLOCKED!", {
                fontSize: "16px", color: "#D4A017", fontStyle: "bold", letterSpacing: 1
            }).setOrigin(0.5));

            // Portrait placeholder
            const portBg = this.add.rectangle(CX, H / 2 - 20, 160, 200, 0x1E293B);
            portBg.setStrokeStyle(1, THEME.BORDER);
            modal.add(portBg);

            modal.add(this.add.text(CX, H / 2 - 20, "👤", { fontSize: "64px" }).setOrigin(0.5));

            // Rarity & Element
            modal.add(this.add.text(CX, H / 2 + 100, `${char.rarity || 'SSR'} | ${char.element || 'Any'}`, {
                fontSize: "14px", color: THEME.TEXT_MUTED
            }).setOrigin(0.5));

            // Character Name
            modal.add(this.add.text(CX, H / 2 + 130, char.name || 'Unknown', {
                fontSize: "20px", color: THEME.TEXT_PRIMARY, fontStyle: "bold"
            }).setOrigin(0.5));
        } else if (item.type === 'skill') {
            const skillData = item.data;
            
            // Clean Flat Vector aesthetics
            bg.setSize(300, 220); // Smaller modal for skill
            bg.setStrokeStyle(2, 0x3b82f6); // Blue border for skill unlock

            modal.add(this.add.text(CX, H / 2 - 60, "SKILL UNLOCKED!", {
                fontSize: "18px", color: "#3b82f6", fontStyle: "bold", letterSpacing: 1
            }).setOrigin(0.5));

            modal.add(this.add.text(CX, H / 2 - 10, skillData.charName, {
                fontSize: "14px", color: THEME.TEXT_MUTED
            }).setOrigin(0.5));

            modal.add(this.add.text(CX, H / 2 + 20, skillData.skillName, {
                fontSize: "22px", color: THEME.TEXT_PRIMARY, fontStyle: "bold"
            }).setOrigin(0.5));
            
            // Adjust button position
        }

        // OK Button
        const btnY = item.type === 'character' ? (H / 2 + 175) : (H / 2 + 75);
        const btnBg = this.add.rectangle(CX, btnY, 120, 36, THEME.PANEL).setInteractive({useHandCursor:true});
        btnBg.setStrokeStyle(1, THEME.BORDER);
        modal.add(btnBg);

        const btnTxtColor = item.type === 'character' ? "#D4A017" : "#3b82f6";
        const btnTxt = this.add.text(CX, btnY, "AWESOME!", {
            fontSize: "14px", color: btnTxtColor, fontStyle: "bold"
        }).setOrigin(0.5);
        modal.add(btnTxt);

        // Pop animation
        modal.setScale(0.8);
        modal.setAlpha(0);
        this.tweens.add({
            targets: modal,
            scale: 1,
            alpha: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });

        btnBg.on('pointerdown', () => {
            this.tweens.add({
                targets: modal,
                scale: 0.8,
                alpha: 0,
                duration: 200,
                ease: 'Power2',
                onComplete: () => {
                    modal.destroy();
                    this.showNextUnlockModal(); // Show next if queue has more
                }
            });
        });
    }

    animateProgressBar(fillRect, textObj, fullWidth, oldExp, newExp, baseExp, nextExp, finalLevel, labelPrefix, isMax = false, wasAlreadyMax = false) {
        if (wasAlreadyMax) {
            textObj.setText(`MAX`);
            textObj.setColor("#D4A017");
            fillRect.setFillStyle(0xD4A017);
            fillRect.width = fullWidth;
            return;
        }

        // If they leveled up (oldExp < baseExp), we do a two-stage animation
        if (oldExp < baseExp) {
            // Level Up scenario!
            // First, animate the old level's bar to 100%
            // Since we don't have the previous level's base and next thresholds easily, 
            // we'll just simulate filling to 100%
            const startWidth = 0; // Estimate
            fillRect.width = startWidth;

            this.tweens.add({
                targets: fillRect,
                width: fullWidth,
                duration: 600,
                ease: 'Quad.easeIn',
                onComplete: () => {
                    // Flash Level Up text
                    textObj.setText("LEVEL UP!");
                    textObj.setColor("#D4A017"); // Gold
                    if (this.sound.get('sfx_levelUp') || this.cache.audio.exists('sfx_levelUp')) {
                        this.sound.play('sfx_levelUp', { volume: 0.8 });
                    }
                    
                    this.tweens.add({
                        targets: textObj,
                        scaleX: 1.2, scaleY: 1.2,
                        yoyo: true,
                        duration: 200,
                        onComplete: () => {
                            if (isMax) {
                                textObj.setText(`MAX`);
                                textObj.setColor("#D4A017");
                            } else {
                                textObj.setText(`${labelPrefix} ${finalLevel}`);
                                textObj.setColor("#FFFFFF");
                            }
                        }
                    });

                    // Reset bar to 0 and fill to new percentage
                    fillRect.width = 0;
                    if (isMax) {
                        fillRect.setFillStyle(0xD4A017); // Gold bar
                        this.tweens.add({
                            targets: fillRect,
                            width: fullWidth,
                            duration: 800,
                            ease: 'Quad.easeOut'
                        });
                    } else {
                        const newRatio = Math.min(1, Math.max(0, (newExp - baseExp) / (nextExp - baseExp)));
                        this.tweens.add({
                            targets: fillRect,
                            width: fullWidth * newRatio,
                            duration: 800,
                            ease: 'Quad.easeOut'
                        });
                    }
                }
            });
        } else {
            // Normal scenario, no level up
            if (isMax) {
                textObj.setText(`MAX`);
                textObj.setColor("#D4A017");
                fillRect.setFillStyle(0xD4A017);
                this.tweens.add({
                    targets: fillRect,
                    width: fullWidth,
                    duration: 1000,
                    ease: 'Quad.easeOut'
                });
            } else {
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
            this.sound.stopAll();
            this.scene.start('LoadingScene', { targetScene: 'QuestScene' });
        });
    }
}
