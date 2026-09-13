import Phaser from 'phaser';
import { THEME } from '../main.js';
import { playGlobalBGM } from '../utils/audioManager.js';
import { checkSession, saveCurrentScene, clearSession, getPlayerId } from '../utils/auth.js';
import PartyApi from '../services/PartyApi.js';
import TopMenuComponent from '../ui/TopMenuComponent.js';
import { API_BASE } from '../config.js';

// Element icons are loaded as PNGs in preload

const W = 480, H = 800, CX = 240;

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
        this.load.image('element_fire', 'assets/icons/elements/fire.png');
        this.load.image('element_wind', 'assets/icons/elements/wind.png');
        this.load.image('element_earth', 'assets/icons/rock.png');
        if (!this.cache.audio.exists('sfx_success')) {
            this.load.audio('sfx_success', 'assets/audio/sfx/success.mp3');
        }
    }

    create() {
        if (!checkSession(this)) return;
        playGlobalBGM(this, 'main_menu');
        this.add.rectangle(0, 0, W, H, THEME.BG).setOrigin(0).setScrollFactor(0).setDepth(-100);

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

        const path = this.char.mc_splash_path;
        if (path && !this.textures.exists(`char_sp_${this.char.mc_id}`)) {
            this.load.image(`char_sp_${this.char.mc_id}`, path);
            this.load.once('complete', () => {
                this.renderUI();
            });
            this.load.start();
        } else {
            this.renderUI();
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

    calculateMaxLevel() {
        const lb = this.char.limit_break_level || 0;
        if (this.char.mc_id === 1) return 40 + (lb * 20);
        if (this.char.mc_rarity === 'SSR') return 40 + (lb * 20);
        if (this.char.mc_rarity === 'SR') return 30 + (lb * 20);
        if (this.char.mc_rarity === 'R') return 20 + (lb * 20);
        return 20 + (lb * 20);
    }

    calculateBaseStat(statType, customLevel = null) {
        const level = customLevel !== null ? customLevel : (this.char.item_level || 1);
        if (statType === 'hp') return this.char.mc_base_hp + (this.char.mc_hp_growth * (level - 1));
        if (statType === 'atk') return this.char.mc_base_atk + (this.char.mc_atk_growth * (level - 1));
        return 0;
    }

    renderUI() {
        this.scrollGroup.clear(true, true);
        const char = this.char;
        let cy = 0;

        // Header Fixed
        const headerBg = this.add.rectangle(0, 0, W, 60, 0x0a0f1d, 1).setOrigin(0).setScrollFactor(0).setDepth(1000);
        headerBg.setStrokeStyle(1, THEME.BORDER);
        this.add.text(CX, 30, 'CHARACTER DETAIL', { fontSize: '16px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY, letterSpacing: 1 }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

        const backBtn = this.add.circle(40, 30, 18, THEME.PANEL, 1).setScrollFactor(0).setDepth(1000);
        backBtn.setStrokeStyle(1, THEME.BORDER);
        backBtn.setInteractive({ useHandCursor: true });
        const homeTxt = this.add.text(40, 30, 'HOME', { fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

        backBtn.on('pointerover', () => { backBtn.setFillStyle(0x334155); homeTxt.setColor('#ffffff'); });
        backBtn.on('pointerout', () => { backBtn.setFillStyle(THEME.PANEL); homeTxt.setColor(THEME.TEXT_PRIMARY); });
        backBtn.on('pointerdown', () => this.scene.start('LoadingScene', { targetScene: 'MainMenuScene' }));

        const bannerW = W - 30; // Matched skill container width
        cy += 70;

        // PORTRAIT PLACEHOLDER
        const portraitH = 160;
        const spKey = `char_sp_${char.mc_id}`;

        if (this.textures.exists(spKey)) {
            const portrait = this.add.image(CX, cy + portraitH / 2, spKey);
            // Fit to banner width
            const scale = Math.max(bannerW / portrait.width, portraitH / portrait.height);
            portrait.setScale(scale);

            // Mask it to rounded rect
            const maskShape = this.make.graphics();
            maskShape.fillStyle(0xffffff);
            maskShape.fillRoundedRect(CX - bannerW / 2, cy, bannerW, portraitH, 8);
            portrait.setMask(maskShape.createGeometryMask());
            this.scrollGroup.add(portrait);

            // Add a subtle border overlay
            const border = this.add.graphics().lineStyle(1, THEME.BORDER);
            border.strokeRoundedRect(CX - bannerW / 2, cy, bannerW, portraitH, 8);
            this.scrollGroup.add(border);
        } else {
            const portraitBox = this.add.rectangle(CX, cy + portraitH / 2, bannerW, portraitH, 0x0a0f1d, 0.5).setStrokeStyle(1, THEME.BORDER);
            this.scrollGroup.add(portraitBox);
        }

        // Rarity at top right of portrait container
        const rarity = char.mc_rarity;
        let rarityColor = '#ffffff';
        if (rarity === 'SSR') rarityColor = '#ffd700'; // Kuning
        else if (rarity === 'SR') rarityColor = '#3b82f6'; // Biru
        else if (rarity === 'R') rarityColor = '#10b981'; // Hijau

        this.scrollGroup.add(this.add.text(CX + bannerW / 2 - 10, cy + 15, rarity, { fontSize: '16px', color: rarityColor, fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }).setOrigin(1, 0.5));

        cy += portraitH;

        // BANNER
        const color = this.getElementColor(char.mc_element);
        const banner = this.add.rectangle(CX, cy + 60, bannerW, 110, THEME.PANEL).setStrokeStyle(1, THEME.BORDER);
        this.scrollGroup.add(banner);

        // Name
        this.scrollGroup.add(this.add.text(CX - bannerW / 2 + 20, cy + 25, char.mc_name, { fontSize: '18px', color: '#fff', fontStyle: 'bold' }).setOrigin(0, 0.5));

        // Limit Break Stars (Right aligned, above ATK)
        let stars = '';
        if (char.limit_break_level > 0) {
            stars = '⭐'.repeat(char.limit_break_level);
            this.scrollGroup.add(this.add.text(CX + bannerW / 2 - 20, cy + 25, stars, { fontSize: '14px' }).setOrigin(1, 0.5));
        }

        // Element Logo on the left
        const elKey = char.mc_element ? `element_${char.mc_element.toLowerCase()}` : '';
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
        const elNameStr = char.mc_element ? char.mc_element.toUpperCase() : '?';
        const colorStr = '#' + color.toString(16).padStart(6, '0');
        this.scrollGroup.add(this.add.text(elX + 15, elY, elNameStr, { fontSize: '13px', color: colorStr, fontStyle: 'bold' }).setOrigin(0, 0.5));

        // Level (white)
        const maxLevel = this.calculateMaxLevel();
        this.scrollGroup.add(this.add.text(CX - bannerW / 2 + 20, cy + 80, `Lv ${char.item_level} / ${maxLevel}`, { fontSize: '14px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0.5));

        // EXP Bar (1/3 of banner width)
        const barW = bannerW / 3;
        const barX = CX - bannerW / 2 + 20;
        const barY = cy + 96;

        // Bordered Background
        const expBg = this.add.rectangle(barX, barY, barW, 6, 0x0f172a).setOrigin(0, 0.5).setStrokeStyle(1, 0x64748b);
        this.scrollGroup.add(expBg);

        let expPct = char.item_level >= maxLevel ? 1 : 0.5; // Visual placeholder if max exp logic isn't on client
        if (char.item_exp !== undefined && expPct !== 1) {
            expPct = (char.item_exp % 10000) / 10000;
        }
        const expFill = this.add.rectangle(barX, barY, barW * expPct, 6, 0x3b82f6).setOrigin(0, 0.5);
        this.scrollGroup.add(expFill);

        // Stats (colored)
        const atk = this.calculateBaseStat('atk');
        const hp = this.calculateBaseStat('hp');
        this.scrollGroup.add(this.add.text(CX + bannerW / 2 - 20, cy + 60, `ATK: ${atk}`, { fontSize: '14px', color: '#ef4444', fontStyle: 'bold' }).setOrigin(1, 0.5));
        this.scrollGroup.add(this.add.text(CX + bannerW / 2 - 20, cy + 85, `HP:  ${hp}`, { fontSize: '14px', color: '#4ade80', fontStyle: 'bold' }).setOrigin(1, 0.5));

        cy += 140;

        // ACTION BUTTONS
        if (this.fromParty && this.partyState && this.partyState.partySlotId !== 'char_slot_1') {
            const btnThirdW = (W - 100) / 3;

            // Upgrade Btn
            const upgZone = this.add.zone(40 + btnThirdW / 2, cy + 20, btnThirdW, 40).setInteractive({ useHandCursor: true });
            const upgBg = this.add.rectangle(40 + btnThirdW / 2, cy + 20, btnThirdW, 40, THEME.PANEL).setStrokeStyle(1, 0x10b981);
            upgZone.on('pointerdown', () => this.showUpgradeModal());
            this.scrollGroup.addMultiple([upgBg, upgZone, this.add.text(40 + btnThirdW / 2, cy + 20, 'UPGRADE', { fontSize: '12px', color: '#10b981', fontStyle: 'bold' }).setOrigin(0.5)]);

            // Uncap Btn
            if (char.limit_break_level < 2) {
                const uncapZone = this.add.zone(CX, cy + 20, btnThirdW, 40).setInteractive({ useHandCursor: true });
                const uncapBg = this.add.rectangle(CX, cy + 20, btnThirdW, 40, THEME.PANEL).setStrokeStyle(1, 0x3b82f6);
                uncapZone.on('pointerdown', () => this.showLimitBreakModal());
                this.scrollGroup.addMultiple([uncapBg, uncapZone, this.add.text(CX, cy + 20, 'UNCAP', { fontSize: '12px', color: '#3b82f6', fontStyle: 'bold' }).setOrigin(0.5)]);
            }

            // Change Character Btn
            const changeZone = this.add.zone(W - 40 - btnThirdW / 2, cy + 20, btnThirdW, 40).setInteractive({ useHandCursor: true });
            const changeBg = this.add.rectangle(W - 40 - btnThirdW / 2, cy + 20, btnThirdW, 40, THEME.PANEL).setStrokeStyle(1, 0xf59e0b);
            changeZone.on('pointerdown', () => {
                this.showCharacterSelectionModal();
            });
            this.scrollGroup.addMultiple([changeBg, changeZone, this.add.text(W - 40 - btnThirdW / 2, cy + 20, 'CHANGE', { fontSize: '12px', color: '#f59e0b', fontStyle: 'bold' }).setOrigin(0.5)]);
        } else {
            const btnW = 160;
            // Upgrade Btn
            const upgZone = this.add.zone(120, cy + 20, btnW, 40).setInteractive({ useHandCursor: true });
            const upgBg = this.add.rectangle(120, cy + 20, btnW, 40, THEME.PANEL).setStrokeStyle(1, 0x10b981);
            upgZone.on('pointerdown', () => this.showUpgradeModal());
            this.scrollGroup.addMultiple([upgBg, upgZone, this.add.text(120, cy + 20, 'UPGRADE', { fontSize: '14px', color: '#10b981', fontStyle: 'bold' }).setOrigin(0.5)]);

            // Uncap Btn
            if (char.limit_break_level < 2) {
                const uncapZone = this.add.zone(W - 120, cy + 20, btnW, 40).setInteractive({ useHandCursor: true });
                const uncapBg = this.add.rectangle(W - 120, cy + 20, btnW, 40, THEME.PANEL).setStrokeStyle(1, 0x3b82f6);
                uncapZone.on('pointerdown', () => this.showLimitBreakModal());
                this.scrollGroup.addMultiple([uncapBg, uncapZone, this.add.text(W - 120, cy + 20, 'UNCAP', { fontSize: '14px', color: '#3b82f6', fontStyle: 'bold' }).setOrigin(0.5)]);
            }
        }

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
                    let cdTextX = W - 35;

                    if (skill.status_effects && skill.status_effects.length > 0) {
                        cdTextX = W - 55; // geser CD text sedikit ke kiri
                        const infoZone = this.add.zone(W - 30, cy + 20, 30, 30).setInteractive({ useHandCursor: true });
                        const infoBg = this.add.circle(W - 30, cy + 20, 10, 0x1e293b).setStrokeStyle(1, 0x3b82f6);
                        const infoText = this.add.text(W - 30, cy + 20, '!', { fontSize: '12px', color: '#3b82f6', fontStyle: 'bold' }).setOrigin(0.5);
                        this.scrollGroup.addMultiple([infoBg, infoText, infoZone]);

                        infoZone.on('pointerdown', () => this.showSkillEffectModal(skill));
                    }

                    this.scrollGroup.add(this.add.text(cdTextX, cy + 20, `CD: ${skill.ms_cooldown}T`, { fontSize: '11px', color: THEME.TEXT_MUTED }).setOrigin(1, 0.5));

                    // Actual Description from Database
                    const desc = skill.ms_desc || `[${skill.ms_action_type}] Target: ${skill.ms_target_type}`;
                    this.scrollGroup.add(this.add.text(35, cy + 35, desc, {
                        fontSize: '11px',
                        color: THEME.TEXT_PRIMARY,
                        wordWrap: { width: W - 70, useAdvancedWrap: true }
                    }).setOrigin(0, 0));
                }

                cy += boxH + 15;
            });
        } else {
            this.scrollGroup.add(this.add.text(CX, cy + 30, 'Tidak ada skill aktif.', { fontSize: '12px', color: THEME.TEXT_MUTED }).setOrigin(0.5));
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

        const modalBg = this.add.rectangle(CX, CY, W - 40, 320, THEME.PANEL).setStrokeStyle(1, 0x10b981);
        this.modalGroup.add(modalBg);

        this.modalGroup.add(this.add.text(CX, CY - 130, 'UPGRADE LEVEL', { fontSize: '18px', color: '#10b981', fontStyle: 'bold', letterSpacing: 2 }).setOrigin(0.5));
        this.modalGroup.add(this.add.rectangle(CX, CY - 110, W - 80, 1, 0x064e3b));

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

                // Enhance Crystal is mat_id = 4
                const crystal = materials.find(m => m.mat_id === 4);
                const crystalCount = crystal ? crystal.quantity : 0;

                this.modalGroup.add(this.add.text(CX, CY - 90, `${char.mc_name}`, { fontSize: '14px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));
                this.modalGroup.add(this.add.text(CX, CY - 70, `Level: ${char.item_level}`, { fontSize: '14px', color: '#f59e0b', fontStyle: 'bold' }).setOrigin(0.5));

                this.modalGroup.add(this.add.text(40, CY - 30, 'Enhance Crystal:', { fontSize: '12px', color: THEME.TEXT_MUTED }).setOrigin(0, 0.5));
                this.modalGroup.add(this.add.text(W - 40, CY - 30, `${crystalCount} dimilikii`, { fontSize: '12px', color: THEME.TEXT_PRIMARY }).setOrigin(1, 0.5));

                let qty = 1;
                const costPerItem = 500;

                const qtyText = this.add.text(CX, CY + 20, `${qty}`, { fontSize: '24px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

                const minusBtn = this.add.text(CX - 50, CY + 20, '-', { fontSize: '24px', color: THEME.TEXT_PRIMARY, backgroundColor: '#334155', padding: { x: 10, y: 5 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
                const plusBtn = this.add.text(CX + 50, CY + 20, '+', { fontSize: '24px', color: THEME.TEXT_PRIMARY, backgroundColor: '#334155', padding: { x: 10, y: 5 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });

                const targetLevelText = this.add.text(CX, CY + 50, 'Target Level: ?', { fontSize: '13px', color: '#10b981', fontStyle: 'bold' }).setOrigin(0.5);

                const goldReqInit = qty * costPerItem;
                const costText = this.add.text(CX, CY + 80, `${goldReqInit} / ${gold} Gold`, { fontSize: '12px', color: gold >= goldReqInit ? '#facc15' : THEME.DANGER, fontStyle: 'bold' }).setOrigin(0.5);

                const currentExp = char.item_exp || 0;
                const calculateTargetLvl = (q) => {
                    const totalExp = currentExp + (q * 80000);
                    const maxLevel = this.calculateMaxLevel();
                    let charTotal = 0;
                    let tLevel = 1;
                    for (let i = 2; i <= maxLevel; i++) {
                        charTotal += Math.floor(50 * Math.pow(i, 1.6));
                        if (totalExp >= charTotal) tLevel = i;
                        else break;
                    }
                    return tLevel;
                };

                const updateQty = (delta) => {
                    let tempQty = qty + delta;
                    if (tempQty < 1) tempQty = 1;
                    if (tempQty > crystalCount) tempQty = crystalCount > 0 ? crystalCount : 1;

                    const maxLvl = this.calculateMaxLevel();
                    let maxExpReq = 0;
                    for (let i = 2; i <= maxLvl; i++) {
                        maxExpReq += Math.floor(50 * Math.pow(i, 1.6));
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

                    const tLvl = calculateTargetLvl(qty);
                    targetLevelText.setText(`Target Level: ${tLvl}${tLvl >= maxLvl ? ' (MAX)' : ''}`);

                    const goldReq = qty * costPerItem;
                    costText.setText(`${goldReq} / ${gold} Gold`);
                    costText.setColor(gold >= goldReq ? '#facc15' : THEME.DANGER);
                };
                updateQty(0); // Initialize text

                minusBtn.on('pointerdown', () => updateQty(-1));
                plusBtn.on('pointerdown', () => updateQty(1));

                // A better approach for plus 10
                const plus10Btn = this.add.text(CX + 100, CY + 20, '+10', { fontSize: '16px', color: THEME.TEXT_PRIMARY, backgroundColor: '#334155', padding: { x: 5, y: 5 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
                plus10Btn.on('pointerdown', () => updateQty(10));

                const minus10Btn = this.add.text(CX - 100, CY + 20, '-10', { fontSize: '16px', color: THEME.TEXT_PRIMARY, backgroundColor: '#334155', padding: { x: 5, y: 5 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
                minus10Btn.on('pointerdown', () => updateQty(-10));

                this.modalGroup.addMultiple([qtyText, minusBtn, plusBtn, plus10Btn, minus10Btn, targetLevelText, costText]);

                // Cancel Button
                const btnW = 120;
                const cancelZone = this.add.zone(CX - 70, CY + 130, btnW, 40).setInteractive({ useHandCursor: true });
                const cancelBg = this.add.rectangle(CX - 70, CY + 130, btnW, 40, THEME.PANEL).setStrokeStyle(1, 0xffffff);
                const cancelTxt = this.add.text(CX - 70, CY + 130, 'CANCEL', { fontSize: '14px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

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
                    if (crystalCount < qty) {
                        enhTxt.setText('NOT ENOUGH CRYSTAL').setColor('#ef4444');
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
                                invId: char.inv_id,
                                itemType: 'Character',
                                quantity: qty,
                                materialId: 4
                            })
                        });
                        const upgData = await upgRes.json();

                        if (upgData.status === 'success') {
                            this.showUpgradeSuccessModal(char.item_level, upgData.data.new_level, upgData.data.new_exp);
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

    async showLimitBreakModal() {
        const char = this.char;
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const CX = W / 2;
        const CY = H / 2;

        this.modalGroup.clear(true, true);
        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.8).setOrigin(0).setInteractive();
        this.modalGroup.add(overlay);

        const modalBg = this.add.rectangle(CX, CY, W - 40, 320, THEME.PANEL).setStrokeStyle(1, 0x3b82f6);
        this.modalGroup.add(modalBg);

        this.modalGroup.add(this.add.text(CX, CY - 130, 'LIMIT BREAK (UNCAP)', { fontSize: '18px', color: '#3b82f6', fontStyle: 'bold', letterSpacing: 2 }).setOrigin(0.5));
        this.modalGroup.add(this.add.text(CX, CY - 105, `${char.mc_name} (LB ${char.limit_break_level} ➔ LB ${char.limit_break_level + 1})`, { fontSize: '14px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));
        this.modalGroup.add(this.add.rectangle(CX, CY - 85, W - 80, 1, 0x1e293b));

        const loadingText = this.add.text(CX, CY, 'Loading data...', { fontSize: '12px', color: THEME.TEXT_MUTED }).setOrigin(0.5);
        this.modalGroup.add(loadingText);

        try {
            const res = await fetch(`${API_BASE}/api/party/${this.playerId}/inventory/all`);
            const data = await res.json();

            if (data.status === 'success') {
                loadingText.destroy();
                const materials = data.data.materials || [];
                const gold = data.data.gold || 0;

                let orbName = char.mc_element ? `${char.mc_element} Orb` : 'Elemental Orb';
                let orbCount = 0;
                let goldReq = 1000 * (char.limit_break_level + 1);
                let orbReq = 3 * (char.limit_break_level + 1);

                try {
                    const costRes = await fetch(`${API_BASE}/api/party/${this.playerId}/lb-cost/${char.mc_id}/${char.limit_break_level + 1}`);
                    const costData = await costRes.json();

                    if (costData.status === 'success') {
                        goldReq = costData.data.gold_cost;
                        orbReq = costData.data.mat_qty;
                        if (costData.data.mat_name) orbName = costData.data.mat_name;

                        const orb = materials.find(m => m.mat_id === costData.data.mat_id);
                        if (orb) orbCount = orb.quantity;
                    }
                } catch (e) {
                    console.error('Failed to fetch LB cost', e);
                }

                this.modalGroup.add(this.add.text(CX, CY - 70, 'Syarat Material:', { fontSize: '12px', color: THEME.TEXT_MUTED }).setOrigin(0.5));

                // Orb Card
                const ix = CX;
                const iy = CY - 15;
                const boxSize = 75;
                const itemBg = this.add.graphics().fillStyle(THEME.PANEL, 1).lineStyle(1, THEME.BORDER).fillRoundedRect(ix - boxSize / 2, iy - boxSize / 2, boxSize, boxSize, 8).strokeRoundedRect(ix - boxSize / 2, iy - boxSize / 2, boxSize, boxSize, 8);
                this.modalGroup.add(itemBg);

                this.modalGroup.add(this.add.text(ix, iy - 18, '🔮', { fontSize: "24px" }).setOrigin(0.5));
                this.modalGroup.add(this.add.text(ix, iy + 6, orbName, { fontSize: "9px", color: "#ccc" }).setOrigin(0.5));
                this.modalGroup.add(this.add.text(ix, iy + 22, `${orbReq} / ${orbCount}`, { fontSize: "12px", color: orbCount >= orbReq ? "#ffffff" : "#ef4444", fontStyle: "bold" }).setOrigin(0.5));

                // Gold requirement
                const goldTxt = `${goldReq} / ${gold} Gold`;
                this.modalGroup.add(this.add.text(CX, iy + boxSize / 2 + 15, goldTxt, { fontSize: '12px', color: gold >= goldReq ? '#facc15' : '#ef4444', fontStyle: 'bold' }).setOrigin(0.5));

                // Cancel Button
                const closeZone = this.add.zone(W / 2 - 60, CY + 120, 100, 35).setInteractive({ useHandCursor: true });
                const closeBg = this.add.rectangle(W / 2 - 60, CY + 120, 100, 35, THEME.PANEL).setStrokeStyle(1, 0xffffff);
                closeZone.on('pointerdown', () => this.modalGroup.clear(true, true));
                this.modalGroup.addMultiple([closeBg, closeZone, this.add.text(W / 2 - 60, CY + 120, 'CANCEL', { fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)]);

                const canLimitBreak = (gold >= goldReq && orbCount >= orbReq);

                // Confirm Button
                const confirmZone = this.add.zone(W / 2 + 60, CY + 120, 100, 35);
                if (canLimitBreak) confirmZone.setInteractive({ useHandCursor: true });
                const confirmBg = this.add.rectangle(W / 2 + 60, CY + 120, 100, 35, THEME.PANEL).setStrokeStyle(1, canLimitBreak ? 0x3b82f6 : 0x334155);
                const confirmTxtColor = canLimitBreak ? '#3b82f6' : '#64748b';

                confirmZone.on('pointerdown', async () => {
                    confirmZone.disableInteractive();
                    this.modalGroup.add(this.add.text(CX, CY + 80, 'Processing...', { fontSize: '12px', color: THEME.GOLD }).setOrigin(0.5));

                    const lbRes = await PartyApi.limitBreak(this.playerId, char.inv_id);
                    if (lbRes.status === 'success') {
                        this.char.limit_break_level += 1;
                        this.showLimitBreakSuccessModal();
                    } else {
                        this.modalGroup.add(this.add.text(CX, CY + 80, lbRes.message || 'Error', { fontSize: '12px', color: THEME.DANGER }).setOrigin(0.5));
                        setTimeout(() => confirmZone.setInteractive(), 2000);
                    }
                });
                this.modalGroup.addMultiple([confirmBg, confirmZone, this.add.text(W / 2 + 60, CY + 120, 'CONFIRM', { fontSize: '13px', color: confirmTxtColor, fontStyle: 'bold' }).setOrigin(0.5)]);
            }
        } catch (error) {
            loadingText.setText('Failed to load data.');
        }
    }


    showSkillEffectModal(skill) {
        const effects = skill.status_effects || [];
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const CX = W / 2;
        const CY = H / 2;

        if (this.modalGroup) {
            this.modalGroup.clear(true, true);
        } else {
            this.modalGroup = this.add.group();
        }

        // Overlay
        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.8).setOrigin(0).setInteractive();
        this.modalGroup.add(overlay);

        const modalH = Math.min(H - 100, 100 + (effects.length * 50));
        const modalBg = this.add.rectangle(CX, CY, W - 40, modalH, THEME.PANEL).setStrokeStyle(1, 0x3b82f6);
        this.modalGroup.add(modalBg);

        this.modalGroup.add(this.add.text(CX, CY - modalH / 2 + 25, 'SKILL EFFECTS', { fontSize: '16px', color: '#3b82f6', fontStyle: 'bold', letterSpacing: 1 }).setOrigin(0.5));

        // X button removed as requested

        let ey = CY - modalH / 2 + 70;
        effects.forEach((eff) => {
            const isBuff = eff.effect_type === 'Buff';
            const effColor = isBuff ? '#10b981' : '#ef4444'; // Green for Buff, Red for Debuff
            const iconStr = isBuff ? '⬆' : '⬇';

            const bg = this.add.rectangle(CX, ey, W - 80, 40, 0x1e293b).setStrokeStyle(1, 0x334155);
            this.modalGroup.add(bg);

            this.modalGroup.add(this.add.text(CX - (W - 80) / 2 + 15, ey - 8, `${iconStr} ${eff.effect_name}`, { fontSize: '13px', color: effColor, fontStyle: 'bold' }).setOrigin(0, 0.5));
            this.modalGroup.add(this.add.text(CX - (W - 80) / 2 + 32, ey + 8, `Lasts: ${eff.duration} turns`, { fontSize: '11px', color: THEME.TEXT_PRIMARY }).setOrigin(0, 0.5));

            ey += 50;
        });

        // OK Button at bottom
        const okBtn = this.add.rectangle(CX, CY + modalH / 2 - 25, 100, 30, 0x1e293b).setStrokeStyle(1, 0x3b82f6).setInteractive({ useHandCursor: true });
        okBtn.on('pointerdown', () => this.modalGroup.clear(true, true));
        this.modalGroup.addMultiple([
            okBtn,
            this.add.text(CX, CY + modalH / 2 - 25, 'OK', { fontSize: '14px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5)
        ]);
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
            this.char.item_level = newLevel;
            this.char.item_exp = newExp;
            this.scene.start('LoadingScene', { targetScene: 'CharacterDetailScene', targetData: this.targetData });
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
            this.scene.start('LoadingScene', { targetScene: 'CharacterDetailScene', targetData: this.targetData });
        });

        this.modalGroup.addMultiple([overlay, modalBg, title, desc, okBg, okZone, okTxt]);
    }

    async showCharacterSelectionModal(page = 1, sortBy = null, displayMode = null) {
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

        const panel = this.add.rectangle(CX, panelCenterY, panelWidth, panelHeight, 0x0d1b2a).setStrokeStyle(2, 0xf59e0b).setInteractive();
        this.modalGroup.add(panel);

        this.modalGroup.add(this.add.text(CX, panelTop + 25, 'SELECT CHARACTER', { fontSize: '16px', fontStyle: 'bold', color: '#f59e0b', fontFamily: 'Outfit', letterSpacing: 2 }).setOrigin(0.5));
        this.modalGroup.add(this.add.rectangle(CX, panelTop + 50, panelWidth - 40, 1, 0x334155));

        const closeBtn = this.add.circle(CX + (panelWidth / 2) - 25, panelTop + 25, 14, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        const closeTxt = this.add.text(CX + (panelWidth / 2) - 25, panelTop + 25, '✕', { fontSize: '12px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        closeBtn.on('pointerdown', () => this.modalGroup.clear(true, true));
        this.modalGroup.addMultiple([closeBtn, closeTxt]);

        const loadingTxt = this.add.text(CX, panelCenterY, 'Loading Characters...', { fontSize: '14px', color: '#fff' }).setOrigin(0.5);
        this.modalGroup.add(loadingTxt);

        if (!this.charactersData) {
            const invRes = await PartyApi.getInventory(this.playerId);
            if (invRes.status === 'success') {
                this.charactersData = invRes.data.characters;
            } else {
                loadingTxt.setText('Failed to load characters');
                return;
            }
        }
        loadingTxt.destroy();

        const preset = this.partyState.preset;
        const equipped = [
            preset.char_slot_2_inv_id, preset.char_slot_3_inv_id, preset.char_slot_4_inv_id
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
            this.showCharacterSelectionModal(1, nextSort, displayMode);
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
            this.showCharacterSelectionModal(page, sortBy, nextDisp);
        });
        this.modalGroup.addMultiple([dispBtnBg, dispZone, dispTxt]);

        // Remove MC from options and the currently viewed character
        let list = this.charactersData.filter(c => c.mc_id !== 1 && c.inv_id !== this.char.inv_id);

        // Sort logic
        list.sort((a, b) => {
            const rarityOrder = { 'SSR': 3, 'SR': 2, 'R': 1 };
            if (sortBy === 'Rarity') {
                if (rarityOrder[a.mc_rarity] !== rarityOrder[b.mc_rarity]) return rarityOrder[b.mc_rarity] - rarityOrder[a.mc_rarity];
                return (b.item_level || 1) - (a.item_level || 1);
            } else if (sortBy === 'ATK') {
                const aAtk = a.mc_base_atk + (a.mc_atk_growth * ((a.item_level || 1) - 1));
                const bAtk = b.mc_base_atk + (b.mc_atk_growth * ((b.item_level || 1) - 1));
                if (bAtk !== aAtk) return bAtk - aAtk;
                return (b.item_level || 1) - (a.item_level || 1);
            } else if (sortBy === 'HP') {
                const aHp = a.mc_base_hp + (a.mc_hp_growth * ((a.item_level || 1) - 1));
                const bHp = b.mc_base_hp + (b.mc_hp_growth * ((b.item_level || 1) - 1));
                if (bHp !== aHp) return bHp - aHp;
                return (b.item_level || 1) - (a.item_level || 1);
            } else {
                if (b.item_level !== a.item_level) return (b.item_level || 1) - (a.item_level || 1);
                return rarityOrder[b.mc_rarity] - rarityOrder[a.mc_rarity];
            }
        });

        const cols = 4;
        const boxW = 85;
        const boxH = 135;
        const paddingX = 15;
        const paddingY = 15;
        const startX = CX - ((cols - 1) * (boxW + paddingX)) / 2;
        const startYGrid = panelTop + 170;

        const itemsPerPage = 12;
        const totalPages = Math.max(1, Math.ceil(list.length / itemsPerPage));
        const startIndex = (page - 1) * itemsPerPage;
        const pagedItems = list.slice(startIndex, startIndex + itemsPerPage);

        pagedItems.forEach((item, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const ix = startX + col * (boxW + paddingX);
            const iy = startYGrid + row * (boxH + paddingY) + (boxH / 2);

            let color = THEME.BORDER;
            const rarity = item.mc_rarity;
            if (rarity === 'SSR') color = 0xffd700;
            else if (rarity === 'SR') color = 0xa855f7;
            else if (rarity === 'R') color = 0xef4444;

            const cardBg = this.add.graphics();
            cardBg.fillStyle(THEME.PANEL, 1);
            cardBg.lineStyle(2, THEME.BORDER);
            cardBg.fillRoundedRect(ix - boxW / 2, iy - boxH / 2, boxW, boxH, 8);
            cardBg.strokeRoundedRect(ix - boxW / 2, iy - boxH / 2, boxW, boxH, 8);
            this.modalGroup.add(cardBg);

            const isEquipped = (
                item.inv_id === this.partyState.preset.char_slot_2_inv_id ||
                item.inv_id === this.partyState.preset.char_slot_3_inv_id ||
                item.inv_id === this.partyState.preset.char_slot_4_inv_id
            );

            const zone = this.add.zone(ix, iy, boxW, boxH).setInteractive({ useHandCursor: true });
            zone.on('pointerdown', async (p, x, y, e) => {
                e.stopPropagation();
                this.modalGroup.clear(true, true);
                await this.saveAndReturn(item.inv_id);
            });
            this.modalGroup.add(zone);

            const yTop = iy - boxH / 2;
            const pSize = boxW - 8;
            const artBg = this.add.graphics();
            artBg.fillStyle(THEME.BG, 1);

            const sqKey = `char_sq_${item.mc_id}`;
            if (this.textures.exists(sqKey)) {
                const portrait = this.add.image(ix, yTop + 4 + pSize / 2, sqKey).setDisplaySize(pSize, pSize);
                portrait.setAlpha(1, 1, 0.25, 0.25);
                const maskShape = this.make.graphics();
                maskShape.fillStyle(0xffffff);
                maskShape.fillRoundedRect(ix - pSize / 2, yTop + 4, pSize, pSize, 4);
                portrait.setMask(maskShape.createGeometryMask());
                this.modalGroup.add(portrait);
            } else {
                artBg.fillRoundedRect(ix - pSize / 2, yTop + 4, pSize, pSize, 4);
                this.modalGroup.add(artBg);
            }

            // Outline of 1:1 portrait
            const border = this.add.graphics();
            border.lineStyle(1, color);
            border.strokeRoundedRect(ix - pSize / 2, yTop + 4, pSize, pSize, 4);
            this.modalGroup.add(border);

            // EQUIPPED Indicator (top left)
            if (isEquipped) {
                const eX = ix - pSize / 2 + 8;
                const eY = yTop + 4 + 8;
                const eBg = this.add.circle(eX, eY, 7, 0x3b82f6).setStrokeStyle(1, THEME.PANEL);
                const eTxt = this.add.text(eX, eY, 'E', { fontSize: '9px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
                this.modalGroup.addMultiple([eBg, eTxt]);
            }

            // Name
            this.modalGroup.add(this.add.text(ix, yTop + 4 + pSize + 10, item.mc_name.split(' ')[0], { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));

            const element = item.mc_element;
            const elKey = element ? `element_${element.toLowerCase()}` : '';
            if (this.textures.exists(elKey)) {
                const iconImg = this.add.image(ix + pSize / 2 - 8, yTop + 4 + 8, elKey).setDisplaySize(14, 14);
                const shape = this.make.graphics();
                shape.fillCircle(ix + pSize / 2 - 8, yTop + 4 + 8, 7);
                iconImg.setMask(shape.createGeometryMask());
                const strokeCircle = this.add.circle(ix + pSize / 2 - 8, yTop + 4 + 8, 7).setStrokeStyle(1, THEME.PANEL);
                this.modalGroup.addMultiple([iconImg, strokeCircle]);
            }

            if (rarity) {
                let rColor = '#ffffff';
                if (rarity === 'SSR') rColor = '#ffd700';
                else if (rarity === 'SR') rColor = '#a855f7';
                else if (rarity === 'R') rColor = '#ef4444';
                this.modalGroup.add(this.add.text(ix - pSize / 2 + 4, yTop + 4 + pSize - 2, rarity, { fontSize: '11px', color: rColor, fontStyle: 'bold', stroke: '#000000', strokeThickness: 2, fontFamily: 'Outfit' }).setOrigin(0, 1));
            }

            const stat1Y = yTop + 4 + pSize + 24;
            const stat2Y = yTop + 4 + pSize + 38;

            if (displayMode === 'Level/LB') {
                this.modalGroup.add(this.add.text(ix, stat1Y, `Lv: ${item.item_level}`, { fontSize: '10px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
                this.modalGroup.add(this.add.text(ix, stat2Y, `LB: ${item.limit_break_level}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));
            } else if (displayMode === 'Skills') {
                const skills = (item.skills || []).filter(s => s.ms_category === 'Special');
                if (skills.length > 0) {
                    const sx = ix;
                    const sy = yTop + 4 + pSize + 30;
                    const sBox = this.add.graphics().fillStyle(THEME.AETHER, 1).fillRoundedRect(sx - 12, sy - 12, 24, 24, 4);
                    this.modalGroup.add(sBox);
                    this.modalGroup.add(this.add.text(sx, sy, 'SA', { fontSize: '10px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
                } else {
                    this.modalGroup.add(this.add.text(ix, yTop + 4 + pSize + 30, 'No SA', { fontSize: '9px', color: THEME.TEXT_MUTED }).setOrigin(0.5));
                }
            } else {
                const itemAtk = item.mc_base_atk + (item.mc_atk_growth * ((item.item_level || 1) - 1));
                const itemHp = item.mc_base_hp + (item.mc_hp_growth * ((item.item_level || 1) - 1));

                this.modalGroup.add(this.add.text(ix, stat1Y, `ATK: ${itemAtk}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));
                this.modalGroup.add(this.add.text(ix, stat2Y, `HP:  ${itemHp}`, { fontSize: '10px', color: THEME.TEXT_PRIMARY, fontStyle: 'bold' }).setOrigin(0.5));
            }
        });

        const pageY = panelBottom - 30;
        const prevActive = page > 1;
        const prevBtn = this.add.rectangle(CX - 80, pageY, 60, 25, prevActive ? 0x1e293b : 0x0f172a).setStrokeStyle(1, THEME.BORDER);
        const prevTxt = this.add.text(CX - 80, pageY, '< PREV', { fontSize: '10px', fontStyle: 'bold', color: prevActive ? '#ffffff' : THEME.TEXT_MUTED }).setOrigin(0.5);
        if (prevActive) {
            prevBtn.setInteractive({ useHandCursor: true });
            prevBtn.on('pointerdown', () => this.showCharacterSelectionModal(page - 1, sortBy, displayMode));
        }

        const nextActive = page < totalPages;
        const nextBtn = this.add.rectangle(CX + 80, pageY, 60, 25, nextActive ? 0x1e293b : 0x0f172a).setStrokeStyle(1, THEME.BORDER);
        const nextTxt = this.add.text(CX + 80, pageY, 'NEXT >', { fontSize: '10px', fontStyle: 'bold', color: nextActive ? '#ffffff' : THEME.TEXT_MUTED }).setOrigin(0.5);
        if (nextActive) {
            nextBtn.setInteractive({ useHandCursor: true });
            nextBtn.on('pointerdown', () => this.showCharacterSelectionModal(page + 1, sortBy, displayMode));
        }

        this.modalGroup.addMultiple([prevBtn, prevTxt, nextBtn, nextTxt]);
        this.modalGroup.add(this.add.text(CX, pageY, `${page} / ${totalPages}`, { fontSize: '12px', fontStyle: 'bold', color: THEME.TEXT_PRIMARY }).setOrigin(0.5));
    }

    async saveAndReturn(newInvId) {
        const W = this.cameras.main.width, H = this.cameras.main.height, CX = W / 2;
        const loadOverlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.8).setOrigin(0).setInteractive().setDepth(2000);
        const loadTxt = this.add.text(CX, H / 2, 'Saving Preset...', { fontSize: '16px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5).setDepth(2000);

        const preset = this.partyState.preset;
        const targetSlot = this.partyState.partySlotId;
        const oldInvId = preset[targetSlot];

        // Find if new character is already in another slot
        const charSlots = ['char_slot_2_inv_id', 'char_slot_3_inv_id'];
        let oldSlotId = null;
        if (newInvId) {
            charSlots.forEach(s => {
                if (preset[s] === newInvId) oldSlotId = s;
            });
        }

        // Apply swap
        if (oldSlotId) {
            preset[oldSlotId] = oldInvId;
        }
        preset[targetSlot] = newInvId;

        // Recalculate stats to show: Base Char Stat -> Base Char Stat + Grid Stat
        const gridAtk = this.partyState.weapAtk || 0;
        const gridHp = this.partyState.weapHp || 0;

        let oldAtk = 0;
        let oldHp = 0;
        let newAtk = 0;
        let newHp = 0;

        let newlyEquippedChar = null;
        if (newInvId && this.charactersData) {
            newlyEquippedChar = this.charactersData.find(c => c.inv_id === newInvId);
            if (newlyEquippedChar) {
                const cBaseAtk = newlyEquippedChar.mc_base_atk + (newlyEquippedChar.mc_atk_growth * ((newlyEquippedChar.item_level || 1) - 1));
                const cBaseHp = newlyEquippedChar.mc_base_hp + (newlyEquippedChar.mc_hp_growth * ((newlyEquippedChar.item_level || 1) - 1));

                oldAtk = cBaseAtk; // Character Base Stat (with level)
                oldHp = cBaseHp;

                newAtk = cBaseAtk + gridAtk; // Total Stat (Char + Grid)
                newHp = cBaseHp + gridHp;
            }
        }

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
                characterChanged: {
                    newInvId: newInvId,
                    oldAtk: Math.floor(oldAtk),
                    oldHp: Math.floor(oldHp),
                    newAtk: Math.floor(newAtk),
                    newHp: Math.floor(newHp)
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
