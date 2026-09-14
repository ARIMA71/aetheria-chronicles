import Phaser from 'phaser';
import { THEME } from '../main.js';
import { playGlobalBGM } from '../utils/audioManager.js';
import { checkSession, saveCurrentScene, clearSession } from '../utils/auth.js';
import BattleApi from '../services/BattleApi.js';
import PartyApi from '../services/PartyApi.js';
import { CameraScrollManager } from '../utils/cameraScroll.js';
import TopMenuComponent from '../ui/TopMenuComponent.js';
import { API_BASE as _ROOT } from '../config.js';

const W = 480, H = 830, CX = 240;
const API_BASE = `${_ROOT}/api`;

// Area positions on the map (Staggered organic layout)
const AREA_DOTS = [
    { x: 95, y: 220, label: 'I' },
    { x: 240, y: 135, label: 'II' },
    { x: 370, y: 210, label: 'III' },
];

export default class QuestScene extends Phaser.Scene {
    constructor() { super('QuestScene'); }

    init(data) {
        this.targetData = data || {};
        this.openQuestId = this.targetData.openQuestId || null;
    }

    preload() {
        this.load.image('bg_quest', 'assets/backgrounds/questScene.jpg');
        if (!this.textures.exists('btn_icon_normal')) this.load.image('btn_icon_normal', 'assets/ui/button/C/Icon Button.png');
        if (!this.textures.exists('btn_icon_hover')) this.load.image('btn_icon_hover', 'assets/ui/button/C/Icon Button Hover.png');
        if (!this.textures.exists('btn_a_normal')) this.load.image('btn_a_normal', 'assets/ui/button/A/Normal.png');
        if (!this.textures.exists('btn_a_hover')) this.load.image('btn_a_hover', 'assets/ui/button/A/Hover.png');
        if (!this.textures.exists('btn_a_active')) this.load.image('btn_a_active', 'assets/ui/button/A/Active.png');
        if (!this.textures.exists('btn_b_normal')) this.load.image('btn_b_normal', 'assets/ui/button/B/Button Normal 1.png');
        if (!this.textures.exists('btn_b_hover')) this.load.image('btn_b_hover', 'assets/ui/button/B/Button Hover 1.png');
        if (!this.textures.exists('btn_b_active')) this.load.image('btn_b_active', 'assets/ui/button/B/Button Active 1.png');
        if (!this.textures.exists('card_x100')) this.load.image('card_x100', 'assets/ui/card/Card X100.png');
        if (!this.textures.exists('card_x101')) this.load.image('card_x101', 'assets/ui/card/Card X101.png');
        if (!this.textures.exists('card_x12')) this.load.image('card_x12', 'assets/ui/card/Card X12.png');
    }

    create() {
        if (!checkSession(this)) return;
        saveCurrentScene(this.scene.key);
        playGlobalBGM(this, 'bgm_quest_selection');
        const raw = localStorage.getItem('aetheria_player');
        this.playerData = raw ? JSON.parse(raw) : { player_id: 1 };
        this.playerId = this.playerData.player_id || 1;
        this.selectedArea = null;
        this.selectedPresetSlot = 1;
        this.questListContainer = null;
        this.preBattleContainer = null;
        this.staminaModalContainer = null;
        this.areaData = [];

        this.fullPresets = [];
        this.fullCharacters = [];
        this.fullWeapons = [];
        this.fullMcSkills = [];
        this.partyDataLoaded = false;

        this.musicOn = localStorage.getItem('music_on') !== 'false';
        this.sfxOn = localStorage.getItem('sfx_on') !== 'false';

        const bg = this.add.image(CX, H / 2, 'bg_quest').setOrigin(0.5);
        const scale = Math.max(W / bg.width, H / bg.height);
        bg.setScale(scale);
        this._buildTopBar();
        this.topMenu = new TopMenuComponent(this);
        this._buildMap();
        this._buildQuestPanel();
        this.fetchQuestData();
        this._checkActiveBattle();
        this._loadFullPartyData();
    }

    async _loadFullPartyData() {
        const presetsRes = await PartyApi.getPresets(this.playerId);
        const invRes = await PartyApi.getInventory(this.playerId);
        const skillsRes = await PartyApi.getMcSkills(this.playerId);
        if (presetsRes.status === 'success' && invRes.status === 'success' && skillsRes.status === 'success') {
            this.fullPresets = presetsRes.data;
            this.fullCharacters = invRes.data.characters;
            this.fullWeapons = invRes.data.weapons;
            this.fullMcSkills = skillsRes.data;
            this.partyDataLoaded = true;

            let assetsToLoad = 0;
            if (!this.textures.exists('element_fire')) { this.load.image('element_fire', 'assets/icons/elements/fire.png'); assetsToLoad++; }
            if (!this.textures.exists('element_wind')) { this.load.image('element_wind', 'assets/icons/elements/wind.png'); assetsToLoad++; }
            if (!this.textures.exists('element_earth')) { this.load.image('element_earth', 'assets/icons/elements/rock.png'); assetsToLoad++; }

            this.fullCharacters.forEach(c => {
                if (c.mc_portrait_path) {
                    let pPath = c.mc_portrait_path;
                    if (!pPath.endsWith('.png') && !pPath.endsWith('.jpg')) pPath += '.png';
                    const pKey = `portrait_${c.mc_id}`;
                    if (!this.textures.exists(pKey)) {
                        this.load.image(pKey, pPath);
                        assetsToLoad++;
                    }
                }
                if (c.mc_square_path) {
                    let sqPath = c.mc_square_path;
                    if (!sqPath.endsWith('.png') && !sqPath.endsWith('.jpg')) sqPath += '.png';
                    const sqKey = `char_sq_${c.mc_id}`;
                    if (!this.textures.exists(sqKey)) {
                        this.load.image(sqKey, sqPath);
                        assetsToLoad++;
                    }
                }
            });

            if (assetsToLoad > 0) {
                this.load.once('complete', () => {
                    if (this.preBattleContainer && this.presetCardsStartY) {
                        this._renderPresetCards(this.presetCardsStartY);
                    }
                });
                this.load.start();
            } else {
                if (this.preBattleContainer && this.presetCardsStartY) {
                    this._renderPresetCards(this.presetCardsStartY);
                }
            }
        }
    }

