import Phaser from 'phaser';
import { THEME } from '../main.js';
import { playGlobalBGM } from '../utils/audioManager.js';
import { checkSession, saveCurrentScene, clearSession, getPlayerId } from '../utils/auth.js';
import PartyApi from '../services/PartyApi.js';
import { CameraScrollManager } from '../utils/cameraScroll.js';

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

        // MENU Button
        const menuBtn = this.add.circle(W - 40, 30, 18, THEME.PANEL, 1).setScrollFactor(0).setDepth(1000);
        menuBtn.setStrokeStyle(1, THEME.BORDER);
        menuBtn.setInteractive({ useHandCursor: true });
        const menuText = this.add.text(W - 40, 30, 'MENU', { fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

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

        if (this.currentTab !== 'Materials') {
            cols = 4;
            boxW = 84;
            boxH = 100; // Portrait ratio
            paddingX = 12;
            paddingY = 10;
        }

        const gridW = (cols * boxW) + ((cols - 1) * paddingX);
        const startX = (W - gridW) / 2 + (boxW / 2);
        let startYGrid = this.currentTab === 'Materials' ? 140 : 200;
        let bottomY = startYGrid;

        // Pagination Logic
        const totalPages = Math.max(1, Math.ceil(items.length / this.itemsPerPage));
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const pagedItems = items.slice(startIndex, startIndex + this.itemsPerPage);

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
                else if (rarity === 'SR') color = 0xc0c0c0; // Silver
                else if (rarity === 'R') color = 0xcd7f32; // Bronze
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
                // Character / Weapon Custom Layout
                // Art Placeholder (Top 45%)
                const artH = boxH * 0.45;
                const artBg = this.add.graphics();
                artBg.fillStyle(THEME.BG, 1);
                artBg.lineStyle(1, color);
                artBg.fillRoundedRect(ix - boxW / 2 + 4, iy - boxH / 2 + 4, boxW - 8, artH, 6);
                artBg.strokeRoundedRect(ix - boxW / 2 + 4, iy - boxH / 2 + 4, boxW - 8, artH, 6);
                this.scrollGroup.add(artBg);

                const itemName = isWeapon ? item.mw_name : item.mc_name;
                this.scrollGroup.add(this.add.text(ix, iy - boxH / 2 + 4 + artH / 2, itemName.split(' ')[0], { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));

                const element = isWeapon ? item.mw_element : item.mc_element;
                const elColor = this.getElementColor(element);
                const elKey = element ? `element_${element.toLowerCase()}` : '';

                // ELEMENT Indicator at top right
                if (this.textures.exists(elKey)) {
                    const iconImg = this.add.image(ix + boxW / 2 - 10, iy - boxH / 2 + 10, elKey).setDisplaySize(14, 14);
                    const shape = this.make.graphics();
                    shape.fillCircle(ix + boxW / 2 - 10, iy - boxH / 2 + 10, 7);
                    iconImg.setMask(shape.createGeometryMask());

                    // Stroke overlay
                    const strokeCircle = this.add.circle(ix + boxW / 2 - 10, iy - boxH / 2 + 10, 7).setStrokeStyle(1, THEME.PANEL);
                    this.scrollGroup.addMultiple([iconImg, strokeCircle]);
                } else {
                    const elCircle = this.add.circle(ix + boxW / 2 - 10, iy - boxH / 2 + 10, 7, elColor).setStrokeStyle(1, THEME.PANEL);
                    const elLetter = element ? element.charAt(0).toUpperCase() : '?';
                    const elTxt = this.add.text(ix + boxW / 2 - 10, iy - boxH / 2 + 10, elLetter, { fontSize: '9px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
                    this.scrollGroup.addMultiple([elCircle, elTxt]);
                }

                // EQUIPPED Indicator at top left
                if (this.equippedItemIds && this.equippedItemIds.has(item.inv_id)) {
                    const eBg = this.add.circle(ix - boxW / 2 + 10, iy - boxH / 2 + 10, 7, 0x3b82f6).setStrokeStyle(1, THEME.PANEL);
                    const eTxt = this.add.text(ix - boxW / 2 + 10, iy - boxH / 2 + 10, 'E', { fontSize: '9px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
                    this.scrollGroup.addMultiple([eBg, eTxt]);
                }

                // RARITY Indicator at bottom left of art
                const itemRarity = isWeapon ? item.mw_rarity : item.mc_rarity;
                let rColor = '#ffffff';
                if (itemRarity === 'SSR') rColor = '#ffd700'; // Gold
                else if (itemRarity === 'SR') rColor = '#c0c0c0'; // Silver
                else if (itemRarity === 'R') rColor = '#cd7f32'; // Bronze

                if (itemRarity) {
                    const rTxt = this.add.text(ix - boxW / 2 + 6, iy - boxH / 2 + artH + 5, itemRarity, { fontSize: '9px', color: rColor, fontStyle: 'bold', stroke: '#000000', strokeThickness: 2, fontFamily: 'Outfit' }).setOrigin(0, 1);
                    this.scrollGroup.add(rTxt);
                }

                // Display Info below art box
                const effMode = (this.currentTab === 'Characters' && this.displayMode === 'Skills') ? 'ATK/HP' : this.displayMode;

                if (effMode === 'Level/LB') {
                    this.scrollGroup.add(this.add.text(ix, iy + 12, `Lv: ${item.item_level}`, { fontSize: '10px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
                    this.scrollGroup.add(this.add.text(ix, iy + 30, `LB: ${item.limit_break_level}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));
                } else if (effMode === 'Skills') {
                    const skills = (item.skills || []).filter(s => s.ms_category === 'Passive');
                    skills.slice(0, 2).forEach((skill, i) => {
                        const sx = ix + (i === 0 && skills.length > 1 ? -15 : (i === 1 ? 15 : 0));
                        const sy = iy + 20;

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
                        this.scrollGroup.add(this.add.text(ix, iy + 20, 'No Passives', { fontSize: '9px', color: THEME.TEXT_MUTED }).setOrigin(0.5));
                    }
                } else {
                    const atk = this.calculateBaseStat(item, 'atk', isWeapon);
                    const hp = this.calculateBaseStat(item, 'hp', isWeapon);
                    this.scrollGroup.add(this.add.text(ix, iy + 12, `ATK: ${atk}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));
                    this.scrollGroup.add(this.add.text(ix, iy + 30, `HP:  ${hp}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));
                }
            }
        });

        // --- Pagination Controls ---
        const pageY = 765; // perfectly centered vertically in the bottom padding space

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

    _buildMenuModal() {
        this.menuContainer = this.add.container(0, 0).setDepth(2000).setVisible(false).setScrollFactor(0);

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

        const closeBtnCircle = this.add.circle(W - 40, 30, 18, THEME.PANEL, 1);
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

        this.confirmContainer = this.add.container(0, 0).setDepth(2100).setVisible(false).setScrollFactor(0);
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

    showSkillReadOnlyModal(skill, isLocked) {
        const container = this.add.container(0, 0).setDepth(200);

        const bg = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.8).setInteractive();
        container.add(bg);
        bg.on('pointerdown', () => container.destroy());

        const CY = H / 2;
        const mBox = this.add.graphics().fillStyle(THEME.PANEL, 1).lineStyle(1, 0x475569).fillRoundedRect(20, CY - 60, W - 40, 100, 4).strokeRoundedRect(20, CY - 60, W - 40, 100, 4);
        container.add(mBox);

        // Icon
        const iconColor = skill.ms_category === 'Special' ? 0xd97706 : 0x4f46e5;
        const iconBox = this.add.graphics().fillStyle(iconColor, 1).fillRoundedRect(35, CY - 45, 45, 45, 8);
        const init = skill.ms_name.substring(0, 2).toUpperCase();
        const iconTxt = this.add.text(57, CY - 22, init, { fontSize: '16px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

        container.add([iconBox, iconTxt]);

        if (isLocked) {
            const lockBox = this.add.graphics().fillStyle(0x000000, 0.6).fillRoundedRect(35, CY - 45, 45, 45, 8);
            const lockTxt = this.add.text(57, CY - 22, '🔒', { fontSize: '16px' }).setOrigin(0.5);
            container.add([lockBox, lockTxt]);
        }

        const titleColor = isLocked ? THEME.TEXT_MUTED : (skill.ms_category === 'Special' ? THEME.GOLD : '#60a5fa');
        container.add(this.add.text(95, CY - 45, skill.ms_name, { fontSize: '14px', color: titleColor, fontStyle: 'bold' }));

        // Cooldown (Hide for Passive skills)
        if (skill.ms_category !== 'Passive') {
            container.add(this.add.text(W - 35, CY - 45, `CD: ${skill.ms_cooldown}T`, { fontSize: '10px', color: THEME.TEXT_MUTED }).setOrigin(1, 0));
        }

        // Desc
        container.add(this.add.text(95, CY - 20, skill.ms_desc, { fontSize: '11px', color: '#ffffff', wordWrap: { width: W - 140 }, lineSpacing: 4 }));

        if (isLocked) {
            const warningBox = this.add.graphics().fillStyle(0x000000, 0.8).lineStyle(1, THEME.DANGER).fillRoundedRect(20, CY + 50, W - 40, 40, 4).strokeRoundedRect(20, CY + 50, W - 40, 40, 4);
            const warningTxt = this.add.text(CX, CY + 70, `🔒 Syarat Level: ${skill.unlock_level}  |  Syarat LB: ${skill.unlock_limit_break}`, { fontSize: '12px', color: THEME.GOLD, fontStyle: 'bold' }).setOrigin(0.5);
            container.add([warningBox, warningTxt]);
        }
    }

    toggleMenuModal(show) {
        this.menuContainer.setVisible(show);
        if (show) this.updateAudioButtonVisuals();
    }

    toggleMusic() {
        this.musicOn = !this.musicOn;
        localStorage.setItem('music_on', this.musicOn);
        this.updateAudioButtonVisuals();
        if (window.AetheriaAudioManager) window.AetheriaAudioManager.updateMuteState(this);
    }

    toggleSfx() {
        this.sfxOn = !this.sfxOn;
        localStorage.setItem('sfx_on', this.sfxOn);
        this.updateAudioButtonVisuals();
        if (window.AetheriaAudioManager) window.AetheriaAudioManager.updateMuteState(this);
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
