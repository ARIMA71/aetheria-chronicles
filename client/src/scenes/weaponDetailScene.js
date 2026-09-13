import Phaser from 'phaser';
import { THEME } from '../main.js';
import { playGlobalBGM } from '../utils/audioManager.js';
import { checkSession, saveCurrentScene, clearSession, getPlayerId } from '../utils/auth.js';
import PartyApi from '../services/PartyApi.js';
import TopMenuComponent from '../ui/TopMenuComponent.js';
import { API_BASE } from '../config.js';

// Element icons are loaded as PNGs in preload

const W = 480, H = 800, CX = 240;

export default class WeaponDetailScene extends Phaser.Scene {
    constructor() {
        super({ key: 'WeaponDetailScene' });
    }

    init(data) {
        this.targetData = data || {};
        this.weap = data.item;
        this.fromParty = data.fromParty || false;
        this.partyState = data.partyState || null;
        this.playerId = getPlayerId();
    }

    preload() {
        this.load.image('element_fire', 'assets/icons/elements/fire.png');
        this.load.image('element_wind', 'assets/icons/elements/wind.png');
        this.load.image('element_earth', 'assets/icons/elements/rock.png');
        if (!this.cache.audio.exists('sfx_success')) {
            this.load.audio('sfx_success', 'assets/audio/sfx/success.mp3');
        }
    }

