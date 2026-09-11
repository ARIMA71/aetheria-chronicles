import Phaser from 'phaser';
import { THEME } from '../main.js';
import { playGlobalBGM } from '../utils/audioManager.js';
import { checkSession, saveCurrentScene, clearSession } from '../utils/auth.js';
import BattleApi from '../services/BattleApi.js';
import PartyApi from '../services/PartyApi.js';
import { CameraScrollManager } from '../utils/cameraScroll.js';
import TopMenuComponent from '../ui/TopMenuComponent.js';

const W = 480, H = 830, CX = 240;
const API_BASE = 'http://localhost:3000/api';

// Area dot positions on the map (top half)
const AREA_DOTS = [
    { x: 115, y: 190, label: 'I' },
    { x: 240, y: 150, label: 'II' },
    { x: 365, y: 200, label: 'III' },
];

// Paths between dots
const PATH_POINTS = [
    { x1: 145, y1: 190, x2: 210, y2: 150 },
    { x1: 270, y1: 150, x2: 335, y2: 190 },
];

export default class QuestScene extends Phaser.Scene {
    constructor() { super('QuestScene'); }

    preload() {
        this.load.image('bg_quest', 'assets/backgrounds/questScene.jpg');
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
                if (c.mc_portrait_path && !this.textures.exists(`portrait_${c.mc_id}`)) {
                    this.load.image(`portrait_${c.mc_id}`, c.mc_portrait_path);
                    assetsToLoad++;
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
        // Map background
        this.add.rectangle(CX, 180, W - 20, 240, THEME.PANEL, 0.5).setStrokeStyle(1, THEME.BORDER);
        this.add.text(CX, 75, 'SELECT AREA', { fontSize: '9px', fontFamily: 'Outfit', color: THEME.TEXT_SECONDARY, letterSpacing: 1 }).setOrigin(0.5);

        // Draw paths between area dots
        const gfx = this.add.graphics();
        gfx.lineStyle(2, THEME.BORDER, 0.6);
        PATH_POINTS.forEach(p => { gfx.beginPath(); gfx.moveTo(p.x1, p.y1); gfx.lineTo(p.x2, p.y2); gfx.strokePath(); });

        // Area dot placeholders (updated after fetch)
        this.areaDots = [];
        AREA_DOTS.forEach((dot, i) => {
            const c = this.add.circle(dot.x, dot.y, 28, THEME.PANEL).setStrokeStyle(2, THEME.BORDER);
            const t = this.add.text(dot.x, dot.y, dot.label, { fontSize: '14px', fontStyle: 'bold', color: THEME.TEXT_MUTED, fontFamily: 'Outfit' }).setOrigin(0.5);
            const nameT = this.add.text(dot.x, dot.y + 38, '...', { fontSize: '9px', color: THEME.TEXT_SECONDARY, fontFamily: 'Outfit' }).setOrigin(0.5);
            const lockT = this.add.text(dot.x, dot.y - 42, '', { fontSize: '11px' }).setOrigin(0.5);
            this.areaDots.push({ circle: c, text: t, nameText: nameT, lockText: lockT, index: i });
        });
    }

    _buildQuestPanel() {
        this.add.rectangle(CX, 540, W - 20, 450, THEME.PANEL, 0.4).setStrokeStyle(1, THEME.BORDER);
        this.questPanelTitle = this.add.text(CX, 335, 'Pilih area di peta untuk melihat quest', { fontSize: '11px', color: THEME.TEXT_MUTED, fontFamily: 'Outfit' }).setOrigin(0.5);
        this.questListContainer = this.add.container(0, 0);
    }

    async fetchQuestData() {
        try {
            const res = await fetch(`${API_BASE}/quests?playerId=${this.playerId}`);
            const json = await res.json();
            if (json.status === 'success') {
                this.areaData = json.data.areas;
                this._updateAreaDots();

                // Auto-select the first unlocked area so quests are immediately visible
                const firstUnlockedIdx = this.areaData.findIndex(a => a.status === 'UNLOCKED');
                if (firstUnlockedIdx !== -1) {
                    this._selectArea(firstUnlockedIdx);
                }
            }
        } catch (e) { console.error('Failed to fetch quests:', e); }
    }

    _updateAreaDots() {
        this.areaData.forEach((area, i) => {
            if (!this.areaDots[i]) return;
            const dot = this.areaDots[i];
            const unlocked = area.status === 'UNLOCKED';
            dot.circle.setStrokeStyle(2, unlocked ? THEME.HEALTH : 0x555555);
            dot.text.setColor(unlocked ? THEME.TEXT_PRIMARY : '#555555');
            dot.nameText.setText(area.area_name);
            dot.lockText.setText(unlocked ? '' : '🔒');

            if (unlocked) {
                // Make circle interactive
                dot.circle.setInteractive({ useHandCursor: true });
                dot.circle.on('pointerover', () => dot.circle.setFillStyle(0x334155));
                dot.circle.on('pointerout', () => dot.circle.setFillStyle(THEME.PANEL));
                dot.circle.on('pointerdown', () => this._selectArea(i));

                // Make label text interactive to prevent pointer-blocking overlay issue
                dot.text.setInteractive({ useHandCursor: true });
                dot.text.on('pointerdown', () => this._selectArea(i));
                dot.text.on('pointerover', () => dot.circle.setFillStyle(0x334155));
                dot.text.on('pointerout', () => dot.circle.setFillStyle(THEME.PANEL));

                // Make name text below the dot interactive
                dot.nameText.setInteractive({ useHandCursor: true });
                dot.nameText.on('pointerdown', () => this._selectArea(i));
            } else {
                dot.circle.setAlpha(0.5);
                dot.text.setAlpha(0.5);
                // Clear interaction if locked
                dot.circle.disableInteractive();
                dot.text.disableInteractive();
                dot.nameText.disableInteractive();
            }
        });
    }

    _selectArea(index) {
        this.selectedArea = index;
        const area = this.areaData[index];
        // Highlight selected dot
        this.areaDots.forEach((d, i) => {
            if (this.areaData[i] && this.areaData[i].status === 'UNLOCKED') {
                d.circle.setStrokeStyle(2, i === index ? THEME.AETHER : THEME.HEALTH);
            }
        });
        this.questPanelTitle.setText(`${area.area_name} — ${area.quests.length} Quests`);
        this._renderQuestList(area.quests);
    }

    _renderQuestList(quests) {
        this.questListContainer.removeAll(true);
        const startY = 400;
        const cardH = 90, gap = 10;

        quests.forEach((q, i) => {
            const y = startY + i * (cardH + gap);
            const unlocked = q.status === 'UNLOCKED';
            const completed = q.completed;

            const bg = this.add.rectangle(CX, y, W - 50, cardH, unlocked ? THEME.PANEL : 0x111111, 0.9);
            bg.setStrokeStyle(1, completed ? THEME.HEALTH : (unlocked ? THEME.BORDER : 0x333333));

            const icon = completed ? '✅' : (unlocked ? '⚔️' : '🔒');
            const iconT = this.add.text(45, y - 15, icon, { fontSize: '18px' }).setOrigin(0, 0.5);
            const nameT = this.add.text(75, y - 18, q.name, { fontSize: '12px', fontStyle: 'bold', color: unlocked ? THEME.TEXT_PRIMARY : '#555', fontFamily: 'Outfit' }).setOrigin(0, 0.5);
            const infoT = this.add.text(75, y + 2, `⚡ ${q.stamina_cost} Stamina  |  💪 ${q.power_level} Power`, { fontSize: '9px', color: THEME.TEXT_SECONDARY, fontFamily: 'Outfit' }).setOrigin(0, 0.5);

            // Enemy preview
            const enemyNames = q.enemies.map(e => `${e.name} Lv.${e.level}`).join(', ');
            const enemyT = this.add.text(75, y + 18, `👹 ${enemyNames || 'Unknown'}`, { fontSize: '9px', color: '#CD5C5C', fontFamily: 'Outfit' }).setOrigin(0, 0.5);

            const items = [bg, iconT, nameT, infoT, enemyT];

            if (unlocked && !completed) {
                bg.setInteractive({ useHandCursor: true });
                bg.on('pointerover', () => bg.setFillStyle(0x334155));
                bg.on('pointerout', () => bg.setFillStyle(THEME.PANEL));
                bg.on('pointerdown', () => this._showPreBattleModal(q));
            } else if (unlocked && completed) {
                // Allow replay
                const replayT = this.add.text(W - 50, y, 'REPLAY', { fontSize: '9px', color: '#A5B4FC', fontStyle: 'bold', fontFamily: 'Outfit' }).setOrigin(1, 0.5);
                items.push(replayT);
                bg.setInteractive({ useHandCursor: true });
                bg.on('pointerdown', () => this._showPreBattleModal(q));
            }

        this.questListContainer.add(items);
        });

        // Aktifkan scroll dinamis berdasarkan quest terakhir
        const maxY = startY + quests.length * (cardH + gap) + 50;
        CameraScrollManager.enable(this, maxY);
    }

    _showPreBattleModal(quest) {
        if (this.preBattleContainer) this.preBattleContainer.destroy();
        // Bersihkan listener lama
        if (this._modalDragMove) this.input.off('pointermove', this._modalDragMove);
        if (this._modalDragUp) this.input.off('pointerup', this._modalDragUp);

        this.preBattleContainer = this.add.container(0, 0).setDepth(50).setScrollFactor(0);

        // Overlay FIXED — tidak ikut scroll
        const overlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.85).setInteractive();
        this.preBattleContainer.add(overlay);

        // scrollContainer — ini yang akan bergeser saat di-drag
        const scrollContainer = this.add.container(0, 0);
        this.preBattleContainer.add(scrollContainer);

        const items = [];

        let currentY = 100; // Starting Y coordinate for content
        const topY = currentY;

        // --- SECTION 1: HEADER ---
        items.push(this.add.text(CX, currentY, 'PRE-BATTLE', { fontSize: '16px', fontStyle: 'bold', color: '#A5B4FC', fontFamily: 'Outfit', letterSpacing: 2 }).setOrigin(0.5));
        currentY += 22;
        items.push(this.add.text(CX, currentY, quest.name, { fontSize: '12px', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit' }).setOrigin(0.5));
        currentY += 25;

        items.push(this.add.rectangle(CX, currentY, W - 70, 1, 0x334155)); // Divider
        currentY += 20;

        // --- SECTION 2: ENEMY INFO ---
        items.push(this.add.text(50, currentY, 'ENEMY INFO', { fontSize: '10px', fontStyle: 'bold', color: THEME.TEXT_SECONDARY, fontFamily: 'Outfit', letterSpacing: 1 }).setOrigin(0, 0.5));
        currentY += 25;

        const uniqueEnemiesMap = new Map();
        quest.enemies.forEach(e => {
            const key = `${e.name}_${e.level}_${e.element}`;
            if (!uniqueEnemiesMap.has(key)) uniqueEnemiesMap.set(key, e);
        });
        const uniqueEnemies = Array.from(uniqueEnemiesMap.values());

        uniqueEnemies.forEach((e) => {
            const elemColor = { Fire: '#CD5C5C', Wind: '#458B74', Earth: '#D4A017' }[e.element] || '#aaa';
            items.push(
                this.add.text(50, currentY, `👹 ${e.name}`, { fontSize: '11px', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit', fontStyle: 'bold' }).setOrigin(0, 0.5),
                this.add.text(250, currentY, `Lv.${e.level}`, { fontSize: '10px', color: '#ffffff', fontFamily: 'Outfit' }).setOrigin(0, 0.5),
                this.add.text(310, currentY, e.element, { fontSize: '10px', color: elemColor, fontFamily: 'Outfit' }).setOrigin(0, 0.5)
            );
            currentY += 25;
        });

        currentY += 10;
        items.push(this.add.rectangle(CX, currentY, W - 70, 1, 0x334155)); // Divider
        currentY += 20;

        // --- SECTION 3: DROP LOOT ---
        items.push(this.add.text(50, currentY, 'DROP LOOT', { fontSize: '10px', fontStyle: 'bold', color: THEME.TEXT_SECONDARY, fontFamily: 'Outfit', letterSpacing: 1 }).setOrigin(0, 0.5));
        currentY += 25;

        const loots = quest.rewards.slice(0, 4);
        loots.forEach((r) => {
            const chance = Math.round(r.drop_chance * 100);
            items.push(this.add.text(50, currentY, `• ${r.item_name} x${r.quantity} (${chance}%)`, { fontSize: '9px', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit' }).setOrigin(0, 0.5));
            currentY += 20;
        });

        currentY += 10;
        items.push(this.add.rectangle(CX, currentY, W - 70, 1, 0x334155)); // Divider
        currentY += 20;

        // --- SECTION 4: STAMINA & POWER ---
        items.push(this.add.text(50, currentY, `⚡ Stamina Cost: ${quest.stamina_cost}`, { fontSize: '11px', color: '#f39c12', fontFamily: 'Outfit', fontStyle: 'bold' }).setOrigin(0, 0.5));
        currentY += 20;
        items.push(this.add.text(50, currentY, `💪 Rec. Power: ${quest.power_level}`, { fontSize: '11px', color: THEME.TEXT_SECONDARY, fontFamily: 'Outfit' }).setOrigin(0, 0.5));

        currentY += 20;
        items.push(this.add.rectangle(CX, currentY, W - 70, 1, 0x334155)); // Divider
        items.push(this.add.text(CX, currentY, 'SELECT PARTY PRESET', { fontSize: '10px', fontStyle: 'bold', color: THEME.TEXT_SECONDARY, fontFamily: 'Outfit', letterSpacing: 1 }).setOrigin(0.5));
        currentY += 30;

        this._presetBtns = [];
        for (let s = 1; s <= 5; s++) {
            const bx = CX - 160 + (s - 1) * 80;
            const active = s === this.selectedPresetSlot;
            const btn = this.add.rectangle(bx, currentY, 70, 36, active ? 0x1a2744 : THEME.PANEL).setStrokeStyle(2, active ? THEME.AETHER : THEME.BORDER).setInteractive({ useHandCursor: true });
            const txt = this.add.text(bx, currentY, `Slot ${s}`, { fontSize: '10px', fontStyle: 'bold', color: active ? '#A5B4FC' : THEME.TEXT_SECONDARY, fontFamily: 'Outfit' }).setOrigin(0.5);
            btn.on('pointerdown', () => { this.selectedPresetSlot = s; this._showPreBattleModal(quest); });
            this._presetBtns.push({ btn, txt });
            items.push(btn, txt);
        }

        currentY += 35; // Menambah jarak antara tombol slot dan tulisan Party Power

        // Container untuk Preset Cards & Skills
        if (this.presetCardsContainer) this.presetCardsContainer.destroy();
        this.presetCardsContainer = this.add.container(0, 0);
        items.push(this.presetCardsContainer);

        this.presetPowerText = this.add.text(CX, currentY, 'Loading data...', { fontSize: '10px', color: THEME.TEXT_MUTED, fontFamily: 'Outfit' }).setOrigin(0.5);
        this.presetCardsContainer.add(this.presetPowerText);

        this.presetCardsStartY = currentY + 35; // Menambah jarak antara Party Power dan Card
        if (this.partyDataLoaded) {
            this._renderPresetCards(this.presetCardsStartY);
        }

        // Tambah jarak untuk cards (potret + kotak skill) agar tidak overlap dengan tombol action
        currentY += 300; 

        // --- SECTION 6: ACTION BUTTONS ---
        const partyBtn = this.add.rectangle(CX - 85, currentY, 150, 40, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        const partyTxt = this.add.text(CX - 85, currentY, '⚙ Atur Party', { fontSize: '11px', fontStyle: 'bold', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit' }).setOrigin(0.5);
        partyBtn.on('pointerover', () => partyBtn.setFillStyle(0x334155));
        partyBtn.on('pointerout', () => partyBtn.setFillStyle(THEME.PANEL));
        items.push(partyBtn, partyTxt);

        const startBtn = this.add.rectangle(CX + 85, currentY, 150, 40, 0x1a3a2a).setStrokeStyle(2, THEME.HEALTH).setInteractive({ useHandCursor: true });
        const startTxt = this.add.text(CX + 85, currentY, '⚔ Mulai Battle', { fontSize: '11px', fontStyle: 'bold', color: '#a8e6cf', fontFamily: 'Outfit' }).setOrigin(0.5);
        startBtn.on('pointerover', () => startBtn.setFillStyle(0x245a3a));
        startBtn.on('pointerout', () => startBtn.setFillStyle(0x1a3a2a));
        startBtn.on('pointerdown', () => this._startBattle(quest));
        items.push(startBtn, startTxt);

        currentY += 40;

        // --- BACKGROUND PANEL ---
        const topPadding = 30;
        const bottomPadding = 30;
        const totalHeight = (currentY - topY) + topPadding + bottomPadding;
        const panelCenterY = (topY - topPadding) + (totalHeight / 2);

        const panel = this.add.rectangle(CX, panelCenterY, W - 30, totalHeight, 0x0d1b2a).setStrokeStyle(2, THEME.AETHER).setInteractive();

        // Insert panel di belakang semua konten
        items.splice(0, 0, panel);

        // --- GEOMETRY MASK UNTUK SCROLLING ---
        // Membuat mask agar konten yang di-scroll terpotong rapi di batas panel
        const panelTop = topY - topPadding;
        const maskShape = this.make.graphics();
        maskShape.fillStyle(0xffffff);
        // Kotak mask seukuran panel background
        maskShape.fillRect(CX - (W - 30) / 2, panelTop, W - 30, totalHeight);
        const scrollMask = maskShape.createGeometryMask();
        scrollContainer.setMask(scrollMask);

        // Close button (Top-Right relative to panel)
        const panelRight = CX + (W - 30) / 2;
        const closeBtn = this.add.circle(panelRight - 25, panelTop + 25, 14, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        const closeTxt = this.add.text(panelRight - 25, panelTop + 25, '✕', { fontSize: '12px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        closeBtn.on('pointerover', () => closeBtn.setFillStyle(0x334155));
        closeBtn.on('pointerout', () => closeBtn.setFillStyle(THEME.PANEL));
        items.push(closeBtn, closeTxt);

        scrollContainer.add(items);

        // ============================================================
        // SCROLLABLE MODAL SYSTEM
        // ============================================================
        // Hitung apakah konten melebihi tinggi layar
        const contentBottom = panelTop + totalHeight;
        const maxScroll = Math.max(0, contentBottom - H + 20);

        let isDragging = false;
        let dragStartY = 0;
        let dragStartContentY = 0;

        const handleDragStart = (pointer, localX, localY, e) => {
            if (e) e.stopPropagation();
            isDragging = true;
            dragStartY = pointer.y;
            dragStartContentY = scrollContainer.y;
        };

        overlay.on('pointerdown', handleDragStart);
        panel.on('pointerdown', handleDragStart);

        this._modalDragMove = (pointer) => {
            if (!isDragging) return;
            const dy = pointer.y - dragStartY;
            let newY = dragStartContentY + dy;
            // Clamp: tidak boleh scroll ke bawah (newY > 0), dan tidak boleh lebih dari maxScroll ke atas
            if (newY > 0) newY = 0;
            if (newY < -maxScroll) newY = -maxScroll;
            scrollContainer.setY(newY);
        };

        this._modalDragUp = () => { isDragging = false; };

        this.input.on('pointermove', this._modalDragMove);
        this.input.on('pointerup', this._modalDragUp);

        // Fungsi untuk cleanup saat modal ditutup
        const destroyModal = () => {
            this.input.off('pointermove', this._modalDragMove);
            this.input.off('pointerup', this._modalDragUp);
            if (this.preBattleContainer) this.preBattleContainer.destroy();
            this.preBattleContainer = null;
        };

        closeBtn.on('pointerdown', destroyModal);
        partyBtn.on('pointerdown', () => {
            destroyModal();
            this.scene.start('LoadingScene', { targetScene: 'PartyScene' });
        });
    }

    _renderPresetCards(startY) {
        if (!this.presetCardsContainer || !this.partyDataLoaded) return;

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
            else if (char.mc_rarity === 'SR') { rColorInt = 0xc0c0c0; rColorHex = '#c0c0c0'; }
            else if (char.mc_rarity === 'R') { rColorInt = 0xcd7f32; rColorHex = '#cd7f32'; }

            // Portrait Background
            const portBg = this.add.rectangle(px, cardY, 85, 145, THEME.PANEL, 0.7);
            portBg.setStrokeStyle(2, rColorInt);
            this.presetCardsContainer.add(portBg);

            // Image
            const portTex = `portrait_${char.mc_id}`;
            if (this.textures.exists(portTex)) {
                const img = this.add.image(px, cardY, portTex);
                const imgW = img.width || 1;
                img.setScale(85 / imgW);
                this.presetCardsContainer.add(img);
            }

            // Element Icon
            let elementStr = char.mc_element;
            if (char.mc_id === 1 && preset.weap_grid_1_inv_id) {
                const mainWeap = this.fullWeapons.find(w => w.inv_id === preset.weap_grid_1_inv_id);
                if (mainWeap && mainWeap.sa_element) {
                    elementStr = mainWeap.sa_element;
                }
            }
            const elKey = elementStr ? `element_${elementStr.toLowerCase()}` : '';
            if (this.textures.exists(elKey)) {
                const ex = px + 42.5 - 12;
                const ey = cardY - 72.5 + 12;
                const elImg = this.add.image(ex, ey, elKey).setDisplaySize(18, 18);
                const shape = this.make.graphics();
                shape.fillCircle(ex, ey, 9);
                elImg.setMask(shape.createGeometryMask());
                
                const elBorder = this.add.circle(ex, ey, 9).setStrokeStyle(1, THEME.PANEL);
                this.presetCardsContainer.add([elImg, elBorder]);
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
                const skBg = this.add.rectangle(px, sy, 80, 14, 0x1e293b).setStrokeStyle(1, 0x334155);
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
            if (this.preBattleContainer) this.preBattleContainer.destroy();
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
        this.staminaModalContainer = this.add.container(0, 0).setDepth(60);

        const ov = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.85).setInteractive();
        ov.on('pointerdown', (p, x, y, e) => e.stopPropagation());

        const pnl = this.add.rectangle(CX, H / 2, 340, 280, 0x0d1b2a).setStrokeStyle(2, 0xf39c12).setInteractive();
        pnl.on('pointerdown', (p, x, y, e) => e.stopPropagation());

        const items = [ov, pnl];
        items.push(this.add.text(CX, H / 2 - 110, '⚡ STAMINA HABIS', { fontSize: '16px', fontStyle: 'bold', color: '#f39c12', fontFamily: 'Outfit' }).setOrigin(0.5));
        items.push(this.add.text(CX, H / 2 - 75, `Butuh: ${staminaData.stamina_cost} | Tersisa: ${staminaData.current_stamina}`, { fontSize: '11px', color: THEME.TEXT_SECONDARY, fontFamily: 'Outfit' }).setOrigin(0.5));
        items.push(this.add.text(CX, H / 2 - 40, `Full Potion tersedia: ${staminaData.full_potion_count}x`, { fontSize: '12px', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit' }).setOrigin(0.5));
        items.push(this.add.text(CX, H / 2 - 10, 'Gunakan 1x Full Potion untuk\nmengisi ulang stamina ke 100?', { fontSize: '10px', color: THEME.TEXT_SECONDARY, fontFamily: 'Outfit', align: 'center' }).setOrigin(0.5));

        if (staminaData.full_potion_count > 0) {
            const useBtn = this.add.rectangle(CX, H / 2 + 50, 260, 40, 0x1a3a2a).setStrokeStyle(2, THEME.HEALTH).setInteractive({ useHandCursor: true });
            const useTxt = this.add.text(CX, H / 2 + 50, '🧪 Gunakan Full Potion', { fontSize: '12px', fontStyle: 'bold', color: '#a8e6cf', fontFamily: 'Outfit' }).setOrigin(0.5);
            useBtn.on('pointerdown', () => this._useStaminaPotion(quest));
            items.push(useBtn, useTxt);
        } else {
            items.push(this.add.text(CX, H / 2 + 50, 'Tidak ada Full Potion di inventory.', { fontSize: '11px', color: '#ff8a80', fontFamily: 'Outfit' }).setOrigin(0.5));
        }

        const cancelBtn = this.add.rectangle(CX, H / 2 + 105, 140, 34, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        const cancelTxt = this.add.text(CX, H / 2 + 105, 'BATAL', { fontSize: '11px', fontStyle: 'bold', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit' }).setOrigin(0.5);
        cancelBtn.on('pointerdown', () => this.staminaModalContainer.destroy());
        items.push(cancelBtn, cancelTxt);

        this.staminaModalContainer.add(items);
    }

    async _useStaminaPotion(quest) {
        try {
            const res = await fetch(`${API_BASE}/player/use-stamina-potion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: this.playerId })
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

        // Panel
        const panel = this.add.rectangle(CX, H / 2, 360, 320, 0x0d1b2a).setStrokeStyle(2, THEME.AETHER).setInteractive();
        panel.on('pointerdown', (p, x, y, e) => e.stopPropagation());
        items.push(panel);

        // Icon
        items.push(this.add.text(CX, H / 2 - 120, '⚔️', { fontSize: '32px' }).setOrigin(0.5));

        // Title
        items.push(this.add.text(CX, H / 2 - 80, 'PERTEMPURAN AKTIF', {
            fontSize: '16px', fontStyle: 'bold', color: '#A5B4FC',
            fontFamily: 'Outfit', letterSpacing: 2
        }).setOrigin(0.5));

        // Quest name
        items.push(this.add.text(CX, H / 2 - 50, data.quest_name || 'Unknown Quest', {
            fontSize: '13px', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit'
        }).setOrigin(0.5));

        // Remaining time
        const mins = Math.floor((data.remaining_time || 0) / 60);
        const secs = (data.remaining_time || 0) % 60;
        const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        items.push(this.add.text(CX, H / 2 - 25, `⏱ Sisa Waktu: ${timeStr}`, {
            fontSize: '12px', color: data.remaining_time < 300 ? '#ff4444' : '#f39c12',
            fontFamily: 'Outfit'
        }).setOrigin(0.5));

        // Info
        items.push(this.add.text(CX, H / 2 + 5, 'Kamu memiliki pertempuran yang belum selesai.\nLanjutkan atau menyerah?', {
            fontSize: '10px', color: THEME.TEXT_SECONDARY, fontFamily: 'Outfit',
            align: 'center', lineSpacing: 4
        }).setOrigin(0.5));

        // Lanjutkan Button
        const resumeBtn = this.add.rectangle(CX, H / 2 + 60, 300, 44, 0x1a3a2a).setStrokeStyle(2, THEME.HEALTH).setInteractive({ useHandCursor: true });
        const resumeTxt = this.add.text(CX, H / 2 + 60, '⚔ Lanjutkan Pertempuran', {
            fontSize: '13px', fontStyle: 'bold', color: '#a8e6cf', fontFamily: 'Outfit'
        }).setOrigin(0.5);
        resumeBtn.on('pointerover', () => resumeBtn.setFillStyle(0x245a3a));
        resumeBtn.on('pointerout', () => resumeBtn.setFillStyle(0x1a3a2a));
        resumeBtn.on('pointerdown', () => {
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
        items.push(resumeBtn, resumeTxt);

        // Menyerah Button
        const surrenderBtn = this.add.rectangle(CX, H / 2 + 115, 300, 38, 0x2a0d0d).setStrokeStyle(1, 0xef4444).setInteractive({ useHandCursor: true });
        const surrenderTxt = this.add.text(CX, H / 2 + 115, '🏳 Menyerah (Stamina Hangus)', {
            fontSize: '11px', fontStyle: 'bold', color: '#ff8a80', fontFamily: 'Outfit'
        }).setOrigin(0.5);
        surrenderBtn.on('pointerover', () => surrenderBtn.setFillStyle(0x3d1111));
        surrenderBtn.on('pointerout', () => surrenderBtn.setFillStyle(0x2a0d0d));
        surrenderBtn.on('pointerdown', async () => {
            try {
                await BattleApi.surrenderBattle(data.bs_id, this.playerId);
                this.resumeContainer.destroy();
            } catch (e) {
                console.error('Surrender failed:', e);
            }
        });
        items.push(surrenderBtn, surrenderTxt);

        this.resumeContainer.add(items);
    }

}
