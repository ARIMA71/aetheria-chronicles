import Player from "../entities/player";
import Enemy  from "../entities/enemy";

// ── Konstanta Layout (Canvas: 450 × 800) ─────────────────────────────────────
const W = 450;
const H = 800;

// Zona posisi utama
const ARENA_CENTER_X   = W / 2;        // 225
const ARENA_ENEMY_Y    = 240;          // Tengah zona arena
const PARTY_ROW_Y      = 600;          // Baris potret party
const ACTION_BAR_Y     = 490;          // Tombol Attack & Aether Burst
const HEAL_BTN_Y       = 740;          // Tombol Heal (safe area bawah)
const SIDEBAR_HIDDEN_X = W + 120;      // X sidebar saat tersembunyi (di luar layar kanan)
const SIDEBAR_SHOWN_X  = W - 100;      // X sidebar saat muncul

export default class BattleScene extends Phaser.Scene {
    constructor() {
        super('BattleScene');
    }

    // ── Phaser Lifecycle ───────────────────────────────────────────────────────
    create() {
        this.turn        = "player";
        this.currentTurn = 1;

        // Array party & state aktif
        this.players      = [];
        this.activePlayer = null;

        // Gambar background gradient sederhana
        this._drawBackground();

        // Loading text di tengah
        this.loadingText = this.add.text(ARENA_CENTER_X, H / 2, 'Loading Battle Data...', {
            fontSize: '20px',
            color: '#cccccc'
        }).setOrigin(0.5);

        this.fetchBattleData();
    }

    // ── Background ─────────────────────────────────────────────────────────────
    _drawBackground() {
        // Sky gradient simulasi dengan beberapa rectangle
        const sky = this.add.rectangle(ARENA_CENTER_X, 200, W, 400, 0x0f3460);
        const ground = this.add.rectangle(ARENA_CENTER_X, 600, W, 400, 0x16213e);
        // Divider garis tipis antara arena dan HUD
        this.add.rectangle(ARENA_CENTER_X, 430, W, 2, 0x0f3460);
        this.add.rectangle(ARENA_CENTER_X, 550, W, 2, 0x0a0a1a);
    }