    create() {
        if (!checkSession(this)) return;
        playGlobalBGM(this, 'main_menu');
        this.add.rectangle(0, 0, W, H, THEME.BG).setOrigin(0);

        this.scrollGroup = this.add.group();
        this.modalGroup = this.add.group();

        this.musicOn = localStorage.getItem('music_on') !== 'false';
        this.sfxOn = localStorage.getItem('sfx_on') !== 'false';

        this.topMenu = new TopMenuComponent(this);

        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            if (this.modalGroup.getChildren().length > 0) return;
            this.cameras.main.scrollY += deltaY;
            if (this.cameras.main.scrollY < 0) this.cameras.main.scrollY = 0;
        });

        let isDragging = false, startY = 0, startCamY = 0;
        this.input.on('pointerdown', (pointer) => {
            if (this.modalGroup.getChildren().length > 0 || pointer.y <= 60) return;
            isDragging = true;
            startY = pointer.y;
            startCamY = this.cameras.main.scrollY;
        });
        this.input.on('pointermove', (pointer) => {
            if (isDragging) {
                const dy = pointer.y - startY;
                this.cameras.main.scrollY = startCamY - dy;
                if (this.cameras.main.scrollY < 0) this.cameras.main.scrollY = 0;
            }
        });
        this.input.on('pointerup', () => { isDragging = false; });

        this.renderUI();
    }

    getElementColor(element) {
        if (!element) return THEME.BORDER;
        const el = element.toLowerCase();
        if (el === 'fire') return 0xef4444;
        if (el === 'wind') return 0x10b981;
        if (el === 'earth') return 0xd97706;
        return 0x94a3b8;
    }

    calculateMaxLevel() {
        if (this.weap.mw_rarity === 'SSR') return 100;
        if (this.weap.mw_rarity === 'SR') return 80;
        if (this.weap.mw_rarity === 'R') return 60;
        return 1;
    }

    calculateBaseStat(statType, customLevel = null) {
        const level = customLevel !== null ? customLevel : (this.weap.item_level || 1);
        if (statType === 'hp') return this.weap.mw_base_hp + (this.weap.mw_hp_growth * (level - 1));
        if (statType === 'atk') return this.weap.mw_base_atk + (this.weap.mw_atk_growth * (level - 1));
        return 0;
    }

    renderUI() {
        this.scrollGroup.clear(true, true);
        const weap = this.weap;
        let cy = 0;

        // Header Fixed
        const headerBg = this.add.rectangle(0, 0, W, 60, 0x0a0f1d, 1).setOrigin(0).setScrollFactor(0).setDepth(1000);
        headerBg.setStrokeStyle(1, THEME.BORDER);
        this.add.text(CX, 30, 'WEAPON DETAIL', { fontSize: '16px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY, letterSpacing: 1 }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

        const backBtn = this.add.circle(40, 30, 18, THEME.PANEL, 1).setScrollFactor(0).setDepth(1000);
        backBtn.setStrokeStyle(1, THEME.BORDER);
        backBtn.setInteractive({ useHandCursor: true });
        const homeTxt = this.add.text(40, 30, 'HOME', { fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

        backBtn.on('pointerover', () => { backBtn.setFillStyle(0x334155); homeTxt.setColor('#ffffff'); });
        backBtn.on('pointerout', () => { backBtn.setFillStyle(THEME.PANEL); homeTxt.setColor(THEME.TEXT_PRIMARY); });
        backBtn.on('pointerdown', () => this.scene.start('LoadingScene', { targetScene: 'MainMenuScene' }));

        const bannerW = W - 30; // Added padding
        cy += 70;

        const path = weap.mw_img_path;
        const imgKey = `weap_img_${weap.mw_id}`;
        if (path && !this.textures.exists(imgKey)) {
            let fullPath = path;
            if (!fullPath.endsWith('.png') && !fullPath.endsWith('.jpg')) fullPath += '.png';
            this.load.image(imgKey, fullPath);
            this.load.once('complete', () => this.renderUI());
            this.load.start();
            return;
        }

        // PORTRAIT PLACEHOLDER & IMAGE
        const portraitH = 160;
        const portraitBox = this.add.rectangle(CX, cy + portraitH / 2, bannerW, portraitH, 0x0a0f1d, 0.5).setStrokeStyle(1, THEME.BORDER);
        this.scrollGroup.add(portraitBox);

        if (this.textures.exists(imgKey)) {
            const weapImg = this.add.image(CX, cy + portraitH / 2, imgKey);
            weapImg.setDisplaySize(bannerW, portraitH);
            const maskShape = this.make.graphics();
            maskShape.fillStyle(0xffffff);
            maskShape.fillRoundedRect(CX - bannerW / 2, cy, bannerW, portraitH, 4);
            weapImg.setMask(maskShape.createGeometryMask());
            this.scrollGroup.add(weapImg);
        }

        // Rarity at top right of portrait container
        const rarity = weap.mw_rarity;
        let rarityColor = '#ffffff';
        if (rarity === 'SSR') rarityColor = '#ffd700'; // Gold
        else if (rarity === 'SR') rarityColor = '#a855f7'; // Purple
        else if (rarity === 'R') rarityColor = '#ef4444'; // Red

        this.scrollGroup.add(this.add.text(CX + bannerW / 2 - 10, cy + 15, rarity, { fontSize: '16px', color: rarityColor, fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }).setOrigin(1, 0.5));

        cy += portraitH;

        // BANNER
        const color = this.getElementColor(weap.mw_element);
        const banner = this.add.rectangle(CX, cy + 60, bannerW, 110, THEME.PANEL).setStrokeStyle(1, THEME.BORDER);
        this.scrollGroup.add(banner);

        // Name
        this.scrollGroup.add(this.add.text(CX - bannerW / 2 + 20, cy + 25, weap.mw_name, { fontSize: '18px', color: '#fff', fontStyle: 'bold' }).setOrigin(0, 0.5));

        // Element Logo on the left
        const elKey = weap.mw_element ? `element_${weap.mw_element.toLowerCase()}` : '';
        const elX = CX - bannerW / 2 + 29;
        const elY = cy + 55;

        if (this.textures.exists(elKey)) {
            const iconImg = this.add.image(elX, elY, elKey).setDisplaySize(18, 18);
            const shape = this.make.graphics();
            shape.fillCircle(elX, elY, 9);
            iconImg.setMask(shape.createGeometryMask());

            const strokeCircle = this.add.circle(elX, elY, 9).setStrokeStyle(1, THEME.PANEL);
            this.scrollGroup.addMultiple([iconImg, strokeCircle]);
        } else {
            const elCircle = this.add.circle(elX, elY, 9, color).setStrokeStyle(1, THEME.PANEL);
            this.scrollGroup.add(elCircle);
        }

        // Element Name (colored)
        const elNameStr = weap.mw_element ? weap.mw_element.toUpperCase() : '?';
        const colorHex = color === THEME.BORDER ? '#334155' : '#' + color.toString(16).padStart(6, '0');
        this.scrollGroup.add(this.add.text(elX + 15, elY, elNameStr, { fontSize: '13px', color: colorHex, fontStyle: 'bold' }).setOrigin(0, 0.5));

        // Level (white)
        const maxLevel = this.calculateMaxLevel();
        this.scrollGroup.add(this.add.text(CX - bannerW / 2 + 20, cy + 80, `Lv ${weap.item_level} / ${maxLevel}`, { fontSize: '14px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0.5));

        // EXP Bar (1/3 of banner width)
        const barW = bannerW / 3;
        const barX = CX - bannerW / 2 + 20;
        const barY = cy + 96;

        // Bordered Background
        const expBg = this.add.rectangle(barX, barY, barW, 6, 0x0f172a).setOrigin(0, 0.5).setStrokeStyle(1, 0x64748b);
        this.scrollGroup.add(expBg);

        let expPct = weap.item_level >= maxLevel ? 1 : 0.5; // Visual placeholder if max exp logic isn't on client
        if (weap.item_exp !== undefined && expPct !== 1) {
            expPct = (weap.item_exp % 10000) / 10000;
        }
        const expFill = this.add.rectangle(barX, barY, barW * expPct, 6, 0x3b82f6).setOrigin(0, 0.5);
        this.scrollGroup.add(expFill);

        // Stats
        const atk = this.calculateBaseStat('atk');
        const hp = this.calculateBaseStat('hp');
        this.scrollGroup.add(this.add.text(CX + bannerW / 2 - 20, cy + 60, `ATK: ${atk}`, { fontSize: '14px', color: '#ef4444', fontStyle: 'bold' }).setOrigin(1, 0.5));
        this.scrollGroup.add(this.add.text(CX + bannerW / 2 - 20, cy + 85, `HP:  ${hp}`, { fontSize: '14px', color: '#4ade80', fontStyle: 'bold' }).setOrigin(1, 0.5));

        cy += 140;

        // ACTION BUTTONS
        if (this.fromParty) {
            const btnHalfW = (W - 80) / 2; // Split space with a gap of 20

            // Upgrade Btn (Left)
            const upgZone = this.add.zone(CX - 10 - btnHalfW / 2, cy + 20, btnHalfW, 40).setInteractive({ useHandCursor: true });
            const upgBg = this.add.rectangle(CX - 10 - btnHalfW / 2, cy + 20, btnHalfW, 40, THEME.PANEL).setStrokeStyle(1, 0x10b981);
            upgZone.on('pointerdown', () => this.showUpgradeModal());
            this.scrollGroup.addMultiple([upgBg, upgZone, this.add.text(CX - 10 - btnHalfW / 2, cy + 20, 'UPGRADE', { fontSize: '14px', color: '#10b981', fontStyle: 'bold' }).setOrigin(0.5)]);

            // Change Weapon Btn (Right)
            const changeZone = this.add.zone(CX + 10 + btnHalfW / 2, cy + 20, btnHalfW, 40).setInteractive({ useHandCursor: true });
            const changeBg = this.add.rectangle(CX + 10 + btnHalfW / 2, cy + 20, btnHalfW, 40, THEME.PANEL).setStrokeStyle(1, 0x3b82f6);
            changeZone.on('pointerdown', () => {
                this.showWeaponSelectionModal();
            });
            this.scrollGroup.addMultiple([changeBg, changeZone, this.add.text(CX + 10 + btnHalfW / 2, cy + 20, 'CHANGE WEAPON', { fontSize: '12px', color: '#3b82f6', fontStyle: 'bold' }).setOrigin(0.5)]);
        } else {
            const btnW = W - 60; // Widen upgrade button to fill space
            // Upgrade Btn
            const upgZone = this.add.zone(CX, cy + 20, btnW, 40).setInteractive({ useHandCursor: true });
            const upgBg = this.add.rectangle(CX, cy + 20, btnW, 40, THEME.PANEL).setStrokeStyle(1, 0x10b981);
            upgZone.on('pointerdown', () => this.showUpgradeModal());
            this.scrollGroup.addMultiple([upgBg, upgZone, this.add.text(CX, cy + 20, 'UPGRADE', { fontSize: '14px', color: '#10b981', fontStyle: 'bold' }).setOrigin(0.5)]);
        }

        cy += 70;

        const specialSkill = weap.skills ? weap.skills.find(s => s.ms_category === 'Special') : null;
        const activeSkills = weap.skills ? weap.skills.filter(s => s.ms_category !== 'Special') : [];

        // SPECIAL ATTACK
        this.scrollGroup.add(this.add.text(CX, cy, 'SPECIAL ATTACK', { fontSize: '12px', color: THEME.TEXT_MUTED, letterSpacing: 2 }).setOrigin(0.5));
        cy += 20;
        const caBox = this.add.rectangle(CX, cy + 30, W - 30, 60, THEME.PANEL).setStrokeStyle(1, THEME.BORDER);
        this.scrollGroup.add(caBox);

        if (specialSkill) {
            this.scrollGroup.add(this.add.text(35, cy + 15, specialSkill.ms_name, { fontSize: '14px', color: '#f59e0b', fontStyle: 'bold' }).setOrigin(0, 0.5));
            const spDesc = specialSkill.ms_desc || `Massive ${specialSkill.ms_element || 'elemental'} damage to a foe.`;
            this.scrollGroup.add(this.add.text(35, cy + 30, spDesc, {
                fontSize: '11px',
                color: THEME.TEXT_PRIMARY,
                wordWrap: { width: W - 70, useAdvancedWrap: true }
            }).setOrigin(0, 0));
        } else {
            this.scrollGroup.add(this.add.text(CX, cy + 30, 'Tidak ada Special Attack.', { fontSize: '11px', color: THEME.TEXT_MUTED }).setOrigin(0.5));
        }

        cy += 80;

        // SKILLS
        this.scrollGroup.add(this.add.text(CX, cy, 'WEAPON SKILLS', { fontSize: '12px', color: THEME.TEXT_MUTED, letterSpacing: 2 }).setOrigin(0.5));
        cy += 20;

        if (activeSkills.length > 0) {
            activeSkills.forEach((skill, i) => {
                const isLocked = (weap.item_level < skill.unlock_level) || (weap.limit_break_level < skill.unlock_limit_break);

                const boxH = isLocked ? 80 : 90;
                const skBox = this.add.rectangle(CX, cy + (boxH / 2), W - 30, boxH, THEME.PANEL);

                if (isLocked) {
                    skBox.setStrokeStyle(2, 0xe74c3c); // Red highlight for locked
                    skBox.setFillStyle(0x1a0505);
                } else {
                    skBox.setStrokeStyle(1, THEME.BORDER);
                }
                this.scrollGroup.add(skBox);

                if (isLocked) {
                    this.scrollGroup.add(this.add.text(35, cy + 20, `🔒 ${skill.ms_name}`, { fontSize: '14px', color: THEME.TEXT_MUTED, fontStyle: 'bold' }).setOrigin(0, 0.5));
                    this.scrollGroup.add(this.add.text(35, cy + 45, `Syarat Level: ${skill.unlock_level}  |  Syarat LB: ${skill.unlock_limit_break}`, { fontSize: '12px', color: '#f1c40f', fontStyle: 'bold' }).setOrigin(0, 0.5));
                } else {
                    this.scrollGroup.add(this.add.text(35, cy + 20, skill.ms_name, { fontSize: '14px', color: '#3b82f6', fontStyle: 'bold' }).setOrigin(0, 0.5));
                    // Actual Description from Database
                    const desc = skill.ms_desc || `Memberikan efek khusus untuk senjata elemen ${skill.ms_element}.`;
                    this.scrollGroup.add(this.add.text(35, cy + 35, desc, {
                        fontSize: '11px',
                        color: THEME.TEXT_PRIMARY,
                        wordWrap: { width: W - 70, useAdvancedWrap: true }
                    }).setOrigin(0, 0));
                    this.scrollGroup.add(this.add.text(35, cy + 65, `Category: ${skill.ms_category}`, { fontSize: '10px', color: THEME.TEXT_MUTED }).setOrigin(0, 0.5));
                }

                cy += boxH + 15;
            });
        } else {
            this.scrollGroup.add(this.add.text(CX, cy + 30, 'Tidak ada skill senjata.', { fontSize: '12px', color: THEME.TEXT_MUTED }).setOrigin(0.5));
            cy += 60;
        }

        cy += 20;

        // BACK BUTTON AT BOTTOM
        const backBg = this.add.rectangle(0, cy, W / 2, 45, 0x0f172a).setOrigin(0, 0).setStrokeStyle(1, 0x475569);
        const backTxt = this.add.text(W / 2 - 20, cy + 22.5, '◀ BACK', { fontSize: '14px', fontFamily: 'Outfit', color: '#a8a29e', fontStyle: 'bold' }).setOrigin(1, 0.5);
        const backZone = this.add.zone(0, cy, W / 2, 45).setOrigin(0, 0).setInteractive({ useHandCursor: true });

        backZone.on('pointerover', () => { backBg.setFillStyle(0x334155); backTxt.setColor('#ffffff'); });
        backZone.on('pointerout', () => { backBg.setFillStyle(0x0f172a); backTxt.setColor('#a8a29e'); });
        backZone.on('pointerdown', () => {
            if (this.targetData.fromParty) {
                this.scene.start('LoadingScene', { targetScene: 'PartyScene', targetData: { partyState: this.targetData.partyState } });
            } else {
                this.scene.start('LoadingScene', { targetScene: 'InventoryScene' });
            }
        });

        this.scrollGroup.addMultiple([backBg, backTxt, backZone]);
        cy += 65;

        this.cameras.main.setBounds(0, 0, W, Math.max(H, cy + 50));
    }

    async showUpgradeModal() {
        const weap = this.weap;
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const CX = W / 2;
        const CY = H / 2;
        const playerId = 1; // HARDCODED for now

        if (this.modalGroup) {
            this.modalGroup.clear(true, true);
        } else {
            this.modalGroup = this.add.group();
        }

        // Overlay
        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.8).setOrigin(0).setInteractive();
        this.modalGroup.add(overlay);

        const modalBg = this.add.rectangle(CX, CY, W - 40, 320, THEME.PANEL).setStrokeStyle(1, THEME.BORDER);
        this.modalGroup.add(modalBg);

        this.modalGroup.add(this.add.text(CX, CY - 130, 'UPGRADE LEVEL', { fontSize: '18px', color: '#10b981', fontStyle: 'bold', letterSpacing: 2 }).setOrigin(0.5));

        // X button removed and replaced with a Cancel button below.

        // Fetch latest inventory to get Gold and Materials
        const loadingText = this.add.text(CX, CY, 'Loading data...', { fontSize: '12px', color: THEME.TEXT_MUTED }).setOrigin(0.5);
        this.modalGroup.add(loadingText);

        try {
            const res = await fetch(`${API_BASE}/api/party/${playerId}/inventory/all`);
            const data = await res.json();

            if (data.status === 'success') {
                loadingText.destroy();

                const materials = data.data.materials || [];
                const gold = data.data.gold || 0;

                // Weapon Whetstone is mat_id = 5
                const whetstone = materials.find(m => m.mat_id === 5);
                const whetstoneCount = whetstone ? whetstone.quantity : 0;

                this.modalGroup.add(this.add.text(CX, CY - 90, `${weap.mw_name}`, { fontSize: '14px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));
                this.modalGroup.add(this.add.text(CX, CY - 70, `Level: ${weap.item_level}`, { fontSize: '14px', color: '#f59e0b', fontStyle: 'bold' }).setOrigin(0.5));

                this.modalGroup.add(this.add.text(40, CY - 30, 'Weapon Whetstone:', { fontSize: '12px', color: THEME.TEXT_MUTED }).setOrigin(0, 0.5));
                this.modalGroup.add(this.add.text(W - 40, CY - 30, `${whetstoneCount} dimiliki`, { fontSize: '12px', color: THEME.TEXT_PRIMARY }).setOrigin(1, 0.5));

                let qty = 1;
                const costPerItem = 500;

                const qtyText = this.add.text(CX, CY + 20, `${qty}`, { fontSize: '24px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

                const minusBtn = this.add.text(CX - 50, CY + 20, '-', { fontSize: '24px', color: THEME.TEXT_PRIMARY, backgroundColor: '#334155', padding: { x: 10, y: 5 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
                const plusBtn = this.add.text(CX + 50, CY + 20, '+', { fontSize: '24px', color: THEME.TEXT_PRIMARY, backgroundColor: '#334155', padding: { x: 10, y: 5 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });

                const targetLevelText = this.add.text(CX, CY + 50, 'Target Level: ?', { fontSize: '13px', color: '#10b981', fontStyle: 'bold' }).setOrigin(0.5);
                const costText = this.add.text(CX, CY + 70, `Biaya: ${qty * costPerItem} Gold`, { fontSize: '12px', color: '#f59e0b' }).setOrigin(0.5);
                const goldText = this.add.text(CX, CY + 90, `Gold Anda: ${gold}`, { fontSize: '11px', color: THEME.TEXT_MUTED }).setOrigin(0.5);

                const currentExp = weap.item_exp || 0;
                const calculateTargetLvl = (q) => {
                    const totalExp = currentExp + (q * 80000);
                    const maxLevel = this.calculateMaxLevel();
                    let weaponTotal = 0;
                    let tLevel = 1;
                    for (let i = 2; i <= maxLevel; i++) {
                        weaponTotal += Math.floor(20 * Math.pow(i, 1.5));
                        if (totalExp >= weaponTotal) tLevel = i;
                        else break;
                    }
                    return tLevel;
                };

                const updateQty = (delta) => {
                    let tempQty = qty + delta;
                    if (tempQty < 1) tempQty = 1;
                    if (tempQty > whetstoneCount) tempQty = whetstoneCount > 0 ? whetstoneCount : 1;

                    const maxLvl = this.calculateMaxLevel();
                    let maxExpReq = 0;
                    for (let i = 2; i <= maxLvl; i++) {
                        maxExpReq += Math.floor(20 * Math.pow(i, 1.5));
                    }

                    const expNeeded = maxExpReq - currentExp;
                    if (expNeeded > 0) {
                        const maxQtyToMaxLvl = Math.ceil(expNeeded / 80000);
                        if (tempQty > maxQtyToMaxLvl) {
                            tempQty = maxQtyToMaxLvl;
                        }
                    } else {
                        tempQty = 0;
                    }

                    qty = tempQty;
                    qtyText.setText(`${qty}`);
                    costText.setText(`Biaya: ${qty * costPerItem} Gold`);

                    const tLvl = calculateTargetLvl(qty);
                    targetLevelText.setText(`Target Level: ${tLvl}${tLvl >= maxLvl ? ' (MAX)' : ''}`);
                };
                updateQty(0); // Initialize text

                minusBtn.on('pointerdown', () => updateQty(-1));
                plusBtn.on('pointerdown', () => updateQty(1));

                const plus10Btn = this.add.text(CX + 100, CY + 20, '+10', { fontSize: '16px', color: THEME.TEXT_PRIMARY, backgroundColor: '#334155', padding: { x: 5, y: 5 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
                plus10Btn.on('pointerdown', () => updateQty(10));

                const minus10Btn = this.add.text(CX - 100, CY + 20, '-10', { fontSize: '16px', color: THEME.TEXT_PRIMARY, backgroundColor: '#334155', padding: { x: 5, y: 5 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
                minus10Btn.on('pointerdown', () => updateQty(-10));

                this.modalGroup.addMultiple([qtyText, minusBtn, plusBtn, plus10Btn, minus10Btn, targetLevelText, costText, goldText]);

                // Cancel Button
                const btnW = 120;
                const cancelZone = this.add.zone(CX - 70, CY + 130, btnW, 40).setInteractive({ useHandCursor: true });
                const cancelBg = this.add.rectangle(CX - 70, CY + 130, btnW, 40, THEME.PANEL).setStrokeStyle(1, THEME.BORDER);
                const cancelTxt = this.add.text(CX - 70, CY + 130, 'CANCEL', { fontSize: '14px', color: THEME.TEXT_MUTED, fontStyle: 'bold' }).setOrigin(0.5);

                cancelZone.on('pointerover', () => cancelBg.setFillStyle(0x334155));
                cancelZone.on('pointerout', () => cancelBg.setFillStyle(THEME.PANEL));
                cancelZone.on('pointerdown', () => this.modalGroup.clear(true, true));

                // Enhance Button
                const enhZone = this.add.zone(CX + 70, CY + 130, btnW, 40).setInteractive({ useHandCursor: true });
                const enhBg = this.add.rectangle(CX + 70, CY + 130, btnW, 40, THEME.PANEL).setStrokeStyle(1, 0x10b981);
                const enhTxt = this.add.text(CX + 70, CY + 130, 'ENHANCE', { fontSize: '14px', color: '#10b981', fontStyle: 'bold' }).setOrigin(0.5);

                enhZone.on('pointerover', () => enhBg.setFillStyle(0x064e3b));
                enhZone.on('pointerout', () => enhBg.setFillStyle(THEME.PANEL));
                enhZone.on('pointerdown', async () => {
                    if (whetstoneCount < qty) {
                        enhTxt.setText('NOT ENOUGH WHETSTONE').setColor('#ef4444');
                        setTimeout(() => enhTxt.setText('ENHANCE').setColor('#10b981'), 2000);
                        return;
                    }
                    if (gold < qty * costPerItem) {
                        enhTxt.setText('NOT ENOUGH GOLD').setColor('#ef4444');
                        setTimeout(() => enhTxt.setText('ENHANCE').setColor('#10b981'), 2000);
                        return;
                    }

                    enhTxt.setText('UPGRADING...').setColor('#f59e0b');
                    try {
                        const upgRes = await fetch(`${API_BASE}/api/party/${playerId}/upgrade`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                invId: weap.inv_id,
                                itemType: 'Weapon',
                                quantity: qty,
                                materialId: 5
                            })
                        });
                        const upgData = await upgRes.json();

                        if (upgData.status === 'success') {
                            this.showUpgradeSuccessModal(weap.item_level, upgData.data.new_level, upgData.data.new_exp);
                        } else {
                            enhTxt.setText('UPGRADE FAILED').setColor('#ef4444');
                            setTimeout(() => enhTxt.setText('ENHANCE').setColor('#10b981'), 2000);
                        }
                    } catch (e) {
                        console.error(e);
                        enhTxt.setText('NETWORK ERROR').setColor('#ef4444');
                        setTimeout(() => enhTxt.setText('ENHANCE').setColor('#10b981'), 2000);
                    }
                });

                this.modalGroup.addMultiple([cancelBg, cancelZone, cancelTxt, enhBg, enhZone, enhTxt]);

            } else {
                this.modalGroup.add(this.add.text(CX, CY, 'Gagal memuat data inventory.', { fontSize: '12px', color: THEME.DANGER }).setOrigin(0.5));
            }

        } catch (e) {
            console.error(e);
            this.modalGroup.add(this.add.text(CX, CY, 'Terjadi kesalahan jaringan.', { fontSize: '12px', color: THEME.DANGER }).setOrigin(0.5));
        }
    }

    showLimitBreakModal() {
        const weap = this.weap;
        this.modalGroup.clear(true, true);
        const bg = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.9).setInteractive();
        this.modalGroup.add(bg);

        const mBox = this.add.graphics().fillStyle(THEME.PANEL, 1).lineStyle(2, 0x3b82f6).fillRoundedRect(40, 250, W - 80, 250, 12).strokeRoundedRect(40, 250, W - 80, 250, 12);
        this.modalGroup.add(mBox);

        this.modalGroup.add(this.add.text(CX, 280, 'LIMIT BREAK (UNCAP)', { fontSize: '16px', color: '#3b82f6', fontStyle: 'bold' }).setOrigin(0.5));
        this.modalGroup.add(this.add.text(CX, 305, `${weap.mw_name} (LB ${weap.limit_break_level} ➔ LB ${weap.limit_break_level + 1})`, { fontSize: '14px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));

        this.modalGroup.add(this.add.text(CX, 340, 'Syarat Material:', { fontSize: '12px', color: THEME.TEXT_MUTED }).setOrigin(0.5));
        this.modalGroup.add(this.add.text(CX, 360, 'Membutuhkan Gold & Orb Elemen.', { fontSize: '12px', color: THEME.TEXT_PRIMARY, align: 'center' }).setOrigin(0.5));

        const closeZone = this.add.zone(140, 440, 100, 40).setInteractive({ useHandCursor: true });
        const closeBg = this.add.graphics().fillStyle(THEME.BG, 1).lineStyle(1, THEME.BORDER).fillRoundedRect(90, 420, 100, 40, 6).strokeRoundedRect(90, 420, 100, 40, 6);
        closeZone.on('pointerdown', () => this.modalGroup.clear(true, true));
        this.modalGroup.addMultiple([closeBg, closeZone, this.add.text(140, 440, 'Cancel', { fontSize: '12px', color: THEME.TEXT_MUTED }).setOrigin(0.5)]);

        const confirmZone = this.add.zone(310, 440, 100, 40).setInteractive({ useHandCursor: true });
        const confirmBg = this.add.graphics().fillStyle(0x3b82f6, 1).fillRoundedRect(260, 420, 100, 40, 6);
        confirmZone.on('pointerdown', async () => {
            confirmZone.disableInteractive();
            this.modalGroup.add(this.add.text(CX, 390, 'Processing...', { fontSize: '12px', color: THEME.GOLD }).setOrigin(0.5));

            const res = await PartyApi.limitBreak(this.playerId, weap.inv_id);
            if (res.status === 'success') {
                this.weap.limit_break_level += 1;
                this.showLimitBreakSuccessModal();
            } else {
                this.modalGroup.add(this.add.text(CX, 410, res.message || 'Error', { fontSize: '12px', color: THEME.DANGER }).setOrigin(0.5));
                setTimeout(() => confirmZone.setInteractive(), 2000);
            }
        });
        this.modalGroup.addMultiple([confirmBg, confirmZone, this.add.text(310, 440, 'Confirm', { fontSize: '12px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5)]);
    }



    showUpgradeSuccessModal(oldLevel, newLevel, newExp) {
        if (this.sound.get('sfx_success') || this.cache.audio.exists('sfx_success')) {
            this.sound.play('sfx_success', { volume: 0.8 });
        }
        this.modalGroup.clear(true, true);
        const W = this.cameras.main.width, H = this.cameras.main.height, CX = W / 2, CY = H / 2;

        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.9).setOrigin(0).setInteractive();
        const modalBg = this.add.rectangle(CX, CY, W - 60, 260, THEME.PANEL).setStrokeStyle(1, 0x10b981);

        const title = this.add.text(CX, CY - 90, 'UPGRADE SUCCESS!', { fontSize: '20px', color: '#10b981', fontStyle: 'bold', letterSpacing: 1 }).setOrigin(0.5);

        const oldAtk = this.calculateBaseStat('atk', oldLevel);
        const newAtk = this.calculateBaseStat('atk', newLevel);
        const oldHp = this.calculateBaseStat('hp', oldLevel);
        const newHp = this.calculateBaseStat('hp', newLevel);

        const lvlTxt = this.add.text(CX, CY - 40, `Level: ${oldLevel}  ➔  ${newLevel}`, { fontSize: '16px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
        const atkTxt = this.add.text(CX, CY - 10, `ATK: ${oldAtk}  ➔  ${newAtk}`, { fontSize: '14px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        const hpTxt = this.add.text(CX, CY + 15, `HP:  ${oldHp}  ➔  ${newHp}`, { fontSize: '14px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);

        const okZone = this.add.zone(CX, CY + 80, 120, 40).setInteractive({ useHandCursor: true });
        const okBg = this.add.rectangle(CX, CY + 80, 120, 40, THEME.PANEL).setStrokeStyle(1, 0x3b82f6);
        const okTxt = this.add.text(CX, CY + 80, 'OK', { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

        okZone.on('pointerover', () => okBg.setFillStyle(0x334155));
        okZone.on('pointerout', () => okBg.setFillStyle(THEME.PANEL));
        okZone.on('pointerdown', () => {
            this.weap.item_level = newLevel;
            this.weap.item_exp = newExp;
            this.scene.start('LoadingScene', { targetScene: 'WeaponDetailScene', targetData: this.targetData });
        });

        this.modalGroup.addMultiple([overlay, modalBg, title, lvlTxt, atkTxt, hpTxt, okBg, okZone, okTxt]);
    }

    showLimitBreakSuccessModal() {
        if (this.sound.get('sfx_success') || this.cache.audio.exists('sfx_success')) {
            this.sound.play('sfx_success', { volume: 0.8 });
        }
        this.modalGroup.clear(true, true);
        const W = this.cameras.main.width, H = this.cameras.main.height, CX = W / 2, CY = H / 2;

        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.9).setOrigin(0).setInteractive();
        const modalBg = this.add.rectangle(CX, CY, W - 60, 200, THEME.PANEL).setStrokeStyle(1, 0x3b82f6);

        const title = this.add.text(CX, CY - 60, 'LIMIT BREAK SUCCESS!', { fontSize: '18px', color: '#3b82f6', fontStyle: 'bold', letterSpacing: 1 }).setOrigin(0.5);
        const desc = this.add.text(CX, CY - 20, 'Max Level cap has been increased!', { fontSize: '14px', color: '#fff' }).setOrigin(0.5);

        const okZone = this.add.zone(CX, CY + 50, 120, 40).setInteractive({ useHandCursor: true });
        const okBg = this.add.rectangle(CX, CY + 50, 120, 40, THEME.PANEL).setStrokeStyle(1, 0x10b981);
        const okTxt = this.add.text(CX, CY + 50, 'OK', { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

        okZone.on('pointerover', () => okBg.setFillStyle(0x334155));
        okZone.on('pointerout', () => okBg.setFillStyle(THEME.PANEL));
        okZone.on('pointerdown', () => {
            this.scene.start('LoadingScene', { targetScene: 'WeaponDetailScene', targetData: this.targetData });
        });

        this.modalGroup.addMultiple([overlay, modalBg, title, desc, okBg, okZone, okTxt]);
    }

    async showWeaponSelectionModal(page = 1, sortBy = null, displayMode = null) {
        sortBy = sortBy || localStorage.getItem('party_sort') || 'Level';
        displayMode = displayMode || localStorage.getItem('party_view') || 'ATK/HP';

        if (this.modalGroup.getChildren().length > 0) this.modalGroup.clear(true, true);
        const W = this.cameras.main.width, H = this.cameras.main.height, CX = W / 2, CY = H / 2;

        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.85).setOrigin(0).setInteractive();
        this.modalGroup.add(overlay);

        const panelTop = 90;
        const panelBottom = 800;
        const panelHeight = panelBottom - panelTop;
        const panelCenterY = panelTop + (panelHeight / 2);
        const panelWidth = W - 30;

        const panel = this.add.rectangle(CX, panelCenterY, panelWidth, panelHeight, 0x0d1b2a).setStrokeStyle(2, 0x3b82f6).setInteractive();
        this.modalGroup.add(panel);

        this.modalGroup.add(this.add.text(CX, panelTop + 25, 'SELECT WEAPON', { fontSize: '16px', fontStyle: 'bold', color: '#A5B4FC', fontFamily: 'Outfit', letterSpacing: 2 }).setOrigin(0.5));
        this.modalGroup.add(this.add.rectangle(CX, panelTop + 50, panelWidth - 40, 1, 0x334155));

        const closeBtn = this.add.circle(CX + (panelWidth / 2) - 25, panelTop + 25, 14, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        const closeTxt = this.add.text(CX + (panelWidth / 2) - 25, panelTop + 25, '✕', { fontSize: '12px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        closeBtn.on('pointerdown', () => this.modalGroup.clear(true, true));
        this.modalGroup.addMultiple([closeBtn, closeTxt]);

        const loadingTxt = this.add.text(CX, panelCenterY, 'Loading Weapons...', { fontSize: '14px', color: '#fff' }).setOrigin(0.5);
        this.modalGroup.add(loadingTxt);

        if (!this.weaponsData) {
            const invRes = await PartyApi.getInventory(this.playerId);
            if (invRes.status === 'success') {
                this.weaponsData = invRes.data.weapons;
            } else {
                loadingTxt.setText('Failed to load weapons');
                return;
            }
        }
        loadingTxt.destroy();

        const preset = this.partyState.preset;
        const equipped = [
            preset.weap_grid_1_inv_id, preset.weap_grid_2_inv_id, preset.weap_grid_3_inv_id, preset.weap_grid_4_inv_id, preset.weap_grid_5_inv_id
        ].filter(id => id != null);

        // Allow unequip
        const unequipY = panelTop + 75;
        const unequipZone = this.add.zone(CX, unequipY, 200, 32).setInteractive({ useHandCursor: true });
        const unBg = this.add.graphics().fillStyle(THEME.DANGER, 1).fillRoundedRect(CX - 100, unequipY - 16, 200, 32, 8);
        unequipZone.on('pointerdown', async () => {
            this.modalGroup.clear(true, true);
            await this.saveAndReturn(null);
        });
        this.modalGroup.addMultiple([unBg, unequipZone, this.add.text(CX, unequipY, 'Unequip / Clear', { fontSize: '12px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5)]);

        // --- Sort & Filter Bar ---
        const filterY = panelTop + 115;
        const sortBtnBg = this.add.rectangle(120, filterY, 140, 26, THEME.PANEL, 1);
        sortBtnBg.setStrokeStyle(1, THEME.BORDER);
        const sortZone = this.add.zone(120, filterY, 140, 26).setInteractive({ useHandCursor: true });
        const sortTxt = this.add.text(120, filterY, `SORT: ${sortBy}`, { fontSize: '11px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

        sortZone.on('pointerover', () => sortBtnBg.setFillStyle(0x334155));
        sortZone.on('pointerout', () => sortBtnBg.setFillStyle(THEME.PANEL));
        sortZone.on('pointerdown', () => {
            const s = ['Level', 'ATK', 'HP', 'Rarity'];
            const nextSort = s[(s.indexOf(sortBy) + 1) % s.length];
            localStorage.setItem('party_sort', nextSort);
            this.showWeaponSelectionModal(1, nextSort, displayMode);
        });
        this.modalGroup.addMultiple([sortBtnBg, sortZone, sortTxt]);

        const dispBtnBg = this.add.rectangle(W - 120, filterY, 140, 26, THEME.PANEL, 1);
        dispBtnBg.setStrokeStyle(1, THEME.BORDER);
        const dispZone = this.add.zone(W - 120, filterY, 140, 26).setInteractive({ useHandCursor: true });
        const dispTxt = this.add.text(W - 120, filterY, `VIEW: ${displayMode}`, { fontSize: '11px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

        dispZone.on('pointerover', () => dispBtnBg.setFillStyle(0x334155));
        dispZone.on('pointerout', () => dispBtnBg.setFillStyle(THEME.PANEL));
        dispZone.on('pointerdown', () => {
            let modes = ['ATK/HP', 'Level/LB', 'Skills'];
            const nextDisp = modes[(modes.indexOf(displayMode) + 1) % modes.length];
            localStorage.setItem('party_view', nextDisp);
            this.showWeaponSelectionModal(page, sortBy, nextDisp);
        });
        this.modalGroup.addMultiple([dispBtnBg, dispZone, dispTxt]);

        let list = this.weaponsData.filter(item => !equipped.includes(item.inv_id));

        // Sorting logic
        list.sort((a, b) => {
            const rarityScore = { 'SSR': 3, 'SR': 2, 'R': 1 };
            if (sortBy === 'Rarity') {
                const rA = rarityScore[a.mw_rarity] || 0;
                const rB = rarityScore[b.mw_rarity] || 0;
                if (rA !== rB) return rB - rA;
            } else if (sortBy === 'ATK') {
                const aAtk = a.mw_base_atk + (a.mw_atk_growth * ((a.item_level || 1) - 1));
                const bAtk = b.mw_base_atk + (b.mw_atk_growth * ((b.item_level || 1) - 1));
                return bAtk - aAtk;
            } else if (sortBy === 'HP') {
                const aHp = a.mw_base_hp + (a.mw_hp_growth * ((a.item_level || 1) - 1));
                const bHp = b.mw_base_hp + (b.mw_hp_growth * ((b.item_level || 1) - 1));
                return bHp - aHp;
            }
            return (b.item_level || 1) - (a.item_level || 1);
        });

        // Grid Render
        const cols = 4;
        const boxW = 84;
        const boxH = 100;
        const paddingX = 12;
        const paddingY = 10;
        const gridW = (cols * boxW) + ((cols - 1) * paddingX);
        const startX = (W - gridW) / 2 + (boxW / 2);
        const startYGrid = panelTop + 150 + 20;

        const itemsPerPage = 16;
        const totalPages = Math.max(1, Math.ceil(list.length / itemsPerPage));
        const pagedItems = list.slice((page - 1) * itemsPerPage, page * itemsPerPage);

        pagedItems.forEach((item, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const ix = startX + col * (boxW + paddingX);
            const iy = startYGrid + row * (boxH + paddingY) + (boxH / 2);

            let color = THEME.BORDER;
            const rarity = item.mw_rarity;
            if (rarity === 'SSR') color = 0xffd700;
            else if (rarity === 'SR') color = 0xa855f7;
            else if (rarity === 'R') color = 0xef4444;

            const cardBg = this.add.graphics();
            cardBg.fillStyle(THEME.PANEL, 1);
            cardBg.lineStyle(2, THEME.BORDER);
            cardBg.fillRoundedRect(ix - boxW / 2, iy - boxH / 2, boxW, boxH, 8);
            cardBg.strokeRoundedRect(ix - boxW / 2, iy - boxH / 2, boxW, boxH, 8);
            this.modalGroup.add(cardBg);

            const zone = this.add.zone(ix, iy, boxW, boxH).setInteractive({ useHandCursor: true });
            zone.on('pointerdown', async (p, x, y, e) => {
                e.stopPropagation();
                this.modalGroup.clear(true, true);
                await this.saveAndReturn(item.inv_id);
            });
            this.modalGroup.add(zone);

            const artH = boxH * 0.45;
            const yTop = iy - boxH / 2;
            const imgKey = `weap_img_${item.mw_id}`;
            if (this.textures.exists(imgKey)) {
                const weapImg = this.add.image(ix, yTop + 4 + artH / 2, imgKey);
                weapImg.setDisplaySize(boxW - 8, artH);
                weapImg.setAlpha(1, 1, 0.4, 0.4);
                const maskShape = this.make.graphics();
                maskShape.fillStyle(0xffffff);
                maskShape.fillRoundedRect(ix - boxW / 2 + 4, yTop + 4, boxW - 8, artH, 6);
                weapImg.setMask(maskShape.createGeometryMask());
                this.modalGroup.add(weapImg);
            } else {
                const artBg = this.add.graphics();
                artBg.fillStyle(THEME.BG, 1);
                artBg.fillRoundedRect(ix - boxW / 2 + 4, yTop + 4, boxW - 8, artH, 6);
                this.modalGroup.add(artBg);
            }

            const border = this.add.graphics();
            border.lineStyle(1, color);
            border.strokeRoundedRect(ix - boxW / 2 + 4, yTop + 4, boxW - 8, artH, 6);
            this.modalGroup.add(border);

            if (!this.textures.exists(`weap_img_${item.mw_id}`)) {
                this.modalGroup.add(this.add.text(ix, iy - boxH / 2 + 4 + artH / 2, item.mw_name.split(' ')[0], { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));
            }

            const element = item.mw_element;
            const elKey = element ? `element_${element.toLowerCase()}` : '';
            if (this.textures.exists(elKey)) {
                const iconImg = this.add.image(ix + boxW / 2 - 10, iy - boxH / 2 + 10, elKey).setDisplaySize(14, 14);
                const shape = this.make.graphics();
                shape.fillCircle(ix + boxW / 2 - 10, iy - boxH / 2 + 10, 7);
                iconImg.setMask(shape.createGeometryMask());
                const strokeCircle = this.add.circle(ix + boxW / 2 - 10, iy - boxH / 2 + 10, 7).setStrokeStyle(1, THEME.PANEL);
                this.modalGroup.addMultiple([iconImg, strokeCircle]);
            } else {
                let elColor = 0xffffff;
                if (element === 'Fire') elColor = 0xef4444;
                if (element === 'Wind') elColor = 0x10b981;
                if (element === 'Earth') elColor = 0xd97706;
                const elCircle = this.add.circle(ix + boxW / 2 - 10, iy - boxH / 2 + 10, 7, elColor).setStrokeStyle(1, THEME.PANEL);
                const elTxt = this.add.text(ix + boxW / 2 - 10, iy - boxH / 2 + 10, element ? element.charAt(0).toUpperCase() : '?', { fontSize: '9px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
                this.modalGroup.addMultiple([elCircle, elTxt]);
            }

            let rColor = '#ffffff';
            if (rarity === 'SSR') rColor = '#ffd700';
            else if (rarity === 'SR') rColor = '#a855f7';
            else if (rarity === 'R') rColor = '#ef4444';

            if (rarity) {
                this.modalGroup.add(this.add.text(ix - boxW / 2 + 6, iy - boxH / 2 + artH + 5, rarity, { fontSize: '11px', color: rColor, fontStyle: 'bold', stroke: '#000000', strokeThickness: 2, fontFamily: 'Outfit' }).setOrigin(0, 1));
            }

            if (displayMode === 'Level/LB') {
                this.modalGroup.add(this.add.text(ix, iy + 12, `Lv: ${item.item_level}`, { fontSize: '10px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
                this.modalGroup.add(this.add.text(ix, iy + 30, `LB: ${item.limit_break_level}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));
            } else if (displayMode === 'Skills') {
                const skills = (item.skills || []).filter(s => s.ms_category === 'Passive');
                skills.slice(0, 2).forEach((skill, i) => {
                    const sx = ix + (i === 0 && skills.length > 1 ? -15 : (i === 1 ? 15 : 0));
                    const sy = iy + 20;

                    const isLocked = (item.item_level < skill.unlock_level) || (item.limit_break_level < skill.unlock_limit_break);
                    const sBox = this.add.graphics().fillStyle(isLocked ? 0x555555 : 0x458B74, 1).fillRoundedRect(sx - 10, sy - 10, 20, 20, 4);
                    this.modalGroup.add(sBox);
                    this.modalGroup.add(this.add.text(sx, sy, 'P', { fontSize: '10px', color: isLocked ? '#999' : '#fff' }).setOrigin(0.5));
                });
                if (skills.length === 0) {
                    this.modalGroup.add(this.add.text(ix, iy + 20, 'No Passives', { fontSize: '9px', color: THEME.TEXT_MUTED }).setOrigin(0.5));
                }
            } else {
                const itemAtk = item.mw_base_atk + (item.mw_atk_growth * ((item.item_level || 1) - 1));
                const itemHp = item.mw_base_hp + (item.mw_hp_growth * ((item.item_level || 1) - 1));

                this.modalGroup.add(this.add.text(ix, iy + 12, `ATK: ${itemAtk}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));
                this.modalGroup.add(this.add.text(ix, iy + 30, `HP:  ${itemHp}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));
            }
        });

        // Pagination
        const pageY = panelBottom - 30;
        const prevActive = page > 1;
        const prevBtn = this.add.rectangle(CX - 80, pageY, 60, 25, prevActive ? 0x1e293b : 0x0f172a).setStrokeStyle(1, THEME.BORDER);
        const prevTxt = this.add.text(CX - 80, pageY, '< PREV', { fontSize: '10px', fontStyle: 'bold', color: prevActive ? '#ffffff' : THEME.TEXT_MUTED }).setOrigin(0.5);
        if (prevActive) {
            prevBtn.setInteractive({ useHandCursor: true });
            prevBtn.on('pointerdown', () => this.showWeaponSelectionModal(page - 1, sortBy, displayMode));
        }

        const nextActive = page < totalPages;
        const nextBtn = this.add.rectangle(CX + 80, pageY, 60, 25, nextActive ? 0x1e293b : 0x0f172a).setStrokeStyle(1, THEME.BORDER);
        const nextTxt = this.add.text(CX + 80, pageY, 'NEXT >', { fontSize: '10px', fontStyle: 'bold', color: nextActive ? '#ffffff' : THEME.TEXT_MUTED }).setOrigin(0.5);
        if (nextActive) {
            nextBtn.setInteractive({ useHandCursor: true });
            nextBtn.on('pointerdown', () => this.showWeaponSelectionModal(page + 1, sortBy, displayMode));
        }

        this.modalGroup.addMultiple([prevBtn, prevTxt, nextBtn, nextTxt]);
        this.modalGroup.add(this.add.text(CX, pageY, `${page} / ${totalPages}`, { fontSize: '12px', fontStyle: 'bold', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));
    }

    async saveAndReturn(newInvId) {
        const W = this.cameras.main.width, H = this.cameras.main.height, CX = W / 2;
        const loadOverlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.8).setOrigin(0).setInteractive().setDepth(2000);
        const loadTxt = this.add.text(CX, H / 2, 'Saving Preset...', { fontSize: '16px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5).setDepth(2000);

        const calcGridStats = (p) => {
            let hp = 0, atk = 0;
            const ids = [p.weap_grid_1_inv_id, p.weap_grid_2_inv_id, p.weap_grid_3_inv_id, p.weap_grid_4_inv_id, p.weap_grid_5_inv_id];
            ids.forEach(id => {
                if (id) {
                    const w = this.weaponsData.find(x => x.inv_id === id);
                    if (w) {
                        hp += w.mw_base_hp + (w.mw_hp_growth * ((w.item_level || 1) - 1));
                        atk += w.mw_base_atk + (w.mw_atk_growth * ((w.item_level || 1) - 1));
                    }
                }
            });
            return { hp: Math.floor(hp), atk: Math.floor(atk) };
        };

        const oldStats = calcGridStats(this.partyState.preset);

        const preset = this.partyState.preset;
        preset[this.partyState.partySlotId] = newInvId;

        const newStats = calcGridStats(preset);

        const mc_skills = [];
        if (preset.mc_skills) {
            for (let i = 0; i < 4; i++) {
                if (preset.mc_skills[i]) mc_skills.push(preset.mc_skills[i].ms_id);
                else mc_skills.push(null);
            }
        }

        const payload = {
            char_slot_1_inv_id: preset.char_slot_1_inv_id,
            char_slot_2_inv_id: preset.char_slot_2_inv_id,
            char_slot_3_inv_id: preset.char_slot_3_inv_id,
            weap_grid_1_inv_id: preset.weap_grid_1_inv_id,
            weap_grid_2_inv_id: preset.weap_grid_2_inv_id,
            weap_grid_3_inv_id: preset.weap_grid_3_inv_id,
            weap_grid_4_inv_id: preset.weap_grid_4_inv_id,
            weap_grid_5_inv_id: preset.weap_grid_5_inv_id,
            mc_skills: mc_skills
        };

        const res = await PartyApi.savePreset(this.playerId, this.partyState.currentSlot, payload);
        if (res.status === 'success') {
            const targetData = {
                partyState: this.partyState,
                weaponChanged: {
                    newInvId: newInvId,
                    oldAtk: oldStats.atk,
                    oldHp: oldStats.hp,
                    newAtk: newStats.atk,
                    newHp: newStats.hp
                }
            };
            this.scene.start('LoadingScene', { targetScene: 'PartyScene', targetData: targetData });
        } else {
            loadTxt.setText('Save Failed!');
            loadTxt.setColor('#ef4444');
            setTimeout(() => {
                loadOverlay.destroy();
                loadTxt.destroy();
            }, 2000);
        }
    }
}
