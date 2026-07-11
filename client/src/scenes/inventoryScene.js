import Phaser from 'phaser';
import { THEME } from '../main.js';
import { checkSession, saveCurrentScene, clearSession, getPlayerId } from '../utils/auth.js';
import PartyApi from '../services/PartyApi.js';

import fireRaw from '../../assets/icons/elements/fire.svg?raw';
import windRaw from '../../assets/icons/elements/wind.svg?raw';
import earthRaw from '../../assets/icons/elements/rock.svg?raw';

const W = 450, H = 800, CX = 225;

export default class InventoryScene extends Phaser.Scene {
    constructor() {
        super({ key: 'InventoryScene' });
    }

    init(data) {
        this.fromParty = data?.fromParty || false;
    }

    preload() {
        const fireUrl = URL.createObjectURL(new Blob([fireRaw], { type: 'image/svg+xml' }));
        const windUrl = URL.createObjectURL(new Blob([windRaw], { type: 'image/svg+xml' }));
        const earthUrl = URL.createObjectURL(new Blob([earthRaw], { type: 'image/svg+xml' }));
        
        this.load.svg('element_fire', fireUrl, { width: 16, height: 16 });
        this.load.svg('element_wind', windUrl, { width: 16, height: 16 });
        this.load.svg('element_earth', earthUrl, { width: 16, height: 16 });
    }