    // ── API Fetching ───────────────────────────────────────────────────────────
    async fetchBattleData() {
        try {
            const res = await fetch('http://localhost:3000/api/battle/init', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ playerId: 1, presetSlot: 1, questId: 1 })
            });

            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

            const json = await res.json();
            if (json.status !== 'success') throw new Error(json.message || 'API error.');

            this.loadingText.destroy();

            // ── Inisialisasi Party (maks 4 karakter) ──────────────────────────
            const characters = json.data.player_party.characters.slice(0, 4);
            const totalChars = characters.length;

            // Hitung posisi X agar party terpusat di baris bawah
            const cardW    = 70;
            const cardGap  = 12;
            const totalW   = totalChars * cardW + (totalChars - 1) * cardGap;
            const startX   = (W - totalW) / 2 + cardW / 2;

            characters.forEach((charData, i) => {
                const px = startX + i * (cardW + cardGap);
                const player = new Player(this, px, PARTY_ROW_Y, charData);
                player._baseX = px;

                // Klik karakter → jadikan activePlayer
                player.setInteractive(
                    new Phaser.Geom.Rectangle(-35, -50, 70, 100),
                    Phaser.Geom.Rectangle.Contains
                );
                player.on('pointerdown', () => {
                    if (this.turn !== 'player') return;
                    this._setActivePlayer(player);
                });

                this.players.push(player);
            });

            // Karakter pertama aktif secara default
            this._setActivePlayer(this.players[0]);

            // ── Inisialisasi Musuh ─────────────────────────────────────────────
            this.enemy = new Enemy(this, ARENA_CENTER_X, ARENA_ENEMY_Y, json.data.enemies[0]);

            // ── Setup UI setelah semua entity siap ────────────────────────────
            this._setupBattleUI();

        } catch (err) {
            console.error('[BattleScene] fetchBattleData gagal:', err);
            this.loadingText
                .setText(`Error: ${err.message}\nPastikan server berjalan di port 3000.`)
                .setColor('#ff5555')
                .setAlign('center');
        }
    }

    // ── Set Active Player ──────────────────────────────────────────────────────
    _setActivePlayer(newActive) {
        // Lepas highlight dari yang lama
        if (this.activePlayer && this.activePlayer !== newActive) {
            this.activePlayer.setHighlight(false);
        }
        this.activePlayer = newActive;
        this.activePlayer.setHighlight(true);

        // Jika sidebar skill sedang terbuka, refresh isinya
        if (this._sidebarOpen) {
            this._renderSkillsInSidebar();
        }
    }

    // ── Setup Seluruh UI ───────────────────────────────────────────────────────
    _setupBattleUI() {
        this._buildHeader();
        this._buildActionButtons();
        this._buildSkillSidebar();
        this._buildHealButton();
        this._updateHeader();
    }

    // ── Header: Turn counter + CA gauge ───────────────────────────────────────
    _buildHeader() {
        // Panel header tipis
        this.add.rectangle(ARENA_CENTER_X, 28, W, 56, 0x0a0a1a);

        this.turnText = this.add.text(ARENA_CENTER_X, 16, 'Turn 1', {
            fontSize: '14px', color: '#cccccc', fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        this.enemyCaText = this.add.text(ARENA_CENTER_X, 34, '', {
            fontSize: '11px', color: '#ffaa00'
        }).setOrigin(0.5, 0);

        this._updateHeader();
    }

    _updateHeader() {
        if (!this.turnText) return;
        this.turnText.setText(`TURN  ${this.currentTurn}`);
        if (this.enemy && this.enemyCaText) {
            this.enemyCaText.setText(
                `${this.enemy.charName}  CHARGE: ${'■'.repeat(this.enemy.caBar)}${'□'.repeat(this.enemy.caMax - this.enemy.caBar)}`
            );
        }
    }

    // ── Tombol Aksi (Attack & Aether Burst) ───────────────────────────────────
    _buildActionButtons() {
        // ── ATTACK button — bulat, sisi kanan ─────────────────────────────────
        const atkX = W - 60;
        const atkY = ACTION_BAR_Y;

        const atkBg = this.add.circle(atkX, atkY, 44, 0xe74c3c);
        atkBg.setStrokeStyle(3, 0xff8a80);

        const atkInner = this.add.circle(atkX, atkY, 36, 0xc0392b);

        const atkText = this.add.text(atkX, atkY, 'ATK', {
            fontSize: '15px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        atkBg.setInteractive();
        atkBg.on('pointerdown', () => {
            if (this.turn !== 'player') return;
            this.playerAttack();
        });

        // ── AETHER BURST toggle — sisi kiri ───────────────────────────────────
        const burstX = 60;
        const burstY = ACTION_BAR_Y;

        const burstBg = this.add.circle(burstX, burstY, 44, 0x1a1a4e);
        burstBg.setStrokeStyle(3, 0x7b68ee);

        this._burstFill = this.add.arc(burstX, burstY, 36, 0, 0, false, 0x7b68ee);

        const burstText = this.add.text(burstX, burstY - 2, '✦', {
            fontSize: '22px', color: '#ccccff'
        }).setOrigin(0.5);

        this.add.text(burstX, burstY + 18, 'AETHER', {
            fontSize: '8px', color: '#9999cc'
        }).setOrigin(0.5);

        burstBg.setInteractive();
        burstBg.on('pointerdown', () => {
            if (this.turn !== 'player') return;
            this.playerSpecialAttack();
        });

        // ── Tombol SKILL — di antara dua tombol ───────────────────────────────
        const skillBtnX = ARENA_CENTER_X;
        const skillBtnY = ACTION_BAR_Y + 36;

        const skillBg = this.add.rectangle(skillBtnX, skillBtnY, 90, 28, 0x1e3a5f);
        skillBg.setStrokeStyle(1, 0x4a90d9);

        this.add.text(skillBtnX, skillBtnY, 'SKILL ▶', {
            fontSize: '12px', color: '#7ec8e3'
        }).setOrigin(0.5);

        skillBg.setInteractive();
        skillBg.on('pointerdown', () => {
            if (this.turn !== 'player') return;
            this._sidebarOpen ? this.closeSkillSidebar() : this.openSkillSidebar();
        });
    }

    // ── Skill Sidebar ──────────────────────────────────────────────────────────
    _buildSkillSidebar() {
        this._sidebarOpen = false;
        const SBW = 200; // lebar sidebar
        const SBH = H;

        // Overlay transparan — tap di luar sidebar untuk menutup
        this._sidebarOverlay = this.add.rectangle(
            ARENA_CENTER_X - SBW / 2, H / 2, W - SBW, H, 0x000000
        );
        this._sidebarOverlay.setAlpha(0).setInteractive();
        this._sidebarOverlay.on('pointerdown', () => this.closeSkillSidebar());

        // Panel sidebar (dimulai di luar layar kanan)
        this._sidebarPanel = this.add.container(SIDEBAR_HIDDEN_X, H / 2);

        const panelBg = this.add.rectangle(0, 0, SBW, SBH, 0x0d1b2a);
        panelBg.setStrokeStyle(1, 0x4a90d9);

        const panelTitle = this.add.text(0, -(H / 2) + 20, 'SKILLS', {
            fontSize: '13px', color: '#7ec8e3', fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        this._sidebarPanel.add([panelBg, panelTitle]);

        // Container isi tombol skill (di-clear dan di-render ulang saat ganti aktif)
        this._skillBtnContainer = this.add.container(SIDEBAR_HIDDEN_X, H / 2);
    }

    openSkillSidebar() {
        this._sidebarOpen = true;
        this._renderSkillsInSidebar();

        // Fade overlay
        this.tweens.add({
            targets: this._sidebarOverlay,
            alpha:   0.45,
            duration: 200
        });

        // Slide in sidebar panel
        this.tweens.add({
            targets:  [this._sidebarPanel, this._skillBtnContainer],
            x:        SIDEBAR_SHOWN_X,
            duration: 220,
            ease:     'Power2'
        });
    }

    closeSkillSidebar() {
        this._sidebarOpen = false;

        this.tweens.add({
            targets: this._sidebarOverlay,
            alpha:   0,
            duration: 180
        });

        this.tweens.add({
            targets:  [this._sidebarPanel, this._skillBtnContainer],
            x:        SIDEBAR_HIDDEN_X,
            duration: 200,
            ease:     'Power2'
        });
    }

    _renderSkillsInSidebar() {
        // Bersihkan tombol skill lama
        this._skillBtnContainer.removeAll(true);

        if (!this.activePlayer) return;
        const skills = this.activePlayer.skills;

        const startY = -(H / 2) + 55;
        const btnH   = 54;
        const btnGap = 8;

        skills.forEach((skill, index) => {
            const cd          = this.activePlayer.cooldowns[skill.id] || 0;
            const isAvailable = cd === 0;
            const btnY        = startY + index * (btnH + btnGap);

            // Background tombol skill
            const bg = this.add.rectangle(0, btnY, 180, btnH,
                isAvailable ? 0x1e3a5f : 0x111111
            );
            bg.setStrokeStyle(1, isAvailable ? 0x4a90d9 : 0x333333);

            // Nama skill
            const nameText = this.add.text(-82, btnY - 14, skill.name, {
                fontSize: '12px',
                color: isAvailable ? '#e0e0ff' : '#555555',
                fontStyle: 'bold'
            }).setOrigin(0, 0.5);

            // Tipe skill
            const typeColor = { damage: '#ff8a80', buff: '#a5d6a7', heal: '#80deea', special: '#ce93d8' };
            const typeText = this.add.text(-82, btnY + 2, `[${skill.type.toUpperCase()}]`, {
                fontSize: '9px',
                color: typeColor[skill.type] || '#aaaaaa'
            }).setOrigin(0, 0.5);

            // Cooldown info
            const cdText = this.add.text(82, btnY, cd > 0 ? `CD:${cd}` : `CD:${skill.cooldown}T`, {
                fontSize: '10px',
                color: cd > 0 ? '#ff5555' : '#7777aa'
            }).setOrigin(1, 0.5);

            this._skillBtnContainer.add([bg, nameText, typeText, cdText]);

            if (isAvailable) {
                bg.setInteractive();
                bg.on('pointerdown', () => {
                    this.useSkill(index);
                    this.closeSkillSidebar();
                });
            }
        });
    }

    // ── Tombol Heal ───────────────────────────────────────────────────────────
    _buildHealButton() {
        const healBg = this.add.rectangle(ARENA_CENTER_X, HEAL_BTN_Y, 300, 44, 0x1a4a2e);
        healBg.setStrokeStyle(2, 0x2ecc71);

        this.add.text(ARENA_CENTER_X, HEAL_BTN_Y, '⊕  HEAL  (Coming Soon)', {
            fontSize: '13px', color: '#a8e6cf'
        }).setOrigin(0.5);
        // Tombol Heal adalah placeholder untuk Fase 3
    }

    // ── Battle Log ─────────────────────────────────────────────────────────────
    _ensureBattleLog() {
        if (this.battleLog) return;
        this.battleLog = this.add.text(ARENA_CENTER_X, 400, '', {
            fontSize: '16px',
            color:    '#ffffff',
            backgroundColor: '#000000cc',
            padding:  { x: 10, y: 6 },
            align:    'center'
        }).setOrigin(0.5).setDepth(10);
    }

    showBattleLog(message) {
        this._ensureBattleLog();
        if (this._logTimer) this._logTimer.remove();
        this.battleLog.setText(message).setVisible(true);
        this._logTimer = this.time.delayedCall(2000, () => {
            this.battleLog.setText('');
        });
    }

    // ── Turn Management ───────────────────────────────────────────────────────
    processTurnEnd() {
        // Proses cooldown & buff untuk SEMUA player yang masih hidup
        this.players.forEach(p => {
            if (p.hp <= 0) return;

            for (let id in p.cooldowns) {
                if (p.cooldowns[id] > 0) p.cooldowns[id]--;
            }

            p.activeBuffs = p.activeBuffs.filter(buff => {
                buff.duration--;
                if (buff.duration <= 0) {
                    p[buff.stat] -= buff.value;
                    this.showBattleLog(`${p.charName}: ${buff.stat} effect expired!`);
                    return false;
                }
                return true;
            });

            p.refreshVisual();
        });

        this.currentTurn++;
        this._updateHeader();

        // Jika sidebar terbuka, refresh cooldown
        if (this._sidebarOpen) this._renderSkillsInSidebar();
    }

    // ── Player Actions ────────────────────────────────────────────────────────
    playerAttack() {
        const livingPlayers = this.players.filter(p => p.hp > 0);
        if (livingPlayers.length === 0) return;

        let totalDamage = 0;
        let logParts = [];

        for (const p of livingPlayers) {
            const rawDamage  = p.atk - this.enemy.def;
            let damage       = Math.max(rawDamage, 1);
            const isCrit     = Math.random() < p.crit;
            if (isCrit) damage *= p.critDamage;

            damage = Math.floor(damage);
            this.enemy.hp -= damage;
            totalDamage   += damage;

            // Isi special bar
            p.specialBar = Math.min(p.specialBar + 20, p.specialMax);
            p.refreshVisual();

            logParts.push(`${p.charName}${isCrit ? '💥' : ''}: ${damage}`);

            if (this.enemy.hp <= 0) {
                this.enemy.hp = 0;
                this.enemy.refreshVisual();
                this.enemy.playHitAnim();
                this.showBattleLog(`VICTORY! 🎉\n${logParts.join(' | ')}`);
                this.turn = 'none';
                return;
            }
        }

        this.enemy.hp = Math.max(0, this.enemy.hp);
        this.enemy.refreshVisual();
        this.enemy.playHitAnim();
        this.showBattleLog(`Party attacks!\n${logParts.join(' | ')}`);
        this._updateHeader();

        this.turn = 'enemy';
        this.time.delayedCall(1500, () => this.enemyAttack());
    }

    playerSpecialAttack() {
        if (!this.activePlayer || this.activePlayer.hp <= 0) {
            this.showBattleLog('No active character!');
            return;
        }
        if (this.activePlayer.specialBar < this.activePlayer.specialMax) {
            this.showBattleLog(`${this.activePlayer.charName}: Aether Burst not ready!`);
            return;
        }

        const p         = this.activePlayer;
        const sa        = p.specialAttack;
        const rawDamage = (p.atk * sa.power) - this.enemy.def;
        const damage    = Math.floor(Math.max(rawDamage, 1));

        this.enemy.hp  -= damage;
        p.specialBar    = 0;
        p.refreshVisual();

        this.enemy.hp = Math.max(0, this.enemy.hp);
        this.enemy.refreshVisual();
        this.enemy.playHitAnim();

        this.showBattleLog(`✨ ${p.charName} AETHER BURST! ${damage} dmg`);

        if (this.enemy.hp <= 0) {
            this.showBattleLog('VICTORY! 🎉');
            this.turn = 'none';
            return;
        }

        this.turn = 'enemy';
        this.time.delayedCall(1500, () => this.enemyAttack());
    }

    useSkill(index) {
        const p     = this.activePlayer;
        const skill = p ? p.skills[index] : null;
        if (!skill || this.turn !== 'player' || p.hp <= 0) return;

        if (p.cooldowns[skill.id] > 0) {
            this.showBattleLog(`${skill.name} is on cooldown!`);
            return;
        }

        if (skill.type === 'damage') {
            const rawDamage = (p.atk * skill.power) - this.enemy.def;
            const damage    = Math.floor(Math.max(rawDamage, 1));
            this.enemy.hp  -= damage;
            this.enemy.hp   = Math.max(0, this.enemy.hp);
            this.enemy.refreshVisual();
            this.enemy.playHitAnim();
            this.showBattleLog(`${p.charName}: ${skill.name}\n→ ${damage} damage!`);
        } else if (skill.type === 'buff') {
            p.activeBuffs.push({ stat: skill.stat, value: skill.value, duration: skill.duration });
            p[skill.stat] += skill.value;
            this.showBattleLog(`${p.charName}: ${skill.name}\n→ ${skill.stat} +${skill.value}!`);
        } else if (skill.type === 'heal') {
            const healed = Math.min(skill.value, p.maxHp - p.hp);
            p.hp = Math.min(p.hp + skill.value, p.maxHp);
            this.showBattleLog(`${p.charName}: ${skill.name}\n→ Healed ${healed} HP!`);
        }

        if (skill.cooldown) p.cooldowns[skill.id] = skill.cooldown;
        p.refreshVisual();

        if (this.enemy.hp <= 0) {
            this.turn = 'none';
            this.showBattleLog('VICTORY! 🎉');
            return;
        }

        this.turn = 'enemy';
        this.time.delayedCall(1500, () => this.enemyAttack());
    }

    // ── Enemy Actions ─────────────────────────────────────────────────────────
    enemyAttack() {
        if (this.enemy.caBar >= this.enemy.caMax) {
            this.enemyChargeAttack();
            return;
        }

        const target = this._pickRandomLivingPlayer();
        if (!target) return; // semua mati (seharusnya sudah ketangkap sebelumnya)

        const rawDamage  = this.enemy.atk - target.def;
        let damage       = Math.max(rawDamage, 1);
        const isCrit     = Math.random() < this.enemy.crit;
        if (isCrit) damage *= this.enemy.critDamage;
        damage = Math.floor(damage);

        target.hp -= damage;
        target.hp  = Math.max(0, target.hp);
        target.refreshVisual();

        this.enemy.caBar = Math.min(this.enemy.caBar + 1, this.enemy.caMax);
        this._updateHeader();

        this.showBattleLog(
            isCrit
                ? `${this.enemy.charName} CRIT HIT ${target.charName}! 💥 ${damage}`
                : `${this.enemy.charName} attacks ${target.charName}! ${damage}`
        );

        if (this._isPartyDefeated()) {
            this.turn = 'none';
            this.showBattleLog('DEFEAT... 💀');
            return;
        }

        this.turn = 'player';
        this.time.delayedCall(1500, () => this.processTurnEnd());
    }

    enemyChargeAttack() {
        const ca     = this.enemy.skills[0];
        const target = this._pickRandomLivingPlayer();
        if (!target || !ca) {
            this.turn = 'player';
            return;
        }

        const rawDamage = (this.enemy.atk * ca.power) - target.def;
        const damage    = Math.floor(Math.max(rawDamage, 1));

        target.hp        -= damage;
        target.hp         = Math.max(0, target.hp);
        this.enemy.caBar  = 0;
        target.refreshVisual();
        this._updateHeader();

        this.showBattleLog(`⚡ ${this.enemy.charName}: ${ca.name}!\n→ ${target.charName} takes ${damage}!`);

        if (this._isPartyDefeated()) {
            this.turn = 'none';
            this.showBattleLog('DEFEAT... 💀');
            return;
        }

        this.turn = 'player';
        this.time.delayedCall(1500, () => this.processTurnEnd());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    _pickRandomLivingPlayer() {
        const living = this.players.filter(p => p.hp > 0);
        if (living.length === 0) return null;
        return living[Math.floor(Math.random() * living.length)];
    }

    _isPartyDefeated() {
        return this.players.every(p => p.hp <= 0);
    }
}