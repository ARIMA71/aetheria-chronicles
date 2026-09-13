import Phaser from 'phaser';
import { THEME } from '../main.js';
import { checkSession, getPlayerUsername } from '../utils/auth.js';
import BattleApi from '../services/BattleApi.js';
import PartyApi from '../services/PartyApi.js';
import { playGlobalBGM } from '../utils/audioManager.js';

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

    preload() {
        if (!this.textures.exists('card_x3')) this.load.image('card_x3', 'assets/ui/card/Card X3.png');
        if (!this.textures.exists('btn_a_normal')) this.load.image('btn_a_normal', 'assets/ui/button/A/Normal.png');
        if (!this.textures.exists('btn_a_hover')) this.load.image('btn_a_hover', 'assets/ui/button/A/Hover.png');
        if (!this.textures.exists('btn_a_active')) this.load.image('btn_a_active', 'assets/ui/button/A/Active.png');
        if (!this.textures.exists('element_fire')) this.load.image('element_fire', 'assets/icons/elements/fire.png');
        if (!this.textures.exists('element_wind')) this.load.image('element_wind', 'assets/icons/elements/wind.png');
        if (!this.textures.exists('element_earth')) this.load.image('element_earth', 'assets/icons/elements/rock.png');
        if (!this.textures.exists('char_sq_8')) this.load.image('char_sq_8', 'assets/portraits/char/dummy-square-f.png');
    }

    create() {
        if (!checkSession(this)) return;

        // Reset camera bounds and position (Full static view)
        this.cameras.main.setBounds(0, 0, W, H);
        this.cameras.main.setScroll(0, 0);

        // Victory BGM looping continuously
        playGlobalBGM(this, 'bgm_victory');

        // Solid background since we transition completely from BattleScene
        const sysW = this.scale.width;
        const sysH = this.scale.height;
        this.add.rectangle(sysW / 2, sysH / 2, sysW, sysH, THEME.BG, 1.0).setInteractive();

        // Title text
        this.add.text(CX, 50, "QUEST CLEARED", {
            fontSize: "24px",
            color: "#D4A017",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif"
        }).setOrigin(0.5);

        this.add.text(CX, 78, "★ VICTORY ★", {
            fontSize: "12px",
            color: "#D4A017",
            fontStyle: "bold",
            letterSpacing: 4
        }).setOrigin(0.5);

        const divider = this.add.graphics();
        divider.lineStyle(1, THEME.BORDER, 1);
        divider.lineBetween(CX - 150, 98, CX + 150, 98);

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

        // Trigger POST /api/battle/result and fetch party data
        const payload = {
            bsId: this.bsId,
            playerId: this.playerId,
            questId: this.questId,
            potionsUsed: this.potionsUsed,
            fullPotionsUsed: this.fullPotionsUsed
        };

        const raw = localStorage.getItem('aetheria_player');
        const playerData = raw ? JSON.parse(raw) : {};
        this.selectedPresetSlot = playerData.selected_preset_slot || 1;

        Promise.all([
            BattleApi.saveBattleResult(payload),
            PartyApi.getPresets(this.playerId),
            PartyApi.getInventory(this.playerId)
        ])
            .then(([res, presetsRes, invRes]) => {
                let assetsToLoad = 0;
                const checkAndLoadTex = (key, path) => {
                    if (!path) return;
                    let fullPath = path;
                    if (!fullPath.endsWith('.png') && !fullPath.endsWith('.jpg')) fullPath += '.png';
                    if (this.textures.exists(key)) {
                        const tex = this.textures.get(key);
                        const src = tex && tex.source && tex.source[0] && tex.source[0].src ? tex.source[0].src : '';
                        const decodedSrc = decodeURIComponent(src);
                        if (decodedSrc && !decodedSrc.includes(fullPath) && !decodedSrc.endsWith(fullPath)) {
                            this.textures.remove(key);
                        }
                    }
                    if (!this.textures.exists(key)) {
                        this.load.image(key, fullPath);
                        assetsToLoad++;
                    }
                };

                const chars = invRes && invRes.data && invRes.data.characters ? invRes.data.characters : [];
                chars.forEach(c => {
                    if (c.mc_portrait_path) checkAndLoadTex(`portrait_${c.mc_id}`, c.mc_portrait_path);
                    if (c.mc_square_path) checkAndLoadTex(`char_sq_${c.mc_id}`, c.mc_square_path);
                });

                if (res && res.status === 'success' && res.data && res.data.obtained_rewards) {
                    res.data.obtained_rewards.forEach(r => {
                        if (r.reward_type === 'Character' || r.is_new_unlock) {
                            const mcId = r.reward_item_id || r.mc_id;
                            if (mcId) {
                                if (r.portrait_path) checkAndLoadTex(`portrait_${mcId}`, r.portrait_path);
                                if (r.square_path) {
                                    checkAndLoadTex(`char_sq_${mcId}`, r.square_path);
                                } else if (r.portrait_path) {
                                    let sqPath = r.portrait_path.replace('potret', 'square');
                                    checkAndLoadTex(`char_sq_${mcId}`, sqPath);
                                }
                            }
                        }
                    });
                }

                const proceed = () => {
                    if (this.loadingText) this.loadingText.destroy();
                    if (this.spinCircle) this.spinCircle.destroy();
                    if (res.status === "success") {
                        this.renderVictoryData(res.data, presetsRes.data, invRes.data);
                    } else {
                        this.showError(res.message || "Failed to process battle results.");
                    }
                };

                if (assetsToLoad > 0) {
                    this.load.once('complete', proceed);
                    this.load.start();
                } else {
                    proceed();
                }
            })
            .catch(err => {
                if (this.loadingText) this.loadingText.destroy();
                if (this.spinCircle) this.spinCircle.destroy();
                this.showError("Connection Error: " + err.message);
            });
    }

    renderVictoryData(data, presets, inventory) {
        const expData = data.exp_data || {};
        const rewards = data.obtained_rewards || [];

        let mcElement = 'Any';
        if (presets && inventory && inventory.weapons) {
            const preset = presets.find(p => p.preset_slot === this.selectedPresetSlot);
            if (preset && preset.weap_grid_1_inv_id) {
                const weap = inventory.weapons.find(w => w.inv_id === preset.weap_grid_1_inv_id);
                if (weap && weap.sa_element) {
                    mcElement = weap.sa_element;
                }
            }
        }

        // 1. SEGMENT ATAS (PLAYER RANK)
        let cursorY = 120;
        const username = getPlayerUsername();

        // Username (Left)
        this.add.text(35, cursorY, username, {
            fontSize: "13px", color: "#ffffff", fontStyle: "bold"
        }).setOrigin(0, 0.5);

        // Rank (Right)
        const rankText = this.add.text(W - 35, cursorY, `Rank ${expData.player_rank}`, {
            fontSize: "13px", color: "#D4A017", fontStyle: "bold"
        }).setOrigin(1, 0.5);

        cursorY += 20;

        // Player Rank Progress Bar (Wide)
        const rankBarW = W - 70;
        const rankBarBg = this.add.rectangle(35, cursorY, rankBarW, 12, 0x334155).setOrigin(0, 0.5);
        const rankBarFill = this.add.rectangle(35, cursorY, 0, 12, 0x10B981).setOrigin(0, 0.5);

        // Rank Animation Logic
        const pTotal = expData.player_total_exp || 0;
        const pBase = expData.player_current_level_base_exp || 0;
        const pNext = expData.player_next_level_exp || 1;
        const pGained = expData.base_exp || 0;
        const pOldTotal = Math.max(0, pTotal - pGained);
        const isPlayerMax = expData.player_rank >= 100;

        this.animateProgressBar(rankBarFill, rankText, rankBarW, pOldTotal, pTotal, pBase, pNext, expData.player_rank, 'Rank', isPlayerMax);

        // 2. SEGMENT TENGAH (PARTY EXP)
        cursorY += 35;
        this.add.text(CX, cursorY, "PARTY EXPERIENCE", {
            fontSize: "11px", color: THEME.TEXT_SECONDARY, letterSpacing: 2
        }).setOrigin(0.5);

        const party = expData.party_exp_details || [];
        const cW = 85, gap = 15, total = party.length;
        const totalW = (total * cW) + ((total - 1) * gap);
        const startX = (W - totalW) / 2 + (cW / 2);
        const cardCenterY = cursorY + 80;

        party.forEach((char, i) => {
            const px = startX + i * (cW + gap);

            // Border color by rarity
            let rColorInt = THEME.BORDER;
            let rColorHex = '#ffffff';
            if (char.rarity === 'SSR') { rColorInt = 0xffd700; rColorHex = '#ffd700'; }
            else if (char.rarity === 'SR') { rColorInt = 0xa855f7; rColorHex = '#a855f7'; }
            else if (char.rarity === 'R') { rColorInt = 0xef4444; rColorHex = '#ef4444'; }

            // Portrait Background (85x145)
            const portBg = this.add.rectangle(px, cardCenterY, 85, 145, THEME.PANEL, 0.7);
            portBg.setStrokeStyle(2, rColorInt);

            // Character Portrait Image
            const portTex = `portrait_${char.mc_id}`;
            if (this.textures.exists(portTex)) {
                const img = this.add.image(px, cardCenterY, portTex);
                const imgW = img.width || 1;
                img.setScale(85 / imgW);
            }

            // Element Icon (Top Right)
            let elementStr = char.element;
            if (char.mc_id === 1 && mcElement) {
                elementStr = mcElement;
            }
            const elKey = elementStr ? `element_${elementStr.toLowerCase()}` : '';
            if (this.textures.exists(elKey)) {
                const ex = px + 42.5 - 12;
                const ey = cardCenterY - 72.5 + 12;
                const elImg = this.add.image(ex, ey, elKey).setDisplaySize(18, 18);
                const elShape = this.make.graphics();
                elShape.fillCircle(ex, ey, 9);
                elImg.setMask(elShape.createGeometryMask());
                this.add.circle(ex, ey, 9).setStrokeStyle(1, THEME.PANEL);
            }

            // Rarity Text (Bottom Left)
            if (char.rarity) {
                this.add.text(px - 42.5 + 6, cardCenterY + 72.5 - 5, char.rarity, {
                    fontSize: '11px', color: rColorHex, fontStyle: 'bold', stroke: '#000000', strokeThickness: 2, fontFamily: 'Outfit'
                }).setOrigin(0, 1);
            }

            // Level Text (below card)
            const lvlTxt = this.add.text(px, cardCenterY + 87, `Lv ${char.current_level}`, {
                fontSize: "11px", color: "#FFFFFF", fontStyle: "bold"
            }).setOrigin(0.5);

            // Mini EXP Bar
            const barW = 75;
            const barBg = this.add.rectangle(px, cardCenterY + 100, barW, 5, 0x334155).setOrigin(0.5);
            const barFill = this.add.rectangle(px - barW / 2, cardCenterY + 100, 0, 5, 0x06B6D4).setOrigin(0, 0.5);

            // Animate Char Bar
            const cTotal = char.total_exp;
            const cBase = char.current_level_base_exp;
            const cNext = char.next_level_exp;
            const cOld = Math.max(0, cTotal - pGained);
            const isCharMax = char.current_level >= char.max_level;
            const wasAlreadyMax = char.old_level >= char.max_level;

            this.animateProgressBar(barFill, lvlTxt, barW, cOld, cTotal, cBase, cNext, char.current_level, 'Lv', isCharMax, wasAlreadyMax);
        });

        // Divider
        const divY = cardCenterY + 116;
        const div2 = this.add.graphics();
        div2.lineStyle(1, THEME.BORDER, 1);
        div2.lineBetween(CX - 150, divY, CX + 150, divY);

        // 3. SEGMENT BAWAH (LOOT GRID CONTAINER WITH GEOMETRY MASK)
        const lootTitleY = divY + 22;
        this.add.text(CX, lootTitleY, "OBTAINED LOOT", {
            fontSize: "11px", color: THEME.TEXT_SECONDARY, letterSpacing: 2
        }).setOrigin(0.5);

        const lootBoxY = lootTitleY + 18;
        const lootBoxW = 430;
        const lootBoxH = 245;

        // Loot Panel Frame / Background
        const lootPanelBg = this.add.rectangle(CX, lootBoxY + lootBoxH / 2, lootBoxW, lootBoxH, 0x0F172A, 0.7);
        lootPanelBg.setStrokeStyle(1.5, 0x1E293B);

        // Filter out Character rewards from standard Loot Grid (Character rewards are presented via Modal Popups)
        const lootRewards = rewards.filter(r => r.reward_type !== 'Character');

        if (lootRewards.length === 0) {
            this.add.text(CX, lootBoxY + lootBoxH / 2, "No rewards dropped.", {
                fontSize: "14px", color: THEME.TEXT_MUTED, fontStyle: "italic"
            }).setOrigin(0.5);
        } else {
            // Mask for Loot Container
            const shape = this.make.graphics();
            shape.fillRect(CX - lootBoxW / 2, lootBoxY + 2, lootBoxW, lootBoxH - 4);
            const mask = shape.createGeometryMask();

            this.lootContainer = this.add.container(0, 0);
            this.lootContainer.setMask(mask);

            const maxCols = 4;
            const boxSize = 75;
            const padding = 15;

            lootRewards.forEach((item, index) => {
                const row = Math.floor(index / maxCols);
                const colInRow = index % maxCols;

                const itemsInThisRow = Math.min(maxCols, lootRewards.length - row * maxCols);
                const rowW = (itemsInThisRow * boxSize) + ((itemsInThisRow - 1) * padding);
                const rowStartX = (W - rowW) / 2 + (boxSize / 2);

                const ix = rowStartX + colInRow * (boxSize + padding);
                const iy = lootBoxY + 15 + row * (boxSize + padding) + (boxSize / 2);

                const itemBg = this.add.rectangle(ix, iy, boxSize, boxSize, THEME.PANEL, 0.9);

                let borderColor = THEME.BORDER;
                if (item.reward_type === 'Currency') borderColor = 0xD4A017;
                else if (item.reward_type === 'Weapon') borderColor = 0x94A3B8;

                itemBg.setStrokeStyle(1, borderColor);

                let iconTxt = "📦";
                if (item.reward_type === 'Currency') iconTxt = "🪙";
                else if (item.reward_type === 'Weapon') iconTxt = "⚔️";

                const tIcon = this.add.text(ix, iy - 14, iconTxt, { fontSize: "24px" }).setOrigin(0.5);
                const itemName = item.name ? item.name.substring(0, 10) : "";
                const tName = this.add.text(ix, iy + 8, itemName, { fontSize: "9px", color: "#ccc" }).setOrigin(0.5);
                const tQty = this.add.text(ix, iy + 22, `x${item.quantity}`, {
                    fontSize: "12px", color: "#fff", fontStyle: "bold"
                }).setOrigin(0.5);

                this.lootContainer.add([itemBg, tIcon, tName, tQty]);
            });

            const rows = Math.ceil(lootRewards.length / maxCols);
            const totalContentH = 30 + rows * (boxSize + padding);
            this.maxLootScroll = Math.max(0, totalContentH - lootBoxH);

            // Drag & Scroll Events inside Loot Box
            let isDraggingLoot = false;
            let startLootPointerY = 0;
            let startContainerY = 0;

            this.input.on('pointerdown', (pointer) => {
                if (this.unlockQueue && this.unlockQueue.length > 0) return;
                if (pointer.x >= (CX - lootBoxW / 2) && pointer.x <= (CX + lootBoxW / 2) &&
                    pointer.y >= lootBoxY && pointer.y <= (lootBoxY + lootBoxH)) {
                    isDraggingLoot = true;
                    startLootPointerY = pointer.y;
                    startContainerY = this.lootContainer.y;
                }
            });

            this.input.on('pointermove', (pointer) => {
                if (isDraggingLoot && this.lootContainer) {
                    const dy = pointer.y - startLootPointerY;
                    this.lootContainer.y = Phaser.Math.Clamp(startContainerY + dy, -this.maxLootScroll, 0);
                }
            });

            const endLootDrag = () => { isDraggingLoot = false; };
            this.input.on('pointerup', endLootDrag);
            this.input.on('pointerupoutside', endLootDrag);

            this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
                if (this.unlockQueue && this.unlockQueue.length > 0) return;
                if (this.lootContainer && pointer.x >= (CX - lootBoxW / 2) && pointer.x <= (CX + lootBoxW / 2) &&
                    pointer.y >= lootBoxY && pointer.y <= (lootBoxY + lootBoxH)) {
                    this.lootContainer.y = Phaser.Math.Clamp(this.lootContainer.y - (deltaY * 0.5), -this.maxLootScroll, 0);
                }
            });
        }

        // 4. FIXED CONTINUE BUTTON AT THE BOTTOM
        const btnY = 745;
        const btn = this.add.rectangle(CX, btnY, 240, 42, THEME.PANEL)
            .setInteractive({ useHandCursor: true })
            .setDepth(10);
        btn.setStrokeStyle(1.5, 0x38BDF8);

        const btnText = this.add.text(CX, btnY, "CONTINUE", {
            fontSize: "14px", color: THEME.TEXT_PRIMARY, fontStyle: "bold", letterSpacing: 1
        }).setOrigin(0.5).setDepth(11);

        btn.on('pointerover', () => {
            btn.setFillStyle(0x334155);
            btnText.setColor("#38BDF8");
        });
        btn.on('pointerout', () => {
            btn.setFillStyle(THEME.PANEL);
            btnText.setColor(THEME.TEXT_PRIMARY);
        });
        btn.on('pointerdown', (pointer, x, y, event) => {
            if (event && event.stopPropagation) event.stopPropagation();
            this.scene.stop('BattleScene');
            this.scene.stop('VictoryScene');
            this.sound.stopAll();
            this.scene.start('LoadingScene', { targetScene: 'QuestScene' });
        });

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

        // Panel size based on type
        const isChar = item.type === 'character';
        const panelW = 340;
        const panelH = isChar ? 430 : 250;

        // Modal Container Background using Card X3.png
        let bg;
        if (this.textures.exists('card_x3')) {
            bg = this.add.image(CX, H / 2, 'card_x3').setDisplaySize(panelW, panelH);
            if (isChar) {
                bg.setTint(0x38bdf8); // Sky Blue tint for Card X3
            } else {
                bg.setTint(0x3b82f6); // Blue tint for skill modal Card X3
            }
        } else {
            bg = this.add.rectangle(CX, H / 2, panelW, panelH, THEME.BG, 1);
            bg.setStrokeStyle(2, 0xD4A017);
        }
        modal.add(bg);

        if (isChar) {
            const char = item.data;
            const mcId = char.reward_item_id || char.mc_id || 8;

            // Rarity colors (matching inventoryScene model)
            let rarityColorInt = 0x38bdf8;
            let rarityColorHex = '#38bdf8';
            const rarityUpper = (char.rarity || 'SR').toUpperCase();
            if (rarityUpper === 'SSR') { rarityColorInt = 0xffd700; rarityColorHex = '#ffd700'; }
            else if (rarityUpper === 'SR') { rarityColorInt = 0xa855f7; rarityColorHex = '#a855f7'; }
            else if (rarityUpper === 'R') { rarityColorInt = 0xef4444; rarityColorHex = '#ef4444'; }

            // Title
            modal.add(this.add.text(CX, H / 2 - 160, "NEW CHARACTER UNLOCKED!", {
                fontSize: "15px", color: "#ffffff", fontStyle: "bold", fontFamily: "Outfit", letterSpacing: 1
            }).setOrigin(0.5));

            // Square 1:1 Portrait Container (150x150)
            const pSize = 150;
            const pX = CX;
            const pY = H / 2 - 30;

            const portBg = this.add.rectangle(pX, pY, pSize, pSize, 0x0f172a, 1.0);
            modal.add(portBg);

            // Portrait Image (Square 1:1)
            const sqKey = `char_sq_${mcId}`;
            const normKey = `portrait_${mcId}`;
            let loadedTexKey = null;
            if (this.textures.exists(sqKey)) loadedTexKey = sqKey;
            else if (this.textures.exists(normKey)) loadedTexKey = normKey;

            if (loadedTexKey) {
                const portImg = this.add.image(pX, pY, loadedTexKey).setDisplaySize(pSize, pSize);
                const maskShape = this.make.graphics();
                maskShape.fillStyle(0xffffff);
                maskShape.fillRoundedRect(pX - pSize / 2, pY - pSize / 2, pSize, pSize, 6);
                portImg.setMask(maskShape.createGeometryMask());
                modal.add(portImg);
            } else {
                modal.add(this.add.text(pX, pY, "👤", { fontSize: "56px" }).setOrigin(0.5));
            }

            // Outline / Border with Rarity Color matching inventoryScene model
            const border = this.add.graphics();
            border.lineStyle(2.5, rarityColorInt);
            border.strokeRoundedRect(pX - pSize / 2, pY - pSize / 2, pSize, pSize, 6);
            modal.add(border);

            // Element Icon on Top Right Corner
            const element = char.element || 'Fire';
            const elKey = `element_${element.toLowerCase()}`;
            const elX = pX + pSize / 2 - 12;
            const elY = pY - pSize / 2 + 12;

            if (this.textures.exists(elKey)) {
                const elImg = this.add.image(elX, elY, elKey).setDisplaySize(18, 18);
                const shape = this.make.graphics();
                shape.fillCircle(elX, elY, 9);
                elImg.setMask(shape.createGeometryMask());
                const strokeCircle = this.add.circle(elX, elY, 9).setStrokeStyle(1, 0x0f172a);
                modal.add([elImg, strokeCircle]);
            } else {
                const elCircle = this.add.circle(elX, elY, 9, rarityColorInt).setStrokeStyle(1, 0x0f172a);
                const elTxt = this.add.text(elX, elY, element.charAt(0).toUpperCase(), { fontSize: '10px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'Outfit' }).setOrigin(0.5);
                modal.add([elCircle, elTxt]);
            }

            // Rarity Label on Bottom Left Corner
            const rX = pX - pSize / 2 + 8;
            const rY = pY + pSize / 2 - 4;
            const rTxt = this.add.text(rX, rY, rarityUpper, {
                fontSize: '12px', color: rarityColorHex, fontStyle: 'bold', stroke: '#000000', strokeThickness: 3, fontFamily: 'Outfit'
            }).setOrigin(0, 1);
            modal.add(rTxt);

            // Character Name
            modal.add(this.add.text(CX, H / 2 + 75, char.name || 'Unknown', {
                fontSize: "20px", color: "#ffffff", fontStyle: "bold", fontFamily: "Outfit"
            }).setOrigin(0.5));

        } else if (item.type === 'skill') {
            const skillData = item.data;

            modal.add(this.add.text(CX, H / 2 - 70, "SKILL UNLOCKED!", {
                fontSize: "18px", color: "#ffffff", fontStyle: "bold", fontFamily: "Outfit", letterSpacing: 1
            }).setOrigin(0.5));

            modal.add(this.add.text(CX, H / 2 - 25, skillData.charName, {
                fontSize: "14px", color: THEME.TEXT_MUTED, fontFamily: "Outfit"
            }).setOrigin(0.5));

            modal.add(this.add.text(CX, H / 2 + 10, skillData.skillName, {
                fontSize: "20px", color: "#ffffff", fontStyle: "bold", fontFamily: "Outfit"
            }).setOrigin(0.5));
        }

        // Button A Implementation for Modal
        const btnY = isChar ? (H / 2 + 145) : (H / 2 + 65);
        const btnW = 160;
        const btnH = 42;

        let btnBg;
        if (this.textures.exists('btn_a_normal')) {
            btnBg = this.add.image(CX, btnY, 'btn_a_normal').setDisplaySize(btnW, btnH).setInteractive({ useHandCursor: true });
        } else {
            btnBg = this.add.rectangle(CX, btnY, btnW, btnH, THEME.PANEL).setInteractive({ useHandCursor: true });
            btnBg.setStrokeStyle(1.5, 0x38bdf8);
        }
        modal.add(btnBg);

        const btnTxt = this.add.text(CX, btnY, "AWESOME!", {
            fontSize: "14px", color: "#ffffff", fontStyle: "bold", fontFamily: "Outfit", letterSpacing: 1
        }).setOrigin(0.5);
        modal.add(btnTxt);

        // Button Interactivity (Hover, Active, Click)
        btnBg.on('pointerover', () => {
            if (this.textures.exists('btn_a_hover')) btnBg.setTexture('btn_a_hover');
            btnBg.setDisplaySize(btnW * 1.05, btnH * 1.05);
            btnTxt.setScale(1.05);
        });

        btnBg.on('pointerout', () => {
            if (this.textures.exists('btn_a_normal')) btnBg.setTexture('btn_a_normal');
            btnBg.setDisplaySize(btnW, btnH);
            btnTxt.setScale(1.0);
        });

        btnBg.on('pointerdown', () => {
            if (this.textures.exists('btn_a_active')) btnBg.setTexture('btn_a_active');
            btnBg.setDisplaySize(btnW * 0.95, btnH * 0.95);
            btnTxt.setScale(0.95);
        });

        btnBg.on('pointerup', () => {
            btnBg.setDisplaySize(btnW, btnH);
            btnTxt.setScale(1.0);
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

        // Pop in animation for modal
        modal.setScale(0.8);
        modal.setAlpha(0);
        this.tweens.add({
            targets: modal,
            scale: 1,
            alpha: 1,
            duration: 300,
            ease: 'Back.easeOut'
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