    create() {
        this.playerId = getPlayerId();
        this.currentTab = 'Characters'; // Characters, Weapons, Materials
        this.sortBy = 'Level'; // Level, ATK, HP, Rarity
        this.displayMode = 'ATK/HP'; // ATK/HP or Level/LB
        
        this.characters = [];
        this.weapons = [];
        this.materials = [];

        // Background
        this.add.rectangle(0, 0, W, H, THEME.BG).setOrigin(0);

        // Header Fixed
        const headerBg = this.add.rectangle(0, 0, W, 60, 0x0a0f1d).setOrigin(0).setScrollFactor(0).setDepth(50);
        headerBg.setStrokeStyle(1, THEME.BORDER);
        this.add.text(CX, 30, 'INVENTORY', { fontSize: '16px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY, letterSpacing: 1 }).setOrigin(0.5).setScrollFactor(0).setDepth(50);
        
        const backBtn = this.add.circle(40, 30, 18, THEME.PANEL, THEME.PANEL_ALPHA).setScrollFactor(0).setDepth(50);
        backBtn.setStrokeStyle(1, THEME.BORDER);
        backBtn.setInteractive({ useHandCursor: true });
        this.add.text(40, 30, '←', { fontSize: '16px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5).setScrollFactor(0).setDepth(50);
        backBtn.on('pointerdown', () => {
            if (this.fromParty) {
                this.scene.start('LoadingScene', { targetScene: 'PartyScene' });
            } else {
                this.scene.start('LoadingScene', { targetScene: 'MainMenuScene' });
            }
        });

        // MENU Button
        const menuBtn = this.add.circle(W - 40, 30, 18, THEME.PANEL, THEME.PANEL_ALPHA).setScrollFactor(0).setDepth(50);
        menuBtn.setStrokeStyle(1, THEME.BORDER);
        menuBtn.setInteractive({ useHandCursor: true });
        const menuText = this.add.text(W - 40, 30, 'MENU', { fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0.5).setScrollFactor(0).setDepth(50);

        menuBtn.on('pointerover', () => { menuBtn.setFillStyle(0x334155); menuText.setColor('#ffffff'); });
        menuBtn.on('pointerout', () => { menuBtn.setFillStyle(THEME.PANEL); menuText.setColor(THEME.TEXT_PRIMARY); });
        menuBtn.on('pointerdown', () => this.toggleMenuModal(true));

        this.modalGroup = this.add.group();
        this.musicOn = localStorage.getItem('music_on') !== 'false';
        this.sfxOn = localStorage.getItem('sfx_on') !== 'false';

        this._buildMenuModal();
        this.uiGroup = this.add.group();
        this.scrollGroup = this.add.group();
        
        this.loadingText = this.add.text(CX, H / 2, 'Loading Inventory...', { fontSize: '14px', color: THEME.TEXT_MUTED, fontFamily: 'Outfit' }).setOrigin(0.5);

        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            this.cameras.main.scrollY += deltaY;
            if (this.cameras.main.scrollY < 0) this.cameras.main.scrollY = 0;
        });

        let isDragging = false;
        let startY = 0;
        let startCamY = 0;

        this.input.on('pointerdown', (pointer) => {
            if (pointer.y <= 130) return; // Prevent drag on headers
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

        this.loadData();
    }

    async loadData() {
        const res = await PartyApi.getInventory(this.playerId);
        if (res.status === 'success') {
            this.characters = res.data.characters || [];
            this.weapons = res.data.weapons || [];
            this.materials = res.data.materials || [];
            this.loadingText.destroy();
            this.renderUI();
        } else {
            this.loadingText.setText('Failed to load inventory.');
        }
    }

    getElementColor(element) {
        if (!element) return THEME.BORDER;
        const el = element.toLowerCase();
        if (el === 'fire') return 0xef4444;
        if (el === 'wind') return 0x10b981;
        if (el === 'earth') return 0xd97706;
        return 0x94a3b8;
    }

    calculateBaseStat(item, statType, isWeapon = false) {
        if (!item) return 0;
        const level = item.item_level || 1;
        if (isWeapon) {
            if (statType === 'hp') return item.mw_base_hp + (item.mw_hp_growth * (level - 1));
            if (statType === 'atk') return item.mw_base_atk + (item.mw_atk_growth * (level - 1));
        } else {
            if (statType === 'hp') return item.mc_base_hp + (item.mc_hp_growth * (level - 1));
            if (statType === 'atk') return item.mc_base_atk + (item.mc_atk_growth * (level - 1));
        }
        return 0;
    }

    getRarityValue(rarity) {
        if (rarity === 'SSR') return 3;
        if (rarity === 'SR') return 2;
        if (rarity === 'R') return 1;
        return 0;
    }

    renderUI() {
        this.uiGroup.clear(true, true);
        this.scrollGroup.clear(true, true);

        // --- Tabs ---
        const tabs = ['Characters', 'Weapons', 'Materials'];
        const tabW = 120;
        
        tabs.forEach((tab, i) => {
            const isSel = this.currentTab === tab;
            const tx = 95 + i * 130;
            const ty = 90;
            
            const g = this.add.graphics();
            g.fillStyle(isSel ? 0x475569 : THEME.PANEL, 1);
            g.lineStyle(1, isSel ? 0xffffff : THEME.BORDER, 1);
            g.fillRoundedRect(tx - tabW/2, ty - 15, tabW, 30, 6);
            g.strokeRoundedRect(tx - tabW/2, ty - 15, tabW, 30, 6);
            g.setScrollFactor(0);
            this.uiGroup.add(g);

            const z = this.add.zone(tx, ty, tabW, 30).setInteractive({useHandCursor:true}).setScrollFactor(0);
            z.on('pointerdown', () => { 
                this.currentTab = tab; 
                this.cameras.main.scrollY = 0;
                this.renderUI(); 
            });
            this.uiGroup.add(z);

            this.uiGroup.add(this.add.text(tx, ty, tab, { 
                fontSize: '12px', color: isSel ? '#ffffff' : THEME.TEXT_MUTED, fontStyle: 'bold' 
            }).setOrigin(0.5).setScrollFactor(0));
        });

        // --- Sort & Filter Bar ---
        if (this.currentTab !== 'Materials') {
            const barBg = this.add.rectangle(CX, 140, W-40, 44, THEME.PANEL, 0.5).setScrollFactor(0);
            barBg.setStrokeStyle(1, THEME.BORDER);
            this.uiGroup.add(barBg);
            
            // Sort Button
            const sortBtnBg = this.add.rectangle(120, 140, 140, 30, THEME.PANEL, 1).setScrollFactor(0);
            sortBtnBg.setStrokeStyle(1, THEME.BORDER);
            const sortZone = this.add.zone(120, 140, 140, 30).setInteractive({useHandCursor:true}).setScrollFactor(0);
            const sortTxt = this.add.text(120, 140, `SORT: ${this.sortBy}`, { fontSize: '11px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0);
            
            sortZone.on('pointerover', () => sortBtnBg.setFillStyle(0x334155));
            sortZone.on('pointerout', () => sortBtnBg.setFillStyle(THEME.PANEL));
            sortZone.on('pointerdown', () => {
                const s = ['Level', 'ATK', 'HP', 'Rarity'];
                this.sortBy = s[(s.indexOf(this.sortBy) + 1) % s.length];
                this.renderUI();
            });
            this.uiGroup.addMultiple([sortBtnBg, sortZone, sortTxt]);

            // Display Toggle Button
            const dispBtnBg = this.add.rectangle(W - 120, 140, 140, 30, THEME.PANEL, 1).setScrollFactor(0);
            dispBtnBg.setStrokeStyle(1, THEME.BORDER);
            const dispZone = this.add.zone(W - 120, 140, 140, 30).setInteractive({useHandCursor:true}).setScrollFactor(0);
            const dispTxt = this.add.text(W - 120, 140, `VIEW: ${this.displayMode || 'ATK/HP'}`, { fontSize: '11px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0);
            
            dispZone.on('pointerover', () => dispBtnBg.setFillStyle(0x334155));
            dispZone.on('pointerout', () => dispBtnBg.setFillStyle(THEME.PANEL));
            dispZone.on('pointerdown', () => {
                this.displayMode = this.displayMode === 'ATK/HP' ? 'Level/LB' : 'ATK/HP';
                this.renderUI();
            });
            this.uiGroup.addMultiple([dispBtnBg, dispZone, dispTxt]);
        }

        // --- Grid Render ---
        let items = [];
        let isWeapon = false;

        if (this.currentTab === 'Characters') {
            items = [...this.characters].filter(c => c.mc_id !== 1);
            isWeapon = false;
        } else if (this.currentTab === 'Weapons') {
            items = [...this.weapons];
            isWeapon = true;
        } else {
            items = [...this.materials];
        }

        if (this.currentTab !== 'Materials') {
            items.sort((a, b) => {
                if (this.sortBy === 'Rarity') {
                    const rA = this.getRarityValue(isWeapon ? a.mw_rarity : a.mc_rarity);
                    const rB = this.getRarityValue(isWeapon ? b.mw_rarity : b.mc_rarity);
                    if (rA !== rB) return rB - rA;
                } else if (this.sortBy === 'ATK') {
                    return this.calculateBaseStat(b, 'atk', isWeapon) - this.calculateBaseStat(a, 'atk', isWeapon);
                } else if (this.sortBy === 'HP') {
                    return this.calculateBaseStat(b, 'hp', isWeapon) - this.calculateBaseStat(a, 'hp', isWeapon);
                }
                // Default to Level
                return (b.item_level || 1) - (a.item_level || 1);
            });
        } else {
            // Material sort by quantity
            items.sort((a, b) => b.quantity - a.quantity);
        }

        let cols = 4;
        let boxW = 85;
        let boxH = 85;
        let paddingX = 15;
        let paddingY = 40;

        if (this.currentTab !== 'Materials') {
            cols = 4;
            boxW = 84;
            boxH = 112; // Portrait ratio
            paddingX = 15;
            paddingY = 15;
        }

        const gridW = (cols * boxW) + ((cols - 1) * paddingX);
        const startX = (W - gridW) / 2 + (boxW / 2);
        let startYGrid = this.currentTab === 'Materials' ? 140 : 180;
        let bottomY = startYGrid;

        items.forEach((item, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            
            const ix = startX + col * (boxW + paddingX);
            const iy = startYGrid + row * (boxH + paddingY) + (boxH / 2);
            bottomY = Math.max(bottomY, iy + boxH / 2);

            let color = THEME.BORDER;
            if (this.currentTab !== 'Materials') {
                const rarity = isWeapon ? item.mw_rarity : item.mc_rarity;
                if (rarity === 'SSR') color = 0xffd700; // Gold
                else if (rarity === 'SR') color = 0xc0c0c0; // Silver
                else if (rarity === 'R') color = 0xcd7f32; // Bronze
            }

            const cardBg = this.add.graphics();
            cardBg.fillStyle(THEME.PANEL, 1);
            cardBg.lineStyle(2, color);
            cardBg.fillRoundedRect(ix - boxW/2, iy - boxH/2, boxW, boxH, 8);
            cardBg.strokeRoundedRect(ix - boxW/2, iy - boxH/2, boxW, boxH, 8);
            this.scrollGroup.add(cardBg);

            // Click Zone
            const zone = this.add.zone(ix, iy, boxW, boxH).setInteractive({useHandCursor:true});
            zone.on('pointerdown', (p, x, y, e) => {
                e.stopPropagation();
                this.tweens.add({ targets: cardBg, scale: 0.95, yoyo: true, duration: 80 });
                if (this.currentTab === 'Characters') {
                    this.scene.start('LoadingScene', { targetScene: 'CharacterDetailScene', targetData: { item, isWeapon: false } });
                } else if (this.currentTab === 'Weapons') {
                    this.scene.start('LoadingScene', { targetScene: 'WeaponDetailScene', targetData: { item, isWeapon: true } });
                }
            });
            this.scrollGroup.add(zone);

            if (this.currentTab === 'Materials') {
                this.scrollGroup.add(this.add.text(ix, iy - 10, "📦", { fontSize: "32px" }).setOrigin(0.5));
                this.scrollGroup.add(this.add.text(ix, iy + 25, item.mat_name.substring(0, 10), { fontSize: '10px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));
                this.scrollGroup.add(this.add.text(ix, iy + 55, `x${item.quantity}`, { fontSize: '12px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
            } else {
                // Character / Weapon Custom Layout
                // Art Placeholder (Top 45%)
                const artH = boxH * 0.45;
                const artBg = this.add.graphics().fillStyle(THEME.BG, 1).fillRoundedRect(ix - boxW/2 + 4, iy - boxH/2 + 4, boxW - 8, artH, 6);
                this.scrollGroup.add(artBg);
                
                const itemName = isWeapon ? item.mw_name : item.mc_name;
                this.scrollGroup.add(this.add.text(ix, iy - boxH/2 + 4 + artH/2, itemName.split(' ')[0], { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));

                const element = isWeapon ? item.mw_element : item.mc_element;
                const elColor = this.getElementColor(element);
                const elKey = element ? `element_${element.toLowerCase()}` : '';

                // ELEMENT Indicator at top right
                if (this.textures.exists(elKey)) {
                    const iconImg = this.add.image(ix + boxW/2 - 10, iy - boxH/2 + 10, elKey).setDisplaySize(14, 14);
                    const shape = this.make.graphics();
                    shape.fillCircle(ix + boxW/2 - 10, iy - boxH/2 + 10, 7);
                    iconImg.setMask(shape.createGeometryMask());
                    
                    // Stroke overlay
                    const strokeCircle = this.add.circle(ix + boxW/2 - 10, iy - boxH/2 + 10, 7).setStrokeStyle(1, THEME.PANEL);
                    this.scrollGroup.addMultiple([iconImg, strokeCircle]);
                } else {
                    const elCircle = this.add.circle(ix + boxW/2 - 10, iy - boxH/2 + 10, 7, elColor).setStrokeStyle(1, THEME.PANEL);
                    const elLetter = element ? element.charAt(0).toUpperCase() : '?';
                    const elTxt = this.add.text(ix + boxW/2 - 10, iy - boxH/2 + 10, elLetter, { fontSize: '9px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
                    this.scrollGroup.addMultiple([elCircle, elTxt]);
                }
                
                // Display Info below art box
                if (this.displayMode === 'Level/LB') {
                    this.scrollGroup.add(this.add.text(ix, iy + 12, `Lv: ${item.item_level}`, { fontSize: '10px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
                    this.scrollGroup.add(this.add.text(ix, iy + 30, `LB: ${item.limit_break_level}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));
                } else {
                    const atk = this.calculateBaseStat(item, 'atk', isWeapon);
                    const hp = this.calculateBaseStat(item, 'hp', isWeapon);
                    this.scrollGroup.add(this.add.text(ix, iy + 12, `ATK: ${atk}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));
                    this.scrollGroup.add(this.add.text(ix, iy + 30, `HP:  ${hp}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));
                }
            }
        });

        this.cameras.main.setBounds(0, 0, W, Math.max(H, bottomY + 100));
    }

    _buildMenuModal() {
        this.menuContainer = this.add.container(0, 0).setDepth(150).setVisible(false).setScrollFactor(0);

        const backdrop = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.75).setInteractive();
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
        });

        const s2Label = this.add.text(CX, 185, 'ITEMS & MARKET', { fontSize: '9px', fontFamily: 'Outfit', color: THEME.TEXT_SECONDARY, letterSpacing: 1 }).setOrigin(0.5);
        const btnInventory = this._createModalRectBtn(CX - 90, 215, 160, 30, 'INVENTORY', () => {
            this.toggleMenuModal(false);
            this.scene.start('LoadingScene', { targetScene: 'InventoryScene' });
        });
        const btnShop = this._createModalRectBtn(CX + 90, 215, 160, 30, 'SHOP', () => {});

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
        const cBackdrop = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.8).setInteractive();
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
}
