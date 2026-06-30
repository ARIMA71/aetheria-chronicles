import Phaser from 'phaser';
import { THEME } from '../main.js';
import { checkSession, saveCurrentScene } from '../utils/auth.js';

const W = 450, H = 800, CX = 225;
const API_BASE = 'http://localhost:3000/api';

// Area dot positions on the map (top half)
const AREA_DOTS = [
    { x: 100, y: 160, label: 'I' },
    { x: 225, y: 120, label: 'II' },
    { x: 350, y: 170, label: 'III' },
];

// Paths between dots
const PATH_POINTS = [
    { x1: 130, y1: 160, x2: 195, y2: 125 },
    { x1: 255, y1: 125, x2: 320, y2: 165 },
];

export default class QuestScene extends Phaser.Scene {
    constructor() { super('QuestScene'); }

    create() {
        if (!checkSession(this)) return;
        saveCurrentScene(this.scene.key);
        const raw = localStorage.getItem('aetheria_player');
        this.playerData = raw ? JSON.parse(raw) : { player_id: 1 };
        this.playerId = this.playerData.player_id || 1;
        this.selectedArea = null;
        this.selectedPresetSlot = 1;
        this.questListContainer = null;
        this.preBattleContainer = null;
        this.staminaModalContainer = null;
        this.areaData = [];

        this.add.rectangle(CX, H / 2, W, H, THEME.BG);
        this._buildTopBar();
        this._buildMap();
        this._buildQuestPanel();
        this.fetchQuestData();
    }

