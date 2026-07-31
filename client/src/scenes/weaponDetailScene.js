import Phaser from 'phaser';
import { THEME } from '../main.js';
import { checkSession, saveCurrentScene, clearSession, getPlayerId } from '../utils/auth.js';
import PartyApi from '../services/PartyApi.js';

import fireRaw from '../../assets/icons/elements/fire.svg?raw';
import windRaw from '../../assets/icons/elements/wind.svg?raw';
import earthRaw from '../../assets/icons/elements/rock.svg?raw';

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
        const fireUrl = URL.createObjectURL(new Blob([fireRaw], { type: 'image/svg+xml' }));
        const windUrl = URL.createObjectURL(new Blob([windRaw], { type: 'image/svg+xml' }));
        const earthUrl = URL.createObjectURL(new Blob([earthRaw], { type: 'image/svg+xml' }));

        this.load.svg('element_fire', fireUrl, { width: 20, height: 20 });
        this.load.svg('element_wind', windUrl, { width: 20, height: 20 });
        this.load.svg('element_earth', earthUrl, { width: 20, height: 20 });
    }

    create() {
        this.add.rectangle(0, 0, W, H, THEME.BG).setOrigin(0);

        this.scrollGroup = this.add.group();
        this.modalGroup = this.add.group();

        this.musicOn = localStorage.getItem('music_on') !== 'false';
        this.sfxOn = localStorage.getItem('sfx_on') !== 'false';

        this._buildMenuModal();

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
        const headerBg = this.add.rectangle(0, 0, W, 60, 0x0a0f1d).setOrigin(0).setScrollFactor(0).setDepth(50);
        headerBg.setStrokeStyle(1, THEME.BORDER);
        this.add.text(CX, 30, 'WEAPON DETAIL', { fontSize: '16px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY, letterSpacing: 1 }).setOrigin(0.5).setScrollFactor(0).setDepth(50);

        const backBtn = this.add.circle(40, 30, 18, THEME.PANEL, THEME.PANEL_ALPHA).setScrollFactor(0).setDepth(50);
        backBtn.setStrokeStyle(1, THEME.BORDER);
        backBtn.setInteractive({ useHandCursor: true });
        const homeTxt = this.add.text(40, 30, 'HOME', { fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0.5).setScrollFactor(0).setDepth(50);
        
        backBtn.on('pointerover', () => { backBtn.setFillStyle(0x334155); homeTxt.setColor('#ffffff'); });
        backBtn.on('pointerout', () => { backBtn.setFillStyle(THEME.PANEL); homeTxt.setColor(THEME.TEXT_PRIMARY); });
        backBtn.on('pointerdown', () => this.scene.start('LoadingScene', { targetScene: 'MainMenuScene' }));

        // MENU Button
        const menuBtn = this.add.circle(W - 40, 30, 18, THEME.PANEL, THEME.PANEL_ALPHA).setScrollFactor(0).setDepth(50);
        menuBtn.setStrokeStyle(1, THEME.BORDER);
        menuBtn.setInteractive({ useHandCursor: true });
        const menuText = this.add.text(W - 40, 30, 'MENU', { fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0.5).setScrollFactor(0).setDepth(50);

        menuBtn.on('pointerover', () => { menuBtn.setFillStyle(0x334155); menuText.setColor('#ffffff'); });
        menuBtn.on('pointerout', () => { menuBtn.setFillStyle(THEME.PANEL); menuText.setColor(THEME.TEXT_PRIMARY); });
        menuBtn.on('pointerdown', () => this.toggleMenuModal(true));

        const bannerW = W - 60; // Added padding
        cy += 70;

        // PORTRAIT PLACEHOLDER
        const portraitH = 160;
        const portraitBox = this.add.rectangle(CX, cy + portraitH/2, bannerW, portraitH, 0x0a0f1d, 0.5).setStrokeStyle(1, THEME.BORDER);
        this.scrollGroup.add(portraitBox);

        // Rarity at top right of portrait container
        const rarity = weap.mw_rarity;
        let rarityColor = '#ffffff';
        if (rarity === 'SSR') rarityColor = '#ffd700'; // Kuning
        else if (rarity === 'SR') rarityColor = '#3b82f6'; // Biru
        else if (rarity === 'R') rarityColor = '#10b981'; // Hijau

        this.scrollGroup.add(this.add.text(CX + bannerW/2 - 10, cy + 15, rarity, { fontSize: '16px', color: rarityColor, fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }).setOrigin(1, 0.5));

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
        this.scrollGroup.add(this.add.text(elX + 15, elY, elNameStr, { fontSize: '13px', color: color, fontStyle: 'bold' }).setOrigin(0, 0.5));

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

        // Stats (white)
        const atk = this.calculateBaseStat('atk');
        const hp = this.calculateBaseStat('hp');
        this.scrollGroup.add(this.add.text(CX + bannerW / 2 - 20, cy + 60, `ATK: ${atk}`, { fontSize: '14px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(1, 0.5));
        this.scrollGroup.add(this.add.text(CX + bannerW / 2 - 20, cy + 85, `HP:  ${hp}`, { fontSize: '14px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(1, 0.5));

        cy += 140;

        // ACTION BUTTONS
        const btnW = W - 60; // Widen upgrade button to fill space

        // Upgrade Btn
        const upgZone = this.add.zone(CX, cy + 20, btnW, 40).setInteractive({ useHandCursor: true });
        const upgBg = this.add.rectangle(CX, cy + 20, btnW, 40, THEME.PANEL).setStrokeStyle(1, 0x10b981);
        upgZone.on('pointerdown', () => this.showUpgradeModal());
        this.scrollGroup.addMultiple([upgBg, upgZone, this.add.text(CX, cy + 20, 'UPGRADE', { fontSize: '14px', color: '#10b981', fontStyle: 'bold' }).setOrigin(0.5)]);

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
            const res = await fetch(`http://localhost:3000/api/party/${playerId}/inventory/all`);
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
                    qty += delta;
                    if (qty < 1) qty = 1;
                    if (qty > whetstoneCount) qty = whetstoneCount > 0 ? whetstoneCount : 1;
                    qtyText.setText(`${qty}`);
                    costText.setText(`Biaya: ${qty * costPerItem} Gold`);

                    const tLvl = calculateTargetLvl(qty);
                    targetLevelText.setText(`Target Level: ${tLvl}${tLvl === this.calculateMaxLevel() ? ' (MAX)' : ''}`);
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
                        const upgRes = await fetch(`http://localhost:3000/api/party/${playerId}/upgrade`, {
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

    _buildMenuModal() {
        this.menuContainer = this.add.container(0, 0).setDepth(150).setVisible(false).setScrollFactor(0);

        const sysW = this.scale.width;
        const sysH = this.scale.height;
        const backdrop = this.add.rectangle(sysW / 2, sysH / 2, sysW, sysH, 0x000000, 0.75).setInteractive();
        backdrop.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
            if (pointer.y > 420) this.toggleMenuModal(false);
        });

        const panel = this.add.rectangle(CX, 210, W, 420, 0x0a0f1d).setInteractive();
        panel.setStrokeStyle(1, THEME.BORDER);
        panel.on('pointerdown', (pointer, localX, localY, event) => event.stopPropagation());

        const header = this.add.text(CX, 30, 'MENU & SETTINGS', { fontSize: '14px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY, letterSpacing: 2 }).setOrigin(0.5);
        const divider = this.add.rectangle(CX, 60, W, 1, THEME.BORDER);

        const s1Label = this.add.text(CX, 85, 'QUICK NAVIGATION', { fontSize: '9px', fontFamily: 'Outfit', color: THEME.TEXT_SECONDARY, letterSpacing: 1 }).setOrigin(0.5);

        const btnParty = this._createModalRoundBtn(CX - 100, 125, 'PARTY', () => {
            this.toggleMenuModal(false);
            this.scene.start('LoadingScene', { targetScene: 'PartyScene' });
        });
        const btnQuest = this._createModalRoundBtn(CX, 125, 'QUEST', () => {
            this.toggleMenuModal(false);
            this.scene.start('LoadingScene', { targetScene: 'QuestScene' });
        });
        const btnGacha = this._createModalRoundBtn(CX + 100, 125, 'GACHA', () => {
            this.toggleMenuModal(false);
            this.scene.start('LoadingScene', { targetScene: 'GachaScene' });
        });

        const s2Label = this.add.text(CX, 185, 'ITEMS & MARKET', { fontSize: '9px', fontFamily: 'Outfit', color: THEME.TEXT_SECONDARY, letterSpacing: 1 }).setOrigin(0.5);
        const btnInventory = this._createModalRectBtn(CX - 90, 215, 160, 30, 'INVENTORY', () => {
            this.toggleMenuModal(false);
            this.scene.start('LoadingScene', { targetScene: 'InventoryScene' });
        });
        const btnShop = this._createModalRectBtn(CX + 90, 215, 160, 30, 'SHOP', () => { });

        const s3Label = this.add.text(CX, 270, 'AUDIO SETTINGS', { fontSize: '9px', fontFamily: 'Outfit', color: THEME.TEXT_SECONDARY, letterSpacing: 1 }).setOrigin(0.5);

        this.musicBtn = this._createModalRectBtn(CX - 90, 300, 160, 30, '', () => this.toggleMusic());
        this.musicTxt = this.add.text(CX - 90, 300, '', { fontSize: '10px', fontStyle: 'bold', fontFamily: 'Outfit' }).setOrigin(0.5);

        this.sfxBtn = this._createModalRectBtn(CX + 90, 300, 160, 30, '', () => this.toggleSfx());
        this.sfxTxt = this.add.text(CX + 90, 300, '', { fontSize: '10px', fontStyle: 'bold', fontFamily: 'Outfit' }).setOrigin(0.5);

        this.updateAudioButtonVisuals();

        const btnLogout = this._createModalRectBtn(CX, 360, 340, 32, 'LOGOUT', () => {
            this.showLogoutConfirmation();
        }, 0x7f1d1d, 0xef4444);

        const closeBtnCircle = this.add.circle(W - 40, 30, 18, THEME.PANEL, THEME.PANEL_ALPHA);
        closeBtnCircle.setStrokeStyle(1, THEME.BORDER);
        closeBtnCircle.setInteractive({ useHandCursor: true });
        const closeBtnText = this.add.text(W - 40, 30, 'CLOSE', { fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);

        closeBtnCircle.on('pointerover', () => { closeBtnCircle.setFillStyle(0x334155); closeBtnText.setColor('#ffffff'); });
        closeBtnCircle.on('pointerout', () => { closeBtnCircle.setFillStyle(THEME.PANEL); closeBtnText.setColor(THEME.TEXT_PRIMARY); });
        closeBtnCircle.on('pointerdown', () => this.toggleMenuModal(false));

        this.menuContainer.add([
            backdrop, panel, header, divider,
            s1Label, btnParty.circle, btnParty.text, btnQuest.circle, btnQuest.text, btnGacha.circle, btnGacha.text,
            s2Label, btnInventory.rect, btnInventory.text, btnShop.rect, btnShop.text,
            s3Label, this.musicBtn.rect, this.musicTxt, this.sfxBtn.rect, this.sfxTxt,
            btnLogout.rect, btnLogout.text, closeBtnCircle, closeBtnText
        ]);

        this.confirmContainer = this.add.container(0, 0).setDepth(160).setVisible(false).setScrollFactor(0);
        const cBackdrop = this.add.rectangle(sysW / 2, sysH / 2, sysW, sysH, 0x000000, 0.8).setInteractive();
        cBackdrop.on('pointerdown', (p, x, y, e) => e.stopPropagation());

        const cPanel = this.add.rectangle(CX, H / 2, 300, 150, 0x0d1425).setInteractive();
        cPanel.setStrokeStyle(2, 0xe74c3c);
        cPanel.on('pointerdown', (p, x, y, e) => e.stopPropagation());

        const cText = this.add.text(CX, H / 2 - 25, 'Apakah Anda yakin ingin logout?', {
            fontSize: '12px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY, align: 'center', wordWrap: { width: 260 }
        }).setOrigin(0.5);

        const btnYesObj = this._createModalRectBtn(CX - 65, H / 2 + 30, 100, 32, 'LOGOUT', () => clearSession(this), 0x7f1d1d, 0xef4444);
        const btnNoObj = this._createModalRectBtn(CX + 65, H / 2 + 30, 100, 32, 'BATAL', () => this.confirmContainer.setVisible(false), THEME.PANEL, THEME.BORDER);

        this.confirmContainer.add([cBackdrop, cPanel, cText, btnYesObj.rect, btnYesObj.text, btnNoObj.rect, btnNoObj.text]);
    }

    _createModalRoundBtn(x, y, label, onClick) {
        const circle = this.add.circle(x, y, 22, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        const text = this.add.text(x, y, label, { fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        circle.on('pointerover', () => circle.setFillStyle(0x334155));
        circle.on('pointerout', () => circle.setFillStyle(THEME.PANEL));
        circle.on('pointerdown', onClick);
        return { circle, text };
    }

    _createModalRectBtn(x, y, w, h, label, onClick, bgColor = THEME.PANEL, borderColor = THEME.BORDER) {
        const rect = this.add.rectangle(x, y, w, h, bgColor).setStrokeStyle(1, borderColor).setInteractive({ useHandCursor: true });
        const text = this.add.text(x, y, label, { fontSize: '10px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        rect.on('pointerover', () => rect.setFillStyle(0x334155));
        rect.on('pointerout', () => rect.setFillStyle(bgColor));
        rect.on('pointerdown', onClick);
        return { rect, text };
    }

    toggleMenuModal(show) {
        this.menuContainer.setVisible(show);
        if (show) this.updateAudioButtonVisuals();
    }

    toggleMusic() {
        this.musicOn = !this.musicOn;
        localStorage.setItem('music_on', this.musicOn);
        this.updateAudioButtonVisuals();
        this.sound.mute = !this.musicOn && !this.sfxOn;
    }

    toggleSfx() {
        this.sfxOn = !this.sfxOn;
        localStorage.setItem('sfx_on', this.sfxOn);
        this.updateAudioButtonVisuals();
        this.sound.mute = !this.musicOn && !this.sfxOn;
    }

    updateAudioButtonVisuals() {
        if (!this.musicBtn || !this.sfxBtn) return;
        this.musicBtn.rect.setFillStyle(this.musicOn ? 0x0d2a1a : 0x2a0d0d);
        this.musicBtn.rect.setStrokeStyle(1, this.musicOn ? 0x2ecc71 : 0xe74c3c);
        this.musicTxt.setText(`MUSIC: ${this.musicOn ? 'ON' : 'OFF'}`).setColor(this.musicOn ? '#a8e6cf' : '#ff8a80');

        this.sfxBtn.rect.setFillStyle(this.sfxOn ? 0x0d2a1a : 0x2a0d0d);
        this.sfxBtn.rect.setStrokeStyle(1, this.sfxOn ? 0x2ecc71 : 0xe74c3c);
        this.sfxTxt.setText(`SFX: ${this.sfxOn ? 'ON' : 'OFF'}`).setColor(this.sfxOn ? '#a8e6cf' : '#ff8a80');
    }

    showLogoutConfirmation() {
        this.confirmContainer.setVisible(true);
    }

    showUpgradeSuccessModal(oldLevel, newLevel, newExp) {
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
}
