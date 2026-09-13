import Phaser from 'phaser';
import { THEME } from '../main.js';
import { playGlobalBGM } from '../utils/audioManager.js';
import { checkSession, saveCurrentScene, clearSession, getPlayerId } from '../utils/auth.js';
import PartyApi from '../services/PartyApi.js';
import { CameraScrollManager } from '../utils/cameraScroll.js';
import TopMenuComponent from '../ui/TopMenuComponent.js';

// Element icons are loaded as PNGs in preload

const W = 480, H = 880, CX = 240;

export default class InventoryScene extends Phaser.Scene {
    constructor() {
        super({ key: 'InventoryScene' });
    }

    init(data) {
        this.fromParty = data?.fromParty || false;
    }

    preload() {
        this.load.image('element_fire', 'assets/icons/elements/fire.png');
        this.load.image('element_wind', 'assets/icons/elements/wind.png');
        this.load.image('element_earth', 'assets/icons/elements/rock.png');
    }

    create() {
        if (!checkSession(this)) return;
        saveCurrentScene(this.scene.key);
        playGlobalBGM(this, 'main_menu');

        this.playerId = getPlayerId();
        this.currentTab = 'Characters'; // Characters, Weapons, Materials
        this.sortBy = localStorage.getItem('inventory_sort') || 'Level'; // Level, ATK, HP, Rarity
        this.displayMode = localStorage.getItem('inventory_view') || 'ATK/HP'; // ATK/HP, Level/LB, Skills

        this.characters = [];
        this.weapons = [];
        this.materials = [];

        // Background
        this.add.rectangle(0, 0, W, H, THEME.BG).setOrigin(0);

        // Header Fixed
        const headerBg = this.add.rectangle(0, 0, W, 60, THEME.BG, 1).setOrigin(0).setScrollFactor(0).setDepth(1000);
        headerBg.setStrokeStyle(1, THEME.BORDER);
        this.add.text(CX, 30, 'INVENTORY', { fontSize: '16px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY, letterSpacing: 1 }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

        const backBtn = this.add.circle(40, 30, 18, THEME.PANEL, 1).setScrollFactor(0).setDepth(1000);
        backBtn.setStrokeStyle(1, THEME.BORDER);
        backBtn.setInteractive({ useHandCursor: true });
        const homeTxt = this.add.text(40, 30, 'HOME', { fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
        backBtn.on('pointerover', () => { backBtn.setFillStyle(0x334155); homeTxt.setColor('#ffffff'); });
        backBtn.on('pointerout', () => { backBtn.setFillStyle(THEME.PANEL); homeTxt.setColor(THEME.TEXT_PRIMARY); });
        backBtn.on('pointerdown', () => {
            this.scene.start('LoadingScene', { targetScene: 'MainMenuScene' });
        });

        this.topMenu = new TopMenuComponent(this);

        this.modalGroup = this.add.group();
        this.uiGroup = this.add.group();
        this.scrollGroup = this.add.group();

        this.loadingText = this.add.text(CX, H / 2, 'Loading Inventory...', { fontSize: '14px', color: THEME.TEXT_MUTED, fontFamily: 'Outfit' }).setOrigin(0.5);

        this.currentPage = 1;
        this.itemsPerPage = 20; // 4x5 grid with pagination

        this.loadData();
    }

    async loadData() {
        const res = await PartyApi.getInventory(this.playerId);
        const presetsRes = await PartyApi.getPresets(this.playerId);

        if (res.status === 'success') {
            this.characters = res.data.characters || [];
            this.weapons = res.data.weapons || [];
            this.materials = res.data.materials || [];

            this.equippedItemIds = new Set();
            if (presetsRes.status === 'success' && presetsRes.data) {
                const activePreset = presetsRes.data.find(p => p.is_active) || presetsRes.data[0];
                if (activePreset) {
                    const keys = [
                        'main_char_inv_id', 'char_slot_1_inv_id', 'char_slot_2_inv_id', 'char_slot_3_inv_id',
                        'weap_grid_1_inv_id', 'weap_grid_2_inv_id', 'weap_grid_3_inv_id', 'weap_grid_4_inv_id', 'weap_grid_5_inv_id'
                    ];
                    keys.forEach(k => {
                        if (activePreset[k]) this.equippedItemIds.add(activePreset[k]);
                    });
                }
            }

            // Dynamically load missing character square portraits and weapon landscape images
            let assetsToLoad = 0;
            this.characters.forEach(char => {
                const path = char.mc_square_path;
                if (path && !this.textures.exists(`char_sq_${char.mc_id}`)) {
                    let fullPath = path;
                    if (!fullPath.endsWith('.png') && !fullPath.endsWith('.jpg')) fullPath += '.png';
                    this.load.image(`char_sq_${char.mc_id}`, fullPath);
                    assetsToLoad++;
                }
            });

            this.weapons.forEach(weap => {
                const path = weap.mw_img_path;
                if (path && !this.textures.exists(`weap_img_${weap.mw_id}`)) {
                    let fullPath = path;
                    if (!fullPath.endsWith('.png') && !fullPath.endsWith('.jpg')) fullPath += '.png';
                    this.load.image(`weap_img_${weap.mw_id}`, fullPath);
                    assetsToLoad++;
                }
            });

            if (assetsToLoad > 0) {
                this.load.once('complete', () => {
                    this.loadingText.destroy();
                    this.renderUI();
                });
                this.load.start();
            } else {
                this.loadingText.destroy();
                this.renderUI();
            }
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

        // Section 2: Container Background for List (Drawn FIRST to avoid covering UI)
        // gridBgH akan menyesuaikan jumlah baris nantinya, kita hapus background kaku ini atau buat transparan
        // karena kita mau adaptive scroll. Atau biarkan saja karena THEME.BG sudah mengisi layar belakang.

        // --- Tabs (Section 1) ---
        const tabs = ['Characters', 'Weapons', 'Materials'];
        const tabW = 140; // Wider tabs to fit the screen

        tabs.forEach((tab, i) => {
            const isSel = this.currentTab === tab;
            const tx = (CX - 144) + i * 144;
            const ty = 90; // Moved up to give more space

            const g = this.add.graphics();
            g.fillStyle(isSel ? 0x1e293b : THEME.BG, 1);

            // Draw custom tab shape (rounded top only), symmetrically centered around ty
            g.lineStyle(1, isSel ? 0x334155 : THEME.BORDER, 1);
            g.beginPath();
            g.moveTo(tx - tabW / 2, ty + 15); // Bottom left
            g.lineTo(tx - tabW / 2, ty - 15); // Top left
            g.lineTo(tx + tabW / 2, ty - 15); // Top right
            g.lineTo(tx + tabW / 2, ty + 15); // Bottom right

            // If selected, we don't draw the bottom border so it blends seamlessly
            if (!isSel) {
                g.lineTo(tx - tabW / 2, ty + 15);
            }
            g.fillPath();
            g.strokePath();

            g.setScrollFactor(0);
            this.uiGroup.add(g);

            const z = this.add.zone(tx, ty, tabW, 30).setInteractive({ useHandCursor: true }).setScrollFactor(0);
            z.on('pointerdown', () => {
                this.currentTab = tab;
                this.currentPage = 1;
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
            // Sort Button
            const sortBtnBg = this.add.rectangle(120, 150, 140, 26, THEME.PANEL, 1).setScrollFactor(0);
            sortBtnBg.setStrokeStyle(1, THEME.BORDER);
            const sortZone = this.add.zone(120, 150, 140, 26).setInteractive({ useHandCursor: true }).setScrollFactor(0);
            const sortTxt = this.add.text(120, 150, `SORT: ${this.sortBy}`, { fontSize: '11px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0);

            sortZone.on('pointerover', () => sortBtnBg.setFillStyle(0x334155));
            sortZone.on('pointerout', () => sortBtnBg.setFillStyle(THEME.PANEL));
            sortZone.on('pointerdown', () => {
                const s = ['Level', 'ATK', 'HP', 'Rarity'];
                this.sortBy = s[(s.indexOf(this.sortBy) + 1) % s.length];
                localStorage.setItem('inventory_sort', this.sortBy);
                this.renderUI();
            });
            this.uiGroup.addMultiple([sortBtnBg, sortZone, sortTxt]);

            // Display Toggle Button
            const dispBtnBg = this.add.rectangle(W - 120, 150, 140, 26, THEME.PANEL, 1).setScrollFactor(0);
            dispBtnBg.setStrokeStyle(1, THEME.BORDER);
            const dispZone = this.add.zone(W - 120, 150, 140, 26).setInteractive({ useHandCursor: true }).setScrollFactor(0);
            const effMode = (this.currentTab === 'Characters' && this.displayMode === 'Skills') ? 'ATK/HP' : (this.displayMode || 'ATK/HP');
            const dispTxt = this.add.text(W - 120, 150, `VIEW: ${effMode}`, { fontSize: '11px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0);

            dispZone.on('pointerover', () => dispBtnBg.setFillStyle(0x334155));
            dispZone.on('pointerout', () => dispBtnBg.setFillStyle(THEME.PANEL));
            dispZone.on('pointerdown', () => {
                let modes = ['ATK/HP', 'Level/LB', 'Skills'];
                if (this.currentTab === 'Characters') {
                    modes = ['ATK/HP', 'Level/LB'];
                }
                this.displayMode = modes[(modes.indexOf(effMode) + 1) % modes.length];
                localStorage.setItem('inventory_view', this.displayMode);
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
        let boxW = 84;
        let boxH = 100;
        let paddingX = 12;
        let paddingY = 10;

        if (this.currentTab === 'Characters') {
            boxW = 85;
            boxH = 135;
        } else if (this.currentTab === 'Weapons') {
            boxW = 84;
            boxH = 100;
        }

        const gridW = (cols * boxW) + ((cols - 1) * paddingX);
        const startX = (W - gridW) / 2 + (boxW / 2);
        let startYGrid = this.currentTab === 'Materials' ? 140 : 200;
        let bottomY = startYGrid;

        // Pagination Logic
        const itemsPerPage = this.currentTab === 'Characters' ? 16 : this.itemsPerPage;
        const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
        const startIndex = (this.currentPage - 1) * itemsPerPage;
        const pagedItems = items.slice(startIndex, startIndex + itemsPerPage);

        pagedItems.forEach((item, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);

            const ix = startX + col * (boxW + paddingX);
            const iy = startYGrid + row * (boxH + paddingY) + (boxH / 2);
            bottomY = Math.max(bottomY, iy + boxH / 2);

            let color = THEME.BORDER;
            if (this.currentTab !== 'Materials') {
                const rarity = isWeapon ? item.mw_rarity : item.mc_rarity;
                if (rarity === 'SSR') color = 0xffd700; // Gold
                else if (rarity === 'SR') color = 0xa855f7; // Purple
                else if (rarity === 'R') color = 0xef4444; // Red
            }

            const cardBg = this.add.graphics();
            cardBg.fillStyle(THEME.PANEL, 1);
            cardBg.lineStyle(2, THEME.BORDER);
            cardBg.fillRoundedRect(ix - boxW / 2, iy - boxH / 2, boxW, boxH, 8);
            cardBg.strokeRoundedRect(ix - boxW / 2, iy - boxH / 2, boxW, boxH, 8);
            this.scrollGroup.add(cardBg);

            // Click Zone
            const zone = this.add.zone(ix, iy, boxW, boxH).setInteractive({ useHandCursor: true });
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
                this.scrollGroup.add(this.add.text(ix, iy - 15, "📦", { fontSize: "32px" }).setOrigin(0.5));
                this.scrollGroup.add(this.add.text(ix, iy + 20, item.mat_name.substring(0, 10), { fontSize: '10px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));
                this.scrollGroup.add(this.add.text(ix, iy + 35, `x${item.quantity}`, { fontSize: '12px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
            } else {
                const artH = isWeapon ? boxH * 0.45 : boxW - 8;
                const yTop = iy - boxH / 2;

                const artBg = this.add.graphics();
                artBg.fillStyle(THEME.BG, 1);

                if (isWeapon) {
                    const weapKey = `weap_img_${item.mw_id}`;
                    if (this.textures.exists(weapKey)) {
                        const weapImg = this.add.image(ix, yTop + 4 + artH / 2, weapKey).setDisplaySize(boxW - 8, artH);
                        weapImg.setAlpha(1, 1, 0.4, 0.4);
                        const maskShape = this.make.graphics();
                        maskShape.fillStyle(0xffffff);
                        maskShape.fillRoundedRect(ix - boxW / 2 + 4, yTop + 4, boxW - 8, artH, 6);
                        weapImg.setMask(maskShape.createGeometryMask());
                        this.scrollGroup.add(weapImg);
                    } else {
                        artBg.fillRoundedRect(ix - boxW / 2 + 4, yTop + 4, boxW - 8, artH, 6);
                        this.scrollGroup.add(artBg);
                    }

                    const border = this.add.graphics();
                    border.lineStyle(1, color);
                    border.strokeRoundedRect(ix - boxW / 2 + 4, yTop + 4, boxW - 8, artH, 6);
                    this.scrollGroup.add(border);
                } else {
                    const pSize = boxW - 8;
                    const sqKey = `char_sq_${item.mc_id}`;
                    if (this.textures.exists(sqKey)) {
                        const portrait = this.add.image(ix, yTop + 4 + pSize / 2, sqKey).setDisplaySize(pSize, pSize);
                        portrait.setAlpha(1, 1, 0.25, 0.25);
                        const maskShape = this.make.graphics();
                        maskShape.fillStyle(0xffffff);
                        maskShape.fillRoundedRect(ix - pSize / 2, yTop + 4, pSize, pSize, 4);
                        portrait.setMask(maskShape.createGeometryMask());
                        this.scrollGroup.add(portrait);
                    } else {
                        artBg.fillRoundedRect(ix - pSize / 2, yTop + 4, pSize, pSize, 4);
                        this.scrollGroup.add(artBg);
                    }

                    const border = this.add.graphics();
                    border.lineStyle(1, color);
                    border.strokeRoundedRect(ix - pSize / 2, yTop + 4, pSize, pSize, 4);
                    this.scrollGroup.add(border);
                }

                const hasWeapImg = isWeapon && this.textures.exists(`weap_img_${item.mw_id}`);
                if (!hasWeapImg) {
                    const itemName = isWeapon ? item.mw_name : item.mc_name;
                    const nameY = isWeapon ? (yTop + 4 + artH / 2) : (yTop + 4 + artH + 10);
                    this.scrollGroup.add(this.add.text(ix, nameY, itemName.split(' ')[0], { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold', stroke: isWeapon ? '#000' : null, strokeThickness: isWeapon ? 2 : 0 }).setOrigin(0.5));
                }

                const element = isWeapon ? item.mw_element : item.mc_element;
                const elColor = this.getElementColor(element);
                const elKey = element ? `element_${element.toLowerCase()}` : '';

                // ELEMENT Indicator
                const elX = isWeapon ? (ix + boxW / 2 - 10) : (ix + (boxW - 8) / 2 - 8);
                const elY = isWeapon ? (yTop + 10) : (yTop + 4 + 8);
                if (this.textures.exists(elKey)) {
                    const iconImg = this.add.image(elX, elY, elKey).setDisplaySize(14, 14);
                    const shape = this.make.graphics();
                    shape.fillCircle(elX, elY, 7);
                    iconImg.setMask(shape.createGeometryMask());
                    const strokeCircle = this.add.circle(elX, elY, 7).setStrokeStyle(1, THEME.PANEL);
                    this.scrollGroup.addMultiple([iconImg, strokeCircle]);
                } else {
                    const elCircle = this.add.circle(elX, elY, 7, elColor).setStrokeStyle(1, THEME.PANEL);
                    const elLetter = element ? element.charAt(0).toUpperCase() : '?';
                    const elTxt = this.add.text(elX, elY, elLetter, { fontSize: '9px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
                    this.scrollGroup.addMultiple([elCircle, elTxt]);
                }

                // EQUIPPED Indicator
                if (this.equippedItemIds && this.equippedItemIds.has(item.inv_id)) {
                    const eX = isWeapon ? (ix - boxW / 2 + 10) : (ix - (boxW - 8) / 2 + 8);
                    const eY = isWeapon ? (yTop + 10) : (yTop + 4 + 8);
                    const eBg = this.add.circle(eX, eY, 7, 0x3b82f6).setStrokeStyle(1, THEME.PANEL);
                    const eTxt = this.add.text(eX, eY, 'E', { fontSize: '9px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
                    this.scrollGroup.addMultiple([eBg, eTxt]);
                }

                // RARITY Indicator
                const itemRarity = isWeapon ? item.mw_rarity : item.mc_rarity;
                let rColor = '#ffffff';
                if (itemRarity === 'SSR') rColor = '#ffd700';
                else if (itemRarity === 'SR') rColor = '#a855f7';
                else if (itemRarity === 'R') rColor = '#ef4444';

                if (itemRarity) {
                    const rX = isWeapon ? (ix - boxW / 2 + 6) : (ix - (boxW - 8) / 2 + 4);
                    const rY = yTop + 4 + artH + (isWeapon ? -2 : -2);
                    const rTxt = this.add.text(rX, rY, itemRarity, { fontSize: '9px', color: rColor, fontStyle: 'bold', stroke: '#000000', strokeThickness: 2, fontFamily: 'Outfit' }).setOrigin(0, 1);
                    this.scrollGroup.add(rTxt);
                }

                // Display Info below art box
                const effMode = (this.currentTab === 'Characters' && this.displayMode === 'Skills') ? 'ATK/HP' : this.displayMode;
                const stat1Y = isWeapon ? (iy + 12) : (yTop + 4 + artH + 24);
                const stat2Y = isWeapon ? (iy + 30) : (yTop + 4 + artH + 38);

                if (effMode === 'Level/LB') {
                    this.scrollGroup.add(this.add.text(ix, stat1Y, `Lv: ${item.item_level}`, { fontSize: '10px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
                    this.scrollGroup.add(this.add.text(ix, stat2Y, `LB: ${item.limit_break_level}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));
                } else if (effMode === 'Skills') {
                    const skills = (item.skills || []).filter(s => s.ms_category === 'Passive');
                    skills.slice(0, 2).forEach((skill, i) => {
                        const sx = ix + (i === 0 && skills.length > 1 ? -15 : (i === 1 ? 15 : 0));
                        const sy = isWeapon ? (iy + 20) : (yTop + 4 + artH + 30);

                        const isLocked = (item.item_level < skill.unlock_level) || (item.limit_break_level < skill.unlock_limit_break);
                        const sBox = this.add.graphics().fillStyle(isLocked ? 0x555555 : 0x458B74, 1).fillRoundedRect(sx - 10, sy - 10, 20, 20, 4);
                        const sZone = this.add.zone(sx, sy, 20, 20).setInteractive({ useHandCursor: true });
                        sZone.on('pointerdown', (ptr, lx, ly, ev) => {
                            ev.stopPropagation();
                            this.showSkillReadOnlyModal(skill, isLocked);
                        });

                        this.scrollGroup.addMultiple([sBox, sZone]);
                        this.scrollGroup.add(this.add.text(sx, sy, 'P', { fontSize: '10px', color: isLocked ? '#999' : '#fff' }).setOrigin(0.5));
                    });
                    if (skills.length === 0) {
                        this.scrollGroup.add(this.add.text(ix, isWeapon ? (iy + 20) : (yTop + 4 + artH + 30), 'No Passives', { fontSize: '9px', color: THEME.TEXT_MUTED }).setOrigin(0.5));
                    }
                } else {
                    const atk = this.calculateBaseStat(item, 'atk', isWeapon);
                    const hp = this.calculateBaseStat(item, 'hp', isWeapon);
                    this.scrollGroup.add(this.add.text(ix, stat1Y, `ATK: ${atk}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));
                    this.scrollGroup.add(this.add.text(ix, stat2Y, `HP:  ${hp}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));
                }
            }
        });

        // --- Pagination Controls ---
        const pageY = 790; // shifted down to fit 4x4 characters

        // Prev Button
        const prevActive = this.currentPage > 1;
        const prevBtn = this.add.rectangle(CX - 80, pageY, 60, 25, prevActive ? 0x1e293b : 0x0f172a).setStrokeStyle(1, THEME.BORDER);
        const prevTxt = this.add.text(CX - 80, pageY, '< PREV', { fontSize: '10px', fontStyle: 'bold', color: prevActive ? '#ffffff' : THEME.TEXT_MUTED }).setOrigin(0.5);
        if (prevActive) {
            prevBtn.setInteractive({ useHandCursor: true });
            prevBtn.on('pointerdown', () => {
                this.currentPage--;
                this.renderUI();
            });
            prevBtn.on('pointerover', () => prevBtn.setFillStyle(0x334155));
            prevBtn.on('pointerout', () => prevBtn.setFillStyle(0x1e293b));
        }

        // Page Info
        const pageTxt = this.add.text(CX, pageY, `${this.currentPage} / ${totalPages}`, { fontSize: '14px', fontFamily: 'Outfit', fontStyle: 'bold', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        this.scrollGroup.add(pageTxt);

        // Next Button
        const nextActive = this.currentPage < totalPages;
        const nextBtn = this.add.rectangle(CX + 80, pageY, 60, 25, nextActive ? 0x1e293b : 0x0f172a).setStrokeStyle(1, THEME.BORDER);
        const nextTxt = this.add.text(CX + 80, pageY, 'NEXT >', { fontSize: '10px', fontStyle: 'bold', color: nextActive ? '#ffffff' : THEME.TEXT_MUTED }).setOrigin(0.5);
        if (nextActive) {
            nextBtn.setInteractive({ useHandCursor: true });
            nextBtn.on('pointerdown', () => {
                this.currentPage++;
                this.renderUI();
            });
            nextBtn.on('pointerover', () => nextBtn.setFillStyle(0x334155));
            nextBtn.on('pointerout', () => nextBtn.setFillStyle(0x1e293b));
        }

        this.scrollGroup.addMultiple([prevBtn, prevTxt, nextBtn, nextTxt]);

        // Enable Camera Scroll
        CameraScrollManager.enable(this, bottomY + 100);
    }

}
