import Phaser from 'phaser';
import { THEME } from '../main.js';
import { checkSession, saveCurrentScene, clearSession, getPlayerId } from '../utils/auth.js';
import PartyApi from '../services/PartyApi.js';

import fireRaw from '../../assets/icons/elements/fire.svg?raw';
import windRaw from '../../assets/icons/elements/wind.svg?raw';
import earthRaw from '../../assets/icons/elements/rock.svg?raw';

const W = 450, H = 800, CX = 225;

export default class CharacterDetailScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CharacterDetailScene' });
    }

    init(data) {
        this.targetData = data || {};
        this.char = data.item;
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
        if (this.char.mc_id === 1) return 20;
        if (this.char.mc_rarity === 'SSR') return 60;
        if (this.char.mc_rarity === 'SR') return 50;
        return 1;
    }

    calculateBaseStat(statType) {
        const level = this.char.item_level || 1;
        if (statType === 'hp') return this.char.mc_base_hp + (this.char.mc_hp_growth * (level - 1));
        if (statType === 'atk') return this.char.mc_base_atk + (this.char.mc_atk_growth * (level - 1));
        return 0;
    }

    renderUI() {
        this.scrollGroup.clear(true, true);
        const char = this.char;
        let cy = 0;

        // Header Fixed
        const headerBg = this.add.rectangle(0, 0, W, 60, 0x0a0f1d).setOrigin(0).setScrollFactor(0).setDepth(50);
        headerBg.setStrokeStyle(1, THEME.BORDER);
        this.add.text(CX, 30, 'CHARACTER DETAIL', { fontSize: '16px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY, letterSpacing: 1 }).setOrigin(0.5).setScrollFactor(0).setDepth(50);

        const backBtn = this.add.circle(40, 30, 18, THEME.PANEL, THEME.PANEL_ALPHA).setScrollFactor(0).setDepth(50);
        backBtn.setStrokeStyle(1, THEME.BORDER);
        backBtn.setInteractive({ useHandCursor: true });
        this.add.text(40, 30, '←', { fontSize: '16px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5).setScrollFactor(0).setDepth(50);
        backBtn.on('pointerdown', () => {
            if (this.fromParty) {
                this.scene.start('LoadingScene', { targetScene: 'PartyScene', targetData: { partyState: this.partyState } });
            } else {
                this.scene.start('LoadingScene', { targetScene: 'InventoryScene' });
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

        cy += 70;

        // BANNER
        const color = this.getElementColor(char.mc_element);
        const bannerW = W - 60; // Added padding
        const banner = this.add.rectangle(CX, cy + 60, bannerW, 120, THEME.PANEL).setStrokeStyle(1, THEME.BORDER);
        this.scrollGroup.add(banner);

        // Name & Rarity
        this.scrollGroup.add(this.add.text(CX - bannerW / 2 + 20, cy + 20, `[${char.mc_rarity}] ${char.mc_name}`, { fontSize: '18px', color: '#fff', fontStyle: 'bold' }).setOrigin(0, 0.5));

        // Element Logo at top right
        const elKey = char.mc_element ? `element_${char.mc_element.toLowerCase()}` : '';
        const elX = CX + bannerW / 2 - 20;
        const elY = cy + 20;

        if (this.textures.exists(elKey)) {
            const iconImg = this.add.image(elX, elY, elKey).setDisplaySize(24, 24);
            const shape = this.make.graphics();
            shape.fillCircle(elX, elY, 12);
            iconImg.setMask(shape.createGeometryMask());

            const strokeCircle = this.add.circle(elX, elY, 12).setStrokeStyle(1, THEME.PANEL);
            this.scrollGroup.addMultiple([iconImg, strokeCircle]);
        } else {
            const elCircle = this.add.circle(elX, elY, 12, color).setStrokeStyle(1, THEME.PANEL);
            const elLetter = char.mc_element ? char.mc_element.charAt(0).toUpperCase() : '?';
            const elTxt = this.add.text(elX, elY, elLetter, { fontSize: '14px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
            this.scrollGroup.addMultiple([elCircle, elTxt]);
        }

        // Element & Level
        const maxLevel = this.calculateMaxLevel();
        this.scrollGroup.add(this.add.text(CX - bannerW / 2 + 20, cy + 50, `Element: ${char.mc_element}`, { fontSize: '13px', color: color, fontStyle: 'bold' }).setOrigin(0, 0.5));
        this.scrollGroup.add(this.add.text(CX - bannerW / 2 + 20, cy + 70, `Lv ${char.item_level} / ${maxLevel}`, { fontSize: '14px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0, 0.5));

        // Stats
        const atk = this.calculateBaseStat('atk');
        const hp = this.calculateBaseStat('hp');
        this.scrollGroup.add(this.add.text(CX + bannerW / 2 - 20, cy + 50, `ATK: ${atk}`, { fontSize: '14px', color: THEME.DAMAGE, fontStyle: 'bold' }).setOrigin(1, 0.5));
        this.scrollGroup.add(this.add.text(CX + bannerW / 2 - 20, cy + 70, `HP:  ${hp}`, { fontSize: '14px', color: THEME.HEALTH, fontStyle: 'bold' }).setOrigin(1, 0.5));

        cy += 140;

        // ACTION BUTTONS
        const btnW = 160;

        // Upgrade Btn
        const upgZone = this.add.zone(120, cy + 20, btnW, 40).setInteractive({ useHandCursor: true });
        const upgBg = this.add.rectangle(120, cy + 20, btnW, 40, THEME.PANEL).setStrokeStyle(1, 0x10b981);
        upgZone.on('pointerdown', () => this.showUpgradeModal());
        this.scrollGroup.addMultiple([upgBg, upgZone, this.add.text(120, cy + 20, 'UPGRADE', { fontSize: '14px', color: '#10b981', fontStyle: 'bold' }).setOrigin(0.5)]);

        // Uncap Btn
        const uncapZone = this.add.zone(W - 120, cy + 20, btnW, 40).setInteractive({ useHandCursor: true });
        const uncapBg = this.add.rectangle(W - 120, cy + 20, btnW, 40, THEME.PANEL).setStrokeStyle(1, 0x3b82f6);
        uncapZone.on('pointerdown', () => this.showLimitBreakModal());
        this.scrollGroup.addMultiple([uncapBg, uncapZone, this.add.text(W - 120, cy + 20, 'UNCAP', { fontSize: '14px', color: '#3b82f6', fontStyle: 'bold' }).setOrigin(0.5)]);

        cy += 70;

        const specialSkill = char.skills ? char.skills.find(s => s.ms_category === 'Special') : null;
        const activeSkills = char.skills ? char.skills.filter(s => s.ms_category !== 'Special') : [];

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
        this.scrollGroup.add(this.add.text(CX, cy, 'SKILLS', { fontSize: '12px', color: THEME.TEXT_MUTED, letterSpacing: 2 }).setOrigin(0.5));
        cy += 20;

        if (activeSkills.length > 0) {
            activeSkills.forEach((skill, i) => {
                const isLocked = (char.item_level < skill.unlock_level) || (char.limit_break_level < skill.unlock_limit_break);

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
                    this.scrollGroup.add(this.add.text(W - 35, cy + 20, `CD: ${skill.ms_cooldown}T`, { fontSize: '11px', color: THEME.TEXT_MUTED }).setOrigin(1, 0.5));

                    // Actual Description from Database
                    const desc = skill.ms_desc || `[${skill.ms_action_type}] Target: ${skill.ms_target_type}`;
                    this.scrollGroup.add(this.add.text(35, cy + 35, desc, { 
                        fontSize: '11px', 
                        color: THEME.TEXT_PRIMARY,
                        wordWrap: { width: W - 70, useAdvancedWrap: true }
                    }).setOrigin(0, 0));

                    const btnAuto = this.add.rectangle(W - 60, cy + 65, 80, 24, 0x0f172a).setStrokeStyle(1, 0x06b6d4);
                    this.scrollGroup.add(btnAuto);
                    this.scrollGroup.add(this.add.text(W - 60, cy + 65, 'Full Auto', { fontSize: '10px', color: '#06b6d4', fontStyle: 'bold' }).setOrigin(0.5));
                }

                cy += boxH + 15;
            });
        } else {
            this.scrollGroup.add(this.add.text(CX, cy + 30, 'Tidak ada skill aktif.', { fontSize: '12px', color: THEME.TEXT_MUTED }).setOrigin(0.5));
            cy += 60;
        }

        this.cameras.main.setBounds(0, 0, W, Math.max(H, cy + 50));
    }

    async showUpgradeModal() {
        const char = this.char;
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

        const closeBtn = this.add.text(W - 40, CY - 130, '✖', { fontSize: '20px', color: THEME.TEXT_MUTED }).setOrigin(0.5).setInteractive({useHandCursor:true});
        closeBtn.on('pointerdown', () => this.modalGroup.clear(true, true));
        this.modalGroup.add(closeBtn);

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
                
                // Enhance Crystal is mat_id = 4
                const crystal = materials.find(m => m.mat_id === 4);
                const crystalCount = crystal ? crystal.quantity : 0;
                
                this.modalGroup.add(this.add.text(CX, CY - 90, `${char.mc_name}`, { fontSize: '14px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));
                this.modalGroup.add(this.add.text(CX, CY - 70, `Level: ${char.item_level}`, { fontSize: '14px', color: '#f59e0b', fontStyle: 'bold' }).setOrigin(0.5));

                this.modalGroup.add(this.add.text(40, CY - 30, 'Enhance Crystal:', { fontSize: '12px', color: THEME.TEXT_MUTED }).setOrigin(0, 0.5));
                this.modalGroup.add(this.add.text(W - 40, CY - 30, `${crystalCount} dimilikii`, { fontSize: '12px', color: THEME.TEXT_PRIMARY }).setOrigin(1, 0.5));

                let qty = 1;
                const costPerItem = 50;
                
                const qtyText = this.add.text(CX, CY + 20, `${qty}`, { fontSize: '24px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
                
                const minusBtn = this.add.text(CX - 50, CY + 20, '-', { fontSize: '24px', color: THEME.TEXT_PRIMARY, backgroundColor: '#334155', padding: { x: 10, y: 5 } }).setOrigin(0.5).setInteractive({useHandCursor:true});
                const plusBtn = this.add.text(CX + 50, CY + 20, '+', { fontSize: '24px', color: THEME.TEXT_PRIMARY, backgroundColor: '#334155', padding: { x: 10, y: 5 } }).setOrigin(0.5).setInteractive({useHandCursor:true});
                
                const costText = this.add.text(CX, CY + 70, `Biaya: ${qty * costPerItem} Gold`, { fontSize: '12px', color: '#f59e0b' }).setOrigin(0.5);
                const goldText = this.add.text(CX, CY + 90, `Gold Anda: ${gold}`, { fontSize: '11px', color: THEME.TEXT_MUTED }).setOrigin(0.5);

                const updateQty = (delta) => {
                    qty += delta;
                    if (qty < 1) qty = 1;
                    if (qty > crystalCount) qty = crystalCount > 0 ? crystalCount : 1;
                    qtyText.setText(`${qty}`);
                    costText.setText(`Biaya: ${qty * costPerItem} Gold`);
                };

                minusBtn.on('pointerdown', () => updateQty(-1));
                plusBtn.on('pointerdown', () => updateQty(1));
                plusBtn.on('pointerdown', () => updateQty(10)); // just for easier testing, let's keep it simple

                // A better approach for plus 10
                const plus10Btn = this.add.text(CX + 100, CY + 20, '+10', { fontSize: '16px', color: THEME.TEXT_PRIMARY, backgroundColor: '#334155', padding: { x: 5, y: 5 } }).setOrigin(0.5).setInteractive({useHandCursor:true});
                plus10Btn.on('pointerdown', () => updateQty(10));

                const minus10Btn = this.add.text(CX - 100, CY + 20, '-10', { fontSize: '16px', color: THEME.TEXT_PRIMARY, backgroundColor: '#334155', padding: { x: 5, y: 5 } }).setOrigin(0.5).setInteractive({useHandCursor:true});
                minus10Btn.on('pointerdown', () => updateQty(-10));

                this.modalGroup.addMultiple([qtyText, minusBtn, plusBtn, plus10Btn, minus10Btn, costText, goldText]);

                // Enhance Button
                const btnW = 200;
                const enhZone = this.add.zone(CX, CY + 130, btnW, 40).setInteractive({useHandCursor:true});
                const enhBg = this.add.rectangle(CX, CY + 130, btnW, 40, THEME.PANEL).setStrokeStyle(1, 0x10b981);
                const enhTxt = this.add.text(CX, CY + 130, 'ENHANCE', { fontSize: '14px', color: '#10b981', fontStyle: 'bold' }).setOrigin(0.5);

                enhZone.on('pointerover', () => enhBg.setFillStyle(0x064e3b));
                enhZone.on('pointerout', () => enhBg.setFillStyle(THEME.PANEL));
                enhZone.on('pointerdown', async () => {
                    if (crystalCount < qty) {
                        alert('Enhance Crystal tidak cukup!');
                        return;
                    }
                    if (gold < qty * costPerItem) {
                        alert('Gold tidak cukup!');
                        return;
                    }

                    enhTxt.setText('UPGRADING...');
                    try {
                        const upgRes = await fetch(`http://localhost:3000/api/party/${playerId}/upgrade`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                invId: char.inv_id,
                                itemType: 'Character',
                                quantity: qty,
                                materialId: 4
                            })
                        });
                        const upgData = await upgRes.json();

                        if (upgData.status === 'success') {
                            alert(`Upgrade Berhasil! Level Baru: ${upgData.data.new_level}`);
                            // We should really refresh the UI, but simplest is to reload the whole scene
                            this.scene.start('LoadingScene', { targetScene: 'InventoryScene' }); // Or maybe just refresh details?
                        } else {
                            alert(upgData.message || 'Upgrade gagal');
                            enhTxt.setText('ENHANCE');
                        }
                    } catch (e) {
                        console.error(e);
                        alert('Terjadi kesalahan jaringan.');
                        enhTxt.setText('ENHANCE');
                    }
                });

                this.modalGroup.addMultiple([enhBg, enhZone, enhTxt]);

            } else {
                this.modalGroup.add(this.add.text(CX, CY, 'Gagal memuat data inventory.', { fontSize: '12px', color: THEME.DANGER }).setOrigin(0.5));
            }

        } catch (e) {
            console.error(e);
            this.modalGroup.add(this.add.text(CX, CY, 'Terjadi kesalahan jaringan.', { fontSize: '12px', color: THEME.DANGER }).setOrigin(0.5));
        }
    }

    showLimitBreakModal() {
        const char = this.char;
        this.modalGroup.clear(true, true);
        const bg = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.9).setInteractive();
        this.modalGroup.add(bg);

        const mBox = this.add.graphics().fillStyle(THEME.PANEL, 1).lineStyle(2, 0x3b82f6).fillRoundedRect(40, 250, W - 80, 250, 12).strokeRoundedRect(40, 250, W - 80, 250, 12);
        this.modalGroup.add(mBox);

        this.modalGroup.add(this.add.text(CX, 280, 'LIMIT BREAK (UNCAP)', { fontSize: '16px', color: '#3b82f6', fontStyle: 'bold' }).setOrigin(0.5));
        this.modalGroup.add(this.add.text(CX, 305, `${char.mc_name} (LB ${char.limit_break_level} ➔ LB ${char.limit_break_level + 1})`, { fontSize: '14px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));

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

            const res = await PartyApi.limitBreak(this.playerId, char.inv_id);
            if (res.status === 'success') {
                this.modalGroup.clear(true, true);
                alert('Limit Break Berhasil! Status karakter diperbarui.');
                // Update local data to reflect LB
                this.char.limit_break_level += 1;
                this.renderUI();
            } else {
                alert(res.message);
                this.modalGroup.clear(true, true);
            }
        });
        this.modalGroup.addMultiple([confirmBg, confirmZone, this.add.text(310, 440, 'Confirm', { fontSize: '12px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5)]);
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
