import Phaser from 'phaser';
import { THEME } from '../main.js';
import { checkSession, getPlayerId, saveCurrentScene, clearSession } from '../utils/auth.js';
import PartyApi from '../services/PartyApi.js';

const W = 450, H = 800, CX = 225;
const COLOR_SSR = 0xffd700, COLOR_SR = 0xc0c0c0, COLOR_R = 0xcd7f32, COLOR_EMPTY = 0x334155;

export default class PartyScene extends Phaser.Scene {
    constructor() { super('PartyScene'); }

    init(data) {
        this.targetData = data || {};
    }

    async create() {
        if (!checkSession(this)) return;
        saveCurrentScene(this.scene.key);
        this.playerId = getPlayerId();

        this.add.rectangle(CX, H / 2, W, H, THEME.BG);

        // Top Bar
        this.add.rectangle(CX, 30, W, 60, THEME.PANEL, THEME.PANEL_ALPHA).setStrokeStyle(1, THEME.BORDER);
        this.add.text(CX, 30, 'PARTY SETTINGS', { fontSize: '15px', fontStyle: 'bold', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit', letterSpacing: 2 }).setOrigin(0.5);
        
        const backBtn = this.add.circle(40, 30, 18, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        const homeTxt = this.add.text(40, 30, 'HOME', { fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        backBtn.on('pointerover', () => { backBtn.setFillStyle(0x334155); homeTxt.setColor('#ffffff'); });
        backBtn.on('pointerout', () => { backBtn.setFillStyle(THEME.PANEL); homeTxt.setColor(THEME.TEXT_PRIMARY); });
        backBtn.on('pointerdown', () => this.scene.start('LoadingScene', { targetScene: 'MainMenuScene' }));

        // Pojok kanan atas: Bulat bertulisan MENU
        const menuBtn = this.add.circle(W - 40, 30, 18, THEME.PANEL, THEME.PANEL_ALPHA);
        menuBtn.setStrokeStyle(1, THEME.BORDER);
        menuBtn.setInteractive({ useHandCursor: true });

        const menuText = this.add.text(W - 40, 30, 'MENU', {
            fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY
        }).setOrigin(0.5);

        menuBtn.on('pointerover', () => {
            menuBtn.setFillStyle(0x334155);
            menuText.setColor('#ffffff');
        });
        menuBtn.on('pointerout', () => {
            menuBtn.setFillStyle(THEME.PANEL);
            menuText.setColor(THEME.TEXT_PRIMARY);
        });
        menuBtn.on('pointerdown', () => {
            this.toggleMenuModal(true);
        });

        this.musicOn = localStorage.getItem('music_on') !== 'false';
        this.sfxOn = localStorage.getItem('sfx_on') !== 'false';
        this._buildMenuModal();

        this.loadingText = this.add.text(CX, H / 2, 'Loading Data...', { fontSize: '14px', color: THEME.TEXT_MUTED, fontFamily: 'Outfit' }).setOrigin(0.5);

        this.uiGroup = this.add.group();
        this.modalGroup = this.add.group();
        this.currentSlot = 1;
        this.currentTab = 'Characters'; // 'Characters' or 'Weapons'

        if (this.targetData && this.targetData.partyState) {
            this.currentSlot = this.targetData.partyState.currentSlot || 1;
            this.currentTab = this.targetData.partyState.currentTab || 'Characters';
        }

        await this.loadData();
    }

    async loadData() {
        const presetsRes = await PartyApi.getPresets(this.playerId);
        const invRes = await PartyApi.getInventory(this.playerId);
        const skillsRes = await PartyApi.getMcSkills(this.playerId);

        if (presetsRes.status !== 'success' || invRes.status !== 'success' || skillsRes.status !== 'success') {
            this.loadingText.setText('Failed to load data. Please refresh.');
            return;
        }

        this.loadingText.destroy();
        this.presets = presetsRes.data;
        this.characters = invRes.data.characters;
        this.weapons = invRes.data.weapons;
        this.mcSkills = skillsRes.data;

        // Setup 5 local slots
        this.localPresets = [];
        // Force MC to always be present and valid
        const mcChar = this.characters.find(c => c.mc_id === 1);
        const actualMcInvId = mcChar ? mcChar.inv_id : null;

        for (let i = 1; i <= 5; i++) {
            const existing = this.presets.find(p => p.preset_slot === i);
            if (existing) {
                const presetCopy = JSON.parse(JSON.stringify(existing));
                if (actualMcInvId) presetCopy.main_char_inv_id = actualMcInvId;
                this.localPresets.push(presetCopy);
            } else {
                this.localPresets.push({
                    preset_slot: i,
                    main_char_inv_id: actualMcInvId,
                    char_slot_1_inv_id: null,
                    char_slot_2_inv_id: null,
                    char_slot_3_inv_id: null,
                    weap_grid_1_inv_id: null,
                    weap_grid_2_inv_id: null,
                    weap_grid_3_inv_id: null,
                    weap_grid_4_inv_id: null,
                    weap_grid_5_inv_id: null,
                    mc_skills: []
                });
            }
        }

        this.renderUI();

        if (this.targetData && this.targetData.openMcSkillManager) {
            this.showMcSkillsManagerModal();
        }
    }

    getElementColor(element) {
        if (!element) return THEME.BORDER;
        const el = element.toLowerCase();
        if (el === 'fire') return 0xef4444;
        if (el === 'wind') return 0x10b981;
        if (el === 'earth') return 0xd97706;
        if (el === 'water') return 0x3b82f6;
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

    getPartyTotalStats(preset) {
        let totalHp = 0;
        let totalAtk = 0;

        const charIds = [preset.main_char_inv_id, preset.char_slot_1_inv_id, preset.char_slot_2_inv_id, preset.char_slot_3_inv_id];
        charIds.forEach(id => {
            if (id) {
                const c = this.characters.find(x => x.inv_id === id);
                if (c) {
                    totalHp += this.calculateBaseStat(c, 'hp', false);
                    totalAtk += this.calculateBaseStat(c, 'atk', false);
                }
            }
        });

        const weapIds = [preset.weap_grid_1_inv_id, preset.weap_grid_2_inv_id, preset.weap_grid_3_inv_id, preset.weap_grid_4_inv_id, preset.weap_grid_5_inv_id];
        weapIds.forEach(id => {
            if (id) {
                const w = this.weapons.find(x => x.inv_id === id);
                if (w) {
                    totalHp += this.calculateBaseStat(w, 'hp', true);
                    totalAtk += this.calculateBaseStat(w, 'atk', true);
                }
            }
        });

        return { totalHp: Math.floor(totalHp), totalAtk: Math.floor(totalAtk) };
    }

    drawRoundedBox(x, y, w, h, radius, color, strokeColor=null, alpha=1) {
        const g = this.add.graphics();
        g.fillStyle(color, alpha);
        if (strokeColor !== null) {
            g.lineStyle(2, strokeColor, 1);
        }
        g.fillRoundedRect(x - w/2, y - h/2, w, h, radius);
        if (strokeColor !== null) {
            g.strokeRoundedRect(x - w/2, y - h/2, w, h, radius);
        }
        this.uiGroup.add(g);
        return g;
    }

    renderUI() {
        this.uiGroup.clear(true, true);
        const preset = this.localPresets[this.currentSlot - 1];
        const stats = this.getPartyTotalStats(preset);

        // --- Tabs Preset 1-5 ---
        for (let i = 1; i <= 5; i++) {
            const isSel = (i === this.currentSlot);
            const tabX = 50 + (i - 1) * 85;
            const tabColor = isSel ? 0x475569 : THEME.PANEL; // Lighter blue for active
            this.drawRoundedBox(tabX, 85, 75, 30, 8, tabColor, isSel ? 0xffffff : THEME.BORDER, 1);
            
            const zone = this.add.zone(tabX, 85, 75, 30).setInteractive({useHandCursor: true});
            zone.on('pointerdown', () => { this.currentSlot = i; this.renderUI(); });
            this.uiGroup.add(zone);

            this.uiGroup.add(this.add.text(tabX, 85, `Set ${i}`, { fontSize: '12px', color: isSel ? '#ffffff' : THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));
        }

        // --- MC Container (Always Visible) ---
        this.renderMC(preset);

        // --- Secondary Tabs (Characters / Weapons) ---
        const tabCharActive = this.currentTab === 'Characters';
        const charTabColor = tabCharActive ? 0x475569 : THEME.PANEL;
        this.drawRoundedBox(130, 240, 160, 30, 6, charTabColor, tabCharActive ? 0xffffff : THEME.BORDER);
        const zChar = this.add.zone(130, 240, 160, 30).setInteractive({useHandCursor:true});
        zChar.on('pointerdown', () => { this.currentTab = 'Characters'; this.renderUI(); });
        this.uiGroup.addMultiple([zChar, this.add.text(130, 240, 'CHARACTERS', { fontSize: '12px', color: tabCharActive ? '#fff' : THEME.TEXT_MUTED, fontStyle: 'bold' }).setOrigin(0.5)]);

        const tabWeapActive = this.currentTab === 'Weapons';
        const weapTabColor = tabWeapActive ? 0x475569 : THEME.PANEL;
        this.drawRoundedBox(320, 240, 160, 30, 6, weapTabColor, tabWeapActive ? 0xffffff : THEME.BORDER);
        const zWeap = this.add.zone(320, 240, 160, 30).setInteractive({useHandCursor:true});
        zWeap.on('pointerdown', () => { this.currentTab = 'Weapons'; this.renderUI(); });
        this.uiGroup.addMultiple([zWeap, this.add.text(320, 240, 'WEAPONS GRID', { fontSize: '12px', color: tabWeapActive ? '#fff' : THEME.TEXT_MUTED, fontStyle: 'bold' }).setOrigin(0.5)]);

        // --- Content Area ---
        if (tabCharActive) {
            this.renderCharacters(preset);
        } else {
            this.renderWeapons(preset);
        }

        // --- Party Stats (Moved to bottom) ---
        const power = stats.totalAtk + stats.totalHp;
        this.uiGroup.add(this.add.text(CX, 660, `TOTAL ATK: ${stats.totalAtk}   |   TOTAL HP: ${stats.totalHp}`, { fontSize: '11px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5));
        this.uiGroup.add(this.add.text(CX, 680, `PARTY POWER: ${power}`, { fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5));

        // --- Bottom Actions ---
        const autoZone = this.add.zone(CX, 725, 200, 40).setInteractive({useHandCursor: true});
        this.drawRoundedBox(CX, 725, 200, 40, 8, THEME.PANEL, THEME.AETHER);
        autoZone.on('pointerdown', () => this.showAutoSelectElementModal());
        this.uiGroup.addMultiple([autoZone, this.add.text(CX, 725, 'AUTO SELECT', { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5)]);
    }

    renderMC(preset) {
        const invId = preset.main_char_inv_id;
        const char = this.characters.find(c => c.inv_id === invId);
        const strokeColor = char ? this.getElementColor(char.mc_element) : COLOR_EMPTY;
        const cy = 160;

        // Container Main Box
        this.drawRoundedBox(CX, cy, W - 40, 95, 12, THEME.PANEL, strokeColor);

        // Left Portrait
        this.drawRoundedBox(70, cy, 70, 75, 8, THEME.BG);
        this.uiGroup.add(this.add.text(70, cy, 'MC', { fontSize: '18px', color: THEME.TEXT_MUTED, fontStyle:'bold' }).setOrigin(0.5));

        if (char) {
            const hp = this.calculateBaseStat(char, 'hp', false);
            const atk = this.calculateBaseStat(char, 'atk', false);
            
            const raw = localStorage.getItem('aetheria_player');
            const playerData = raw ? JSON.parse(raw) : null;
            const mcName = (playerData && playerData.username) ? playerData.username : char.mc_name;

            this.uiGroup.add(this.add.text(120, cy - 25, `Lv ${char.item_level} - ${mcName}`, { fontSize: '14px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0, 0.5));
            this.uiGroup.add(this.add.text(120, cy - 2, `ATK: ${atk}  |  HP: ${hp}`, { fontSize: '12px', color: THEME.TEXT_MUTED }).setOrigin(0, 0.5));
        }

        // INFO Button (!) at top right
        const infoCircle = this.add.circle(CX + (W-40)/2 - 20, cy - 25, 12, THEME.PANEL).setStrokeStyle(1, THEME.BORDER);
        const infoZone = this.add.zone(CX + (W-40)/2 - 20, cy - 25, 24, 24).setInteractive({useHandCursor: true});
        const infoTxt = this.add.text(CX + (W-40)/2 - 20, cy - 25, '!', { fontSize: '14px', color: THEME.TEXT_MUTED, fontStyle: 'bold' }).setOrigin(0.5);
        
        infoZone.on('pointerover', () => { infoCircle.setFillStyle(0x334155); infoTxt.setColor('#fff'); });
        infoZone.on('pointerout', () => { infoCircle.setFillStyle(THEME.PANEL); infoTxt.setColor(THEME.TEXT_MUTED); });
        infoZone.on('pointerdown', () => {
            const partyState = { currentSlot: this.currentSlot, currentTab: this.currentTab };
            this.scene.start('LoadingScene', { targetScene: 'CharacterDetailScene', targetData: { item: char, isWeapon: false, fromParty: true, partyState } });
        });
        
        // Change Skills Button
        const btnZone = this.add.zone(170, cy + 23, 100, 26).setInteractive({useHandCursor:true});
        this.drawRoundedBox(170, cy + 23, 100, 26, 4, 0x458B74, null); // HEALTH color
        btnZone.on('pointerdown', () => this.showMcSkillsManagerModal());
        
        this.uiGroup.addMultiple([infoCircle, infoTxt, infoZone, btnZone, this.add.text(170, cy + 23, 'Change Skills', { fontSize: '11px', color: '#fff', fontStyle:'bold' }).setOrigin(0.5)]);
    }

    renderCharacters(preset) {
        const slots = [
            { id: 'char_slot_1_inv_id', y: 340 },
            { id: 'char_slot_2_inv_id', y: 450 },
            { id: 'char_slot_3_inv_id', y: 560 }
        ];

        slots.forEach(slot => {
            const invId = preset[slot.id];
            const char = this.characters.find(c => c.inv_id === invId);
            const strokeColor = char ? this.getElementColor(char.mc_element) : COLOR_EMPTY;

            // Container Main Box
            this.drawRoundedBox(CX, slot.y, W - 40, 100, 12, THEME.PANEL, strokeColor);
                // Party Slot Setup
                const portZone = this.add.zone(70, slot.y, 70, 80).setInteractive({useHandCursor:true});
                this.drawRoundedBox(70, slot.y, 70, 80, 8, THEME.BG, null);
                portZone.on('pointerdown', () => {
                    this.tweens.add({ targets: portZone, scale: 0.9, yoyo: true, duration: 100 });
                    this.showItemSelectionModal('Character', slot.id);
                });
                this.uiGroup.add(portZone);

                // INFO Button (!) at top right
                if (char) {
                    const infoCircle = this.add.circle(CX + (W-40)/2 - 20, slot.y - 30, 12, THEME.PANEL).setStrokeStyle(1, THEME.BORDER);
                    const infoZone = this.add.zone(CX + (W-40)/2 - 20, slot.y - 30, 24, 24).setInteractive({useHandCursor: true});
                    const infoTxt = this.add.text(CX + (W-40)/2 - 20, slot.y - 30, '!', { fontSize: '14px', color: THEME.TEXT_MUTED, fontStyle: 'bold' }).setOrigin(0.5);
                    
                    infoZone.on('pointerover', () => { infoCircle.setFillStyle(0x334155); infoTxt.setColor('#fff'); });
                    infoZone.on('pointerout', () => { infoCircle.setFillStyle(THEME.PANEL); infoTxt.setColor(THEME.TEXT_MUTED); });
                    infoZone.on('pointerdown', () => {
                        const partyState = { currentSlot: this.currentSlot, currentTab: this.currentTab };
                        this.scene.start('LoadingScene', { targetScene: 'CharacterDetailScene', targetData: { item: char, isWeapon: false, fromParty: true, partyState } });
                    });
                    
                    this.uiGroup.addMultiple([infoCircle, infoTxt, infoZone]);
                }

                if (char) {
                    this.uiGroup.add(this.add.text(70, slot.y, char.mc_name.split(' ')[0], { fontSize: '11px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));
                    
                    const hp = this.calculateBaseStat(char, 'hp', false);
                    const atk = this.calculateBaseStat(char, 'atk', false);
                    this.uiGroup.add(this.add.text(120, slot.y - 30, `Lv ${char.item_level} - ${char.mc_name}`, { fontSize: '14px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }));
                    this.uiGroup.add(this.add.text(120, slot.y - 10, `ATK: ${atk}  |  HP: ${hp}`, { fontSize: '11px', color: THEME.TEXT_MUTED }));

                    // Skills Rendering
                    const skills = [...(char.skills || [])].sort((a,b) => {
                        if (a.ms_category === 'Special') return -1;
                        if (b.ms_category === 'Special') return 1;
                        return a.unlock_level - b.unlock_level;
                    });
                    const hasSpecial = skills.some(s => s.ms_category === 'Special');

                    skills.slice(0, 4).forEach((skill, i) => {
                        const isSpecial = skill.ms_category === 'Special';
                        const offset = (!isSpecial && hasSpecial) ? 10 : 0;
                        const sx = 135 + (i * 32) + offset;
                        const sy = slot.y + 20;
                        const isLocked = (skill.unlock_level > 0 && char.item_level < skill.unlock_level) || (skill.unlock_limit_break > 0 && char.limit_break_level < skill.unlock_limit_break);
                        
                        const sBox = this.add.graphics().fillStyle(isLocked ? 0x555555 : THEME.AETHER, 1).fillRoundedRect(sx-14, sy-14, 28, 28, 4);
                        const sZone = this.add.zone(sx, sy, 28, 28).setInteractive({useHandCursor:true});
                        sZone.on('pointerdown', () => this.showSkillReadOnlyModal(skill, isLocked));
                        
                        this.uiGroup.addMultiple([sBox, sZone]);
                        const init = skill.ms_name.substring(0, 2).toUpperCase();
                        this.uiGroup.add(this.add.text(sx, sy, init, { fontSize: '9px', color: isLocked ? '#999' : '#fff' }).setOrigin(0.5));
                        
                        if (isLocked) {
                            this.uiGroup.add(this.add.text(sx, sy - 8, '🔒', { fontSize: '10px' }).setOrigin(0.5));
                        }
                    });

                } else {
                    this.uiGroup.add(this.add.text(70, slot.y, '+', { fontSize: '24px', color: THEME.TEXT_MUTED }).setOrigin(0.5));
                    this.uiGroup.add(this.add.text(120, slot.y, 'Tap to assign character...', { fontSize: '14px', color: THEME.TEXT_MUTED, fontStyle: 'italic' }).setOrigin(0, 0.5));
                }
        });
    }

    renderWeapons(preset) {
        // Weapon Grid: 1 Main Hand (Center), 4 Sub (Corners)
        // Scaled down to look like a rune grid with proper gaps
        const wSlots = [
            { id: 'weap_grid_1_inv_id', x: CX, y: 470, w: 110, h: 150, isMain: true },
            { id: 'weap_grid_2_inv_id', x: 115, y: 370, w: 85, h: 115, isMain: false },
            { id: 'weap_grid_3_inv_id', x: W - 115, y: 370, w: 85, h: 115, isMain: false },
            { id: 'weap_grid_4_inv_id', x: 115, y: 570, w: 85, h: 115, isMain: false },
            { id: 'weap_grid_5_inv_id', x: W - 115, y: 570, w: 85, h: 115, isMain: false },
        ];

        wSlots.forEach(slot => {
            const invId = preset[slot.id];
            const weap = this.weapons.find(w => w.inv_id === invId);
            const strokeColor = weap ? this.getElementColor(weap.mw_element) : 0x475569;

            this.drawRoundedBox(slot.x, slot.y, slot.w, slot.h, 10, THEME.PANEL, strokeColor);
            const z = this.add.zone(slot.x, slot.y, slot.w, slot.h).setInteractive({useHandCursor:true});
            z.on('pointerdown', () => this.showItemSelectionModal('Weapon', slot.id));
            this.uiGroup.add(z);

            if (weap) {
                // Top 50% for Weapon Art Placeholder
                const artH = slot.h * 0.5;
                this.drawRoundedBox(slot.x, slot.y - (slot.h/2) + (artH/2) + 5, slot.w - 10, artH, 6, THEME.BG, null);
                this.uiGroup.add(this.add.text(slot.x, slot.y - (slot.h/2) + (artH/2) + 5, weap.mw_name.split(' ')[0], { fontSize: slot.isMain ? '12px' : '10px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));
                
                if (slot.isMain) {
                    const labelY = slot.y - (slot.h/2) - 12;
                    const bgMain = this.add.rectangle(slot.x, labelY, 84, 18, 0x0a0f1d).setStrokeStyle(1, 0xD4A017);
                    const txtMain = this.add.text(slot.x, labelY, 'MAIN WEAPON', { fontSize: '9px', color: '#D4A017', fontStyle: 'bold', fontFamily: 'Outfit' }).setOrigin(0.5);
                    this.uiGroup.addMultiple([bgMain, txtMain]);
                }

                // Middle Stats
                const atk = this.calculateBaseStat(weap, 'atk', true);
                const hp = this.calculateBaseStat(weap, 'hp', true);
                this.uiGroup.add(this.add.text(slot.x, slot.y + 15, `🗡️ ${atk}  |  ❤️ ${hp}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit' }).setOrigin(0.5));

                // Bottom Skills
                const skills = (weap.skills || []).filter(s => s.ms_category === 'Passive');
                skills.slice(0, 2).forEach((skill, i) => {
                    const sx = slot.x + (i===0 && skills.length>1 ? -15 : (i===1 ? 15 : 0));
                    const sy = slot.y + (slot.h/2) - 20;
                    
                    const isLocked = (weap.item_level < skill.unlock_level) || (weap.limit_break_level < skill.unlock_limit_break);
                    
                    const sBox = this.add.graphics().fillStyle(isLocked ? 0x555555 : 0x458B74, 1).fillRoundedRect(sx-10, sy-10, 20, 20, 4);
                    const sZone = this.add.zone(sx, sy, 20, 20).setInteractive({useHandCursor:true});
                    sZone.on('pointerdown', (ptr, lx, ly, ev) => { 
                        ev.stopPropagation(); // prevent opening weapon select
                        this.showSkillReadOnlyModal(skill, isLocked); 
                    });
                    
                    this.uiGroup.addMultiple([sBox, sZone]);
                    this.uiGroup.add(this.add.text(sx, sy, 'P', { fontSize: '10px', color: isLocked ? '#999' : '#fff' }).setOrigin(0.5));
                });

                // INFO Button (!) at top right (Rendered last so it sits on top)
                const infoCircle = this.add.circle(slot.x + slot.w/2 - 12, slot.y - slot.h/2 + 12, 10, THEME.PANEL).setStrokeStyle(1, THEME.BORDER);
                const infoZone = this.add.zone(slot.x + slot.w/2 - 12, slot.y - slot.h/2 + 12, 20, 20).setInteractive({useHandCursor: true});
                const infoTxt = this.add.text(slot.x + slot.w/2 - 12, slot.y - slot.h/2 + 12, '!', { fontSize: '12px', color: THEME.TEXT_MUTED, fontStyle: 'bold' }).setOrigin(0.5);
                
                infoZone.on('pointerover', () => { infoCircle.setFillStyle(0x334155); infoTxt.setColor('#fff'); });
                infoZone.on('pointerout', () => { infoCircle.setFillStyle(THEME.PANEL); infoTxt.setColor(THEME.TEXT_MUTED); });
                infoZone.on('pointerdown', (ptr, lx, ly, ev) => {
                    ev.stopPropagation(); // prevent opening weapon select
                    const partyState = { currentSlot: this.currentSlot, currentTab: this.currentTab };
                    this.scene.start('LoadingScene', { targetScene: 'WeaponDetailScene', targetData: { item: weap, isWeapon: true, fromParty: true, partyState } });
                });
                
                this.uiGroup.addMultiple([infoCircle, infoTxt, infoZone]);

            } else {
                this.uiGroup.add(this.add.text(slot.x, slot.y, '+', { fontSize: '24px', color: THEME.TEXT_MUTED }).setOrigin(0.5));
                if (slot.isMain) {
                    this.uiGroup.add(this.add.text(slot.x, slot.y - 25, 'MAIN', { fontSize: '10px', color: THEME.TEXT_MUTED, fontStyle: 'bold' }).setOrigin(0.5));
                }
            }
        });
    }

    showSkillReadOnlyModal(skill, isLocked) {
        const container = this.add.container(0, 0).setDepth(200);
        
        const bg = this.add.rectangle(CX, H/2, W, H, 0x000000, 0.8).setInteractive();
        container.add(bg);

        const CY = H / 2;
        
        let headerText = 'SKILL DETAIL';
        if (skill.ms_category === 'Special') headerText = 'SPECIAL ATTACK';
        else if (skill.ms_category === 'Active') headerText = 'ACTIVE SKILL';
        else if (skill.ms_category === 'Passive') headerText = 'PASSIVE SKILL';

        // Calculate height
        let modalH = 160;
        if (isLocked) modalH += 60;

        const modalBg = this.add.rectangle(CX, CY, W - 40, modalH, THEME.PANEL).setStrokeStyle(1, 0x3b82f6);
        container.add(modalBg);

        container.add(this.add.text(CX, CY - modalH/2 + 25, headerText, { fontSize: '16px', color: '#3b82f6', fontStyle: 'bold', letterSpacing: 1 }).setOrigin(0.5));

        // Skill Container bg
        const sBg = this.add.rectangle(CX, CY - modalH/2 + 75, W - 80, 50, 0x1e293b).setStrokeStyle(1, 0x334155);
        container.add(sBg);

        // Icon
        const iconColor = skill.ms_category === 'Special' ? 0xd97706 : (skill.ms_category === 'Passive' ? 0x10b981 : 0x4f46e5);
        const iconBox = this.add.graphics().fillStyle(iconColor, 1).fillRoundedRect(CX - (W - 80)/2 + 10, CY - modalH/2 + 55, 40, 40, 8);
        const init = skill.ms_name ? skill.ms_name.substring(0, 2).toUpperCase() : 'SK';
        const iconTxt = this.add.text(CX - (W - 80)/2 + 30, CY - modalH/2 + 75, init, { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

        container.add([iconBox, iconTxt]);

        if (isLocked) {
            const lockBox = this.add.graphics().fillStyle(0x000000, 0.6).fillRoundedRect(CX - (W - 80)/2 + 10, CY - modalH/2 + 55, 40, 40, 8);
            const lockTxt = this.add.text(CX - (W - 80)/2 + 30, CY - modalH/2 + 75, '🔒', { fontSize: '14px' }).setOrigin(0.5);
            container.add([lockBox, lockTxt]);
        }

        const titleColor = isLocked ? THEME.TEXT_MUTED : (skill.ms_category === 'Special' ? THEME.GOLD : '#60a5fa');
        container.add(this.add.text(CX - (W - 80)/2 + 60, CY - modalH/2 + 62, skill.ms_name || 'Unknown Skill', { fontSize: '13px', color: titleColor, fontStyle: 'bold' }).setOrigin(0, 0.5));
        
        container.add(this.add.text(CX - (W - 80)/2 + 60, CY - modalH/2 + 82, skill.ms_desc || '', { fontSize: '10px', color: '#ffffff', wordWrap: { width: W - 160 }, lineSpacing: 2 }).setOrigin(0, 0.5));

        // Cooldown (Hide for Passive skills)
        if (skill.ms_category !== 'Passive' && skill.ms_cooldown !== undefined) {
            container.add(this.add.text(CX + (W - 80)/2 - 10, CY - modalH/2 + 62, `CD: ${skill.ms_cooldown}T`, { fontSize: '10px', color: THEME.TEXT_MUTED }).setOrigin(1, 0.5));
        }

        if (isLocked) {
            const warningBox = this.add.graphics().fillStyle(0x000000, 0.8).lineStyle(1, THEME.DANGER).fillRoundedRect(CX - (W - 40)/2 + 20, CY - modalH/2 + 110, W - 80, 40, 4).strokeRoundedRect(CX - (W - 40)/2 + 20, CY - modalH/2 + 110, W - 80, 40, 4);
            const warningTxt = this.add.text(CX, CY - modalH/2 + 130, `🔒 Syarat Level: ${skill.unlock_level || '?'}  |  Syarat LB: ${skill.unlock_limit_break || '?'}`, { fontSize: '11px', color: THEME.GOLD, fontStyle: 'bold' }).setOrigin(0.5);
            container.add([warningBox, warningTxt]);
        }

        // OK Button at bottom
        const okBtn = this.add.rectangle(CX, CY + modalH/2 - 25, 100, 30, 0x1e293b).setStrokeStyle(1, 0x3b82f6).setInteractive({ useHandCursor: true });
        okBtn.on('pointerdown', () => container.destroy());
        container.add([
            okBtn,
            this.add.text(CX, CY + modalH/2 - 25, 'OK', { fontSize: '14px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5)
        ]);
    }

    showMcSkillsManagerModal() {
        this.modalGroup.clear(true, true);
        const bg = this.add.rectangle(CX, H/2, W, H, 0x000000, 0.9).setInteractive();
        this.modalGroup.add(bg);

        this.modalGroup.add(this.add.text(CX, 100, 'MC SKILLS MANAGER', { fontSize: '18px', color: '#fff', fontStyle: 'bold', fontFamily: 'Outfit' }).setOrigin(0.5));
        
        const closeBtn = this.add.text(W - 40, 100, 'X', { fontSize: '20px', color: '#fff' }).setOrigin(0.5).setInteractive({useHandCursor: true});
        closeBtn.on('pointerdown', () => { this.modalGroup.clear(true, true); this.renderUI(); });
        this.modalGroup.add(closeBtn);

        this.modalGroup.add(this.add.text(CX, 125, `Saved to Preset ${this.currentSlot}`, { fontSize: '11px', color: THEME.TEXT_MUTED, fontStyle: 'italic' }).setOrigin(0.5));

        const preset = this.localPresets[this.currentSlot - 1];
        
        for (let i = 0; i < 4; i++) {
            const y = 180 + i * 90;
            const skillObj = preset.mc_skills && preset.mc_skills[i];
            const skillData = skillObj ? this.mcSkills.find(s => s.ms_id === skillObj.ms_id) : null;

            const card = this.add.graphics().fillStyle(THEME.PANEL, 1).lineStyle(1, THEME.BORDER).fillRoundedRect(40, y-35, W-80, 70, 8).strokeRoundedRect(40, y-35, W-80, 70, 8);
            const zone = this.add.zone(CX, y, W-80, 70).setInteractive({useHandCursor:true});
            
            zone.on('pointerdown', () => this.showMcSkillSelectionList(i));
            this.modalGroup.addMultiple([card, zone]);

            this.modalGroup.add(this.add.text(60, y, `Slot ${i+1}`, { fontSize: '14px', color: THEME.TEXT_MUTED, fontStyle: 'bold' }).setOrigin(0, 0.5));

            if (skillData) {
                this.modalGroup.add(this.add.text(130, y-10, skillData.ms_name, { fontSize: '14px', color: THEME.GOLD, fontStyle: 'bold' }).setOrigin(0, 0.5));
                this.modalGroup.add(this.add.text(130, y+10, `CD: ${skillData.ms_cooldown}T | ${skillData.ms_action_type}`, { fontSize: '11px', color: THEME.TEXT_PRIMARY }).setOrigin(0, 0.5));
                
                // Fast unequip btn
                const unx = W - 70;
                const unBox = this.add.graphics().fillStyle(THEME.DANGER, 1).fillRoundedRect(unx-25, y-15, 50, 30, 6);
                const unZone = this.add.zone(unx, y, 50, 30).setInteractive({useHandCursor:true});
                unZone.on('pointerdown', (ptr, lx, ly, ev) => {
                    ev.stopPropagation();
                    preset.mc_skills[i] = null; // Fixed logic to preserve array structure
                    this.saveCurrentPreset();
                    this.showMcSkillsManagerModal(); // refresh
                });
                this.modalGroup.addMultiple([unBox, unZone, this.add.text(unx, y, 'Clear', { fontSize: '11px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5)]);
            } else {
                this.modalGroup.add(this.add.text(130, y, 'Tap to assign skill...', { fontSize: '12px', color: THEME.TEXT_MUTED, fontStyle: 'italic' }).setOrigin(0, 0.5));
            }
        }
    }

    showMcSkillSelectionList(slotIndex) {
        // Overlay on top of manager
        const listGroup = this.add.group();
        const bg = this.add.rectangle(CX, H/2, W, H, 0x000000, 0.95).setInteractive();
        listGroup.add(bg);

        listGroup.add(this.add.text(CX, 50, `Select Skill for Slot ${slotIndex+1}`, { fontSize: '16px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
        
        const closeBtn = this.add.text(W - 40, 50, 'Back', { fontSize: '14px', color: '#fff' }).setOrigin(0.5).setInteractive({useHandCursor: true});
        closeBtn.on('pointerdown', () => { listGroup.clear(true, true); });
        listGroup.add(closeBtn);

        let y = 100;
        
        // Filter out already equipped skills to avoid duplicates
        const preset = this.localPresets[this.currentSlot - 1];
        const equippedIds = (preset.mc_skills || []).map(s => s ? s.ms_id : null).filter(id => id);

        const availableSkills = this.mcSkills.filter(s => !equippedIds.includes(s.ms_id));

        const mcInvId = preset.main_char_inv_id;
        const mcChar = this.characters.find(c => c.inv_id === mcInvId);
        const mcLevel = mcChar ? mcChar.item_level : 1;
        const mcLb = mcChar ? mcChar.limit_break_level : 0;

        availableSkills.slice(0, 8).forEach(skill => {
            const isLocked = (mcLevel < skill.unlock_level) || (mcLb < skill.unlock_limit_break);

            const cardColor = isLocked ? 0x222222 : THEME.PANEL;
            const card = this.add.graphics().fillStyle(cardColor, 1).fillRoundedRect(30, y-30, W-60, 60, 8);
            const zone = this.add.zone(CX, y, W-60, 60).setInteractive({useHandCursor: true});
            
            zone.on('pointerdown', () => {
                if (isLocked) {
                    this.showSkillReadOnlyModal(skill, isLocked);
                } else {
                    if (!preset.mc_skills) preset.mc_skills = [];
                    preset.mc_skills[slotIndex] = { ms_id: skill.ms_id, slot_number: slotIndex+1 };
                    this.saveCurrentPreset();
                    listGroup.clear(true, true);
                    this.showMcSkillsManagerModal(); // return and refresh manager
                }
            });

            listGroup.addMultiple([card, zone]);

            if (isLocked) {
                listGroup.add(this.add.text(45, y-10, `🔒 ${skill.ms_name}`, { fontSize: '14px', color: THEME.TEXT_MUTED, fontStyle: 'bold' }).setOrigin(0, 0.5));
                listGroup.add(this.add.text(45, y+10, `Requires Lv ${skill.unlock_level} / LB ${skill.unlock_limit_break}`, { fontSize: '11px', color: THEME.DANGER }).setOrigin(0, 0.5));
            } else {
                listGroup.add(this.add.text(45, y-10, skill.ms_name, { fontSize: '14px', color: THEME.GOLD, fontStyle: 'bold' }).setOrigin(0, 0.5));
                listGroup.add(this.add.text(45, y+10, `${skill.ms_category} | ${skill.ms_action_type}`, { fontSize: '11px', color: '#ccc' }).setOrigin(0, 0.5));
            }

            listGroup.add(this.add.text(W-45, y-10, `CD: ${skill.ms_cooldown}T`, { fontSize: '10px', color: THEME.TEXT_MUTED }).setOrigin(1, 0.5));
            
            y += 70;
        });
    }

    showLimitBreakModal(char) {
        this.modalGroup.clear(true, true);
        const bg = this.add.rectangle(CX, H/2, W, H, 0x000000, 0.9).setInteractive();
        this.modalGroup.add(bg);

        const mBox = this.add.graphics().fillStyle(THEME.PANEL, 1).lineStyle(2, THEME.BORDER).fillRoundedRect(40, 250, W-80, 250, 12).strokeRoundedRect(40, 250, W-80, 250, 12);
        this.modalGroup.add(mBox);

        this.modalGroup.add(this.add.text(CX, 280, 'LIMIT BREAK', { fontSize: '18px', color: '#3b82f6', fontStyle: 'bold' }).setOrigin(0.5));
        this.modalGroup.add(this.add.text(CX, 305, `${char.mc_name} (LB ${char.limit_break_level} ➔ LB ${char.limit_break_level + 1})`, { fontSize: '14px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));

        this.modalGroup.add(this.add.text(CX, 340, 'Syarat Material:', { fontSize: '12px', color: THEME.TEXT_MUTED }).setOrigin(0.5));
        
        // This is a placeholder since we don't load char_lb_costs on frontend yet.
        // We will just show a confirmation text. The backend will validate.
        this.modalGroup.add(this.add.text(CX, 360, 'Operasi ini membutuhkan sejumlah Gold\ndan Material spesifik elemen.', { fontSize: '12px', color: THEME.TEXT_PRIMARY, align: 'center' }).setOrigin(0.5));
        
        const closeZone = this.add.zone(140, 440, 100, 40).setInteractive({useHandCursor:true});
        const closeBg = this.add.graphics().fillStyle(THEME.BG, 1).lineStyle(1, THEME.BORDER).fillRoundedRect(90, 420, 100, 40, 6).strokeRoundedRect(90, 420, 100, 40, 6);
        closeZone.on('pointerdown', () => this.modalGroup.clear(true, true));
        this.modalGroup.addMultiple([closeBg, closeZone, this.add.text(140, 440, 'Cancel', { fontSize: '12px', color: THEME.TEXT_MUTED }).setOrigin(0.5)]);

        const confirmZone = this.add.zone(310, 440, 100, 40).setInteractive({useHandCursor:true});
        const confirmBg = this.add.graphics().fillStyle(0x3b82f6, 1).fillRoundedRect(260, 420, 100, 40, 6);
        confirmZone.on('pointerdown', async () => {
            confirmZone.disableInteractive();
            this.modalGroup.add(this.add.text(CX, 390, 'Processing...', { fontSize: '12px', color: THEME.GOLD }).setOrigin(0.5));
            
            const res = await PartyApi.limitBreak(this.playerId, char.inv_id);
            if (res.status === 'success') {
                this.modalGroup.clear(true, true);
                
                if (res.data && res.data.new_skills_unlocked && res.data.new_skills_unlocked.length > 0) {
                    this.showSkillUnlockQueue(res.data.char_name, res.data.new_skills_unlocked, () => {
                        this.loadData();
                    });
                } else {
                    alert('Limit Break Berhasil!');
                    this.loadData(); // reload
                }
            } else {
                alert(res.message);
                this.modalGroup.clear(true, true);
            }
        });
        this.modalGroup.addMultiple([confirmBg, confirmZone, this.add.text(310, 440, 'Confirm', { fontSize: '12px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5)]);
    }

    showSkillUnlockQueue(charName, skillsArray, onComplete) {
        if (!skillsArray || skillsArray.length === 0) {
            if (onComplete) onComplete();
            return;
        }

        const skillName = skillsArray.shift();
        
        const modal = this.add.container(0, 0).setDepth(200);
        const overlay = this.add.rectangle(CX, H/2, W, H, 0x000000, 0.8).setInteractive();
        modal.add(overlay);

        const bg = this.add.rectangle(CX, H/2, 300, 220, THEME.BG, 1);
        bg.setStrokeStyle(2, 0x3b82f6);
        modal.add(bg);

        modal.add(this.add.text(CX, H/2 - 60, "SKILL UNLOCKED!", { fontSize: "18px", color: "#3b82f6", fontStyle: "bold", letterSpacing: 1 }).setOrigin(0.5));
        modal.add(this.add.text(CX, H/2 - 10, charName, { fontSize: "14px", color: THEME.TEXT_MUTED }).setOrigin(0.5));
        modal.add(this.add.text(CX, H/2 + 20, skillName, { fontSize: "22px", color: THEME.TEXT_PRIMARY, fontStyle: "bold" }).setOrigin(0.5));

        const btnBg = this.add.rectangle(CX, H/2 + 75, 120, 36, THEME.PANEL).setInteractive({useHandCursor:true});
        btnBg.setStrokeStyle(1, THEME.BORDER);
        modal.add(btnBg);

        modal.add(this.add.text(CX, H/2 + 75, "AWESOME!", { fontSize: "14px", color: "#3b82f6", fontStyle: "bold" }).setOrigin(0.5));

        modal.setScale(0.8);
        modal.setAlpha(0);
        this.tweens.add({ targets: modal, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });

        btnBg.on('pointerdown', () => {
            this.tweens.add({
                targets: modal, scale: 0.8, alpha: 0, duration: 200, ease: 'Power2',
                onComplete: () => {
                    modal.destroy();
                    this.showSkillUnlockQueue(charName, skillsArray, onComplete);
                }
            });
        });
    }

    showItemSelectionModal(type, slotId, page = 1, sortBy = null, displayMode = null) {
        sortBy = sortBy || localStorage.getItem('party_sort') || 'Level';
        displayMode = displayMode || localStorage.getItem('party_view') || 'ATK/HP';
        this.modalGroup.clear(true, true);
        const bg = this.add.rectangle(CX, H/2, W, H, 0x000000, 0.95).setInteractive();
        this.modalGroup.add(bg);

        this.modalGroup.add(this.add.text(CX, 50, `Select ${type}`, { fontSize: '18px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
        
        const closeBtn = this.add.text(W - 40, 50, 'X', { fontSize: '20px', color: '#fff' }).setOrigin(0.5).setInteractive({useHandCursor: true});
        closeBtn.on('pointerdown', () => this.modalGroup.clear(true, true));
        this.modalGroup.add(closeBtn);

        // Render unequip button
        const unequipZone = this.add.zone(CX, 95, 200, 32).setInteractive({useHandCursor: true});
        const unBg = this.add.graphics().fillStyle(THEME.DANGER, 1).fillRoundedRect(CX-100, 79, 200, 32, 8);
        unequipZone.on('pointerdown', () => {
            this.localPresets[this.currentSlot - 1][slotId] = null;
            this.saveCurrentPreset();
            this.modalGroup.clear(true, true);
            this.renderUI();
        });
        this.modalGroup.addMultiple([unBg, unequipZone, this.add.text(CX, 95, 'Unequip / Clear', { fontSize: '12px', color: '#fff', fontStyle:'bold' }).setOrigin(0.5)]);

        // --- Sort & Filter Bar ---
        const sortBtnBg = this.add.rectangle(120, 140, 140, 26, THEME.PANEL, 1);
        sortBtnBg.setStrokeStyle(1, THEME.BORDER);
        const sortZone = this.add.zone(120, 140, 140, 26).setInteractive({useHandCursor:true});
        const sortTxt = this.add.text(120, 140, `SORT: ${sortBy}`, { fontSize: '11px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
        
        sortZone.on('pointerover', () => sortBtnBg.setFillStyle(0x334155));
        sortZone.on('pointerout', () => sortBtnBg.setFillStyle(THEME.PANEL));
        sortZone.on('pointerdown', () => {
            const s = ['Level', 'ATK', 'HP', 'Rarity'];
            const nextSort = s[(s.indexOf(sortBy) + 1) % s.length];
            localStorage.setItem('party_sort', nextSort);
            this.showItemSelectionModal(type, slotId, 1, nextSort, displayMode);
        });
        this.modalGroup.addMultiple([sortBtnBg, sortZone, sortTxt]);

        const isChar = type === 'Character';
        const effMode = (isChar && displayMode === 'Skills') ? 'ATK/HP' : displayMode;

        const dispBtnBg = this.add.rectangle(W - 120, 140, 140, 26, THEME.PANEL, 1);
        dispBtnBg.setStrokeStyle(1, THEME.BORDER);
        const dispZone = this.add.zone(W - 120, 140, 140, 26).setInteractive({useHandCursor:true});
        const dispTxt = this.add.text(W - 120, 140, `VIEW: ${effMode}`, { fontSize: '11px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
        
        dispZone.on('pointerover', () => dispBtnBg.setFillStyle(0x334155));
        dispZone.on('pointerout', () => dispBtnBg.setFillStyle(THEME.PANEL));
        dispZone.on('pointerdown', () => {
            let modes = ['ATK/HP', 'Level/LB', 'Skills'];
            if (isChar) modes = ['ATK/HP', 'Level/LB'];
            const nextDisp = modes[(modes.indexOf(effMode) + 1) % modes.length];
            localStorage.setItem('party_view', nextDisp);
            this.showItemSelectionModal(type, slotId, page, sortBy, nextDisp);
        });
        this.modalGroup.addMultiple([dispBtnBg, dispZone, dispTxt]);

        let list = type === 'Character' ? this.characters.filter(c => c.mc_id !== 1) : this.weapons;
        
        const preset = this.localPresets[this.currentSlot - 1];
        const equipped = [
            preset.char_slot_1_inv_id, preset.char_slot_2_inv_id, preset.char_slot_3_inv_id,
            preset.weap_grid_1_inv_id, preset.weap_grid_2_inv_id, preset.weap_grid_3_inv_id, preset.weap_grid_4_inv_id, preset.weap_grid_5_inv_id
        ].filter(id => id != null);
        
        list = list.filter(item => !equipped.includes(item.inv_id));
        const isWeapon = type === 'Weapon';
        
        list.sort((a, b) => {
            const rarityScore = { 'SSR': 3, 'SR': 2, 'R': 1 };
            if (sortBy === 'Rarity') {
                const rA = rarityScore[isWeapon ? a.mw_rarity : a.mc_rarity] || 0;
                const rB = rarityScore[isWeapon ? b.mw_rarity : b.mc_rarity] || 0;
                if (rA !== rB) return rB - rA;
            } else if (sortBy === 'ATK') {
                return this.calculateBaseStat(b, 'atk', isWeapon) - this.calculateBaseStat(a, 'atk', isWeapon);
            } else if (sortBy === 'HP') {
                return this.calculateBaseStat(b, 'hp', isWeapon) - this.calculateBaseStat(a, 'hp', isWeapon);
            }
            return (b.item_level || 1) - (a.item_level || 1);
        });

        // --- Grid Render ---
        const cols = 4;
        const boxW = 84;
        const boxH = 100;
        const paddingX = 12;
        const paddingY = 10;
        
        const gridW = (cols * boxW) + ((cols - 1) * paddingX);
        const startX = (W - gridW) / 2 + (boxW / 2);
        const startYGrid = 200;

        const itemsPerPage = 20; // 4x5 grid
        const totalPages = Math.max(1, Math.ceil(list.length / itemsPerPage));
        const pagedItems = list.slice((page - 1) * itemsPerPage, page * itemsPerPage);

        pagedItems.forEach((item, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            
            const ix = startX + col * (boxW + paddingX);
            const iy = startYGrid + row * (boxH + paddingY) + (boxH / 2);

            let color = THEME.BORDER;
            const rarity = isWeapon ? item.mw_rarity : item.mc_rarity;
            if (rarity === 'SSR') color = 0xffd700;
            else if (rarity === 'SR') color = 0xc0c0c0;
            else if (rarity === 'R') color = 0xcd7f32;

            const cardBg = this.add.graphics();
            cardBg.fillStyle(THEME.PANEL, 1);
            cardBg.lineStyle(2, color);
            cardBg.fillRoundedRect(ix - boxW/2, iy - boxH/2, boxW, boxH, 8);
            cardBg.strokeRoundedRect(ix - boxW/2, iy - boxH/2, boxW, boxH, 8);
            this.modalGroup.add(cardBg);

            // Click Zone
            const zone = this.add.zone(ix, iy, boxW, boxH).setInteractive({useHandCursor:true});
            zone.on('pointerdown', (p, x, y, e) => {
                e.stopPropagation();
                this.localPresets[this.currentSlot - 1][slotId] = item.inv_id;
                this.saveCurrentPreset();
                this.modalGroup.clear(true, true);
                this.renderUI();
            });
            this.modalGroup.add(zone);

            // Art Placeholder (Top 45%)
            const artH = boxH * 0.45;
            const artBg = this.add.graphics().fillStyle(THEME.BG, 1).fillRoundedRect(ix - boxW/2 + 4, iy - boxH/2 + 4, boxW - 8, artH, 6);
            this.modalGroup.add(artBg);
            
            const itemName = isWeapon ? item.mw_name : item.mc_name;
            this.modalGroup.add(this.add.text(ix, iy - boxH/2 + 4 + artH/2, itemName.split(' ')[0], { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));

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
                this.modalGroup.addMultiple([iconImg, strokeCircle]);
            } else {
                const elCircle = this.add.circle(ix + boxW/2 - 10, iy - boxH/2 + 10, 7, elColor).setStrokeStyle(1, THEME.PANEL);
                const elLetter = element ? element.charAt(0).toUpperCase() : '?';
                const elTxt = this.add.text(ix + boxW/2 - 10, iy - boxH/2 + 10, elLetter, { fontSize: '9px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
                this.modalGroup.addMultiple([elCircle, elTxt]);
            }
            
            // Display Info below art box
            if (effMode === 'Level/LB') {
                this.modalGroup.add(this.add.text(ix, iy + 12, `Lv: ${item.item_level}`, { fontSize: '10px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
                this.modalGroup.add(this.add.text(ix, iy + 30, `LB: ${item.limit_break_level}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));
            } else if (effMode === 'Skills') {
                const skills = (item.skills || []).filter(s => s.ms_category === 'Passive');
                skills.slice(0, 2).forEach((skill, i) => {
                    const sx = ix + (i===0 && skills.length>1 ? -15 : (i===1 ? 15 : 0));
                    const sy = iy + 20;
                    
                    const isLocked = (item.item_level < skill.unlock_level) || (item.limit_break_level < skill.unlock_limit_break);
                    const sBox = this.add.graphics().fillStyle(isLocked ? 0x555555 : 0x458B74, 1).fillRoundedRect(sx-10, sy-10, 20, 20, 4);
                    const sZone = this.add.zone(sx, sy, 20, 20).setInteractive({useHandCursor:true});
                    sZone.on('pointerdown', (ptr, lx, ly, ev) => { 
                        ev.stopPropagation();
                        this.showSkillReadOnlyModal(skill, isLocked); 
                    });
                    
                    this.modalGroup.addMultiple([sBox, sZone]);
                    this.modalGroup.add(this.add.text(sx, sy, 'P', { fontSize: '10px', color: isLocked ? '#999' : '#fff' }).setOrigin(0.5));
                });
                if (skills.length === 0) {
                    this.modalGroup.add(this.add.text(ix, iy + 20, 'No Passives', { fontSize: '9px', color: THEME.TEXT_MUTED }).setOrigin(0.5));
                }
            } else {
                const atk = this.calculateBaseStat(item, 'atk', isWeapon);
                const hp = this.calculateBaseStat(item, 'hp', isWeapon);
                this.modalGroup.add(this.add.text(ix, iy + 12, `ATK: ${atk}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));
                this.modalGroup.add(this.add.text(ix, iy + 30, `HP:  ${hp}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));
            }
        });

        // --- Pagination Controls ---
        const pageY = 765;
        
        const prevActive = page > 1;
        const prevBtn = this.add.rectangle(CX - 80, pageY, 60, 25, prevActive ? 0x1e293b : 0x0f172a).setStrokeStyle(1, THEME.BORDER);
        const prevTxt = this.add.text(CX - 80, pageY, '< PREV', { fontSize: '10px', fontStyle: 'bold', color: prevActive ? '#ffffff' : THEME.TEXT_MUTED }).setOrigin(0.5);
        if (prevActive) {
            prevBtn.setInteractive({ useHandCursor: true });
            prevBtn.on('pointerdown', () => this.showItemSelectionModal(type, slotId, page - 1, sortBy, displayMode));
            prevBtn.on('pointerover', () => prevBtn.setFillStyle(0x334155));
            prevBtn.on('pointerout', () => prevBtn.setFillStyle(0x1e293b));
        }
        
        this.modalGroup.add(this.add.text(CX, pageY, `${page} / ${totalPages}`, { fontSize: '12px', fontStyle: 'bold', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));

        const nextActive = page < totalPages;
        const nextBtn = this.add.rectangle(CX + 80, pageY, 60, 25, nextActive ? 0x1e293b : 0x0f172a).setStrokeStyle(1, THEME.BORDER);
        const nextTxt = this.add.text(CX + 80, pageY, 'NEXT >', { fontSize: '10px', fontStyle: 'bold', color: nextActive ? '#ffffff' : THEME.TEXT_MUTED }).setOrigin(0.5);
        if (nextActive) {
            nextBtn.setInteractive({ useHandCursor: true });
            nextBtn.on('pointerdown', () => this.showItemSelectionModal(type, slotId, page + 1, sortBy, displayMode));
            nextBtn.on('pointerover', () => nextBtn.setFillStyle(0x334155));
            nextBtn.on('pointerout', () => nextBtn.setFillStyle(0x1e293b));
        }

        this.modalGroup.addMultiple([prevBtn, prevTxt, nextBtn, nextTxt]);
    }

    showAutoSelectElementModal() {
        this.modalGroup.clear(true, true);
        this.selectedAutoElement = null; // Reset selection

        const bg = this.add.rectangle(CX, H/2, W, H, 0x000000, 0.8).setInteractive();
        this.modalGroup.add(bg);

        const mBox = this.add.graphics();
        mBox.fillStyle(THEME.PANEL, 1);
        mBox.lineStyle(2, THEME.BORDER);
        mBox.fillRoundedRect(50, 270, 350, 230, 16);
        mBox.strokeRoundedRect(50, 270, 350, 230, 16);
        this.modalGroup.add(mBox);

        this.modalGroup.add(this.add.text(CX, 300, 'Auto Select Priority Element', { fontSize: '16px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));

        const elements = ['Fire', 'Wind', 'Earth'];
        const btnGraphics = [];
        
        elements.forEach((el, i) => {
            const ex = 115 + i * 110;
            const btn = this.add.graphics();
            btn.fillStyle(THEME.BG, 1);
            btn.lineStyle(2, this.getElementColor(el));
            btn.fillRoundedRect(ex - 45, 330, 90, 40, 8);
            btn.strokeRoundedRect(ex - 45, 330, 90, 40, 8);
            this.modalGroup.add(btn);
            btnGraphics.push({ g: btn, el: el, x: ex });

            const z = this.add.zone(ex, 350, 90, 40).setInteractive({useHandCursor: true});
            const text = this.add.text(ex, 350, el, { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
            
            z.on('pointerdown', () => {
                this.selectedAutoElement = el;
                // Highlight selection
                btnGraphics.forEach(bgObj => {
                    bgObj.g.clear();
                    const isSel = bgObj.el === el;
                    bgObj.g.fillStyle(isSel ? this.getElementColor(bgObj.el) : THEME.BG, 1);
                    bgObj.g.lineStyle(2, this.getElementColor(bgObj.el));
                    bgObj.g.fillRoundedRect(bgObj.x - 45, 330, 90, 40, 8);
                    bgObj.g.strokeRoundedRect(bgObj.x - 45, 330, 90, 40, 8);
                });
            });
            this.modalGroup.addMultiple([z, text]);
        });

        // Cancel / Confirm
        const cancelZone = this.add.zone(140, 440, 100, 40).setInteractive({useHandCursor: true});
        const cancelBg = this.add.graphics().fillStyle(THEME.BG, 1).lineStyle(1, THEME.BORDER).fillRoundedRect(90, 420, 100, 40, 6).strokeRoundedRect(90, 420, 100, 40, 6);
        cancelZone.on('pointerdown', () => this.modalGroup.clear(true, true));
        this.modalGroup.addMultiple([cancelBg, cancelZone, this.add.text(140, 440, 'Cancel', { fontSize: '14px', color: THEME.TEXT_MUTED }).setOrigin(0.5)]);

        const confirmZone = this.add.zone(310, 440, 100, 40).setInteractive({useHandCursor: true});
        const confirmBg = this.add.graphics().fillStyle(THEME.AETHER, 1).fillRoundedRect(260, 420, 100, 40, 6);
        confirmZone.on('pointerdown', () => {
            if (this.selectedAutoElement) {
                this.executeAutoSelect(this.selectedAutoElement);
                this.modalGroup.clear(true, true);
            } else {
                alert('Pilih elemen terlebih dahulu!');
            }
        });
        this.modalGroup.addMultiple([confirmBg, confirmZone, this.add.text(310, 440, 'Confirm', { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5)]);
    }

    executeAutoSelect(element) {
        const preset = this.localPresets[this.currentSlot - 1];

        const availableChars = [...this.characters].filter(c => c.mc_id !== 1);
        availableChars.sort((a, b) => {
            if (a.mc_element === element && b.mc_element !== element) return -1;
            if (b.mc_element === element && a.mc_element !== element) return 1;
            const rarityScore = { 'SSR': 3, 'SR': 2, 'R': 1 };
            const rs = rarityScore[b.mc_rarity] - rarityScore[a.mc_rarity];
            if (rs !== 0) return rs;
            return this.calculateBaseStat(b, 'atk', false) - this.calculateBaseStat(a, 'atk', false);
        });

        const charSlots = ['char_slot_1_inv_id', 'char_slot_2_inv_id', 'char_slot_3_inv_id'];
        charSlots.forEach(slot => {
            const pick = availableChars.shift();
            preset[slot] = pick ? pick.inv_id : null;
        });

        const availableWeaps = [...this.weapons];
        availableWeaps.sort((a, b) => {
            if (a.mw_element === element && b.mw_element !== element) return -1;
            if (b.mw_element === element && a.mw_element !== element) return 1;
            const rarityScore = { 'SSR': 3, 'SR': 2, 'R': 1 };
            const rs = rarityScore[b.mw_rarity] - rarityScore[a.mw_rarity];
            if (rs !== 0) return rs;
            return this.calculateBaseStat(b, 'atk', true) - this.calculateBaseStat(a, 'atk', true);
        });

        const weapSlots = ['weap_grid_1_inv_id', 'weap_grid_2_inv_id', 'weap_grid_3_inv_id', 'weap_grid_4_inv_id', 'weap_grid_5_inv_id'];
        weapSlots.forEach(slot => {
            const pick = availableWeaps.shift();
            preset[slot] = pick ? pick.inv_id : null;
        });

        this.saveCurrentPreset();
        this.renderUI();
    }

    async saveCurrentPreset() {
        const preset = this.localPresets[this.currentSlot - 1];
        
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

        const res = await PartyApi.savePreset(this.playerId, this.currentSlot, payload);
        if (res.status !== 'success') {
            console.error('Failed to auto-save party: ' + res.message);
            alert(res.message || 'Gagal menyimpan party preset.');
        }
    }

    _buildMenuModal() {
        this.menuContainer = this.add.container(0, 0).setDepth(95).setVisible(false);

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

        this.confirmContainer = this.add.container(0, 0).setDepth(100).setVisible(false);
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