    _buildTopBar() {
        this.add.rectangle(CX, 30, W, 60, THEME.PANEL, THEME.PANEL_ALPHA).setStrokeStyle(1, THEME.BORDER);
        this.add.text(CX, 30, 'QUEST MAP', { fontSize: '15px', fontStyle: 'bold', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit', letterSpacing: 2 }).setOrigin(0.5);
        const backBtn = this.add.circle(40, 30, 18, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        this.add.text(40, 30, '←', { fontSize: '16px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        backBtn.on('pointerdown', () => this.scene.start('MainMenuScene'));
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
    }

    _showPreBattleModal(quest) {
        if (this.preBattleContainer) this.preBattleContainer.destroy();
        this.preBattleContainer = this.add.container(0, 0).setDepth(50);

        const items = [];

        const overlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.8).setInteractive();
        overlay.on('pointerdown', (p, x, y, e) => e.stopPropagation());
        items.push(overlay);

        const panel = this.add.rectangle(CX, H / 2, W - 30, 580, 0x0d1b2a).setStrokeStyle(2, THEME.AETHER).setInteractive();
        panel.on('pointerdown', (p, x, y, e) => e.stopPropagation());
        items.push(panel);

        // Title
        items.push(this.add.text(CX, 140, 'PRE-BATTLE', { fontSize: '16px', fontStyle: 'bold', color: '#A5B4FC', fontFamily: 'Outfit', letterSpacing: 2 }).setOrigin(0.5));
        items.push(this.add.text(CX, 162, quest.name, { fontSize: '12px', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit' }).setOrigin(0.5));

        // Enemy Info
        items.push(this.add.text(50, 190, 'ENEMY INFO', { fontSize: '10px', fontStyle: 'bold', color: THEME.TEXT_SECONDARY, fontFamily: 'Outfit', letterSpacing: 1 }).setOrigin(0, 0.5));
        quest.enemies.forEach((e, i) => {
            const ey = 215 + i * 30;
            const elemColor = { Fire: '#CD5C5C', Wind: '#458B74', Earth: '#D4A017' }[e.element] || '#aaa';
            items.push(
                this.add.text(50, ey, `👹 ${e.name}`, { fontSize: '11px', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit' }),
                this.add.text(250, ey, `Lv.${e.level}`, { fontSize: '10px', color: '#CD5C5C', fontFamily: 'Outfit' }),
                this.add.text(310, ey, e.element, { fontSize: '10px', color: elemColor, fontFamily: 'Outfit' })
            );
        });

        // Drop Loot
        const lootY = 260;
        items.push(this.add.text(50, lootY, 'DROP LOOT', { fontSize: '10px', fontStyle: 'bold', color: THEME.TEXT_SECONDARY, fontFamily: 'Outfit', letterSpacing: 1 }).setOrigin(0, 0.5));
        const loots = quest.rewards.slice(0, 4);
        loots.forEach((r, i) => {
            const ly = lootY + 22 + i * 18;
            const chance = Math.round(r.drop_chance * 100);
            items.push(this.add.text(50, ly, `• ${r.item_name} x${r.quantity} (${chance}%)`, { fontSize: '9px', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit' }));
        });

        // Stamina cost
        items.push(this.add.text(50, 355, `⚡ Stamina Cost: ${quest.stamina_cost}`, { fontSize: '11px', color: '#f39c12', fontFamily: 'Outfit' }));
        items.push(this.add.text(50, 375, `💪 Rec. Power: ${quest.power_level}`, { fontSize: '11px', color: THEME.TEXT_SECONDARY, fontFamily: 'Outfit' }));

        // Preset selection
        items.push(this.add.text(CX, 410, 'SELECT PARTY PRESET', { fontSize: '10px', fontStyle: 'bold', color: THEME.TEXT_SECONDARY, fontFamily: 'Outfit', letterSpacing: 1 }).setOrigin(0.5));

        this._presetBtns = [];
        for (let s = 1; s <= 3; s++) {
            const bx = CX - 100 + (s - 1) * 100;
            const active = s === this.selectedPresetSlot;
            const btn = this.add.rectangle(bx, 445, 80, 36, active ? 0x1a2744 : THEME.PANEL).setStrokeStyle(2, active ? THEME.AETHER : THEME.BORDER).setInteractive({ useHandCursor: true });
            const txt = this.add.text(bx, 445, `Slot ${s}`, { fontSize: '11px', fontStyle: 'bold', color: active ? '#A5B4FC' : THEME.TEXT_SECONDARY, fontFamily: 'Outfit' }).setOrigin(0.5);
            btn.on('pointerdown', () => { this.selectedPresetSlot = s; this._showPreBattleModal(quest); });
            this._presetBtns.push({ btn, txt });
            items.push(btn, txt);
        }

        // Power display
        this.presetPowerText = this.add.text(CX, 475, 'Loading power...', { fontSize: '10px', color: THEME.TEXT_MUTED, fontFamily: 'Outfit' }).setOrigin(0.5);
        this._fetchPresetPower();
        items.push(this.presetPowerText);

        // Atur Party button
        const partyBtn = this.add.rectangle(CX - 85, 530, 150, 40, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        const partyTxt = this.add.text(CX - 85, 530, '⚙ Atur Party', { fontSize: '11px', fontStyle: 'bold', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit' }).setOrigin(0.5);
        partyBtn.on('pointerover', () => partyBtn.setFillStyle(0x334155));
        partyBtn.on('pointerout', () => partyBtn.setFillStyle(THEME.PANEL));
        partyBtn.on('pointerdown', () => { this.preBattleContainer.destroy(); this.scene.start('PartyScene'); });
        items.push(partyBtn, partyTxt);

        // Mulai Battle button
        const startBtn = this.add.rectangle(CX + 85, 530, 150, 40, 0x1a3a2a).setStrokeStyle(2, THEME.HEALTH).setInteractive({ useHandCursor: true });
        const startTxt = this.add.text(CX + 85, 530, '⚔ Mulai Battle', { fontSize: '11px', fontStyle: 'bold', color: '#a8e6cf', fontFamily: 'Outfit' }).setOrigin(0.5);
        startBtn.on('pointerover', () => startBtn.setFillStyle(0x245a3a));
        startBtn.on('pointerout', () => startBtn.setFillStyle(0x1a3a2a));
        startBtn.on('pointerdown', () => this._startBattle(quest));
        items.push(startBtn, startTxt);

        // Close button
        const closeBtn = this.add.circle(W - 40, 140, 16, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        const closeTxt = this.add.text(W - 40, 140, '✕', { fontSize: '14px', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
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
            this.scene.start('BattleScene', {
                questId: quest.mq_id,
                presetSlot: this.selectedPresetSlot,
                initData: json
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
}
