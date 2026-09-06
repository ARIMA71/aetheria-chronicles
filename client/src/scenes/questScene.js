import Phaser from 'phaser';
import { THEME } from '../main.js';
import { playGlobalBGM } from '../utils/audioManager.js';
import { checkSession, saveCurrentScene, clearSession } from '../utils/auth.js';
import BattleApi from '../services/BattleApi.js';
import { CameraScrollManager } from '../utils/cameraScroll.js';

const W = 480, H = 880, CX = 240;
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

        this.musicOn = localStorage.getItem('music_on') !== 'false';
        this.sfxOn = localStorage.getItem('sfx_on') !== 'false';

        this.add.rectangle(CX, H / 2, W, H, THEME.BG);
        this._buildTopBar();
        this._buildMenuModal();
        this._buildMap();
        this._buildQuestPanel();
        this.fetchQuestData();
        this._checkActiveBattle();
    }

    _buildTopBar() {
        this.add.rectangle(CX, 30, W, 60, THEME.PANEL, THEME.PANEL_ALPHA).setStrokeStyle(1, THEME.BORDER).setScrollFactor(0).setDepth(100);
        this.add.text(CX, 30, 'QUEST MAP', { fontSize: '15px', fontStyle: 'bold', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit', letterSpacing: 2 }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        const backBtn = this.add.circle(40, 30, 18, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(100);
        const homeTxt = this.add.text(40, 30, 'HOME', { fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        backBtn.on('pointerover', () => { backBtn.setFillStyle(0x334155); homeTxt.setColor('#ffffff'); });
        backBtn.on('pointerout', () => { backBtn.setFillStyle(THEME.PANEL); homeTxt.setColor(THEME.TEXT_PRIMARY); });
        backBtn.on('pointerdown', () => this.scene.start('LoadingScene', { targetScene: 'MainMenuScene' }));

        // Pojok kanan atas: Bulat bertulisan MENU
        const menuBtn = this.add.circle(W - 40, 30, 18, THEME.PANEL, THEME.PANEL_ALPHA).setScrollFactor(0).setDepth(100);
        menuBtn.setStrokeStyle(1, THEME.BORDER);
        menuBtn.setInteractive({ useHandCursor: true });

        const menuText = this.add.text(W - 40, 30, 'MENU', {
            fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100);

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
        this.preBattleContainer = this.add.container(0, 0).setDepth(50);

        const items = [];

        const overlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.85).setInteractive();
        overlay.on('pointerdown', (p, x, y, e) => e.stopPropagation());
        items.push(overlay);

        let currentY = 130; // Starting Y coordinate for content
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

        // Use a Set to filter unique enemies based on name and level
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
        currentY += 25;

        // --- SECTION 5: PARTY PRESET ---
        items.push(this.add.text(CX, currentY, 'SELECT PARTY PRESET', { fontSize: '10px', fontStyle: 'bold', color: THEME.TEXT_SECONDARY, fontFamily: 'Outfit', letterSpacing: 1 }).setOrigin(0.5));
        currentY += 30;

        this._presetBtns = [];
        for (let s = 1; s <= 3; s++) {
            const bx = CX - 100 + (s - 1) * 100;
            const active = s === this.selectedPresetSlot;
            const btn = this.add.rectangle(bx, currentY, 80, 36, active ? 0x1a2744 : THEME.PANEL).setStrokeStyle(2, active ? THEME.AETHER : THEME.BORDER).setInteractive({ useHandCursor: true });
            const txt = this.add.text(bx, currentY, `Slot ${s}`, { fontSize: '11px', fontStyle: 'bold', color: active ? '#A5B4FC' : THEME.TEXT_SECONDARY, fontFamily: 'Outfit' }).setOrigin(0.5);
            btn.on('pointerdown', () => { this.selectedPresetSlot = s; this._showPreBattleModal(quest); });
            this._presetBtns.push({ btn, txt });
            items.push(btn, txt);
        }

        currentY += 30;

        // Power display
        this.presetPowerText = this.add.text(CX, currentY, 'Loading power...', { fontSize: '10px', color: THEME.TEXT_MUTED, fontFamily: 'Outfit' }).setOrigin(0.5);
        this._fetchPresetPower();
        items.push(this.presetPowerText);

        currentY += 40;

        // --- SECTION 6: ACTION BUTTONS ---
        const partyBtn = this.add.rectangle(CX - 85, currentY, 150, 40, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        const partyTxt = this.add.text(CX - 85, currentY, '⚙ Atur Party', { fontSize: '11px', fontStyle: 'bold', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit' }).setOrigin(0.5);
        partyBtn.on('pointerover', () => partyBtn.setFillStyle(0x334155));
        partyBtn.on('pointerout', () => partyBtn.setFillStyle(THEME.PANEL));
        partyBtn.on('pointerdown', () => { this.preBattleContainer.destroy(); this.scene.start('LoadingScene', { targetScene: 'PartyScene' }); });
        items.push(partyBtn, partyTxt);

        const startBtn = this.add.rectangle(CX + 85, currentY, 150, 40, 0x1a3a2a).setStrokeStyle(2, THEME.HEALTH).setInteractive({ useHandCursor: true });
        const startTxt = this.add.text(CX + 85, currentY, '⚔ Mulai Battle', { fontSize: '11px', fontStyle: 'bold', color: '#a8e6cf', fontFamily: 'Outfit' }).setOrigin(0.5);
        startBtn.on('pointerover', () => startBtn.setFillStyle(0x245a3a));
        startBtn.on('pointerout', () => startBtn.setFillStyle(0x1a3a2a));
        startBtn.on('pointerdown', () => this._startBattle(quest));
        items.push(startBtn, startTxt);

        currentY += 20;

        // --- BACKGROUND PANEL ---
        const topPadding = 40;
        const bottomPadding = 30;
        const totalHeight = (currentY - topY) + topPadding + bottomPadding;
        const panelCenterY = (topY - topPadding) + (totalHeight / 2);

        const panel = this.add.rectangle(CX, panelCenterY, W - 30, totalHeight, 0x0d1b2a).setStrokeStyle(2, THEME.AETHER).setInteractive();
        panel.on('pointerdown', (p, x, y, e) => e.stopPropagation());

        // Insert panel immediately behind content (index 1, right after overlay)
        items.splice(1, 0, panel);

        // Close button (Top-Right relative to panel)
        const panelTop = topY - topPadding;
        const panelRight = CX + (W - 30) / 2;
        const closeBtn = this.add.circle(panelRight - 25, panelTop + 25, 14, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        const closeTxt = this.add.text(panelRight - 25, panelTop + 25, '✕', { fontSize: '12px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        closeBtn.on('pointerover', () => closeBtn.setFillStyle(0x334155));
        closeBtn.on('pointerout', () => closeBtn.setFillStyle(THEME.PANEL));
        closeBtn.on('pointerdown', () => this.preBattleContainer.destroy());
        items.push(closeBtn, closeTxt);

        this.preBattleContainer.add(items);
    }

    async _fetchPresetPower() {
        try {
            const res = await fetch(`${API_BASE}/player/${this.playerId}/party-presets`);
            const json = await res.json();
            if (json.status === 'success') {
                this.presetsData = json.data.presets;
                const preset = this.presetsData.find(p => p.slot === this.selectedPresetSlot);
                if (preset && this.presetPowerText && this.presetPowerText.active) {
                    this.presetPowerText.setText(`⚡ Party Power: ${preset.total_power}${preset.has_data ? '' : ' (Empty)'}`);
                }
            }
        } catch (e) { console.error('Failed to fetch presets:', e); }
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

    _buildMenuModal() {
        this.menuContainer = this.add.container(0, 0).setDepth(300).setVisible(false);

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

        this.confirmContainer = this.add.container(0, 0).setDepth(310).setVisible(false);
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
