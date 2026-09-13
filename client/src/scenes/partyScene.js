import Phaser from 'phaser';
import { THEME } from '../main.js';
import { checkSession, getPlayerId, saveCurrentScene, clearSession } from '../utils/auth.js';
import { playGlobalBGM } from '../utils/audioManager.js';
import PartyApi from '../services/PartyApi.js';
import { CameraScrollManager } from '../utils/cameraScroll.js';
import TopMenuComponent from '../ui/TopMenuComponent.js';

const W = 480, H = 880, CX = 240;
const COLOR_SSR = 0xffd700, COLOR_SR = 0xa855f7, COLOR_R = 0xef4444, COLOR_EMPTY = 0x334155;

export default class PartyScene extends Phaser.Scene {
    constructor() { super('PartyScene'); }

    init(data) {
        this.targetData = data || {};
    }

    preload() {
        this.load.image('element_fire', 'assets/icons/elements/fire.png');
        this.load.image('element_wind', 'assets/icons/elements/wind.png');
        this.load.image('element_earth', 'assets/icons/elements/rock.png');
    }

    async create() {
        playGlobalBGM(this, 'main_menu');
        if (!checkSession(this)) return;
        saveCurrentScene(this.scene.key);
        this.playerId = getPlayerId();

        this.add.rectangle(CX, H / 2, W, H, THEME.BG);

        // Top Bar
        this.add.rectangle(CX, 30, W, 60, THEME.PANEL, THEME.PANEL_ALPHA).setStrokeStyle(1, THEME.BORDER).setScrollFactor(0).setDepth(100);
        this.add.text(CX, 30, 'PARTY SETTINGS', { fontSize: '15px', fontStyle: 'bold', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit', letterSpacing: 2 }).setOrigin(0.5).setScrollFactor(0).setDepth(100);

        const backBtn = this.add.circle(40, 30, 18, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(100);
        const homeTxt = this.add.text(40, 30, 'HOME', { fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        backBtn.on('pointerover', () => { backBtn.setFillStyle(0x334155); homeTxt.setColor('#ffffff'); });
        backBtn.on('pointerout', () => { backBtn.setFillStyle(THEME.PANEL); homeTxt.setColor(THEME.TEXT_PRIMARY); });
        backBtn.on('pointerdown', () => this.scene.start('LoadingScene', { targetScene: 'MainMenuScene' }));

        this.topMenu = new TopMenuComponent(this);

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

        this.presets = presetsRes.data;
        this.characters = invRes.data.characters;
        this.weapons = invRes.data.weapons;
        this.mcSkills = skillsRes.data;

        // Setup 5 local slots
        this.localPresets = [];
        // Force MC to always be present and valid
        const mcChar = this.characters.find(c => c.mc_id === 1);
        const actualMcInvId = mcChar ? mcChar.inv_id : null;

        const agrisWeap = (this.weapons || []).find(w => w.mw_id === 7 || w.master_item_id === 7);
        const defaultWeapInvId = agrisWeap ? agrisWeap.inv_id : ((this.weapons && this.weapons.length > 0) ? this.weapons[0].inv_id : null);
        const defaultSkills = (this.mcSkills && this.mcSkills.length > 0) ? this.mcSkills.slice(0, 4).map((s, idx) => ({ slot_number: idx + 1, ms_id: s.ms_id })) : [];

        for (let i = 1; i <= 5; i++) {
            const existing = this.presets.find(p => p.preset_slot === i);
            if (existing) {
                const presetCopy = JSON.parse(JSON.stringify(existing));
                if (actualMcInvId) presetCopy.main_char_inv_id = actualMcInvId;

                // Sanitize character slots
                ['char_slot_1_inv_id', 'char_slot_2_inv_id', 'char_slot_3_inv_id'].forEach(slot => {
                    if (presetCopy[slot] != null && !this.characters.some(c => Number(c.inv_id) === Number(presetCopy[slot]))) {
                        presetCopy[slot] = null;
                    }
                });

                // Sanitize weapon grid slots
                ['weap_grid_1_inv_id', 'weap_grid_2_inv_id', 'weap_grid_3_inv_id', 'weap_grid_4_inv_id', 'weap_grid_5_inv_id'].forEach(slot => {
                    if (presetCopy[slot] != null && !this.weapons.some(w => Number(w.inv_id) === Number(presetCopy[slot]))) {
                        presetCopy[slot] = (slot === 'weap_grid_1_inv_id') ? defaultWeapInvId : null;
                    }
                });

                if (!presetCopy.weap_grid_1_inv_id) presetCopy.weap_grid_1_inv_id = defaultWeapInvId;
                this.localPresets.push(presetCopy);
            } else {
                this.localPresets.push({
                    preset_slot: i,
                    main_char_inv_id: actualMcInvId,
                    char_slot_1_inv_id: null,
                    char_slot_2_inv_id: null,
                    char_slot_3_inv_id: null,
                    weap_grid_1_inv_id: defaultWeapInvId,
                    weap_grid_2_inv_id: null,
                    weap_grid_3_inv_id: null,
                    weap_grid_4_inv_id: null,
                    weap_grid_5_inv_id: null,
                    mc_skills: [...defaultSkills]
                });
            }
        }

        // Dynamically load missing character square portraits
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
                this.checkTargetDataActions();
            });
            this.load.start();
        } else {
            this.loadingText.destroy();
            this.renderUI();
            this.checkTargetDataActions();
        }
    }

    checkTargetDataActions() {
        if (this.targetData && this.targetData.openMcSkillManager) {
            this.showMcSkillsManagerModal();
        }
        if (this.targetData && this.targetData.openWeaponModal) {
            this.showItemSelectionModal('Weapon', this.targetData.openWeaponModal);
        }
        if (this.targetData && this.targetData.weaponChanged) {
            this.showWeaponChangedSuccessModal(this.targetData.weaponChanged);
            delete this.targetData.weaponChanged;
        }
        if (this.targetData && this.targetData.characterChanged) {
            this.showCharacterChangedSuccessModal(this.targetData.characterChanged);
            delete this.targetData.characterChanged;
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
            if (statType === 'def') return item.mc_base_def + (item.mc_def_growth * (level - 1));
        }
        return 0;
    }

    getPartyTotalStats(preset) {
        let charHp = 0;
        let charAtk = 0;
        let charDef = 0;

        const charIds = [preset.main_char_inv_id, preset.char_slot_1_inv_id, preset.char_slot_2_inv_id, preset.char_slot_3_inv_id];
        charIds.forEach(id => {
            if (id) {
                const c = this.characters.find(x => x.inv_id === id);
                if (c) {
                    charHp += this.calculateBaseStat(c, 'hp', false);
                    charAtk += this.calculateBaseStat(c, 'atk', false);
                    charDef += this.calculateBaseStat(c, 'def', false);
                }
            }
        });

        let weapHp = 0;
        let weapAtk = 0;
        const weapIds = [preset.weap_grid_1_inv_id, preset.weap_grid_2_inv_id, preset.weap_grid_3_inv_id, preset.weap_grid_4_inv_id, preset.weap_grid_5_inv_id];
        weapIds.forEach(id => {
            if (id) {
                const w = this.weapons.find(x => x.inv_id === id);
                if (w) {
                    weapHp += this.calculateBaseStat(w, 'hp', true);
                    weapAtk += this.calculateBaseStat(w, 'atk', true);
                }
            }
        });

        const totalHp = charHp + weapHp;
        const totalAtk = charAtk + weapAtk;
        const totalDef = charDef;

        const partyPower = Math.floor((totalHp / 5) + totalAtk + totalDef);

        return {
            weapHp: Math.floor(weapHp),
            weapAtk: Math.floor(weapAtk),
            partyPower
        };
    }

    drawRoundedBox(x, y, w, h, radius, color, strokeColor = null, alpha = 1) {
        const g = this.add.graphics();
        g.fillStyle(color, alpha);
        if (strokeColor !== null) {
            g.lineStyle(2, strokeColor, 1);
        }
        g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
        if (strokeColor !== null) {
            g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
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
            const tabX = 70 + (i - 1) * 85;
            const tabColor = isSel ? 0x475569 : THEME.PANEL; // Lighter blue for active
            this.drawRoundedBox(tabX, 85, 75, 30, 8, tabColor, isSel ? 0xffffff : THEME.BORDER, 1);

            const zone = this.add.zone(tabX, 85, 75, 30).setInteractive({ useHandCursor: true });
            zone.on('pointerdown', () => { this.currentSlot = i; this.renderUI(); });
            this.uiGroup.add(zone);

            this.uiGroup.add(this.add.text(tabX, 85, `Set ${i}`, { fontSize: '12px', color: isSel ? '#ffffff' : THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));
        }

        // --- MC Container (Always Visible) ---
        this.renderMC(preset, stats);

        // --- Secondary Tabs (Characters / Weapons) ---
        // Expanded to half the container width (W-40 = 440) -> width 216 each with a 8px gap
        const tabCharActive = this.currentTab === 'Characters';
        const charTabColor = tabCharActive ? 0x475569 : THEME.PANEL;
        this.drawRoundedBox(CX - 110, 258, 216, 30, 6, charTabColor, tabCharActive ? 0xffffff : THEME.BORDER);
        const zChar = this.add.zone(CX - 110, 258, 216, 30).setInteractive({ useHandCursor: true });
        zChar.on('pointerdown', () => { this.currentTab = 'Characters'; this.renderUI(); });
        this.uiGroup.addMultiple([zChar, this.add.text(CX - 110, 258, 'CHARACTERS', { fontSize: '12px', color: tabCharActive ? '#fff' : THEME.TEXT_MUTED, fontStyle: 'bold' }).setOrigin(0.5)]);

        const tabWeapActive = this.currentTab === 'Weapons';
        const weapTabColor = tabWeapActive ? 0x475569 : THEME.PANEL;
        this.drawRoundedBox(CX + 110, 258, 216, 30, 6, weapTabColor, tabWeapActive ? 0xffffff : THEME.BORDER);
        const zWeap = this.add.zone(CX + 110, 258, 216, 30).setInteractive({ useHandCursor: true });
        zWeap.on('pointerdown', () => { this.currentTab = 'Weapons'; this.renderUI(); });
        this.uiGroup.addMultiple([zWeap, this.add.text(CX + 110, 258, 'WEAPONS', { fontSize: '12px', color: tabWeapActive ? '#fff' : THEME.TEXT_MUTED, fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0)]);

        // --- Content Area ---
        if (this.currentTab === 'Characters') {
            this.renderCharacters(preset, stats);
            CameraScrollManager.enable(this, 750);
        } else {
            this.renderWeapons(preset, stats);
            CameraScrollManager.enable(this, 750);
        }

        // --- Party Stats (Moved to bottom) ---
        const isWeapons = this.currentTab === 'Weapons';
        const partyPowerY = isWeapons ? 695 : 665;
        const autoY = isWeapons ? 745 : 715;

        // Display Party Power
        this.uiGroup.add(this.add.text(CX, partyPowerY, `PARTY POWER: ${stats.partyPower}`, { fontSize: '16px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'Outfit' }).setOrigin(0.5));

        // --- Bottom Actions ---
        const autoZone = this.add.zone(CX, autoY, 200, 40).setInteractive({ useHandCursor: true });
        this.drawRoundedBox(CX, autoY, 200, 40, 8, THEME.PANEL, THEME.AETHER);
        autoZone.on('pointerdown', () => this.showAutoSelectElementModal());
        this.uiGroup.addMultiple([autoZone, this.add.text(CX, autoY, 'AUTO SELECT', { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5)]);
    }

    renderMC(preset, stats) {
        const invId = preset.main_char_inv_id;
        const char = this.characters.find(c => c.inv_id === invId);

        // Determine MC Element from Main Weapon, default to Fire
        const mainWeap = this.weapons.find(w => w.inv_id === preset.weap_grid_1_inv_id);
        const mcElement = mainWeap && mainWeap.mw_element ? mainWeap.mw_element : 'Fire';

        const strokeColor = char ? this.getElementColor(mcElement) : COLOR_EMPTY;
        const cy = 178; // Shifted down further by 6px

        // Section Title (Centered)
        this.uiGroup.add(this.add.text(CX, cy - 62, 'MAIN CHARACTER', { fontSize: '11px', color: THEME.TEXT_MUTED, fontStyle: 'bold', fontFamily: 'Outfit', letterSpacing: 1 }).setOrigin(0.5));

        // Container Main Box
        this.drawRoundedBox(CX, cy, W - 40, 100, 12, THEME.PANEL, strokeColor);

        // Party Slot Setup (Portrait Placeholder 1:1)
        const pSize = 100;
        const pX = 96;

        if (!char) {
            this.drawRoundedBox(pX, cy, pSize, pSize, 8, THEME.BG, null);
            this.uiGroup.add(this.add.text(pX, cy, 'MC', { fontSize: '18px', color: THEME.TEXT_MUTED, fontStyle: 'bold' }).setOrigin(0.5));
        }

        if (char) {
            const sqKey = `char_sq_${char.mc_id}`;
            if (this.textures.exists(sqKey)) {
                const portrait = this.add.image(pX, cy, sqKey);
                portrait.setDisplaySize(pSize, pSize);

                // Gradient transparency
                portrait.setAlpha(1, 1, 0.25, 0.25);

                const maskShape = this.make.graphics();
                maskShape.fillStyle(0xffffff);
                maskShape.fillRoundedRect(pX - pSize / 2, cy - pSize / 2, pSize, pSize, 8);
                portrait.setMask(maskShape.createGeometryMask());
                this.uiGroup.add(portrait);
            }

            // Element Icon (Top-Left of MAIN container)
            const elKey = `element_${mcElement.toLowerCase()}`;
            if (this.textures.exists(elKey)) {
                const ex = 32;
                const ey = cy - 38;
                const elImg = this.add.image(ex, ey, elKey).setDisplaySize(16, 16);
                const shape = this.make.graphics();
                shape.fillCircle(ex, ey, 8);
                elImg.setMask(shape.createGeometryMask());

                const elBorder = this.add.circle(ex, ey, 8).setStrokeStyle(1, THEME.PANEL);
                this.uiGroup.addMultiple([elImg, elBorder]);
            }

            // Background behind Level and Name
            const infoBg = this.add.graphics();
            infoBg.fillStyle(THEME.BG, 0.7);
            infoBg.fillRoundedRect(148, cy - 42, 185, 24, 6);
            this.uiGroup.add(infoBg);

            const raw = localStorage.getItem('aetheria_player');
            const playerData = raw ? JSON.parse(raw) : null;
            const mcName = (playerData && playerData.username) ? playerData.username : char.mc_name;

            // Level & Name
            this.uiGroup.add(this.add.text(154, cy - 30, `Lv ${char.item_level}`, { fontSize: '14px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0, 0.5));
            this.uiGroup.add(this.add.text(322, cy - 30, mcName, { fontSize: '14px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(1, 0.5));

            // Vertical Stats
            const hp = this.calculateBaseStat(char, 'hp', false) + (stats ? stats.weapHp : 0);
            const atk = this.calculateBaseStat(char, 'atk', false) + (stats ? stats.weapAtk : 0);
            this.uiGroup.add(this.add.text(360, cy + 10, `ATK: ${atk}`, { fontSize: '14px', color: '#ef4444', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2, fontFamily: 'Outfit' }).setOrigin(0, 0.5));
            this.uiGroup.add(this.add.text(360, cy + 28, `HP:  ${hp}`, { fontSize: '14px', color: '#4ade80', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2, fontFamily: 'Outfit' }).setOrigin(0, 0.5));

            // Skills Rendering
            this.uiGroup.add(this.add.text(228, cy - 8, 'SKILLS', { fontSize: '9px', color: THEME.TEXT_MUTED, fontStyle: 'bold' }).setOrigin(0.5));

            // 4 skill placeholders (no SA gap)
            const presetSkills = preset.mc_skills || [];
            for (let i = 0; i < 4; i++) {
                const sx = 168 + (i * 40);
                const sy = cy + 18;

                const skill = presetSkills[i];
                const sBox = this.add.graphics();
                if (skill) {
                    sBox.fillStyle(THEME.AETHER, 1).lineStyle(1, THEME.BORDER).fillRoundedRect(sx - 18, sy - 18, 36, 36, 4).strokeRoundedRect(sx - 18, sy - 18, 36, 36, 4);
                } else {
                    sBox.fillStyle(0x000000, 0.2).lineStyle(1.5, THEME.BORDER, 0.8).fillRoundedRect(sx - 18, sy - 18, 36, 36, 4).strokeRoundedRect(sx - 18, sy - 18, 36, 36, 4);
                }

                const sZone = this.add.zone(sx, sy, 36, 36).setInteractive({ useHandCursor: true });
                sZone.on('pointerdown', () => {
                    if (skill) {
                        const skillData = this.mcSkills.find(s => s.ms_id === skill.ms_id);
                        if (skillData) this.showSkillReadOnlyModal(skillData, false);
                    } else {
                        this.showMcSkillSelectionList(i);
                    }
                });

                this.uiGroup.addMultiple([sBox, sZone]);

                if (skill) {
                    const init = skill.ms_name ? skill.ms_name.substring(0, 2).toUpperCase() : 'SK';
                    this.uiGroup.add(this.add.text(sx, sy, init, { fontSize: '11px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
                } else {
                    this.uiGroup.add(this.add.text(sx, sy, '+', { fontSize: '16px', color: THEME.TEXT_MUTED }).setOrigin(0.5));
                }
            }
        }

        // Change Skills Button at top right (replacing info button)
        const btnZone = this.add.zone(410, cy - 30, 80, 22).setInteractive({ useHandCursor: true });
        this.drawRoundedBox(410, cy - 30, 80, 22, 4, 0x458B74, null); // HEALTH color
        btnZone.on('pointerdown', () => this.showMcSkillsManagerModal());

        this.uiGroup.addMultiple([btnZone, this.add.text(410, cy - 30, 'CHANGE SKILLS', { fontSize: '9px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5)]);
    }

    renderCharacters(preset, stats) {
        // Section Title (Centered)
        this.uiGroup.add(this.add.text(CX, 292, 'PARTY MEMBER', { fontSize: '11px', color: THEME.TEXT_MUTED, fontStyle: 'bold', fontFamily: 'Outfit', letterSpacing: 1 }).setOrigin(0.5));

        const slots = [
            { id: 'char_slot_1_inv_id', y: 355 },
            { id: 'char_slot_2_inv_id', y: 465 },
            { id: 'char_slot_3_inv_id', y: 575 }
        ];

        slots.forEach(slot => {
            const invId = preset[slot.id];
            const char = this.characters.find(c => c.inv_id === invId);

            let strokeColor = COLOR_EMPTY;
            if (char) {
                if (char.mc_rarity === 'SSR') strokeColor = 0xffd700;
                else if (char.mc_rarity === 'SR') strokeColor = 0xa855f7;
                else if (char.mc_rarity === 'R') strokeColor = 0xef4444;
            }

            // Container Main Box
            this.drawRoundedBox(CX, slot.y, W - 40, 100, 12, THEME.PANEL, strokeColor);

            // Party Slot Setup (Portrait Placeholder 1:1, original X position)
            const pSize = 100;
            const pX = 96;
            const portZone = this.add.zone(pX, slot.y, pSize, pSize).setInteractive({ useHandCursor: true });

            // Only draw background placeholder if there is no character
            if (!char) {
                this.drawRoundedBox(pX, slot.y, pSize, pSize, 8, THEME.BG, null);
            }

            if (char) {
                const sqKey = `char_sq_${char.mc_id}`;
                if (this.textures.exists(sqKey)) {
                    const portrait = this.add.image(pX, slot.y, sqKey);
                    portrait.setDisplaySize(pSize, pSize);

                    // Gradient transparency from top 100% to bottom 25%
                    portrait.setAlpha(1, 1, 0.25, 0.25);

                    const maskShape = this.make.graphics();
                    maskShape.fillStyle(0xffffff);
                    // Standard rounded rect mask since it doesn't touch the left container border
                    maskShape.fillRoundedRect(pX - pSize / 2, slot.y - pSize / 2, pSize, pSize, 8);
                    portrait.setMask(maskShape.createGeometryMask());
                    this.uiGroup.add(portrait);
                }
            }

            portZone.on('pointerdown', () => {
                this.tweens.add({ targets: portZone, scale: 0.9, yoyo: true, duration: 100 });
                if (char) {
                    const preset = this.localPresets[this.currentSlot - 1];
                    const partyState = {
                        currentSlot: this.currentSlot,
                        currentTab: this.currentTab,
                        partySlotId: slot.id,
                        preset: preset,
                        weapAtk: stats ? stats.weapAtk : 0,
                        weapHp: stats ? stats.weapHp : 0
                    };
                    this.scene.start('LoadingScene', { targetScene: 'CharacterDetailScene', targetData: { item: char, isWeapon: false, fromParty: true, partyState } });
                } else {
                    this.showItemSelectionModal('Character', slot.id);
                }
            });
            this.uiGroup.add(portZone);

            // Element and Rarity Icons (Corners of main container, padded 3px)
            if (char) {
                // Element Icon (Top-Left of MAIN container)
                const elKey = `element_${char.mc_element.toLowerCase()}`;
                if (this.textures.exists(elKey)) {
                    const ex = 32;
                    const ey = slot.y - 38;
                    const elImg = this.add.image(ex, ey, elKey).setDisplaySize(16, 16);
                    const shape = this.make.graphics();
                    shape.fillCircle(ex, ey, 8);
                    elImg.setMask(shape.createGeometryMask());

                    const elBorder = this.add.circle(ex, ey, 8).setStrokeStyle(1, THEME.PANEL);
                    this.uiGroup.addMultiple([elImg, elBorder]);
                }

                // Rarity Icon/Text (Bottom-Left of MAIN container)
                const rColorHex = strokeColor === 0xffd700 ? '#ffd700' : (strokeColor === 0xa855f7 ? '#a855f7' : '#ef4444');
                this.uiGroup.add(this.add.text(23, slot.y + 47, char.mc_rarity, {
                    fontSize: '11px', color: rColorHex, fontStyle: 'bold', stroke: '#000000', strokeThickness: 2, fontFamily: 'Outfit'
                }).setOrigin(0, 1));
            }

            if (char) {
                // Background behind Level and Name
                const infoBg = this.add.graphics();
                infoBg.fillStyle(THEME.BG, 0.7); // Darker background with some transparency
                // Draw from just right of the portrait (150) to right of Name
                infoBg.fillRoundedRect(148, slot.y - 42, 185, 24, 6);
                this.uiGroup.add(infoBg);

                // Level (Left aligned)
                this.uiGroup.add(this.add.text(154, slot.y - 30, `Lv ${char.item_level}`, { fontSize: '14px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0, 0.5));
                // Name (Right aligned)
                this.uiGroup.add(this.add.text(322, slot.y - 30, char.mc_name, { fontSize: '14px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(1, 0.5));

                // Vertical Stats (ATK and HP) on far right, left-aligned
                const hp = this.calculateBaseStat(char, 'hp', false) + (stats ? stats.weapHp : 0);
                const atk = this.calculateBaseStat(char, 'atk', false) + (stats ? stats.weapAtk : 0);
                this.uiGroup.add(this.add.text(360, slot.y + 10, `ATK: ${atk}`, { fontSize: '14px', color: '#ef4444', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2, fontFamily: 'Outfit' }).setOrigin(0, 0.5));
                this.uiGroup.add(this.add.text(360, slot.y + 28, `HP:  ${hp}`, { fontSize: '14px', color: '#4ade80', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2, fontFamily: 'Outfit' }).setOrigin(0, 0.5));

                // Skills Rendering
                const skills = [...(char.skills || [])].sort((a, b) => {
                    if (a.ms_category === 'Special') return -1;
                    if (b.ms_category === 'Special') return 1;
                    return a.unlock_level - b.unlock_level;
                });
                const hasSpecial = skills.some(s => s.ms_category === 'Special');

                // Labels for Skills
                if (hasSpecial) {
                    this.uiGroup.add(this.add.text(168, slot.y - 8, 'SA', { fontSize: '9px', color: THEME.TEXT_MUTED, fontStyle: 'bold' }).setOrigin(0.5));
                    this.uiGroup.add(this.add.text(268, slot.y - 8, 'SKILLS', { fontSize: '9px', color: THEME.TEXT_MUTED, fontStyle: 'bold' }).setOrigin(0.5));
                }

                skills.slice(0, 4).forEach((skill, i) => {
                    const isSpecial = skill.ms_category === 'Special';
                    const offset = (!isSpecial && hasSpecial) ? 20 : 0;
                    const sx = 168 + (i * 40) + offset;
                    const sy = slot.y + 18;
                    const isLocked = (skill.unlock_level > 0 && char.item_level < skill.unlock_level) || (skill.unlock_limit_break > 0 && char.limit_break_level < skill.unlock_limit_break);

                    const sBox = this.add.graphics().fillStyle(isLocked ? 0x555555 : THEME.AETHER, 1).fillRoundedRect(sx - 18, sy - 18, 36, 36, 4);
                    const sZone = this.add.zone(sx, sy, 36, 36).setInteractive({ useHandCursor: true });
                    sZone.on('pointerdown', () => this.showSkillReadOnlyModal(skill, isLocked));

                    this.uiGroup.addMultiple([sBox, sZone]);
                    const init = skill.ms_name.substring(0, 2).toUpperCase();
                    this.uiGroup.add(this.add.text(sx, sy, init, { fontSize: '11px', color: isLocked ? '#999' : '#fff', fontStyle: 'bold' }).setOrigin(0.5));

                    if (isLocked) {
                        this.uiGroup.add(this.add.text(sx, sy - 12, '🔒', { fontSize: '12px' }).setOrigin(0.5));
                    }
                });

            } else {
                this.uiGroup.add(this.add.text(pX, slot.y, '+', { fontSize: '24px', color: THEME.TEXT_MUTED }).setOrigin(0.5));
                this.uiGroup.add(this.add.text(160, slot.y, 'Tap to assign character...', { fontSize: '14px', color: THEME.TEXT_MUTED, fontStyle: 'italic' }).setOrigin(0, 0.5));
            }
        });
    }

    renderWeapons(preset, stats) {
        // Section Title (Centered)
        this.uiGroup.add(this.add.text(CX, 292, 'WEAPON GRID', { fontSize: '11px', color: THEME.TEXT_MUTED, fontStyle: 'bold', fontFamily: 'Outfit', letterSpacing: 1 }).setOrigin(0.5));

        // Weapon Grid Stats Header
        if (stats) {
            this.drawRoundedBox(CX - 80, 325, 140, 26, 6, THEME.PANEL, null);
            this.uiGroup.add(this.add.text(CX - 80, 325, `TOTAL ATK: ${stats.weapAtk}`, { fontSize: '13px', color: '#ef4444', fontStyle: 'bold', fontFamily: 'Outfit' }).setOrigin(0.5));

            this.drawRoundedBox(CX + 80, 325, 140, 26, 6, THEME.PANEL, null);
            this.uiGroup.add(this.add.text(CX + 80, 325, `TOTAL HP: ${stats.weapHp}`, { fontSize: '13px', color: '#4ade80', fontStyle: 'bold', fontFamily: 'Outfit' }).setOrigin(0.5));
        }

        // Weapon Grid: 1 Main Hand (Center), 4 Sub (Corners)
        // Scaled down to look like a rune grid with proper gaps
        const wSlots = [
            { id: 'weap_grid_1_inv_id', x: CX, y: 515, w: 110, h: 150, isMain: true },
            { id: 'weap_grid_2_inv_id', x: 115, y: 415, w: 85, h: 115, isMain: false },
            { id: 'weap_grid_3_inv_id', x: W - 115, y: 415, w: 85, h: 115, isMain: false },
            { id: 'weap_grid_4_inv_id', x: 115, y: 615, w: 85, h: 115, isMain: false },
            { id: 'weap_grid_5_inv_id', x: W - 115, y: 615, w: 85, h: 115, isMain: false },
        ];

        wSlots.forEach(slot => {
            const invId = preset[slot.id];
            const weap = this.weapons.find(w => w.inv_id === invId);
            const strokeColor = weap ? THEME.BORDER : 0x475569;

            this.drawRoundedBox(slot.x, slot.y, slot.w, slot.h, 10, THEME.PANEL, strokeColor);
            const z = this.add.zone(slot.x, slot.y, slot.w, slot.h).setInteractive({ useHandCursor: true });
            z.on('pointerdown', () => {
                if (weap) {
                    const partyState = { currentSlot: this.currentSlot, currentTab: this.currentTab, partySlotId: slot.id, preset: preset };
                    this.scene.start('LoadingScene', { targetScene: 'WeaponDetailScene', targetData: { item: weap, isWeapon: true, fromParty: true, partyState } });
                } else {
                    this.showItemSelectionModal('Weapon', slot.id);
                }
            });
            this.uiGroup.add(z);

            if (weap) {
                // Art Placeholder (Top 45%) with rarity color
                const artH = slot.h * 0.45;
                const artBg = this.add.graphics();
                artBg.fillStyle(THEME.BG, 1);

                let rColorNum = 0xffffff;
                let rColorStr = '#ffffff';
                if (weap.mw_rarity === 'SSR') { rColorNum = 0xffd700; rColorStr = '#ffd700'; }
                else if (weap.mw_rarity === 'SR') { rColorNum = 0xa855f7; rColorStr = '#a855f7'; }
                else if (weap.mw_rarity === 'R') { rColorNum = 0xef4444; rColorStr = '#ef4444'; }

                const imgKey = `weap_img_${weap.mw_id}`;
                if (this.textures.exists(imgKey)) {
                    const weapImg = this.add.image(slot.x, slot.y - slot.h / 2 + 4 + artH / 2, imgKey);
                    weapImg.setDisplaySize(slot.w - 8, artH);
                    weapImg.setAlpha(1, 1, 0.4, 0.4);
                    const maskShape = this.make.graphics();
                    maskShape.fillStyle(0xffffff);
                    maskShape.fillRoundedRect(slot.x - slot.w / 2 + 4, slot.y - slot.h / 2 + 4, slot.w - 8, artH, 6);
                    weapImg.setMask(maskShape.createGeometryMask());
                    this.uiGroup.add(weapImg);
                } else {
                    artBg.fillRoundedRect(slot.x - slot.w / 2 + 4, slot.y - slot.h / 2 + 4, slot.w - 8, artH, 6);
                    this.uiGroup.add(artBg);
                }

                const border = this.add.graphics();
                border.lineStyle(1, rColorNum);
                border.strokeRoundedRect(slot.x - slot.w / 2 + 4, slot.y - slot.h / 2 + 4, slot.w - 8, artH, 6);
                this.uiGroup.add(border);

                if (!this.textures.exists(`weap_img_${weap.mw_id}`)) {
                    this.uiGroup.add(this.add.text(slot.x, slot.y - slot.h / 2 + 4 + artH / 2, weap.mw_name.split(' ')[0], { fontSize: slot.isMain ? '12px' : '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5));
                }

                // Element Indicator top right
                const element = weap.mw_element;
                const elColorNum = this.getElementColor(element);
                const elKey = element ? `element_${element.toLowerCase()}` : '';

                if (this.textures.exists(elKey)) {
                    const iconImg = this.add.image(slot.x + slot.w / 2 - 14, slot.y - slot.h / 2 + 14, elKey).setDisplaySize(14, 14);
                    const shape = this.make.graphics();
                    shape.fillCircle(slot.x + slot.w / 2 - 14, slot.y - slot.h / 2 + 14, 7);
                    iconImg.setMask(shape.createGeometryMask());

                    const strokeCircle = this.add.circle(slot.x + slot.w / 2 - 14, slot.y - slot.h / 2 + 14, 7).setStrokeStyle(1, THEME.PANEL);
                    this.uiGroup.addMultiple([iconImg, strokeCircle]);
                } else {
                    const elCircle = this.add.circle(slot.x + slot.w / 2 - 14, slot.y - slot.h / 2 + 14, 7, elColorNum).setStrokeStyle(1, THEME.PANEL);
                    const elLetter = element ? element.charAt(0).toUpperCase() : '?';
                    const elTxt = this.add.text(slot.x + slot.w / 2 - 14, slot.y - slot.h / 2 + 14, elLetter, { fontSize: '9px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
                    this.uiGroup.addMultiple([elCircle, elTxt]);
                }

                // Rarity bottom left of art
                if (weap.mw_rarity) {
                    const rTxt = this.add.text(slot.x - slot.w / 2 + 8, slot.y - slot.h / 2 + artH + 1, weap.mw_rarity, { fontSize: '10px', color: rColorStr, fontStyle: 'bold', stroke: '#000000', strokeThickness: 2, fontFamily: 'Outfit' }).setOrigin(0, 1);
                    this.uiGroup.add(rTxt);
                }

                if (slot.isMain) {
                    const labelY = slot.y - (slot.h / 2) - 12;
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
                    const sx = slot.x + (i === 0 && skills.length > 1 ? -15 : (i === 1 ? 15 : 0));
                    const sy = slot.y + (slot.h / 2) - 20;

                    const isLocked = (weap.item_level < skill.unlock_level) || (weap.limit_break_level < skill.unlock_limit_break);

                    const sBox = this.add.graphics().fillStyle(isLocked ? 0x555555 : 0x458B74, 1).fillRoundedRect(sx - 10, sy - 10, 20, 20, 4);
                    const sZone = this.add.zone(sx, sy, 20, 20).setInteractive({ useHandCursor: true });
                    sZone.on('pointerdown', (ptr, lx, ly, ev) => {
                        ev.stopPropagation(); // prevent opening weapon select
                        this.showSkillReadOnlyModal(skill, isLocked);
                    });

                    this.uiGroup.addMultiple([sBox, sZone]);
                    this.uiGroup.add(this.add.text(sx, sy, 'P', { fontSize: '10px', color: isLocked ? '#999' : '#fff' }).setOrigin(0.5));
                });

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

        const bg = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.8).setInteractive();
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

        container.add(this.add.text(CX, CY - modalH / 2 + 25, headerText, { fontSize: '16px', color: '#3b82f6', fontStyle: 'bold', letterSpacing: 1 }).setOrigin(0.5));

        // Skill Container bg
        const sBg = this.add.rectangle(CX, CY - modalH / 2 + 75, W - 80, 50, 0x1e293b).setStrokeStyle(1, 0x334155);
        container.add(sBg);

        // Icon
        const iconColor = skill.ms_category === 'Special' ? 0xd97706 : (skill.ms_category === 'Passive' ? 0x10b981 : 0x4f46e5);
        const iconBox = this.add.graphics().fillStyle(iconColor, 1).fillRoundedRect(CX - (W - 80) / 2 + 10, CY - modalH / 2 + 55, 40, 40, 8);
        const init = skill.ms_name ? skill.ms_name.substring(0, 2).toUpperCase() : 'SK';
        const iconTxt = this.add.text(CX - (W - 80) / 2 + 30, CY - modalH / 2 + 75, init, { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

        container.add([iconBox, iconTxt]);

        if (isLocked) {
            const lockBox = this.add.graphics().fillStyle(0x000000, 0.6).fillRoundedRect(CX - (W - 80) / 2 + 10, CY - modalH / 2 + 55, 40, 40, 8);
            const lockTxt = this.add.text(CX - (W - 80) / 2 + 30, CY - modalH / 2 + 75, '🔒', { fontSize: '14px' }).setOrigin(0.5);
            container.add([lockBox, lockTxt]);
        }

        const titleColor = isLocked ? THEME.TEXT_MUTED : (skill.ms_category === 'Special' ? THEME.GOLD : '#60a5fa');
        container.add(this.add.text(CX - (W - 80) / 2 + 60, CY - modalH / 2 + 62, skill.ms_name || 'Unknown Skill', { fontSize: '13px', color: titleColor, fontStyle: 'bold' }).setOrigin(0, 0.5));

        container.add(this.add.text(CX - (W - 80) / 2 + 60, CY - modalH / 2 + 82, skill.ms_desc || '', { fontSize: '10px', color: '#ffffff', wordWrap: { width: W - 160 }, lineSpacing: 2 }).setOrigin(0, 0.5));

        // Cooldown (Hide for Passive skills)
        if (skill.ms_category !== 'Passive' && skill.ms_cooldown !== undefined) {
            container.add(this.add.text(CX + (W - 80) / 2 - 10, CY - modalH / 2 + 62, `CD: ${skill.ms_cooldown}T`, { fontSize: '10px', color: THEME.TEXT_MUTED }).setOrigin(1, 0.5));
        }

        if (isLocked) {
            const warningBox = this.add.graphics().fillStyle(0x000000, 0.8).lineStyle(1, THEME.DANGER).fillRoundedRect(CX - (W - 40) / 2 + 20, CY - modalH / 2 + 110, W - 80, 40, 4).strokeRoundedRect(CX - (W - 40) / 2 + 20, CY - modalH / 2 + 110, W - 80, 40, 4);
            const warningTxt = this.add.text(CX, CY - modalH / 2 + 130, `🔒 Syarat Level: ${skill.unlock_level || '?'}  |  Syarat LB: ${skill.unlock_limit_break || '?'}`, { fontSize: '11px', color: THEME.GOLD, fontStyle: 'bold' }).setOrigin(0.5);
            container.add([warningBox, warningTxt]);
        }

        // OK Button at bottom
        const okBtn = this.add.rectangle(CX, CY + modalH / 2 - 25, 100, 30, 0x1e293b).setStrokeStyle(1, 0x3b82f6).setInteractive({ useHandCursor: true });
        okBtn.on('pointerdown', () => container.destroy());
        container.add([
            okBtn,
            this.add.text(CX, CY + modalH / 2 - 25, 'OK', { fontSize: '14px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5)
        ]);
    }

    showMcSkillsManagerModal() {
        this.modalGroup.clear(true, true);
        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.85).setOrigin(0).setInteractive();
        this.modalGroup.add(overlay);

        const panelTop = 110;
        const panelBottom = 720;
        const panelHeight = panelBottom - panelTop;
        const panelCenterY = panelTop + (panelHeight / 2);
        const panelWidth = W - 30;

        const panel = this.add.rectangle(CX, panelCenterY, panelWidth, panelHeight, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive();
        this.modalGroup.add(panel);

        this.modalGroup.add(this.add.text(CX, panelTop + 25, 'MC SKILLS MANAGER', { fontSize: '16px', color: '#fff', fontStyle: 'bold', fontFamily: 'Outfit', letterSpacing: 1 }).setOrigin(0.5));
        this.modalGroup.add(this.add.rectangle(CX, panelTop + 45, panelWidth - 40, 1, 0x334155));

        const closeBtn = this.add.circle(CX + (panelWidth / 2) - 25, panelTop + 25, 14, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        const closeTxt = this.add.text(CX + (panelWidth / 2) - 25, panelTop + 25, '✕', { fontSize: '12px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        closeBtn.on('pointerdown', () => { this.modalGroup.clear(true, true); this.renderUI(); });
        this.modalGroup.addMultiple([closeBtn, closeTxt]);

        this.modalGroup.add(this.add.text(CX, panelTop + 65, `Saved to Preset ${this.currentSlot}`, { fontSize: '11px', color: THEME.TEXT_MUTED, fontStyle: 'bold' }).setOrigin(0.5));

        const preset = this.localPresets[this.currentSlot - 1];

        for (let i = 0; i < 4; i++) {
            const y = panelTop + 140 + i * 125;
            const skillObj = preset.mc_skills && preset.mc_skills[i];
            const skillData = skillObj ? this.mcSkills.find(s => s.ms_id === skillObj.ms_id) : null;

            // Card Container (Blends with panel, only outline)
            const card = this.add.graphics().fillStyle(THEME.PANEL, 1).lineStyle(1, THEME.BORDER).fillRoundedRect(35, y - 50, W - 70, 100, 8).strokeRoundedRect(35, y - 50, W - 70, 100, 8);
            const zone = this.add.zone(CX, y, W - 70, 100).setInteractive({ useHandCursor: true });

            zone.on('pointerdown', () => this.showMcSkillSelectionList(i));
            this.modalGroup.addMultiple([card, zone]);

            // Slot Badge (Top-left protruding)
            const slotTextBg = this.add.graphics().fillStyle(THEME.PANEL, 1).lineStyle(1, THEME.BORDER).fillRoundedRect(40, y - 58, 40, 16, 4).strokeRoundedRect(40, y - 58, 40, 16, 4);
            this.modalGroup.add(slotTextBg);
            this.modalGroup.add(this.add.text(60, y - 50, `Slot ${i + 1}`, { fontSize: '10px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));

            if (skillData) {
                let actionTypeText = skillData.ms_action_type.toUpperCase();
                let typeColor = '#fff';
                let typeHex = 0xffffff;

                if (skillData.ms_action_type === 'Support') {
                    const hasBuff = skillData.status_effects && skillData.status_effects.some(e => e.effect_type === 'Buff');
                    const hasDebuff = skillData.status_effects && skillData.status_effects.some(e => e.effect_type === 'Debuff');

                    if (hasBuff && !hasDebuff) {
                        actionTypeText = 'BUFF';
                        typeColor = '#facc15'; typeHex = 0xfacc15;
                    } else if (hasDebuff && !hasBuff) {
                        actionTypeText = 'DEBUFF';
                        typeColor = '#3b82f6'; typeHex = 0x3b82f6;
                    } else if (hasBuff && hasDebuff) {
                        actionTypeText = 'SUPPORT';
                        typeColor = '#facc15'; typeHex = 0xfacc15;
                    } else {
                        // Fallback if no status effects linked
                        if (['All_Allies', 'Single_Ally', 'Self'].includes(skillData.ms_target_type)) {
                            actionTypeText = 'BUFF';
                            typeColor = '#facc15'; typeHex = 0xfacc15;
                        } else {
                            actionTypeText = 'DEBUFF';
                            typeColor = '#3b82f6'; typeHex = 0x3b82f6;
                        }
                    }
                } else if (skillData.ms_action_type === 'Damage') {
                    typeColor = '#ef4444'; typeHex = 0xef4444;
                } else if (skillData.ms_action_type === 'Heal' || skillData.ms_action_type === 'Revive' || skillData.ms_action_type === 'Cleanse') {
                    typeColor = '#4ade80'; typeHex = 0x4ade80;
                }

                // Skill Icon 1:1 on the left with colored stroke
                const iconBox = this.add.graphics().fillStyle(0x334155, 1).lineStyle(2, typeHex).fillRoundedRect(45, y - 25, 50, 50, 8).strokeRoundedRect(45, y - 25, 50, 50, 8);
                this.modalGroup.add(iconBox);
                const init = skillData.ms_name.substring(0, 2).toUpperCase();
                this.modalGroup.add(this.add.text(70, y, init, { fontSize: '16px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));

                // Action Type Text (Small, above name)
                this.modalGroup.add(this.add.text(110, y - 26, actionTypeText, { fontSize: '9px', color: typeColor, fontStyle: 'bold' }).setOrigin(0, 0.5));

                // Skill Name (White with darker rounded background)
                const tempName = this.add.text(0, 0, skillData.ms_name, { fontSize: '14px', color: '#fff', fontStyle: 'bold' });
                const th = tempName.height;
                tempName.destroy();

                // const nameBg = this.add.graphics().fillStyle(THEME.BG, 1).fillRoundedRect(106, y - 10 - (th/2) - 2, 230, th + 4, 4);
                // this.modalGroup.add(nameBg);

                this.modalGroup.add(this.add.text(110, y - 10, skillData.ms_name, { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0, 0.5));

                // Description (Word Wrap)
                this.modalGroup.add(this.add.text(110, y + 4, skillData.ms_desc, { fontSize: '13px', color: '#ccc', fontStyle: 'italic', wordWrap: { width: 220 } }).setOrigin(0, 0));

                // CD & Duration (White)
                let durText = '';
                if (skillData.status_effects && skillData.status_effects.length > 0) {
                    const maxDur = Math.max(...skillData.status_effects.map(e => e.duration || 0));
                    if (maxDur > 0) durText = ` | Duration: ${maxDur}T`;
                }
                this.modalGroup.add(this.add.text(110, y + 38, `CD: ${skillData.ms_cooldown}T${durText}`, { fontSize: '9px', color: '#fff' }).setOrigin(0, 0.5));

                // Clear Button
                const unx = W - 75;
                const unBox = this.add.graphics().fillStyle(0xb91c1c, 1).fillRoundedRect(unx - 25, y - 14, 50, 28, 6);
                const unZone = this.add.zone(unx, y, 50, 28).setInteractive({ useHandCursor: true });
                unZone.on('pointerdown', (ptr, lx, ly, ev) => {
                    ev.stopPropagation();
                    preset.mc_skills[i] = null;
                    this.saveCurrentPreset();
                    this.showMcSkillsManagerModal();
                });
                this.modalGroup.addMultiple([unBox, unZone, this.add.text(unx, y, 'Clear', { fontSize: '11px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5)]);
            } else {
                const iconBox = this.add.graphics().fillStyle(THEME.PANEL, 1).lineStyle(1, THEME.BORDER).fillRoundedRect(45, y - 25, 50, 50, 8).strokeRoundedRect(45, y - 25, 50, 50, 8);
                this.modalGroup.add(iconBox);
                this.modalGroup.add(this.add.text(70, y, '+', { fontSize: '20px', color: THEME.TEXT_MUTED }).setOrigin(0.5));

                this.modalGroup.add(this.add.text(110, y, 'Tap to assign skill...', { fontSize: '12px', color: '#fff', fontStyle: 'italic' }).setOrigin(0, 0.5));
            }
        }
    }

    showMcSkillSelectionList(slotIndex) {
        if (this.listGroup) this.listGroup.clear(true, true);
        this.listGroup = this.add.group();

        const bg = this.add.rectangle(0, 0, W, H, 0x000000, 0.95).setOrigin(0).setInteractive();
        this.listGroup.add(bg);

        const panelTop = 110;
        const panelBottom = 720;
        const panelHeight = panelBottom - panelTop;
        const panelWidth = W - 30;

        const panel = this.add.rectangle(CX, panelTop + panelHeight / 2, panelWidth, panelHeight, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive();
        this.listGroup.add(panel);

        this.listGroup.add(this.add.text(CX, panelTop + 25, `SELECT SKILL FOR SLOT ${slotIndex + 1}`, { fontSize: '16px', color: '#fff', fontStyle: 'bold', fontFamily: 'Outfit', letterSpacing: 1 }).setOrigin(0.5));
        this.listGroup.add(this.add.rectangle(CX, panelTop + 45, panelWidth - 40, 1, 0x334155));

        const closeBtn = this.add.circle(CX + (panelWidth / 2) - 35, panelTop + 25, 14, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        const closeTxt = this.add.text(CX + (panelWidth / 2) - 35, panelTop + 25, '✕', { fontSize: '12px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        closeBtn.on('pointerdown', () => { this.listGroup.clear(true, true); });
        this.listGroup.addMultiple([closeBtn, closeTxt]);

        const preset = this.localPresets[this.currentSlot - 1];
        if (!preset.mc_skills) preset.mc_skills = [null, null, null, null];

        const currentSlotSkillId = preset.mc_skills[slotIndex] ? preset.mc_skills[slotIndex].ms_id : null;

        // Exclude the skill currently equipped in THIS slot
        const availableSkills = this.mcSkills.filter(s => s.ms_id !== currentSlotSkillId);

        const mcInvId = preset.main_char_inv_id;
        const mcChar = this.characters.find(c => c.inv_id === mcInvId);
        const mcLevel = mcChar ? mcChar.item_level : 1;
        const mcLb = mcChar ? mcChar.limit_break_level : 0;

        const itemsPerPage = 4;
        const totalPages = Math.ceil(availableSkills.length / itemsPerPage);
        if (!this.mcSkillSelectPage || this.mcSkillSelectPage > totalPages) this.mcSkillSelectPage = 1;

        const startIndex = (this.mcSkillSelectPage - 1) * itemsPerPage;
        const pagedSkills = availableSkills.slice(startIndex, startIndex + itemsPerPage);

        pagedSkills.forEach((skillData, i) => {
            const y = panelTop + 115 + i * 125;
            const isLocked = (mcLevel < skillData.unlock_level) || (mcLb < skillData.unlock_limit_break);

            const otherEquippedSlot = preset.mc_skills.findIndex((s, idx) => s && s.ms_id === skillData.ms_id && idx !== slotIndex);
            const isEquippedElsewhere = otherEquippedSlot !== -1;

            const cardColor = isLocked ? 0x0f172a : THEME.PANEL;
            const cardAlpha = isLocked ? 0.6 : 1;

            const card = this.add.graphics().fillStyle(cardColor, cardAlpha).lineStyle(1, THEME.BORDER).fillRoundedRect(35, y - 50, W - 70, 100, 8).strokeRoundedRect(35, y - 50, W - 70, 100, 8);
            const zone = this.add.zone(CX, y, W - 70, 100).setInteractive({ useHandCursor: true });

            zone.on('pointerdown', () => {
                if (isLocked) {
                    this.showSkillReadOnlyModal(skillData, isLocked);
                } else {
                    if (isEquippedElsewhere) {
                        // Swap logic
                        const temp = preset.mc_skills[slotIndex];
                        preset.mc_skills[slotIndex] = preset.mc_skills[otherEquippedSlot];
                        preset.mc_skills[otherEquippedSlot] = temp;
                    } else {
                        preset.mc_skills[slotIndex] = { ms_id: skillData.ms_id, slot_number: slotIndex + 1 };
                    }
                    this.saveCurrentPreset();
                    this.listGroup.clear(true, true);
                    this.modalGroup.clear(true, true);
                    this.renderUI();
                }
            });
            this.listGroup.addMultiple([card, zone]);

            let actionTypeText = skillData.ms_action_type.toUpperCase();
            let typeColor = '#fff';
            let typeHex = 0xffffff;

            if (skillData.ms_action_type === 'Support') {
                const hasBuff = skillData.status_effects && skillData.status_effects.some(e => e.effect_type === 'Buff');
                const hasDebuff = skillData.status_effects && skillData.status_effects.some(e => e.effect_type === 'Debuff');

                if (hasBuff && !hasDebuff) { actionTypeText = 'BUFF'; typeColor = '#facc15'; typeHex = 0xfacc15; }
                else if (hasDebuff && !hasBuff) { actionTypeText = 'DEBUFF'; typeColor = '#3b82f6'; typeHex = 0x3b82f6; }
                else if (hasBuff && hasDebuff) { actionTypeText = 'SUPPORT'; typeColor = '#facc15'; typeHex = 0xfacc15; }
                else {
                    if (['All_Allies', 'Single_Ally', 'Self'].includes(skillData.ms_target_type)) { actionTypeText = 'BUFF'; typeColor = '#facc15'; typeHex = 0xfacc15; }
                    else { actionTypeText = 'DEBUFF'; typeColor = '#3b82f6'; typeHex = 0x3b82f6; }
                }
            } else if (skillData.ms_action_type === 'Damage') { typeColor = '#ef4444'; typeHex = 0xef4444; }
            else if (skillData.ms_action_type === 'Heal' || skillData.ms_action_type === 'Revive' || skillData.ms_action_type === 'Cleanse') { typeColor = '#4ade80'; typeHex = 0x4ade80; }

            if (isLocked) { typeHex = 0x475569; typeColor = '#94a3b8'; }

            const iconBox = this.add.graphics().fillStyle(0x334155, cardAlpha).lineStyle(2, typeHex).fillRoundedRect(45, y - 25, 50, 50, 8).strokeRoundedRect(45, y - 25, 50, 50, 8);
            this.listGroup.add(iconBox);
            const init = skillData.ms_name.substring(0, 2).toUpperCase();
            this.listGroup.add(this.add.text(70, y, isLocked ? '🔒' : init, { fontSize: isLocked ? '24px' : '16px', color: isLocked ? '#94a3b8' : '#fff', fontStyle: 'bold' }).setOrigin(0.5));

            this.listGroup.add(this.add.text(110, y - 26, actionTypeText, { fontSize: '9px', color: typeColor, fontStyle: 'bold' }).setOrigin(0, 0.5));


            this.listGroup.add(this.add.text(110, y - 10, skillData.ms_name, { fontSize: '14px', color: isLocked ? '#94a3b8' : '#fff', fontStyle: 'bold' }).setOrigin(0, 0.5));

            this.listGroup.add(this.add.text(110, y + 4, skillData.ms_desc, { fontSize: '13px', color: isLocked ? '#64748b' : '#ccc', fontStyle: 'italic', wordWrap: { width: 220 } }).setOrigin(0, 0));

            let durText = '';
            if (skillData.status_effects && skillData.status_effects.length > 0) {
                const maxDur = Math.max(...skillData.status_effects.map(e => e.duration || 0));
                if (maxDur > 0) durText = ` | Dur: ${maxDur}T`;
            }
            this.listGroup.add(this.add.text(110, y + 38, `CD: ${skillData.ms_cooldown}T${durText}`, { fontSize: '9px', color: isLocked ? '#64748b' : '#fff' }).setOrigin(0, 0.5));

            if (isEquippedElsewhere) {
                const eqX = W - 75;
                const eqY = y - 35;
                const eqBg = this.add.graphics().fillStyle(0x1e3a8a, cardAlpha).fillRoundedRect(eqX - 35, eqY - 10, 70, 20, 10);
                this.listGroup.add(eqBg);
                this.listGroup.add(this.add.text(eqX, eqY, 'EQUIPPED', { fontSize: '10px', color: '#60a5fa', fontStyle: 'bold' }).setOrigin(0.5));
            } else if (isLocked) {
                this.listGroup.add(this.add.text(W - 60, y, `Req\nLv ${skillData.unlock_level}`, { fontSize: '10px', color: THEME.DANGER, fontStyle: 'bold', align: 'center' }).setOrigin(0.5, 0.5));
            }
        });

        // Pagination Controls
        const pageY = panelBottom - 30;

        const prevBg = this.add.rectangle(CX - 80, pageY, 80, 30, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        this.listGroup.add(prevBg);
        this.listGroup.add(this.add.text(CX - 80, pageY, '< PREV', { fontSize: '12px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
        prevBg.on('pointerdown', () => {
            if (this.mcSkillSelectPage > 1) {
                this.mcSkillSelectPage--;
                this.showMcSkillSelectionList(slotIndex);
            }
        });

        this.listGroup.add(this.add.text(CX, pageY, `${this.mcSkillSelectPage} / ${totalPages}`, { fontSize: '12px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));

        const nextBg = this.add.rectangle(CX + 80, pageY, 80, 30, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        this.listGroup.add(nextBg);
        this.listGroup.add(this.add.text(CX + 80, pageY, 'NEXT >', { fontSize: '12px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
        nextBg.on('pointerdown', () => {
            if (this.mcSkillSelectPage < totalPages) {
                this.mcSkillSelectPage++;
                this.showMcSkillSelectionList(slotIndex);
            }
        });
    }

    showLimitBreakModal(char) {
        this.modalGroup.clear(true, true);
        const bg = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.9).setInteractive();
        this.modalGroup.add(bg);

        const mBox = this.add.graphics().fillStyle(THEME.PANEL, 1).lineStyle(2, THEME.BORDER).fillRoundedRect(40, 250, W - 80, 250, 12).strokeRoundedRect(40, 250, W - 80, 250, 12);
        this.modalGroup.add(mBox);

        this.modalGroup.add(this.add.text(CX, 280, 'LIMIT BREAK', { fontSize: '18px', color: '#3b82f6', fontStyle: 'bold' }).setOrigin(0.5));
        this.modalGroup.add(this.add.text(CX, 305, `${char.mc_name} (LB ${char.limit_break_level} ➔ LB ${char.limit_break_level + 1})`, { fontSize: '14px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));

        this.modalGroup.add(this.add.text(CX, 340, 'Syarat Material:', { fontSize: '12px', color: THEME.TEXT_MUTED }).setOrigin(0.5));

        // This is a placeholder since we don't load char_lb_costs on frontend yet.
        // We will just show a confirmation text. The backend will validate.
        this.modalGroup.add(this.add.text(CX, 360, 'Operasi ini membutuhkan sejumlah Gold\ndan Material spesifik elemen.', { fontSize: '12px', color: THEME.TEXT_PRIMARY, align: 'center' }).setOrigin(0.5));

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
        const overlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.8).setInteractive();
        modal.add(overlay);

        const bg = this.add.rectangle(CX, H / 2, 300, 220, THEME.BG, 1);
        bg.setStrokeStyle(2, 0x3b82f6);
        modal.add(bg);

        modal.add(this.add.text(CX, H / 2 - 60, "SKILL UNLOCKED!", { fontSize: "18px", color: "#3b82f6", fontStyle: "bold", letterSpacing: 1 }).setOrigin(0.5));
        modal.add(this.add.text(CX, H / 2 - 10, charName, { fontSize: "14px", color: THEME.TEXT_MUTED }).setOrigin(0.5));
        modal.add(this.add.text(CX, H / 2 + 20, skillName, { fontSize: "22px", color: THEME.TEXT_PRIMARY, fontStyle: "bold" }).setOrigin(0.5));

        const btnBg = this.add.rectangle(CX, H / 2 + 75, 120, 36, THEME.PANEL).setInteractive({ useHandCursor: true });
        btnBg.setStrokeStyle(1, THEME.BORDER);
        modal.add(btnBg);

        modal.add(this.add.text(CX, H / 2 + 75, "AWESOME!", { fontSize: "14px", color: "#3b82f6", fontStyle: "bold" }).setOrigin(0.5));

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
        const overlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.85).setInteractive();
        this.modalGroup.add(overlay);

        const panelTop = 90;
        const panelBottom = 800;
        const panelHeight = panelBottom - panelTop;
        const panelCenterY = panelTop + (panelHeight / 2);
        const panelWidth = W - 30;

        const panel = this.add.rectangle(CX, panelCenterY, panelWidth, panelHeight, 0x0d1b2a).setStrokeStyle(2, THEME.AETHER).setInteractive();
        this.modalGroup.add(panel);

        this.modalGroup.add(this.add.text(CX, panelTop + 25, `SELECT ${type.toUpperCase()}`, { fontSize: '16px', fontStyle: 'bold', color: '#A5B4FC', fontFamily: 'Outfit', letterSpacing: 2 }).setOrigin(0.5));
        this.modalGroup.add(this.add.rectangle(CX, panelTop + 50, panelWidth - 40, 1, 0x334155));

        const closeBtn = this.add.circle(CX + (panelWidth / 2) - 25, panelTop + 25, 14, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        const closeTxt = this.add.text(CX + (panelWidth / 2) - 25, panelTop + 25, '✕', { fontSize: '12px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        closeBtn.on('pointerover', () => closeBtn.setFillStyle(0x334155));
        closeBtn.on('pointerout', () => closeBtn.setFillStyle(THEME.PANEL));
        closeBtn.on('pointerdown', () => this.modalGroup.clear(true, true));
        this.modalGroup.addMultiple([closeBtn, closeTxt]);

        // Render unequip button
        const unequipY = panelTop + 75;
        const unequipZone = this.add.zone(CX, unequipY, 200, 32).setInteractive({ useHandCursor: true });
        const unBg = this.add.graphics().fillStyle(THEME.DANGER, 1).fillRoundedRect(CX - 100, unequipY - 16, 200, 32, 8);
        unequipZone.on('pointerdown', () => {
            this.localPresets[this.currentSlot - 1][slotId] = null;
            this.saveCurrentPreset();
            this.modalGroup.clear(true, true);
            this.renderUI();
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
            this.showItemSelectionModal(type, slotId, 1, nextSort, displayMode);
        });
        this.modalGroup.addMultiple([sortBtnBg, sortZone, sortTxt]);

        const isChar = type === 'Character';
        const effMode = (isChar && displayMode === 'Skills') ? 'ATK/HP' : displayMode;

        const dispBtnBg = this.add.rectangle(W - 120, filterY, 140, 26, THEME.PANEL, 1);
        dispBtnBg.setStrokeStyle(1, THEME.BORDER);
        const dispZone = this.add.zone(W - 120, filterY, 140, 26).setInteractive({ useHandCursor: true });
        const dispTxt = this.add.text(W - 120, filterY, `VIEW: ${effMode}`, { fontSize: '11px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

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
        const startYGrid = panelTop + 150;

        const itemsPerPage = 16; // 4x4 grid (to fit nicely in modal)
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
            else if (rarity === 'SR') color = 0xa855f7;
            else if (rarity === 'R') color = 0xef4444;

            const cardBg = this.add.graphics();
            cardBg.fillStyle(THEME.PANEL, 1);
            cardBg.lineStyle(2, THEME.BORDER);
            cardBg.fillRoundedRect(ix - boxW / 2, iy - boxH / 2, boxW, boxH, 8);
            cardBg.strokeRoundedRect(ix - boxW / 2, iy - boxH / 2, boxW, boxH, 8);
            this.modalGroup.add(cardBg);

            // Click Zone
            const zone = this.add.zone(ix, iy, boxW, boxH).setInteractive({ useHandCursor: true });
            zone.on('pointerdown', (p, x, y, e) => {
                e.stopPropagation();
                this.localPresets[this.currentSlot - 1][slotId] = item.inv_id;
                this.saveCurrentPreset();
                this.modalGroup.clear(true, true);
                this.renderUI();
            });
            this.modalGroup.add(zone);

            // Art Placeholder / Image (Top 45%)
            const artH = boxH * 0.45;
            const yTop = iy - boxH / 2;
            if (isWeapon) {
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
            } else {
                const artBg = this.add.graphics();
                artBg.fillStyle(THEME.BG, 1);
                artBg.lineStyle(1, color);
                artBg.fillRoundedRect(ix - boxW / 2 + 4, yTop + 4, boxW - 8, artH, 6);
                artBg.strokeRoundedRect(ix - boxW / 2 + 4, yTop + 4, boxW - 8, artH, 6);
                this.modalGroup.add(artBg);
            }

            const hasWeapImg = isWeapon && this.textures.exists(`weap_img_${item.mw_id}`);
            if (!hasWeapImg) {
                const itemName = isWeapon ? item.mw_name : item.mc_name;
                this.modalGroup.add(this.add.text(ix, iy - boxH / 2 + 4 + artH / 2, itemName.split(' ')[0], { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));
            }

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
                this.modalGroup.addMultiple([iconImg, strokeCircle]);
            } else {
                const elCircle = this.add.circle(ix + boxW / 2 - 10, iy - boxH / 2 + 10, 7, elColor).setStrokeStyle(1, THEME.PANEL);
                const elLetter = element ? element.charAt(0).toUpperCase() : '?';
                const elTxt = this.add.text(ix + boxW / 2 - 10, iy - boxH / 2 + 10, elLetter, { fontSize: '9px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
                this.modalGroup.addMultiple([elCircle, elTxt]);
            }

            // RARITY Indicator at bottom left of art
            let rColor = '#ffffff';
            if (rarity === 'SSR') rColor = '#ffd700'; // Gold
            else if (rarity === 'SR') rColor = '#a855f7'; // Purple
            else if (rarity === 'R') rColor = '#ef4444'; // Red

            if (rarity) {
                const rTxt = this.add.text(ix - boxW / 2 + 6, iy - boxH / 2 + artH + 5, rarity, { fontSize: '11px', color: rColor, fontStyle: 'bold', stroke: '#000000', strokeThickness: 2, fontFamily: 'Outfit' }).setOrigin(0, 1);
                this.modalGroup.add(rTxt);
            }

            // Display Info below art box
            if (effMode === 'Level/LB') {
                this.modalGroup.add(this.add.text(ix, iy + 12, `Lv: ${item.item_level}`, { fontSize: '10px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
                this.modalGroup.add(this.add.text(ix, iy + 30, `LB: ${item.limit_break_level}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));
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
        const pageY = panelBottom - 30;

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

        const bg = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.8).setInteractive();
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

            const z = this.add.zone(ex, 350, 90, 40).setInteractive({ useHandCursor: true });
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
        const cancelZone = this.add.zone(140, 440, 100, 40).setInteractive({ useHandCursor: true });
        const cancelBg = this.add.graphics().fillStyle(THEME.BG, 1).lineStyle(1, THEME.BORDER).fillRoundedRect(90, 420, 100, 40, 6).strokeRoundedRect(90, 420, 100, 40, 6);
        cancelZone.on('pointerdown', () => this.modalGroup.clear(true, true));
        this.modalGroup.addMultiple([cancelBg, cancelZone, this.add.text(140, 440, 'Cancel', { fontSize: '14px', color: THEME.TEXT_MUTED }).setOrigin(0.5)]);

        const confirmZone = this.add.zone(310, 440, 100, 40).setInteractive({ useHandCursor: true });
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
    showWeaponChangedSuccessModal(data) {
        this.modalGroup.clear(true, true);
        const W = this.cameras.main.width, H = this.cameras.main.height, CX = W / 2;
        const bg = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.9).setInteractive();
        this.modalGroup.add(bg);

        const mBox = this.add.graphics().fillStyle(THEME.PANEL, 1).lineStyle(1, THEME.BORDER)
            .fillRoundedRect(CX - 120, H / 2 - 130, 240, 260, 12)
            .strokeRoundedRect(CX - 120, H / 2 - 130, 240, 260, 12);
        this.modalGroup.add(mBox);

        this.modalGroup.add(this.add.text(CX, H / 2 - 100, 'WEAPON CHANGED', { fontSize: '18px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'Outfit' }).setOrigin(0.5));

        if (data.newInvId) {
            const weap = this.weapons.find(w => w.inv_id === data.newInvId);
            if (weap) {
                const px = CX;
                const py = H / 2 - 20;

                let rColor = THEME.BORDER;
                let rStr = '#ffffff';
                if (weap.mw_rarity === 'SSR') { rColor = 0xffd700; rStr = '#ffd700'; }
                else if (weap.mw_rarity === 'SR') { rColor = 0xa855f7; rStr = '#a855f7'; }
                else if (weap.mw_rarity === 'R') { rColor = 0xef4444; rStr = '#ef4444'; }

                const boxW = 120;
                const boxH = 80;
                const boxBg = this.add.graphics();
                boxBg.fillStyle(THEME.BG, 1);
                boxBg.lineStyle(2, rColor);
                boxBg.fillRoundedRect(px - boxW / 2, py - boxH / 2, boxW, boxH, 8);
                boxBg.strokeRoundedRect(px - boxW / 2, py - boxH / 2, boxW, boxH, 8);
                this.modalGroup.add(boxBg);

                // Element Icon
                const elStr = weap.mw_element;
                const elKey = elStr ? `element_${elStr.toLowerCase()}` : '';
                if (this.textures.exists(elKey)) {
                    const ex = px + boxW / 2 - 12;
                    const ey = py - boxH / 2 + 12;
                    const iconImg = this.add.image(ex, ey, elKey).setDisplaySize(16, 16);
                    const shape = this.make.graphics();
                    shape.fillCircle(ex, ey, 8);
                    iconImg.setMask(shape.createGeometryMask());
                    const strokeCircle = this.add.circle(ex, ey, 8).setStrokeStyle(1, THEME.PANEL);
                    this.modalGroup.addMultiple([iconImg, strokeCircle]);
                }

                // Rarity text
                if (weap.mw_rarity) {
                    this.modalGroup.add(this.add.text(px - boxW / 2 + 6, py + boxH / 2 - 6, weap.mw_rarity, {
                        fontSize: '14px', color: rStr, fontStyle: 'bold', stroke: '#000000', strokeThickness: 2, fontFamily: 'Outfit'
                    }).setOrigin(0, 1));
                }
            }
        } else {
            this.modalGroup.add(this.add.text(CX, H / 2 - 20, 'Unequipped', { fontSize: '14px', color: THEME.TEXT_MUTED }).setOrigin(0.5));
        }

        const cY = H / 2 + 45;

        const oldAtkStr = data.oldAtk.toString();
        const newAtkStr = data.newAtk.toString();
        const atkColor = data.newAtk >= data.oldAtk ? (data.newAtk > data.oldAtk ? '#10b981' : '#ffffff') : '#ef4444';
        this.modalGroup.add(this.add.text(CX, cY, `Grid ATK:  ${oldAtkStr}  ➔  ${newAtkStr}`, { fontSize: '13px', color: atkColor, fontStyle: 'bold' }).setOrigin(0.5));

        const oldHpStr = data.oldHp.toString();
        const newHpStr = data.newHp.toString();
        const hpColor = data.newHp >= data.oldHp ? (data.newHp > data.oldHp ? '#10b981' : '#ffffff') : '#ef4444';
        this.modalGroup.add(this.add.text(CX, cY + 25, `Grid HP:  ${oldHpStr}  ➔  ${newHpStr}`, { fontSize: '13px', color: hpColor, fontStyle: 'bold' }).setOrigin(0.5));

        const okBtn = this.add.rectangle(CX, H / 2 + 105, 100, 32, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        okBtn.on('pointerover', () => okBtn.setFillStyle(0x334155));
        okBtn.on('pointerout', () => okBtn.setFillStyle(THEME.PANEL));
        okBtn.on('pointerdown', () => this.modalGroup.clear(true, true));
        this.modalGroup.addMultiple([
            okBtn,
            this.add.text(CX, H / 2 + 105, 'OK', { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5)
        ]);
    }

    showCharacterChangedSuccessModal(data) {
        this.modalGroup.clear(true, true);
        const W = this.cameras.main.width, H = this.cameras.main.height, CX = W / 2;
        const bg = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.9).setInteractive();
        this.modalGroup.add(bg);

        const mBox = this.add.graphics().fillStyle(THEME.PANEL, 1).lineStyle(1, THEME.BORDER)
            .fillRoundedRect(CX - 120, H / 2 - 130, 240, 260, 12)
            .strokeRoundedRect(CX - 120, H / 2 - 130, 240, 260, 12);
        this.modalGroup.add(mBox);

        this.modalGroup.add(this.add.text(CX, H / 2 - 100, 'CHARACTER CHANGED', { fontSize: '18px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'Outfit' }).setOrigin(0.5));

        if (data.newInvId) {
            const char = this.characters.find(c => c.inv_id === data.newInvId);
            if (char) {
                const px = CX;
                const py = H / 2 - 20;

                let rColor = THEME.BORDER;
                let rStr = '#ffffff';
                if (char.mc_rarity === 'SSR') { rColor = 0xffd700; rStr = '#ffd700'; }
                else if (char.mc_rarity === 'SR') { rColor = 0xa855f7; rStr = '#a855f7'; }
                else if (char.mc_rarity === 'R') { rColor = 0xef4444; rStr = '#ef4444'; }

                const pSize = 80;

                const boxBg = this.add.graphics();
                boxBg.fillStyle(THEME.BG, 1);
                boxBg.fillRoundedRect(px - pSize / 2, py - pSize / 2, pSize, pSize, 8);
                this.modalGroup.add(boxBg);

                const sqKey = `char_sq_${char.mc_id}`;
                if (this.textures.exists(sqKey)) {
                    const portrait = this.add.image(px, py, sqKey).setDisplaySize(pSize, pSize);
                    portrait.setAlpha(1, 1, 0.25, 0.25);
                    const maskShape = this.make.graphics();
                    maskShape.fillStyle(0xffffff);
                    maskShape.fillRoundedRect(px - pSize / 2, py - pSize / 2, pSize, pSize, 8);
                    portrait.setMask(maskShape.createGeometryMask());
                    this.modalGroup.add(portrait);
                }

                const border = this.add.graphics();
                border.lineStyle(2, rColor);
                border.strokeRoundedRect(px - pSize / 2, py - pSize / 2, pSize, pSize, 8);
                this.modalGroup.add(border);

                // Element Icon
                const elStr = char.mc_element;
                const elKey = elStr ? `element_${elStr.toLowerCase()}` : '';
                if (this.textures.exists(elKey)) {
                    const ex = px - pSize / 2 + 12;
                    const ey = py - pSize / 2 + 12;
                    const iconImg = this.add.image(ex, ey, elKey).setDisplaySize(16, 16);
                    const shape = this.make.graphics();
                    shape.fillCircle(ex, ey, 8);
                    iconImg.setMask(shape.createGeometryMask());
                    const strokeCircle = this.add.circle(ex, ey, 8).setStrokeStyle(1, THEME.PANEL);
                    this.modalGroup.addMultiple([iconImg, strokeCircle]);
                }

                // Rarity text
                if (char.mc_rarity) {
                    this.modalGroup.add(this.add.text(px - pSize / 2 + 6, py + pSize / 2 - 6, char.mc_rarity, {
                        fontSize: '14px', color: rStr, fontStyle: 'bold', stroke: '#000000', strokeThickness: 2, fontFamily: 'Outfit'
                    }).setOrigin(0, 1));
                }
            }
        }

        const cY = H / 2 + 45;

        const oldAtkStr = data.oldAtk.toString();
        const newAtkStr = data.newAtk.toString();
        const atkColor = data.newAtk >= data.oldAtk ? (data.newAtk > data.oldAtk ? '#10b981' : '#ffffff') : '#ef4444';
        this.modalGroup.add(this.add.text(CX, cY, `Total ATK:  ${oldAtkStr}  ➔  ${newAtkStr}`, { fontSize: '13px', color: atkColor, fontStyle: 'bold' }).setOrigin(0.5));

        const oldHpStr = data.oldHp.toString();
        const newHpStr = data.newHp.toString();
        const hpColor = data.newHp >= data.oldHp ? (data.newHp > data.oldHp ? '#10b981' : '#ffffff') : '#ef4444';
        this.modalGroup.add(this.add.text(CX, cY + 25, `Total HP:  ${oldHpStr}  ➔  ${newHpStr}`, { fontSize: '13px', color: hpColor, fontStyle: 'bold' }).setOrigin(0.5));

        const okBtn = this.add.rectangle(CX, H / 2 + 105, 100, 32, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        okBtn.on('pointerover', () => okBtn.setFillStyle(0x334155));
        okBtn.on('pointerout', () => okBtn.setFillStyle(THEME.PANEL));
        okBtn.on('pointerdown', () => this.modalGroup.clear(true, true));
        this.modalGroup.addMultiple([
            okBtn,
            this.add.text(CX, H / 2 + 105, 'OK', { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5)
        ]);
    }
}