    _buildTopBar() {
        this.add.rectangle(CX, 30, W, 60, THEME.PANEL, THEME.PANEL_ALPHA).setStrokeStyle(1, THEME.BORDER).setScrollFactor(0).setDepth(100);
        this.add.text(CX, 30, 'QUEST MAP', { fontSize: '15px', fontStyle: 'bold', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit', letterSpacing: 2 }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        const backBtn = this.add.circle(40, 30, 18, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(100);
        const homeTxt = this.add.text(40, 30, 'HOME', { fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        backBtn.on('pointerover', () => { backBtn.setFillStyle(0x334155); homeTxt.setColor('#ffffff'); });
        backBtn.on('pointerout', () => { backBtn.setFillStyle(THEME.PANEL); homeTxt.setColor(THEME.TEXT_PRIMARY); });
        backBtn.on('pointerdown', () => this.scene.start('LoadingScene', { targetScene: 'MainMenuScene' }));
    }

    _buildMap() {
        // Title Header (No background rectangle behind map)
        this.add.text(CX, 80, 'SELECT AREA', { fontSize: '11px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#A5B4FC', letterSpacing: 2 }).setOrigin(0.5);

        // Area button placeholders using Button C design (Enlarged to 85px)
        this.areaDots = [];
        AREA_DOTS.forEach((dot, i) => {
            const baseSize = 85;
            
            // Dark circle fill under button C
            const circleBg = this.add.circle(dot.x, dot.y, (baseSize / 2) - 18, 0x0f172a, 1.0);

            const btnKey = this.textures.exists('btn_icon_normal') ? 'btn_icon_normal' : null;
            let btn;

            if (btnKey) {
                btn = this.add.image(dot.x, dot.y, 'btn_icon_normal').setOrigin(0.5);
                btn.setDisplaySize(baseSize, baseSize);
            } else {
                btn = this.add.circle(dot.x, dot.y, baseSize / 2, 0x0f172a);
                btn.setStrokeStyle(2, THEME.BORDER);
            }

            const labelTxt = this.add.text(dot.x, dot.y, dot.label, { fontSize: '15px', fontStyle: 'bold', color: '#ffffff', fontFamily: 'Outfit' }).setOrigin(0.5);
            const nameTxt = this.add.text(dot.x, dot.y + 48, '...', { fontSize: '11px', fontStyle: 'bold', color: THEME.TEXT_SECONDARY, stroke: '#000000', strokeThickness: 3, fontFamily: 'Outfit' }).setOrigin(0.5);
            const lockTxt = this.add.text(dot.x, dot.y - 44, '', { fontSize: '12px' }).setOrigin(0.5);

            this.areaDots.push({
                btn, circleBg, labelTxt, nameTxt, lockTxt, baseSize,
                x: dot.x, y: dot.y, index: i
            });
        });
    }

    _buildQuestPanel() {
        const panelW = W + 35; // 515px: Reduced width by 5px
        const panelH = 645; // Reduced height by 5px
        const panelY = 603; // Lowered Y position by 8px (from 595 to 603)

        this.questPanelContainer = this.add.container(0, 0);

        let panelBg;
        if (this.textures.exists('card_x101')) {
            panelBg = this.add.image(CX, panelY, 'card_x101').setDisplaySize(panelW, panelH);
            panelBg.setTint(0x38bdf8); // Sky Blue tint
        } else {
            panelBg = this.add.rectangle(CX, panelY, panelW, panelH, THEME.PANEL, 0.4).setStrokeStyle(1, THEME.BORDER);
        }

        // Title positioned comfortably 49px below top edge of Card X101
        this.questPanelTitle = this.add.text(CX, panelY - panelH / 2 + 49, 'Pilih area di peta untuk melihat quest', {
            fontSize: '14px', fontStyle: 'bold', color: '#ffffff', fontFamily: 'Outfit', letterSpacing: 1.2
        }).setOrigin(0.5);
        
        this.questListContainer = this.add.container(0, 0);

        this.questPanelContainer.add([panelBg, this.questPanelTitle, this.questListContainer]);
    }

    async fetchQuestData() {
        try {
            const res = await fetch(`${API_BASE}/quests?playerId=${this.playerId}`);
            const json = await res.json();
            if (json.status === 'success') {
                this.areaData = json.data.areas;
                this._updateAreaDots();

                let targetAreaIdx = -1;
                let targetQuest = null;

                if (this.openQuestId) {
                    this.areaData.forEach((area, aIdx) => {
                        const found = area.quests.find(q => q.mq_id === Number(this.openQuestId));
                        if (found) {
                            targetAreaIdx = aIdx;
                            targetQuest = found;
                        }
                    });
                }

                if (targetAreaIdx !== -1) {
                    this._selectArea(targetAreaIdx);
                    if (targetQuest) {
                        this._showPreBattleModal(targetQuest);
                    }
                } else {
                    const firstUnlockedIdx = this.areaData.findIndex(a => a.status === 'UNLOCKED');
                    if (firstUnlockedIdx !== -1) {
                        this._selectArea(firstUnlockedIdx);
                    }
                }
            }
        } catch (e) { console.error('Failed to fetch quests:', e); }
    }

    _updateAreaDots() {
        this.areaData.forEach((area, i) => {
            if (!this.areaDots[i]) return;
            const dot = this.areaDots[i];
            const unlocked = area.status === 'UNLOCKED';
            const isSelected = this.selectedArea === i;

            const normalTint = 0x38bdf8;
            const selectedTint = 0x22c55e;
            const hoverTint = 0x60a5fa;

            if (dot.btn.setTint) {
                dot.btn.setTint(unlocked ? (isSelected ? selectedTint : normalTint) : 0x475569);
            }

            dot.labelTxt.setColor(unlocked ? '#ffffff' : '#64748b');
            dot.nameTxt.setText(area.area_name);
            dot.nameTxt.setColor(isSelected ? '#22c55e' : (unlocked ? THEME.TEXT_PRIMARY : '#64748b'));
            dot.lockTxt.setText(unlocked ? '' : '🔒');

            if (unlocked) {
                dot.btn.setInteractive({ useHandCursor: true });
                dot.btn.on('pointerover', () => {
                    if (this.textures.exists('btn_icon_hover')) dot.btn.setTexture('btn_icon_hover');
                    if (dot.btn.setTint && this.selectedArea !== i) dot.btn.setTint(hoverTint);
                    dot.btn.setDisplaySize(dot.baseSize * 1.06, dot.baseSize * 1.06);
                    dot.circleBg.setScale(1.06);
                    dot.labelTxt.setScale(1.06);
                });

                dot.btn.on('pointerout', () => {
                    if (this.textures.exists('btn_icon_normal')) dot.btn.setTexture('btn_icon_normal');
                    if (dot.btn.setTint) dot.btn.setTint(this.selectedArea === i ? selectedTint : normalTint);
                    dot.btn.setDisplaySize(dot.baseSize, dot.baseSize);
                    dot.circleBg.setScale(1.0);
                    dot.labelTxt.setScale(1.0);
                });

                dot.btn.on('pointerdown', () => this._selectArea(i));

                dot.labelTxt.setInteractive({ useHandCursor: true });
                dot.labelTxt.on('pointerdown', () => this._selectArea(i));
                dot.nameTxt.setInteractive({ useHandCursor: true });
                dot.nameTxt.on('pointerdown', () => this._selectArea(i));
            } else {
                if (dot.btn.setAlpha) dot.btn.setAlpha(0.6);
                dot.labelTxt.setAlpha(0.6);
                dot.nameTxt.setAlpha(0.6);
                dot.btn.disableInteractive();
                dot.labelTxt.disableInteractive();
                dot.nameTxt.disableInteractive();
            }
        });
    }

    _selectArea(index) {
        this.selectedArea = index;
        const area = this.areaData[index];
        
        // Highlight selected area button tint
        this.areaDots.forEach((d, i) => {
            if (this.areaData[i] && this.areaData[i].status === 'UNLOCKED') {
                const isSel = i === index;
                if (d.btn.setTint) {
                    d.btn.setTint(isSel ? 0x22c55e : 0x38bdf8);
                }
                if (d.nameTxt) {
                    d.nameTxt.setColor(isSel ? '#22c55e' : THEME.TEXT_PRIMARY);
                }
            }
        });

        this.questPanelTitle.setText(`${area.area_name} — ${area.quests.length} Quests`);
        this._renderQuestList(area.quests);

        if (this.questPanelContainer) {
            this.questPanelContainer.y = 0;
        }
    }

    _renderQuestList(quests) {
        this.questListContainer.removeAll(true);
        const startY = 399; // Lowered by 8px (from 391 to 399)
        const cardH = 85, gap = 10;
        const cardW = W - 30; // 450px

        quests.forEach((q, i) => {
            const y = startY + i * (cardH + gap);
            const unlocked = q.status === 'UNLOCKED';
            const completed = q.completed;

            let cardImg;
            if (this.textures.exists('card_x12')) {
                cardImg = this.add.image(CX, y, 'card_x12').setDisplaySize(cardW, cardH);
                // Sky Blue tint for all unlocked cards!
                cardImg.setTint(unlocked ? 0x38bdf8 : 0x475569);
            } else {
                cardImg = this.add.rectangle(CX, y, cardW, cardH, unlocked ? THEME.PANEL : 0x111111, 0.9);
                cardImg.setStrokeStyle(1, completed ? THEME.HEALTH : (unlocked ? THEME.BORDER : 0x333333));
            }

            const icon = completed ? '✅' : (unlocked ? '⚔️' : '🔒');
            const iconT = this.add.text(32, y - 18, icon, { fontSize: '18px' }).setOrigin(0, 0.5);
            
            // Name (Reduced font size: 13px bold)
            const nameT = this.add.text(65, y - 18, q.name, {
                fontSize: '13px', fontStyle: 'bold', color: unlocked ? '#ffffff' : '#94a3b8', fontFamily: 'Outfit'
            }).setOrigin(0, 0.5);

            // Info (Reduced font size: 10.5px bold)
            const infoT = this.add.text(65, y + 2, `⚡ ${q.stamina_cost} Stamina   |   💪 ${q.power_level} Rec. Power`, {
                fontSize: '10.5px', fontStyle: 'bold', color: '#f59e0b', fontFamily: 'Outfit'
            }).setOrigin(0, 0.5);

            // Enemy preview (Reduced font size: 10.5px bold)
            const enemyNames = q.enemies.map(e => `${e.name} Lv.${e.level}`).join(', ');
            const enemyT = this.add.text(65, y + 20, `👹 Enemies: ${enemyNames || 'Unknown'}`, {
                fontSize: '10.5px', fontStyle: 'bold', color: '#ef4444', fontFamily: 'Outfit'
            }).setOrigin(0, 0.5);

            const items = [cardImg, iconT, nameT, infoT, enemyT];

            if (unlocked) {
                if (completed) {
                    const replayT = this.add.text(W - 32, y - 18, 'REPLAY', {
                        fontSize: '10.5px', color: '#4ade80', fontStyle: 'bold', fontFamily: 'Outfit'
                    }).setOrigin(1, 0.5);
                    items.push(replayT);
                }

                cardImg.setInteractive({ useHandCursor: true });
                cardImg.on('pointerover', () => {
                    if (cardImg.setTint) cardImg.setTint(0x7dd3fc); // Brighter Sky Blue on hover
                });
                cardImg.on('pointerout', () => {
                    if (cardImg.setTint) cardImg.setTint(0x38bdf8); // Sky Blue
                });
                cardImg.on('pointerdown', () => this._showPreBattleModal(q));
            }

            this.questListContainer.add(items);
        });

        // Enable dynamic scrolling
        const maxY = startY + quests.length * (cardH + gap) + 60;
        CameraScrollManager.enable(this, maxY);
    }

    _showPreBattleModal(quest) {
        this._destroyPreBattleModal();

        // 1. Root Container (Fixed on screen, depth 300)
        this.preBattleContainer = this.add.container(0, 0).setDepth(300).setScrollFactor(0);

        // 2. Fullscreen Dark Overlay
        const overlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.85).setInteractive();

        // 3. Main Modal Background Window (Card X100, Sky Blue tint, height = 738px, extended by 10px)
        let panelBg;
        if (this.textures.exists('card_x100')) {
            panelBg = this.add.image(CX, 440, 'card_x100').setDisplaySize(W - 12, 738);
            panelBg.setTint(0x38bdf8); // Sky Blue tint
        } else {
            panelBg = this.add.rectangle(CX, 440, W - 22, 738, 0x0d1b2a);
            panelBg.setStrokeStyle(2, THEME.AETHER);
        }
        panelBg.setInteractive();

        // 4. Fixed Header Title & Subtitle (Lowered slightly to Y = 116 / 138, No dark background box)
        const headerTitle = this.add.text(CX, 116, 'PRE-BATTLE STAGE', {
            fontSize: '15px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#A5B4FC', letterSpacing: 2
        }).setOrigin(0.5);
        const headerSubtitle = this.add.text(CX, 138, quest.name, {
            fontSize: '11px', fontFamily: 'Outfit', color: THEME.TEXT_MUTED
        }).setOrigin(0.5);

        // Enlarged & Raised UI Close Button (Y = 112, size = 42x42)
        let closeBtn;
        if (this.textures.exists('btn_icon_normal')) {
            closeBtn = this.add.image(W - 32, 112, 'btn_icon_normal').setDisplaySize(42, 42);
            closeBtn.setTint(0xef4444); // Red UI Button
        } else {
            closeBtn = this.add.circle(W - 32, 112, 18, THEME.PANEL).setStrokeStyle(1, THEME.BORDER);
        }
        const closeTxt = this.add.text(W - 32, 112, '✕', { fontSize: '14px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);

        closeBtn.setInteractive({ useHandCursor: true });
        closeBtn.on('pointerover', () => {
            if (this.textures.exists('btn_icon_hover')) closeBtn.setTexture('btn_icon_hover');
            if (closeBtn.setTint) closeBtn.setTint(0xf87171);
            closeBtn.setDisplaySize(46, 46);
            closeTxt.setScale(1.1);
        });
        closeBtn.on('pointerout', () => {
            if (this.textures.exists('btn_icon_normal')) closeBtn.setTexture('btn_icon_normal');
            if (closeBtn.setTint) closeBtn.setTint(0xef4444);
            closeBtn.setDisplaySize(42, 42);
            closeTxt.setScale(1.0);
        });
        closeBtn.on('pointerdown', () => this._destroyPreBattleModal());

        // 5. Fixed Sticky Footer Action Buttons with Gap (Raised 5px to Y = 763)
        const btnAW = 145, btnAH = 46;
        let partyBtn, startBtn;

        if (this.textures.exists('btn_a_normal')) {
            partyBtn = this.add.image(CX - 90, 763, 'btn_a_normal').setDisplaySize(btnAW, btnAH);
            partyBtn.setTint(0x38bdf8); // Sky blue tint
        } else {
            partyBtn = this.add.rectangle(CX - 90, 763, 135, 44, THEME.PANEL).setStrokeStyle(1, THEME.BORDER);
        }
        const partyTxt = this.add.text(CX - 90, 763, '⚙ Atur Party', {
            fontSize: '12px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#ffffff'
        }).setOrigin(0.5);

        partyBtn.setInteractive({ useHandCursor: true });
        partyBtn.on('pointerover', () => {
            if (this.textures.exists('btn_a_hover')) partyBtn.setTexture('btn_a_hover');
            if (partyBtn.setTint) partyBtn.setTint(0x60a5fa);
        });
        partyBtn.on('pointerout', () => {
            if (this.textures.exists('btn_a_normal')) partyBtn.setTexture('btn_a_normal');
            if (partyBtn.setTint) partyBtn.setTint(0x38bdf8);
        });
        partyBtn.on('pointerdown', () => {
            if (this.textures.exists('btn_a_active')) partyBtn.setTexture('btn_a_active');
            this._destroyPreBattleModal();
            this.scene.start('LoadingScene', {
                targetScene: 'PartyScene',
                targetData: {
                    fromScene: 'QuestScene',
                    questId: quest.mq_id
                }
            });
        });

        if (this.textures.exists('btn_a_normal')) {
            startBtn = this.add.image(CX + 90, 763, 'btn_a_normal').setDisplaySize(btnAW + 10, btnAH);
            startBtn.setTint(0x22c55e); // Emerald green tint for Start Battle
        } else {
            startBtn = this.add.rectangle(CX + 90, 763, 145, 44, 0x166534).setStrokeStyle(2, 0x22c55e);
        }
        const startTxt = this.add.text(CX + 90, 763, '⚔ Mulai Battle', {
            fontSize: '12px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#ffffff'
        }).setOrigin(0.5);

        startBtn.setInteractive({ useHandCursor: true });
        startBtn.on('pointerover', () => {
            if (this.textures.exists('btn_a_hover')) startBtn.setTexture('btn_a_hover');
            if (startBtn.setTint) startBtn.setTint(0x4ade80);
        });
        startBtn.on('pointerout', () => {
            if (this.textures.exists('btn_a_normal')) startBtn.setTexture('btn_a_normal');
            if (startBtn.setTint) startBtn.setTint(0x22c55e);
        });
        startBtn.on('pointerdown', () => {
            if (this.textures.exists('btn_a_active')) startBtn.setTexture('btn_a_active');
            this._startBattle(quest);
        });

        // 6. Scroll Viewport Setup (Y = 152 to Y = 735, height = 583px)
        const viewY = 152;
        const viewH = 583;

        const maskShape = this.make.graphics();
        maskShape.fillRect(15, viewY, W - 30, viewH);
        const mask = maskShape.createGeometryMask();

        this.scrollContainer = this.add.container(0, viewY);
        this.scrollContainer.setMask(mask);

        // Interactive Drag & Wheel Zone
        const dragZone = this.add.rectangle(CX, viewY + viewH / 2, W - 30, viewH, 0x000000, 0).setInteractive();
        let startY = 0;

        dragZone.on('pointerdown', (pointer) => {
            startY = this.scrollContainer.y - pointer.y;
        });

        dragZone.on('pointermove', (pointer) => {
            if (pointer.isDown) {
                let newY = pointer.y + startY;
                const contentH = this.scrollContentHeight || viewH;
                const minY = viewY - Math.max(0, contentH - viewH + 20);
                const maxY = viewY;

                if (newY > maxY) newY = maxY;
                if (newY < minY) newY = minY;

                this.scrollContainer.y = newY;
            }
        });

        dragZone.on('wheel', (pointer, dx, dy) => {
            let newY = this.scrollContainer.y - dy;
            const contentH = this.scrollContentHeight || viewH;
            const minY = viewY - Math.max(0, contentH - viewH + 20);
            const maxY = viewY;

            if (newY > maxY) newY = maxY;
            if (newY < minY) newY = minY;

            this.scrollContainer.y = newY;
        });

        // Add static modal structures to preBattleContainer (No headerBg, No footerBg)
        this.preBattleContainer.add([
            overlay, panelBg, headerTitle, headerSubtitle, closeBtn, closeTxt,
            dragZone, this.scrollContainer,
            partyBtn, partyTxt, startBtn, startTxt
        ]);

        // 7. Populate Content inside scrollContainer
        let currentY = 15;

        // --- SECTION 1: QUEST BADGES & INFO (No Fill, Stroke Outline Only) ---
        const badgeBg1 = this.add.rectangle(CX - 90, currentY + 12, 150, 26).setStrokeStyle(1, THEME.BORDER);
        const badgeTxt1 = this.add.text(CX - 90, currentY + 12, `⚡ Stamina Cost: ${quest.stamina_cost}`, {
            fontSize: '10px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#f59e0b'
        }).setOrigin(0.5);

        const badgeBg2 = this.add.rectangle(CX + 90, currentY + 12, 150, 26).setStrokeStyle(1, THEME.BORDER);
        const badgeTxt2 = this.add.text(CX + 90, currentY + 12, `💪 Rec. Power: ${quest.power_level}`, {
            fontSize: '10px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_SECONDARY
        }).setOrigin(0.5);

        this.scrollContainer.add([badgeBg1, badgeTxt1, badgeBg2, badgeTxt2]);
        currentY += 35;

        const divider1 = this.add.rectangle(CX, currentY, W - 60, 1, 0x334155);
        this.scrollContainer.add(divider1);
        currentY += 15;

        // --- SECTION 2: TARGET ENEMIES (No Fill, Stroke Outline Only) ---
        const enemyHeader = this.add.text(35, currentY, 'TARGET ENEMIES', {
            fontSize: '11px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_SECONDARY, letterSpacing: 1
        }).setOrigin(0, 0.5);
        this.scrollContainer.add(enemyHeader);
        currentY += 22;

        const uniqueEnemiesMap = new Map();
        quest.enemies.forEach(e => {
            const key = `${e.name}_${e.level}_${e.element}`;
            if (!uniqueEnemiesMap.has(key)) uniqueEnemiesMap.set(key, e);
        });
        const uniqueEnemies = Array.from(uniqueEnemiesMap.values());

        uniqueEnemies.forEach((e) => {
            const elemColor = { Fire: '#ef4444', Wind: '#22c55e', Earth: '#d97706' }[e.element] || '#94a3b8';
            const eBg = this.add.rectangle(CX, currentY + 10, W - 70, 24).setStrokeStyle(1, 0x334155);
            const eName = this.add.text(45, currentY + 10, `👹 ${e.name}`, { fontSize: '11px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0, 0.5);
            const eLvl = this.add.text(260, currentY + 10, `Lv.${e.level}`, { fontSize: '10px', fontFamily: 'Outfit', color: '#ffffff' }).setOrigin(0, 0.5);
            const eElem = this.add.text(340, currentY + 10, e.element, { fontSize: '10px', fontStyle: 'bold', fontFamily: 'Outfit', color: elemColor }).setOrigin(0, 0.5);

            this.scrollContainer.add([eBg, eName, eLvl, eElem]);
            currentY += 28;
        });

        currentY += 5;
        const divider2 = this.add.rectangle(CX, currentY, W - 60, 1, 0x334155);
        this.scrollContainer.add(divider2);
        currentY += 15;

        // --- SECTION 3: POSSIBLE REWARDS ---
        const rewardHeader = this.add.text(35, currentY, 'POSSIBLE REWARDS', {
            fontSize: '11px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_SECONDARY, letterSpacing: 1
        }).setOrigin(0, 0.5);
        this.scrollContainer.add(rewardHeader);
        currentY += 22;

        const loots = quest.rewards;
        loots.forEach((r) => {
            const chance = Math.round(r.drop_chance * 100);
            const isFirst = !!r.is_first_clear;
            const isClaimed = isFirst && quest.completed;

            let labelText = `• ${r.item_name} x${r.quantity} (${chance}%)`;
            if (isFirst) {
                labelText += ` 🎁 [First Clear]`;
            }

            const textColor = isClaimed ? '#64748b' : (isFirst ? '#f59e0b' : THEME.TEXT_PRIMARY);

            const rTxt = this.add.text(45, currentY, labelText, {
                fontSize: '10px',
                fontFamily: 'Outfit',
                color: textColor
            }).setOrigin(0, 0.5);

            this.scrollContainer.add(rTxt);

            if (isClaimed) {
                // Strikethrough line over reward text
                const textWidth = rTxt.width;
                const strikeLine = this.add.rectangle(45 + textWidth / 2, currentY, textWidth, 1, 0x64748b);
                
                // Red CLAIMED text at right edge
                const claimedTxt = this.add.text(W - 45, currentY, 'CLAIMED', {
                    fontSize: '9px',
                    fontStyle: 'bold',
                    fontFamily: 'Outfit',
                    color: '#ef4444'
                }).setOrigin(1, 0.5);

                this.scrollContainer.add([strikeLine, claimedTxt]);
            }

            currentY += 20;
        });

        currentY += 10;
        const divider3 = this.add.rectangle(CX, currentY, W - 60, 1, 0x334155);
        this.scrollContainer.add(divider3);
        currentY += 15;

        // --- SECTION 4: PARTY PRESET SELECTION ---
        const presetHeader = this.add.text(CX, currentY, 'SELECT PARTY PRESET', {
            fontSize: '11px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_SECONDARY, letterSpacing: 1
        }).setOrigin(0.5);
        this.scrollContainer.add(presetHeader);
        currentY += 25;

        this._presetBtns = [];
        for (let s = 1; s <= 5; s++) {
            const bx = CX - 160 + (s - 1) * 80;
            const active = s === this.selectedPresetSlot;

            let btn;
            if (this.textures.exists('btn_b_normal')) {
                const btnTex = active ? 'btn_b_active' : 'btn_b_normal';
                btn = this.add.image(bx, currentY, btnTex).setDisplaySize(72, 34);
                btn.setTint(active ? 0x38bdf8 : 0x475569);
            } else {
                btn = this.add.rectangle(bx, currentY, 72, 34, active ? 0x1e3a8a : THEME.PANEL).setStrokeStyle(2, active ? 0x3b82f6 : THEME.BORDER);
            }

            const txt = this.add.text(bx, currentY, `Slot ${s}`, {
                fontSize: '11px', fontStyle: 'bold', color: active ? '#ffffff' : '#cbd5e1', fontFamily: 'Outfit'
            }).setOrigin(0.5);

            btn.setInteractive({ useHandCursor: true });
            btn.on('pointerover', () => {
                if (!active && this.textures.exists('btn_b_hover')) {
                    btn.setTexture('btn_b_hover');
                    btn.setTint(0x60a5fa);
                }
            });
            btn.on('pointerout', () => {
                if (!active && this.textures.exists('btn_b_normal')) {
                    btn.setTexture('btn_b_normal');
                    btn.setTint(0x475569);
                }
            });
            btn.on('pointerdown', () => {
                this.selectedPresetSlot = s;
                this._showPreBattleModal(quest);
            });

            this._presetBtns.push({ btn, txt });
            this.scrollContainer.add([btn, txt]);
        }

        currentY += 35;

        // Container untuk Preset Cards & Skills
        if (this.presetCardsContainer) this.presetCardsContainer.destroy();
        this.presetCardsContainer = this.add.container(0, 0);
        this.scrollContainer.add(this.presetCardsContainer);

        this.presetPowerText = this.add.text(CX, currentY, 'Loading data...', { fontSize: '11px', color: THEME.TEXT_MUTED, fontFamily: 'Outfit' }).setOrigin(0.5);
        this.presetCardsContainer.add(this.presetPowerText);

        this.presetCardsStartY = currentY + 30;
        if (this.partyDataLoaded) {
            this._renderPresetCards(this.presetCardsStartY);
        }

        currentY += 300; // Spacing for preset cards + skills grid
        this.scrollContentHeight = currentY;
    }

    _destroyPreBattleModal() {
        if (this.preBattleContainer) {
            this.preBattleContainer.destroy();
            this.preBattleContainer = null;
        }
    }

    _ensureCircularElementTextures() {
        ['fire', 'wind', 'earth', 'rock'].forEach(elem => {
            const sourceKey = `element_${elem}`;
            const circleKey = `element_${elem}_circle`;
            if (this.textures.exists(sourceKey) && !this.textures.exists(circleKey)) {
                try {
                    const srcTex = this.textures.get(sourceKey).getSourceImage();
                    if (srcTex && srcTex.width > 0) {
                        const canvasTex = this.textures.createCanvas(circleKey, 64, 64);
                        const ctx = canvasTex.context;
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(32, 32, 32, 0, Math.PI * 2, true);
                        ctx.closePath();
                        ctx.clip();
                        ctx.drawImage(srcTex, 0, 0, 64, 64);
                        ctx.restore();
                        canvasTex.refresh();
                    }
                } catch (e) {
                    console.warn('Failed to create circular element texture:', e);
                }
            }
        });
    }

    _renderPresetCards(startY) {
        if (!this.presetCardsContainer || !this.partyDataLoaded) return;
        this._ensureCircularElementTextures();

        // Bersihkan renderan card sebelumnya
        this.presetCardsContainer.removeAll(true);

        const preset = this.fullPresets.find(p => p.preset_slot === this.selectedPresetSlot);
        if (!preset) {
            const txt = this.add.text(CX, startY - 25, 'Preset tidak ditemukan', { fontSize: '12px', color: THEME.TEXT_MUTED }).setOrigin(0.5);
            this.presetCardsContainer.add(txt);
            return;
        }

        const slotInvIds = [
            preset.main_char_inv_id,
            preset.char_slot_1_inv_id,
            preset.char_slot_2_inv_id,
            preset.char_slot_3_inv_id
        ].filter(id => id !== null);

        const charsInPreset = slotInvIds.map(invId => this.fullCharacters.find(c => c.inv_id === invId)).filter(c => c);

        // Hitung total power (Standardized: Math.floor((totalHp / 5) + totalAtk + totalDef))
        let totalHp = 0;
        let totalAtk = 0;
        let totalDef = 0;

        charsInPreset.forEach(c => {
            const level = c.item_level || 1;
            totalHp += c.mc_base_hp + (c.mc_hp_growth * (level - 1));
            totalAtk += c.mc_base_atk + (c.mc_atk_growth * (level - 1));
            totalDef += c.mc_base_def + (c.mc_def_growth * (level - 1));
        });

        const weapIds = [preset.weap_grid_1_inv_id, preset.weap_grid_2_inv_id, preset.weap_grid_3_inv_id, preset.weap_grid_4_inv_id, preset.weap_grid_5_inv_id];
        weapIds.forEach(id => {
            if (id && this.fullWeapons) {
                const w = this.fullWeapons.find(x => x.inv_id === id);
                if (w) {
                    const level = w.item_level || 1;
                    totalHp += w.mw_base_hp + (w.mw_hp_growth * (level - 1));
                    totalAtk += w.mw_base_atk + (w.mw_atk_growth * (level - 1));
                }
            }
        });

        const totalPower = Math.floor((totalHp / 5) + totalAtk + totalDef);

        const pwrTxt = this.add.text(CX, startY - 25, `⚡ Party Power: ${totalPower}${charsInPreset.length > 0 ? '' : ' (Empty)'}`, { fontSize: '11px', color: '#D4A017', fontStyle: 'bold', fontFamily: 'Outfit' }).setOrigin(0.5);
        this.presetCardsContainer.add(pwrTxt);

        if (charsInPreset.length === 0) return;

        const cW = 85, gap = 10, total = charsInPreset.length;
        const totalW = (total * cW) + ((total - 1) * gap);
        const startX = (W - totalW) / 2 + (cW / 2);

        charsInPreset.forEach((char, i) => {
            const px = startX + i * (cW + gap);
            const cardY = startY + (145 / 2); // Center Y of portrait

            // Border color by rarity
            let rColorInt = THEME.BORDER;
            let rColorHex = '#ffffff';
            if (char.mc_rarity === 'SSR') { rColorInt = 0xffd700; rColorHex = '#ffd700'; }
            else if (char.mc_rarity === 'SR') { rColorInt = 0xa855f7; rColorHex = '#a855f7'; }
            else if (char.mc_rarity === 'R') { rColorInt = 0xef4444; rColorHex = '#ef4444'; }

            // Portrait Background (No fill, stroke outline only)
            const portBg = this.add.rectangle(px, cardY, 85, 145).setStrokeStyle(2, rColorInt);
            this.presetCardsContainer.add(portBg);

            // Image
            const portTex = `portrait_${char.mc_id}`;
            if (this.textures.exists(portTex)) {
                const img = this.add.image(px, cardY, portTex);
                const imgW = img.width || 1;
                img.setScale(85 / imgW);
                this.presetCardsContainer.add(img);
            }

            // Element Icon (Borderless circular cropped icon)
            let elementStr = char.mc_element;
            if (char.mc_id === 1 && preset.weap_grid_1_inv_id) {
                const mainWeap = this.fullWeapons.find(w => w.inv_id === preset.weap_grid_1_inv_id);
                if (mainWeap && mainWeap.sa_element) {
                    elementStr = mainWeap.sa_element;
                }
            }
            const elCircleKey = elementStr ? `element_${elementStr.toLowerCase()}_circle` : '';
            const elKey = elementStr ? `element_${elementStr.toLowerCase()}` : '';
            const ex = px + 42.5 - 12;
            const ey = cardY - 72.5 + 12;

            if (this.textures.exists(elCircleKey)) {
                const elImg = this.add.image(ex, ey, elCircleKey).setDisplaySize(18, 18);
                this.presetCardsContainer.add(elImg);
            } else if (this.textures.exists(elKey)) {
                const elImg = this.add.image(ex, ey, elKey).setDisplaySize(18, 18);
                this.presetCardsContainer.add(elImg);
            }

            // Rarity Text
            if (char.mc_rarity) {
                const rarTxt = this.add.text(px - 42.5 + 6, cardY + 72.5 - 5, char.mc_rarity, {
                    fontSize: '11px', color: rColorHex, fontStyle: 'bold', stroke: '#000000', strokeThickness: 2, fontFamily: 'Outfit'
                }).setOrigin(0, 1);
                this.presetCardsContainer.add(rarTxt);
            }

            // Level
            const lvlTxt = this.add.text(px, cardY + 72.5 + 10, `Lv ${char.item_level}`, {
                fontSize: "10px", color: "#FFFFFF", fontStyle: "bold"
            }).setOrigin(0.5);
            this.presetCardsContainer.add(lvlTxt);

            // Skills Grid (4 rows)
            // Untuk karakter biasa, ambil 3 skill pertama (atau yang aktif). Untuk MC, ambil dari preset.mc_skills.
            let activeSkills = [];
            if (char.mc_id === 1) {
                const skillSlots = [1, 2, 3, 4];
                skillSlots.forEach(s => {
                    const skRec = preset.mc_skills.find(sk => sk.slot_number === s);
                    if (skRec) {
                        const skDef = this.fullMcSkills.find(sk => sk.ms_id === skRec.ms_id);
                        activeSkills.push(skDef ? skDef.ms_name : 'Unknown');
                    } else {
                        activeSkills.push(null);
                    }
                });
            } else {
                const unlocked = char.skills.filter(s => char.item_level >= s.unlock_level && char.limit_break_level >= s.unlock_limit_break);
                activeSkills = unlocked.slice(0, 3).map(s => s.ms_name);
                while (activeSkills.length < 4) activeSkills.push(null);
            }

            let sy = cardY + 72.5 + 25;
            for (let r = 0; r < 4; r++) {
                const skName = activeSkills[r];
                const skBg = this.add.rectangle(px, sy, 80, 14).setStrokeStyle(1, 0x334155);
                this.presetCardsContainer.add(skBg);
                if (skName) {
                    const skTxt = this.add.text(px, sy, skName.substring(0, 12), { fontSize: '8px', color: '#cbd5e1' }).setOrigin(0.5);
                    this.presetCardsContainer.add(skTxt);
                } else {
                    const lckTxt = this.add.text(px, sy, '🔒', { fontSize: '8px', color: '#64748b' }).setOrigin(0.5);
                    this.presetCardsContainer.add(lckTxt);
                }
                sy += 16;
            }
        });
    }

    async _startBattle(quest) {
        // Store quest info for BattleScene
        const playerData = JSON.parse(localStorage.getItem('aetheria_player') || '{}');
        playerData.current_quest_stage = quest.mq_id;
        playerData.selected_preset_slot = this.selectedPresetSlot;
        localStorage.setItem('aetheria_player', JSON.stringify(playerData));

        // Try init battle to check stamina
        try {
            const res = await fetch(`${API_BASE}/battle/init`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questId: quest.mq_id, playerId: this.playerId, presetSlot: this.selectedPresetSlot })
            });
            const json = await res.json();

            if (json.reason === 'INSUFFICIENT_STAMINA') {
                this._showStaminaModal(quest, json.data);
                return;
            }

            if (json.status !== 'success') {
                throw new Error(json.message || 'Init battle failed');
            }

            // Success — go to battle
            this._destroyPreBattleModal();
            this.scene.start('LoadingScene', {
                targetScene: 'ReadyScene',
                targetData: {
                    questId: quest.mq_id,
                    presetSlot: this.selectedPresetSlot,
                    initData: json
                }
            });
        } catch (e) {
            console.error('Battle init error:', e);
        }
    }

    _showStaminaModal(quest, staminaData) {
        if (this.staminaModalContainer) this.staminaModalContainer.destroy();
        this.staminaModalContainer = this.add.container(0, 0).setDepth(400);

        const CY = H / 2;
        const items = [];

        // 1. Dark Overlay Backdrop
        const ov = this.add.rectangle(CX, CY, W, H, 0x000000, 0.85).setInteractive();
        ov.on('pointerdown', (p, x, y, e) => e.stopPropagation());
        items.push(ov);

        // 2. Main Panel Box using Card X101 UI asset
        const panelW = 380;
        const panelH = 430;
        let pnl;
        if (this.textures.exists('card_x101')) {
            pnl = this.add.image(CX, CY, 'card_x101').setDisplaySize(panelW, panelH);
            pnl.setTint(0x38bdf8); // Sky Blue tint
        } else if (this.textures.exists('bg_card_x101')) {
            pnl = this.add.image(CX, CY, 'bg_card_x101').setDisplaySize(panelW, panelH);
            pnl.setTint(0x38bdf8);
        } else {
            pnl = this.add.rectangle(CX, CY, panelW, panelH, 0x0d1b2a).setStrokeStyle(2, 0xf39c12);
        }
        pnl.setInteractive();
        pnl.on('pointerdown', (p, x, y, e) => e.stopPropagation());
        items.push(pnl);

        // 3. Title Text
        const titleTxt = this.add.text(CX, CY - 165, '⚡ STAMINA HABIS', {
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#f59e0b',
            fontFamily: 'Outfit, Inter, sans-serif',
            stroke: '#000000',
            strokeThickness: 3,
            letterSpacing: 2
        }).setOrigin(0.5);
        items.push(titleTxt);

        // 4. Quest requirement notice
        const costTxt = this.add.text(CX, CY - 135, `Dibutuhkan: ${staminaData.stamina_cost} Stamina  |  Tersisa: ${staminaData.current_stamina}`, {
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#ef4444',
            fontFamily: 'Outfit, Inter, sans-serif'
        }).setOrigin(0.5);
        items.push(costTxt);

        // Natural refill info & potion info
        const infoRefill = this.add.text(CX, CY - 110, `⚡ Refill Alami: 1 Stamina / 5 Menit`, {
            fontSize: '12px',
            color: '#94a3b8',
            fontFamily: 'Outfit, Inter, sans-serif'
        }).setOrigin(0.5);
        items.push(infoRefill);

        const infoPotion = this.add.text(CX, CY - 90, `🧪 1x Full Potion memulihkan +120 Stamina (Max Cap 999)`, {
            fontSize: '12px',
            color: '#38bdf8',
            fontStyle: 'bold',
            fontFamily: 'Outfit, Inter, sans-serif'
        }).setOrigin(0.5);
        items.push(infoPotion);

        const potionCount = staminaData.full_potion_count || 0;
        const potCountTxt = this.add.text(CX, CY - 68, `Stok Full Potion: ${potionCount}x tersedia`, {
            fontSize: '13px',
            fontStyle: 'bold',
            color: potionCount > 0 ? '#10b981' : '#ef4444',
            fontFamily: 'Outfit, Inter, sans-serif'
        }).setOrigin(0.5);
        items.push(potCountTxt);

        const sep = this.add.rectangle(CX, CY - 50, panelW - 60, 1, 0x334155);
        items.push(sep);

        let selectedQty = potionCount > 0 ? 1 : 0;
        const currentStam = staminaData.current_stamina || 0;

        // Quantity Selector UI
        const qtyLabel = this.add.text(CX, CY - 33, 'Jumlah yang ingin digunakan:', {
            fontSize: '12px',
            color: '#cbd5e1',
            fontFamily: 'Outfit, Inter, sans-serif'
        }).setOrigin(0.5);
        items.push(qtyLabel);

        const qtyY = CY - 2;
        const qtyValueTxt = this.add.text(CX, qtyY, `${selectedQty}`, {
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#ffffff',
            fontFamily: 'Outfit, Inter, sans-serif'
        }).setOrigin(0.5);
        items.push(qtyValueTxt);

        const minusBtn = this.add.text(CX - 50, qtyY, '-', {
            fontSize: '22px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#334155', padding: { x: 12, y: 3 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const plusBtn = this.add.text(CX + 50, qtyY, '+', {
            fontSize: '22px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#334155', padding: { x: 12, y: 3 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const minus10Btn = this.add.text(CX - 100, qtyY, '-10', {
            fontSize: '14px', fontStyle: 'bold', color: '#94a3b8', backgroundColor: '#1e293b', padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const plus10Btn = this.add.text(CX + 100, qtyY, '+10', {
            fontSize: '14px', fontStyle: 'bold', color: '#94a3b8', backgroundColor: '#1e293b', padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        items.push(minusBtn, plusBtn, minus10Btn, plus10Btn);

        // Result calculation text
        const resultTxt = this.add.text(CX, CY + 32, `Pemulihan: +${selectedQty * 120} Stamina ➔ Total: ${Math.min(999, currentStam + selectedQty * 120)} Stamina`, {
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#facc15',
            fontFamily: 'Outfit, Inter, sans-serif'
        }).setOrigin(0.5);
        items.push(resultTxt);

        // Buttons (2 Vertical Buttons: USE above CANCEL)
        const btnW = 300;
        const btnH = 44;

        // 1. USE BUTTON (Top)
        const btnUseY = CY + 80;
        let useBtnImg;
        if (this.textures.exists('btn_a_normal')) {
            useBtnImg = this.add.image(CX, btnUseY, 'btn_a_normal').setDisplaySize(btnW, btnH);
        } else {
            useBtnImg = this.add.rectangle(CX, btnUseY, btnW, btnH, 0x1a3a2a).setStrokeStyle(2, 0x2ecc71);
        }
        useBtnImg.setTint(potionCount > 0 ? 0x2ecc71 : 0x555555);

        const useBtnTxt = this.add.text(CX, btnUseY, potionCount > 0 ? `🧪 GUNAKAN (${selectedQty})` : 'STOK HABIS', {
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#ffffff',
            fontFamily: 'Outfit, Inter, sans-serif',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        const updateQty = (delta) => {
            if (potionCount <= 0) {
                selectedQty = 0;
            } else {
                let n = selectedQty + delta;
                if (n < 1) n = 1;
                if (n > potionCount) n = potionCount;
                selectedQty = n;
            }
            qtyValueTxt.setText(`${selectedQty}`);
            const added = selectedQty * 120;
            const finalStam = Math.min(999, currentStam + added);
            resultTxt.setText(`Pemulihan: +${added} Stamina ➔ Total: ${finalStam} Stamina`);

            if (selectedQty > 0) {
                useBtnTxt.setText(`🧪 GUNAKAN (${selectedQty})`);
                useBtnImg.setTint(0x2ecc71);
            } else {
                useBtnTxt.setText('STOK HABIS');
                useBtnImg.setTint(0x555555);
            }
        };

        minusBtn.on('pointerdown', () => updateQty(-1));
        plusBtn.on('pointerdown', () => updateQty(1));
        minus10Btn.on('pointerdown', () => updateQty(-10));
        plus10Btn.on('pointerdown', () => updateQty(10));

        const useHitZone = this.add.rectangle(CX, btnUseY, btnW, btnH, 0x000000, 0).setInteractive({ useHandCursor: true });
        useHitZone.on('pointerover', () => {
            if (selectedQty > 0) {
                if (this.textures.exists('btn_a_hover')) useBtnImg.setTexture('btn_a_hover');
                useBtnImg.setTint(0x52be80);
            }
        });
        useHitZone.on('pointerout', () => {
            if (selectedQty > 0) {
                if (this.textures.exists('btn_a_normal')) useBtnImg.setTexture('btn_a_normal');
                useBtnImg.setTint(0x2ecc71);
            }
        });
        useHitZone.on('pointerdown', () => {
            if (selectedQty <= 0) return;
            this._useStaminaPotion(quest, selectedQty);
        });
        items.push(useBtnImg, useBtnTxt, useHitZone);

        // 2. CANCEL BUTTON (Bottom)
        const btnCancelY = CY + 140;
        let cancelBtnImg;
        if (this.textures.exists('btn_a_normal')) {
            cancelBtnImg = this.add.image(CX, btnCancelY, 'btn_a_normal').setDisplaySize(btnW, 40);
            cancelBtnImg.setTint(0xe74c3c);
        } else {
            cancelBtnImg = this.add.rectangle(CX, btnCancelY, btnW, 40, 0x2a0d0d).setStrokeStyle(1, 0xe74c3c);
        }

        const cancelTxt = this.add.text(CX, btnCancelY, 'BATAL', {
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#ffffff',
            fontFamily: 'Outfit, Inter, sans-serif',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        const cancelHitZone = this.add.rectangle(CX, btnCancelY, btnW, 40, 0x000000, 0).setInteractive({ useHandCursor: true });
        cancelHitZone.on('pointerover', () => {
            if (this.textures.exists('btn_a_hover')) cancelBtnImg.setTexture('btn_a_hover');
            cancelBtnImg.setTint(0xec7063);
        });
        cancelHitZone.on('pointerout', () => {
            if (this.textures.exists('btn_a_normal')) cancelBtnImg.setTexture('btn_a_normal');
            cancelBtnImg.setTint(0xe74c3c);
        });
        cancelHitZone.on('pointerdown', () => {
            this.staminaModalContainer.destroy();
        });
        items.push(cancelBtnImg, cancelTxt, cancelHitZone);

        this.staminaModalContainer.add(items);
    }

    async _useStaminaPotion(quest, quantity = 1) {
        try {
            const res = await fetch(`${API_BASE}/player/use-stamina-potion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: this.playerId, quantity })
            });
            const json = await res.json();
            if (json.status === 'success') {
                // Update local data
                const pd = JSON.parse(localStorage.getItem('aetheria_player') || '{}');
                pd.stamina = json.data.stamina;
                localStorage.setItem('aetheria_player', JSON.stringify(pd));
                if (this.staminaModalContainer) this.staminaModalContainer.destroy();
                // Retry battle
                this._startBattle(quest);
            }
        } catch (e) { console.error('Use stamina potion failed:', e); }
    }

    async _checkActiveBattle() {
        if (!this.playerData || !this.playerData.player_id) return;

        try {
            const res = await BattleApi.checkActiveBattle(this.playerData.player_id);
            if (res.status === 'success' && res.data && res.data.has_active) {
                // Tampilkan Pop-up Resume Battle
                this._showResumeBattleModal(res.data);
            }
        } catch (e) {
            console.error('Failed to check active battle:', e);
        }
    }

    _showResumeBattleModal(data) {
        if (this.resumeContainer) this.resumeContainer.destroy();
        this.resumeContainer = this.add.container(0, 0).setDepth(110);

        const items = [];

        // Backdrop
        const overlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.85).setInteractive();
        overlay.on('pointerdown', (p, x, y, e) => e.stopPropagation());
        items.push(overlay);

        // Panel Box using Card X101 UI asset
        let panel;
        const panelW = 380;
        const panelH = 340;
        if (this.textures.exists('card_x101')) {
            panel = this.add.image(CX, H / 2, 'card_x101').setDisplaySize(panelW, panelH);
            panel.setTint(0x38bdf8); // Sky Blue tint
        } else if (this.textures.exists('bg_card_x101')) {
            panel = this.add.image(CX, H / 2, 'bg_card_x101').setDisplaySize(panelW, panelH);
            panel.setTint(0x38bdf8);
        } else {
            panel = this.add.rectangle(CX, H / 2, panelW, panelH, 0x0d1b2a).setStrokeStyle(2, 0x38bdf8);
        }
        panel.setInteractive();
        panel.on('pointerdown', (p, x, y, e) => e.stopPropagation());
        items.push(panel);

        // Title
        const titleTxt = this.add.text(CX, H / 2 - 125, 'PERTEMPURAN AKTIF', {
            fontSize: '17px', fontStyle: 'bold', color: '#38bdf8',
            fontFamily: 'Outfit, Inter, sans-serif', stroke: '#000000', strokeThickness: 3,
            letterSpacing: 2
        }).setOrigin(0.5);
        items.push(titleTxt);

        // Quest name
        const questNameTxt = this.add.text(CX, H / 2 - 90, data.quest_name || 'Unknown Quest', {
            fontSize: '14px', fontStyle: 'bold', color: '#ffffff', fontFamily: 'Outfit, Inter, sans-serif'
        }).setOrigin(0.5);
        items.push(questNameTxt);

        // Remaining time
        const mins = Math.floor((data.remaining_time || 0) / 60);
        const secs = (data.remaining_time || 0) % 60;
        const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        const timeTxt = this.add.text(CX, H / 2 - 60, `⏱ Sisa Waktu: ${timeStr}`, {
            fontSize: '12px', fontStyle: 'bold', color: data.remaining_time < 300 ? '#ff4444' : '#f39c12',
            fontFamily: 'Outfit, Inter, sans-serif'
        }).setOrigin(0.5);
        items.push(timeTxt);

        // Info description
        const descTxt = this.add.text(CX, H / 2 - 25, 'Kamu memiliki pertempuran yang belum selesai.\nLanjutkan atau menyerah?', {
            fontSize: '11px', color: '#94a3b8', fontFamily: 'Outfit, Inter, sans-serif',
            align: 'center', lineSpacing: 4
        }).setOrigin(0.5);
        items.push(descTxt);

        // --- BUTTON 1: Lanjutkan Pertempuran (Button A with Green tint) ---
        const btnW = 300;
        const btn1H = 46;
        const btn1Y = H / 2 + 35;
        let resumeBtnImg;
        if (this.textures.exists('btn_a_normal')) {
            resumeBtnImg = this.add.image(CX, btn1Y, 'btn_a_normal').setDisplaySize(btnW, btn1H);
            resumeBtnImg.setTint(0x2ecc71); // Green tint
        } else {
            resumeBtnImg = this.add.rectangle(CX, btn1Y, btnW, btn1H, 0x1a3a2a).setStrokeStyle(2, 0x2ecc71);
        }
        const resumeTxt = this.add.text(CX, btn1Y, '⚔  Lanjutkan Pertempuran', {
            fontSize: '13px', fontStyle: 'bold', color: '#ffffff', fontFamily: 'Outfit, Inter, sans-serif',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        const resumeHitZone = this.add.rectangle(CX, btn1Y, btnW, btn1H, 0x000000, 0).setInteractive({ useHandCursor: true });
        resumeHitZone.on('pointerover', () => {
            if (this.textures.exists('btn_a_hover')) resumeBtnImg.setTexture('btn_a_hover');
            resumeBtnImg.setTint(0x52be80);
        });
        resumeHitZone.on('pointerout', () => {
            if (this.textures.exists('btn_a_normal')) resumeBtnImg.setTexture('btn_a_normal');
            resumeBtnImg.setTint(0x2ecc71);
        });
        resumeHitZone.on('pointerdown', () => {
            if (this.textures.exists('btn_a_active')) resumeBtnImg.setTexture('btn_a_active');
            this.resumeContainer.destroy();
            this.scene.start('LoadingScene', {
                targetScene: 'ReadyScene',
                targetData: {
                    resumeData: data.battle_state,
                    bsId: data.bs_id,
                    questId: data.mq_id,
                    remainingTime: data.remaining_time
                }
            });
        });
        resumeHitZone.on('pointerup', () => {
            if (this.textures.exists('btn_a_normal')) resumeBtnImg.setTexture('btn_a_normal');
        });
        items.push(resumeBtnImg, resumeTxt, resumeHitZone);

        // --- BUTTON 2: Menyerah (Button A with Red tint) ---
        const btn2H = 42;
        const btn2Y = H / 2 + 95;
        let surrenderBtnImg;
        if (this.textures.exists('btn_a_normal')) {
            surrenderBtnImg = this.add.image(CX, btn2Y, 'btn_a_normal').setDisplaySize(btnW, btn2H);
            surrenderBtnImg.setTint(0xe74c3c); // Red tint
        } else {
            surrenderBtnImg = this.add.rectangle(CX, btn2Y, btnW, btn2H, 0x2a0d0d).setStrokeStyle(1, 0xe74c3c);
        }
        const surrenderTxt = this.add.text(CX, btn2Y, '🏳  Menyerah (Stamina Hangus)', {
            fontSize: '11px', fontStyle: 'bold', color: '#ff8a80', fontFamily: 'Outfit, Inter, sans-serif',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        const surrenderHitZone = this.add.rectangle(CX, btn2Y, btnW, btn2H, 0x000000, 0).setInteractive({ useHandCursor: true });
        surrenderHitZone.on('pointerover', () => {
            if (this.textures.exists('btn_a_hover')) surrenderBtnImg.setTexture('btn_a_hover');
            surrenderBtnImg.setTint(0xec7063);
        });
        surrenderHitZone.on('pointerout', () => {
            if (this.textures.exists('btn_a_normal')) surrenderBtnImg.setTexture('btn_a_normal');
            surrenderBtnImg.setTint(0xe74c3c);
        });
        surrenderHitZone.on('pointerdown', async () => {
            if (this.textures.exists('btn_a_active')) surrenderBtnImg.setTexture('btn_a_active');
            try {
                await BattleApi.surrenderBattle(data.bs_id, this.playerId);
                this.resumeContainer.destroy();
            } catch (e) {
                console.error('Surrender failed:', e);
            }
        });
        surrenderHitZone.on('pointerup', () => {
            if (this.textures.exists('btn_a_normal')) surrenderBtnImg.setTexture('btn_a_normal');
        });
        items.push(surrenderBtnImg, surrenderTxt, surrenderHitZone);

        this.resumeContainer.add(items);
    }
}
