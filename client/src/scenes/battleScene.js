import Player from "../entities/player";
import Enemy from "../entities/enemy";
import { THEME } from "../main.js";
import { checkSession, saveCurrentScene, getPlayerUsername } from "../utils/auth.js";
import BattleApi from "../services/BattleApi.js";
// import CombatManager from "../services/CombatManager.js"; // DEPRECATED
import BattleMenu from "../ui/BattleMenu.js";
import fireRaw from '../../assets/icons/elements/fire.svg?raw';
import windRaw from '../../assets/icons/elements/wind.svg?raw';
import earthRaw from '../../assets/icons/elements/rock.svg?raw';

const W = 450, H = 800, CX = 225;
export default class BattleScene extends Phaser.Scene {
    constructor() { super("BattleScene"); }
    init(data) {
        // Accept data from QuestScene if available
        this._sceneData = data || {};
        saveCurrentScene(this.scene.key, this._sceneData);
    }
    preload() {
        const fireUrl = URL.createObjectURL(new Blob([fireRaw], { type: 'image/svg+xml' }));
        const windUrl = URL.createObjectURL(new Blob([windRaw], { type: 'image/svg+xml' }));
        const earthUrl = URL.createObjectURL(new Blob([earthRaw], { type: 'image/svg+xml' }));
        
        this.load.svg('element_fire', fireUrl, { width: 16, height: 16 });
        this.load.svg('element_wind', windUrl, { width: 16, height: 16 });
        this.load.svg('element_earth', earthUrl, { width: 16, height: 16 });
    }
    setTurn(newTurn) {
        if (newTurn === "player") {
            const alive = this.players ? this.players.filter(p => p.hp > 0) : [];
            const allStunned = alive.length > 0 && alive.every(p => p.activeEffects && p.activeEffects.some(e => e.target_stat === 'STUN'));
            if (allStunned) {
                this.showLog("⚡ Seluruh party dalam keadaan STUN! Giliran dilewati.");
                this.turn = "enemy";
                if (this._attackBtnContainer) this._attackBtnContainer.setVisible(false);
                this.time.delayedCall(1500, () => this._processEnemyTurn());
                return;
            }
        }
        this.turn = newTurn;
        if (this._attackBtnContainer) {
            this._attackBtnContainer.setVisible(newTurn === "player");
        }
    }
    create() {
        if (!checkSession(this)) return;
        this.setTurn("player"); this.currentTurn = 1;
        this.players = []; this.activePlayer = null;
        this.aetherGauge = 0; this.aetherGaugeMax = 100;
        this.skillQueue = []; this.isProcessingQueue = false;
        this._sidebarOpen = false; this._timerSec = 2700; this._exhaustedTurns = 0; this._enragedTurns = 0;
        this.potionCount = 0;
        this.potionsUsed = 0;
        this.healsRemaining = 0;
        this.fullPotionCount = 0;
        this.fullPotionsUsed = 0;

        const playerRaw = localStorage.getItem('aetheria_player');
        const playerData = playerRaw ? JSON.parse(playerRaw) : { player_id: 1, current_quest_stage: 5 };
        this.playerId = playerData.player_id || 1;
        this.questId = this._sceneData.questId || playerData.current_quest_stage || 5;
        this.presetSlot = this._sceneData.presetSlot || playerData.selected_preset_slot || 1;

        this.add.rectangle(CX, H / 2, W, H, THEME.BG);
        this.add.rectangle(CX, 26, W, 52, THEME.PANEL, THEME.PANEL_ALPHA);
        // Removed unnecessary borders

        // === RESUME PATH: data resume dari MainMenu Pop-up ===
        if (this._sceneData.resumeData) {
            this._resumeBattle(this._sceneData);
        }
        // === NORMAL PATH: initData dari QuestScene (battle baru) ===
        else if (this._sceneData.initData && this._sceneData.initData.status === 'success') {
            this._processBattleData(this._sceneData.initData);
        } else {
            this.loadingText = this.add.text(CX, H / 2, "Loading...", { fontSize: "20px", color: "#ccc" }).setOrigin(0.5);
            this.fetchBattleData();
        }
    }
    async fetchBattleData() {
        try {
            const j = await BattleApi.initBattle(this.questId, this.playerId, this.presetSlot);
            if (j.status !== "success") throw new Error(j.message || "API error");
            this._processBattleData(j);
        } catch (e) {
            console.error(e);
            this.scene.start('LoadingScene', {
                targetScene: 'FallbackScene',
                targetData: {
                    message: 'Oops! Ada kesalahan kecil pada sistem, silakan coba lagi.\n\nDetail: ' + e.message,
                    previousScene: 'QuestScene'
                }
            });
        }
    }
    _processBattleData(j) {
        if (this.loadingText) this.loadingText.destroy();
        this.bsId = j.data.bs_id;
        this.potionCount = j.data.potion_count !== undefined ? j.data.potion_count : 0;
        this.healsRemaining = Math.min(3, this.potionCount);
        this.fullPotionCount = j.data.full_potion_count !== undefined ? j.data.full_potion_count : 0;
        const chars = j.data.player_party.characters.slice(0, 4);
        const cW = 85, gap = 15, total = chars.length, totalW = total * cW + (total - 1) * gap, sx = (W - totalW) / 2 + cW / 2;
        chars.forEach((d, i) => {
            const px = sx + i * (cW + gap);
            const p = new Player(this, px, 600, d);
            p._baseX = px;
            p.setInteractive(new Phaser.Geom.Rectangle(-42.5, -60, 85, 120), Phaser.Geom.Rectangle.Contains);
            p.on("pointerdown", () => { if (this.turn !== "player") return; this._tapPortrait(p); });
            this.players.push(p);
        });
        this.activePlayer = null;
        this.enemies = [];
        const startX = CX - ((j.data.enemies.length - 1) * 70);
        j.data.enemies.forEach((eData, i) => {
            const ex = startX + (i * 140);
            const enemy = new Enemy(this, ex, 260, eData);
            enemy.index = i;
            this.enemies.push(enemy);
        });
        this.selectedTargetIndex = -1;
        this._setupUI();
    }

    /**
     * Resume battle dari data yang tersimpan di server.
     * Inject seluruh state (HP, cooldowns, SA/CA, buffs, turn counter, timer)
     * sebelum UI dibangun.
     */
    _resumeBattle(sceneData) {
        const state = sceneData.resumeData;
        if (!state) { this.scene.start('LoadingScene', { targetScene: 'MainMenuScene' }); return; }

        this.bsId = sceneData.bsId;
        this.questId = sceneData.questId || state.quest_id;
        this._timerSec = sceneData.remainingTime || 2700;

        // Restore potion counts
        this.potionCount = state.potion_count !== undefined ? state.potion_count : 0;
        this.healsRemaining = Math.min(3, this.potionCount);
        this.fullPotionCount = state.full_potion_count !== undefined ? state.full_potion_count : 0;
        this.potionsUsed = state.potions_used || 0;
        this.fullPotionsUsed = state.full_potions_used || 0;

        // Restore turn counter
        this.currentTurn = state.current_turn || 1;
        this.aetherGauge = state.aether_gauge || 0;

        // Build player entities with resume state
        const chars = state.player_party.characters.slice(0, 4);
        const cW = 85, gap = 15, total = chars.length, totalW = total * cW + (total - 1) * gap, sx = (W - totalW) / 2 + cW / 2;
        chars.forEach((d, i) => {
            const px = sx + i * (cW + gap);
            const p = new Player(this, px, 600, d);
            p._baseX = px;

            // Inject runtime state dari resume data
            if (d.current_hp !== undefined) p.hp = d.current_hp;
            if (d.current_sa !== undefined) p.sa = d.current_sa;
            if (d.active_buffs && Array.isArray(d.active_buffs)) p.activeEffects = [...d.active_buffs];
            if (d.skills) {
                d.skills.forEach(sk => {
                    if (sk.current_cooldown !== undefined && sk.current_cooldown > 0) {
                        p.cooldowns[sk.id] = sk.current_cooldown;
                    }
                });
            }

            p.setInteractive(new Phaser.Geom.Rectangle(-42.5, -60, 85, 120), Phaser.Geom.Rectangle.Contains);
            p.on("pointerdown", () => { if (this.turn !== "player") return; this._tapPortrait(p); });
            this.players.push(p);
            
            // Fix: Sinkronisasi visual agar tidak terlihat "sehat" padahal sebenarnya terluka
            p.refreshVisual();
        });
        this.activePlayer = null;

        // Build enemy entity with resume state
        this.enemies = [];
        const startX = CX - ((state.enemies.length - 1) * 70);
        state.enemies.forEach((eData, i) => {
            const ex = startX + (i * 140);
            const enemy = new Enemy(this, ex, 260, eData);
            enemy.index = i;
            if (eData.current_hp !== undefined) enemy.hp = eData.current_hp;
            if (eData.current_ca !== undefined) enemy.chargeBar = eData.current_ca;
            if (eData.active_buffs && Array.isArray(eData.active_buffs)) enemy.activeEffects = [...eData.active_buffs];
            enemy.modeState = eData.mode_state || 'normal';
            enemy.modeBar = eData.mode_bar || 0;
            enemy.isBoss = eData.is_boss === true;
            this.enemies.push(enemy);
        });
        this.selectedTargetIndex = -1;

        this._setupUI();


        // Update turn text setelah UI dibangun
        if (this.turnText) this._updateTurnText();

        // Refresh visual semua entity setelah state di-inject
        this.players.forEach(p => p.refreshVisual());
        this._refreshEnemyHUD();
    }
    _setActive(p) {
        if (this.activePlayer && this.activePlayer !== p) this.activePlayer.setHighlight(false);
        this.activePlayer = p;
        if (p) p.setHighlight(true);
        if (this._sidebarOpen) this._renderSidebar();
    }
    _tapPortrait(p) {
        if (this.activePlayer === p && this._sidebarOpen) { this.closeSidebar(); return; }
        this._setActive(p);
        if (!this._sidebarOpen) this.openSidebar(); else this._renderSidebar();
    }
    _setupUI() {
        this._buildLayer1(); this._buildEnemyHUD(); this._buildArenaButtons();
        this._buildPartySprites(); this._buildLayer4(); this._buildSidebar(); this._buildBattleLog();
        this._startTimer(); this._refreshEnemyHUD();
        this._playStartAnimation();
        
        // Setup targeting indicator listener
        this.enemies.forEach(enemy => {
            // Click area exactly on the Enemy Sprite which is 130x130
            enemy.setInteractive(new Phaser.Geom.Rectangle(-65, -65, 130, 130), Phaser.Geom.Rectangle.Contains);
            enemy.on("pointerdown", () => {
                if (this.turn === "none" || this.turn === "attacking") return;
                this.selectTarget(enemy.index);
            });
        });
        this._updateTargetIndicator();
    }

    selectTarget(index) {
        if (!this.enemies[index] || this.enemies[index].hp <= 0) return;
        
        if (this.selectedTargetIndex === index) {
            this.selectedTargetIndex = -1;
        } else {
            this.selectedTargetIndex = index;
        }
        
        this._updateTargetIndicator();
    }

    _updateTargetIndicator() {
        if (!this._targetIndicator) {
            // HUD bounds approximation: width ~405, height ~55
            this._targetIndicator = this.add.rectangle(0, 0, 405, 55, 0x000000, 0)
                .setStrokeStyle(3, 0xffeb3b)
                .setDepth(50);
        }

        const target = this.enemies[this.selectedTargetIndex];
        if (target && target.hp > 0 && this.selectedTargetIndex !== -1) {
            this._targetIndicator.setVisible(true);
            // baseY of the target HUD is 88 + (index * 45)
            const baseY = 88 + (this.selectedTargetIndex * 45);
            // Center of the HUD: X around 227.5, Y around baseY + 10
            this._targetIndicator.setPosition(228, baseY + 10);
        } else {
            this._targetIndicator.setVisible(false);
        }
    }

    _updateTurnText() {
        if (!this.turnText) return;
        let txt = "TURN " + this.currentTurn;
        if (this.currentWaveLabel) txt += "  |  " + this.currentWaveLabel;
        this.turnText.setText(txt);
    }
    _buildLayer1() {
        this.turnText = this.add.text(20, 26, "TURN 1  |  (1/1)", { fontSize: "13px", color: THEME.TEXT_SECONDARY, fontStyle: "bold" }).setOrigin(0, 0.5);
        this.timerText = this.add.text(CX, 26, "44:59", { fontSize: "18px", color: THEME.TEXT_PRIMARY, fontStyle: "bold" }).setOrigin(0.5, 0.5);
        const mb = this.add.rectangle(405, 26, 50, 34, THEME.PANEL).setInteractive();
        mb.setStrokeStyle(1, THEME.BORDER);
        this.add.text(405, 26, "☰", { fontSize: "18px", color: THEME.TEXT_SECONDARY }).setOrigin(0.5);
        mb.on("pointerdown", () => {
            if (this.turn === "none" || this.turn === "attacking") return;
            this.showMainMenu();
        });
    }
    _buildEnemyHUD() {
        if (this.enemyHUDs) {
            this.enemyHUDs.forEach(hud => {
                Object.values(hud).forEach(item => {
                    if (item && item.destroy && !Array.isArray(item)) item.destroy();
                    else if (Array.isArray(item)) item.forEach(i => i && i.destroy && i.destroy());
                });
            });
        }
        this.enemyHUDs = [];
        this.enemies.forEach((enemy, index) => {
            const baseY = 88 + (index * 45); 
            const ec = this._elemColor(enemy.element);
            
            const icon = this.add.rectangle(45, baseY + 8, 30, 30, THEME.PANEL).setStrokeStyle(2, ec);
            const elemText = this.add.text(45, baseY + 8, enemy.element.substring(0, 2).toUpperCase(), { fontSize: "8px", color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
            const hpPct = this.add.text(65, baseY - 2, "100%", { fontSize: "10px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0, 1);
            
            const hpBarBg = this.add.rectangle(65, baseY + 4, 360, 12, THEME.BG).setOrigin(0, 0.5).setStrokeStyle(2, THEME.BORDER);
            const hpFill = this.add.rectangle(65, baseY + 4, 356, 10, THEME.DAMAGE).setOrigin(0, 0.5);
            const hpEnrage = this.add.rectangle(65, baseY + 4, 360, 12, 0, 0).setOrigin(0, 0.5).setAlpha(0);
            
            const modeBarBg = this.add.rectangle(65, baseY + 14, 360, 4, THEME.BG).setOrigin(0, 0.5).setStrokeStyle(1, THEME.BORDER);
            const modeFill = this.add.rectangle(65, baseY + 14, 0, 4, 0xffffff).setOrigin(0, 0.5);

            if (!enemy.isBoss) {
                hpEnrage.setVisible(false);
                modeBarBg.setVisible(false);
                modeFill.setVisible(false);
            }
            
            const caSegmentsBg = [];
            const caSegments = [];
            for (let i = 0; i < enemy.caMax; i++) {
                const bg = this.add.rectangle(65 + i * 14, baseY + 26, 10, 10, THEME.BG).setOrigin(0, 0.5).setStrokeStyle(1, THEME.BORDER);
                const f = this.add.rectangle(65 + i * 14, baseY + 26, 8, 8, THEME.GOLD).setOrigin(0, 0.5).setAlpha(0);
                caSegmentsBg.push(bg);
                caSegments.push(f);
            }
            
            const nameText = this.add.text(enemy.x, 340, enemy.charName + " \nLv." + enemy.level, { fontSize: "11px", color: "#ffffff", fontStyle: "bold", align: "center" }).setOrigin(0.5, 0);

            this.enemyHUDs.push({
                icon, elemText, hpPct, hpBarBg, hpFill, hpEnrage, modeBarBg, modeFill, caSegmentsBg, caSegments, nameText
            });
        });
    }
    _refreshEnemyHUD() {
        this.enemies.forEach((enemy, index) => {
            const hud = this.enemyHUDs[index];
            if (!hud || !hud.hpFill) return;
            
            const hr = Math.max(0, enemy.hp / enemy.maxHp);
            hud.hpFill.setSize(356 * hr, 10);
            hud.hpPct.setText(Math.ceil(hr * 100) + "%");

            const mr = Math.min(1, enemy.modeBar / enemy.modeMax);
            hud.modeFill.setSize(360 * mr, 4);

            if (hud.caSegments && hud.caSegments.length !== enemy.caMax) {
                hud.caSegments.forEach(f => f.destroy());
                hud.caSegmentsBg.forEach(bg => bg.destroy());
                hud.caSegments = [];
                hud.caSegmentsBg = [];
                const baseY = 88 + (index * 45);
                for (let i = 0; i < enemy.caMax; i++) {
                    const bg = this.add.rectangle(65 + i * 14, baseY + 26, 10, 10, THEME.BG).setOrigin(0, 0.5).setStrokeStyle(1, THEME.BORDER);
                    if (enemy) bg.setAlpha(enemy.alpha);
                    const f = this.add.rectangle(65 + i * 14, baseY + 26, 8, 8, THEME.GOLD).setOrigin(0, 0.5).setAlpha(0);
                    hud.caSegmentsBg.push(bg);
                    hud.caSegments.push(f);
                }
            }

            if (hud.caSegments) {
                const caColor = (enemy.modeState === "exhausted") ? 0x3498db : 0xffaa00;
                hud.caSegments.forEach((f, i) => { f.setFillStyle(caColor); f.setAlpha(i < enemy.caBar ? 1 : 0); });
            }
            
            if (hud.nameText) {
                hud.nameText.setText(enemy.charName + " \nLv." + enemy.level);
                hud.nameText.setPosition(enemy.x, 340);
                if(enemy.hp <= 0) hud.nameText.setAlpha(0.3);
            }
            if (hud.icon) {
                hud.icon.setStrokeStyle(2, this._elemColor(enemy.element));
                if (hud.elemText) hud.elemText.setText(enemy.element.substring(0, 2).toUpperCase());
            }

            this._updateEnrageHUD(enemy, hud);
            enemy.updateEnrageVisual();
            
            if (enemy.hp <= 0) {
                hud.icon.setAlpha(0.3);
                hud.hpBarBg.setAlpha(0.3);
            }
        });
        if (this._updateTargetIndicator) this._updateTargetIndicator();
    }
    _updateEnrageHUD(enemy, hud) {
        if (!enemy || !enemy.isBoss) return;
        const state = enemy.modeState;
        const ratio = enemy.modeBar / enemy.modeMax;

        let color = 0xffffff;
        let alpha = 0.5;

        if (state === "enraged") {
            color = 0xe74c3c;
            alpha = 1;
        } else if (state === "exhausted") {
            color = 0x3498db;
            alpha = 1;
        } else if (state === "normal") {
            if (ratio >= 0.75) {
                color = 0xf1c40f;
                alpha = 1;
            } else {
                color = 0xffffff;
                alpha = 0.5;
            }
        }

        if (hud && hud.hpEnrage) {
            hud.hpEnrage.setStrokeStyle(2, color);
            hud.hpEnrage.setAlpha(alpha);
        }
        if (hud && hud.modeFill) {
            hud.modeFill.setFillStyle(color);
        }
    }
    _applyEnemyDamage(enemyIndex, dmg) {
        const enemy = this.enemies[enemyIndex];
        if (!enemy) return;
        enemy.hp = Math.max(0, enemy.hp - dmg);
        this._refreshEnemyHUD();
        enemy.playHitAnim();
    }
    _buildArenaButtons() {
        this._attackBtnContainer = this.add.container(0, 0);
        const ab = this.add.rectangle(375, 460, 100, 40, THEME.DAMAGE).setDepth(10);
        ab.setStrokeStyle(1, THEME.BORDER);
        const text = this.add.text(375, 460, "ATTACK ⚔", { fontSize: "14px", color: THEME.TEXT_PRIMARY, fontStyle: "bold", align: "center" }).setOrigin(0.5).setDepth(10);
        this._attackBtnContainer.add([ab, text]);
        ab.setInteractive(); ab.on("pointerdown", () => { 
            if (this.turn === "player" && !this.attackBtnLocked) this.playerAttack(); 
        });
        this._attackBtnContainer.setVisible(this.turn === "player");
    }
    _buildPartySprites() {
        this.add.rectangle(CX, 535, W, 1, THEME.BORDER);
        const cW = 85, gap = 15, total = this.players.length, totalW = total * cW + (total - 1) * gap, sx = (W - totalW) / 2 + cW / 2;
        this.players.forEach((p, i) => {
            const px = sx + i * (cW + gap);
            const b = this.add.rectangle(0, 0, 58, 58, THEME.PANEL, 0.7);
            b.setStrokeStyle(1, THEME.BORDER);
            const t = this.add.text(0, 0, "?", { fontSize: "20px", color: THEME.TEXT_SECONDARY }).setOrigin(0.5);
            p.spriteObj = this.add.container(px, 500, [b, t]);
        });
    }

    _buildLayer4() {
        this._aethBarBg = this.add.rectangle(CX, 693, W - 40, 10, THEME.BG);
        this._aethBarBg.setStrokeStyle(1, THEME.AETHER);
        this._aethFill = this.add.rectangle(20, 693, 0, 8, THEME.AETHER).setOrigin(0, 0.5);
        this._aethPct = this.add.text(W - 20, 683, "0%", { fontSize: "8px", color: THEME.TEXT_SECONDARY }).setOrigin(1, 1);
        this.add.text(20, 683, "AETHER", { fontSize: "8px", color: THEME.TEXT_SECONDARY }).setOrigin(0, 1);

        this._healBtn = this.add.rectangle(130, 735, 220, 44, THEME.PANEL);
        this._healBtn.setStrokeStyle(1, THEME.HEALTH);
        this._healText = this.add.text(130, 735, "⊕  HEAL  (x" + this.healsRemaining + ")", { fontSize: "12px", color: THEME.TEXT_SECONDARY }).setOrigin(0.5);
        this._healBtn.setInteractive();
        this._healBtn.on("pointerdown", () => {
            if (this.turn === "player") this.useHealPotion();
        });

        this._abBg = this.add.rectangle(350, 735, 160, 44, THEME.PANEL);
        this._abBg.setStrokeStyle(1, THEME.BORDER);
        this._abText = this.add.text(350, 735, "✦ AETHER BURST", { fontSize: "11px", color: THEME.TEXT_SECONDARY, align: "center" }).setOrigin(0.5);
        this._abBg.setInteractive(); this._abBg.on("pointerdown", () => { if (this.turn === "player") this.aetherBurst(); });
        this._refreshAetherUI();
        this._refreshHealButtonUI();
    }
    _refreshAetherUI() {
        if (!this._aethFill) return;
        const r = Math.min(1, this.aetherGauge / this.aetherGaugeMax);
        this._aethFill.setSize((W - 40) * r, 8);
        this._aethPct.setText(Math.floor(r * 100) + "%");
        const rdy = this.aetherGauge >= this.aetherGaugeMax;
        this._abBg.setStrokeStyle(1, rdy ? THEME.AETHER : THEME.BORDER);
        this._abText.setColor(rdy ? "#A5B4FC" : THEME.TEXT_SECONDARY);
    }
    _buildSidebar() {
        const SBW = 210, SHX = W + SBW / 2;
        this._sbShownX = W - SBW / 2; this._sbHiddenX = SHX;
        this._overlay = this.add.rectangle(CX, H / 2, W, H, 0x000000).setAlpha(0).setInteractive().setDepth(19);
        this._overlay.on("pointerdown", () => this.closeSidebar());
        this._sbPanel = this.add.container(SHX, H / 2).setDepth(20);
        const bg = this.add.rectangle(0, 0, SBW, H, THEME.PANEL); bg.setStrokeStyle(1, THEME.BORDER);
        this._sbPanel.add([bg]);
        this._sbBtns = this.add.container(SHX, H / 2).setDepth(20);
    }
    openSidebar() {
        this._sidebarOpen = true; this._renderSidebar();
        this.tweens.add({ targets: this._overlay, alpha: 0.5, duration: 200 });
        this.tweens.add({ targets: [this._sbPanel, this._sbBtns], x: this._sbShownX, duration: 220, ease: "Power2" });
    }
    closeSidebar() {
        this._sidebarOpen = false;
        if (this._detailModal) {
            this._detailModal.destroy();
            this._detailModal = null;
        }
        this.tweens.add({ targets: this._overlay, alpha: 0, duration: 180 });
        this.tweens.add({ targets: [this._sbPanel, this._sbBtns], x: this._sbHiddenX, duration: 200, ease: "Power2" });
        this._setActive(null);
    }
    _renderSidebar() {
        if (this._detailModal) {
            this._detailModal.destroy();
            this._detailModal = null;
        }
        this._sbBtns.removeAll(true);
        if (!this.activePlayer) return;
        const p = this.activePlayer;
        const skills = [...p.skills].sort((a, b) => {
            const isSaA = (a.category || '').toLowerCase() === 'special';
            const isSaB = (b.category || '').toLowerCase() === 'special';
            if (isSaA && !isSaB) return 1;
            if (!isSaA && isSaB) return -1;
            return 0;
        });

        // --- SECTION 1: Portrait & Stats ---
        const portBg = this.add.rectangle(0, -260, 180, 180, THEME.PANEL);
        portBg.setStrokeStyle(3, p._elemColor); // Border tebal berwarna elemen

        let displayName = p.charName;
        if (displayName === 'Main Character (MC)' || displayName.includes('MC') || displayName === 'Main Character') {
            displayName = getPlayerUsername();
        }

        const nameText = this.add.text(-75, -335, displayName, { fontSize: "13px", fontStyle: "bold", color: THEME.TEXT_PRIMARY }).setOrigin(0, 0.5);
        const lvlText = this.add.text(75, -335, "Lv." + p.level, { fontSize: "10px", fontStyle: "bold", color: THEME.TEXT_SECONDARY }).setOrigin(1, 0.5);

        // Placeholder Area untuk Splash Art (Subtle Background)
        const artPlaceholder = this.add.rectangle(0, -260, 168, 110, THEME.BG, 0.3).setOrigin(0.5);

        // HP Bar
        const hpRatio = Math.max(0, p.hp / p.maxHp);
        const hpLbl = this.add.text(-75, -200, "HP", { fontSize: "10px", fontStyle: "bold", color: THEME.TEXT_MUTED }).setOrigin(0, 0.5);
        const hpBg = this.add.rectangle(10, -200, 110, 12, THEME.BG).setOrigin(0.5);
        const hpFill = this.add.rectangle(-45, -200, 110 * hpRatio, 12, hpRatio > 0.5 ? THEME.HEALTH : hpRatio > 0.25 ? THEME.GOLD : THEME.DAMAGE).setOrigin(0, 0.5);
        const hpText = this.add.text(10, -200, `${Math.floor(p.hp)}/${p.maxHp}`, { fontSize: "9px", fontStyle: "bold", color: THEME.TEXT_PRIMARY }).setOrigin(0.5);

        // SA Bar
        const saRatio = Math.min(1, p.specialBar / p.specialMax);
        const saLbl = this.add.text(-75, -180, "SA", { fontSize: "10px", fontStyle: "bold", color: THEME.TEXT_MUTED }).setOrigin(0, 0.5);
        const saBg = this.add.rectangle(10, -180, 110, 10, THEME.BG).setOrigin(0.5);
        const saFill = this.add.rectangle(-45, -180, 110 * saRatio, 10, THEME.GOLD).setOrigin(0, 0.5);
        const saText = this.add.text(10, -180, `${Math.floor(saRatio * 100)}%`, { fontSize: "8px", fontStyle: "bold", color: saRatio >= 1 ? THEME.TEXT_PRIMARY : THEME.TEXT_SECONDARY }).setOrigin(0.5);

        this._sbBtns.add([portBg, nameText, lvlText, artPlaceholder, hpLbl, hpBg, hpFill, hpText, saLbl, saBg, saFill, saText]);

        // Divider 1
        const div1 = this.add.rectangle(0, -160, 180, 1, THEME.BORDER);
        this._sbBtns.add(div1);

        // --- SECTION 2: Active Effects ---
        const effHeader = this.add.text(-75, -140, "ACTIVE EFFECTS", { fontSize: "10px", fontStyle: "bold", color: THEME.TEXT_SECONDARY }).setOrigin(0, 0.5);

        const effBg = this.add.rectangle(0, -105, 180, 40, THEME.BG).setStrokeStyle(1, THEME.BORDER).setInteractive();
        effBg.on("pointerdown", () => this.showEffectDetailsModal(p));

        this._sbBtns.add([effHeader, effBg]);

        // Draw emojis inside active effects box
        const visibleEffects = p.activeEffects || [];

        if (visibleEffects.length === 0) {
            const noEffText = this.add.text(0, -105, "No active effects", { fontSize: "9px", color: THEME.TEXT_MUTED }).setOrigin(0.5);
            this._sbBtns.add(noEffText);
        } else {
            const sups = { 0: '', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
            visibleEffects.forEach((e, idx) => {
                const isBuff = (e.effect_type || '').toLowerCase() === 'buff';
                const color = isBuff ? '#f1c40f' : '#7ec8e3';

                let emoji = '🔮';
                const stat = (e.target_stat || '').toUpperCase();
                if (stat === 'ATK') emoji = '⚔️';
                else if (stat === 'DEF') emoji = '🛡️';
                else if (stat === 'CRIT') emoji = '✨';
                else if (stat === 'STUN') emoji = '💫';
                else if (stat === 'POISON') emoji = '🤢';
                else if (stat === 'HP') emoji = '💚';
                else if (stat === 'AGI') emoji = '💨';

                const durSup = sups[e.duration] || e.duration || '';
                const label = `${emoji}${durSup}`;

                // Posisi horizontal di tengah container
                const startX = -(visibleEffects.length - 1) * 16;
                const xPos = startX + idx * 32;

                const txt = this.add.text(xPos, -105, label, {
                    fontSize: '11px',
                    color,
                    fontStyle: 'bold',
                    stroke: '#000',
                    strokeThickness: 2
                }).setOrigin(0.5);
                this._sbBtns.add(txt);
            });
        }

        // Divider 2
        const div2 = this.add.rectangle(0, -75, 180, 1, THEME.BORDER);
        this._sbBtns.add(div2);

        // --- SECTION 3: Skills List ---
        const sy = -92, bH = 50, bG = 8;
        const tC = {
            damage: "#CD5C5C",
            buff: THEME.TEXT_SECONDARY,
            debuff: THEME.TEXT_SECONDARY,
            heal: "#458B74",
            special: "#A78BFA"
        };

        skills.forEach((sk, i) => {
            const isSA = (sk.category || '').toLowerCase() === "special";
            const cd = isSA ? 0 : (p.cooldowns[sk.id] || 0);
            const saRdy = isSA && p.specialBar >= p.specialMax;
            const canUse = isSA ? saRdy : (cd === 0);

            // Evaluasi visualType
            let visualType = (sk.type || '').toLowerCase();
            if (visualType === 'support') {
                const hasDebuff = sk.status_effects && sk.status_effects.some(e => (e.effect_type || '').toLowerCase() === 'debuff');
                visualType = hasDebuff ? 'debuff' : 'buff';
            } else if (visualType === 'cleanse' || visualType === 'revive') {
                visualType = 'heal';
            }

            const labelColor = isSA ? tC.special : (tC[visualType] || "#aaaaaa");
            const by = sy + (i + 1) * (bH + bG);

            const bgR = this.add.rectangle(0, by, 180, bH, canUse ? (isSA ? THEME.PANEL : THEME.PANEL) : THEME.BG);
            bgR.setStrokeStyle(1, canUse ? (isSA ? THEME.AETHER : THEME.BORDER) : THEME.BORDER);

            const displayName = sk.name.length > 22 ? sk.name.substring(0, 20) + "..." : sk.name;
            const nm = this.add.text(-78, by - 14, displayName, { fontSize: "11px", color: canUse ? "#e0e0ff" : "#555", fontStyle: "bold" }).setOrigin(0, 0.5);
            const tp = this.add.text(-78, by, isSA ? "[SA]" : "[" + visualType.toUpperCase() + "]", { fontSize: "9px", color: labelColor }).setOrigin(0, 0.5);

            const items = [bgR, nm, tp];
            if (isSA) {
                const bW = 130, bBg = this.add.rectangle(-78 + bW / 2, by + 13, bW, 6, 0x222222).setOrigin(0.5);
                const bF = this.add.rectangle(-78, by + 13, bW * (p.specialBar / p.specialMax), 6, 0xf39c12).setOrigin(0, 0.5);
                const bL = this.add.text(58, by + 13, p.specialBar + "/" + p.specialMax, { fontSize: "8px", color: "#f1c40f" }).setOrigin(0, 0.5);
                items.push(bBg, bF, bL);
                if (p.isSAReady) {
                    const rd = this.add.text(0, by + 22, "✦ STANCE ACTIVE", { fontSize: "8px", color: "#f39c12" }).setOrigin(0.5);
                    items.push(rd);
                }
            } else {
                const cdT = this.add.text(78, by, cd > 0 ? "CD:" + cd : "CD:" + sk.cooldown + "T", { fontSize: "9px", color: cd > 0 ? "#f55" : "#777" }).setOrigin(1, 0.5);
                items.push(cdT);
            }

            this._sbBtns.add(items);
            if (canUse) {
                bgR.setInteractive();
                bgR.on("pointerdown", () => {
                    if (isSA) {
                        p.setSAReady(!p.isSAReady);
                        if (p.isSAReady) this.showLog("✦ " + p.charName + ": SA STANCE!");
                        else this.showLog(p.charName + ": SA cancelled");
                        this._renderSidebar();
                    } else {
                        this.useSkill(i);
                    }
                });
            }
        });
    }

    showEffectDetailsModal(p) {
        if (this._detailModal) this._detailModal.destroy();

        const modalContainer = this.add.container(0, 0).setDepth(30);
        this._detailModal = modalContainer;

        // Overlay menutupi seluruh sidebar
        const overlay = this.add.rectangle(0, 0, 210, H, 0x000000, 0.8).setInteractive();
        modalContainer.add(overlay);

        const cardBg = this.add.rectangle(0, 0, 180, 320, THEME.PANEL).setStrokeStyle(1, THEME.BORDER);
        const cardTitle = this.add.text(0, -130, "STATUS DETAILS", { fontSize: "12px", fontStyle: "bold", color: THEME.TEXT_SECONDARY }).setOrigin(0.5);
        modalContainer.add([cardBg, cardTitle]);

        const visibleEffects = p.activeEffects.filter(e =>
            ['ATK', 'DEF', 'CRIT', 'STUN', 'POISON'].includes(e.target_stat)
        );

        let startY = -90;
        if (visibleEffects.length === 0) {
            const noEff = this.add.text(0, 0, "No active effects", { fontSize: "11px", color: THEME.TEXT_MUTED }).setOrigin(0.5);
            modalContainer.add(noEff);
        } else {
            visibleEffects.forEach((e, idx) => {
                const y = startY + idx * 45;
                if (y > 110) return; // limit card height

                const isBuff = (e.effect_type || '').toLowerCase() === 'buff';
                const color = isBuff ? '#f1c40f' : '#7ec8e3';

                let emoji = '❓';
                if (e.target_stat === 'ATK') emoji = '⚔️';
                else if (e.target_stat === 'DEF') emoji = '🛡️';
                else if (e.target_stat === 'CRIT') emoji = '✨';
                else if (e.target_stat === 'STUN') emoji = '💫';
                else if (e.target_stat === 'POISON') emoji = '🤢';

                const nameText = this.add.text(-70, y, `${emoji} ${e.effect_name || e.target_stat}`, { fontSize: "11px", fontStyle: "bold", color }).setOrigin(0, 0.5);

                let valStr = '';
                if (e.target_stat === 'POISON') {
                    valStr = "-5% HP/Turn";
                } else if (e.target_stat === 'STUN') {
                    valStr = "Can't Move";
                } else {
                    const pct = Math.round((Number(e.value) || 0) * 100);
                    valStr = (pct >= 0 ? "+" : "") + pct + "% " + e.target_stat;
                }

                const descText = this.add.text(-70, y + 15, `${valStr} (${e.duration} turns left)`, { fontSize: "9px", color: "#aaa" }).setOrigin(0, 0.5);
                modalContainer.add([nameText, descText]);
            });
        }

        const closeHint = this.add.text(0, 130, "Click anywhere to close", { fontSize: "9px", color: THEME.TEXT_MUTED }).setOrigin(0.5);
        modalContainer.add(closeHint);

        this._sbBtns.add(modalContainer);

        overlay.on("pointerdown", () => {
            modalContainer.destroy();
            this._detailModal = null;
        });
    }
    playSpriteHitAnim(p) {
        if (!p || !p.spriteObj) return;
        const ox = p.spriteObj.x;
        this.tweens.add({
            targets: p.spriteObj, x: ox + 8,
            duration: 50, yoyo: true, repeat: 2,
            ease: 'Power1',
            onComplete: () => { p.spriteObj.x = ox; }
        });
    }
    _buildBattleLog() {
        this.battleLog = this.add.text(CX, 380, "", { fontSize: "14px", color: "#fff", backgroundColor: "#000000cc", padding: { x: 10, y: 6 }, align: "center", wordWrap: { width: 360 } }).setOrigin(0.5).setDepth(10);
    }
    showLog(msg) {
        if (this._logTimer) this._logTimer.remove();
        this.battleLog.setText(msg);
        this._logTimer = this.time.delayedCall(2200, () => this.battleLog.setText(""));
    }

    showFloatingDoT(target, effectName, dmg, colorStr) {
        if (!target) return;
        
        let x = target.x || (target.spriteObj && target.spriteObj.x) || 200;
        let y = (target.y || (target.spriteObj && target.spriteObj.y) || 300) - 40;

        const labelTxt = this.add.text(x, y, effectName, { 
            fontSize: "14px", color: colorStr, fontStyle: "bold", 
            stroke: "#000", strokeThickness: 3, fontFamily: 'Outfit'
        }).setOrigin(0.5).setDepth(200);

        const amtTxt = this.add.text(x, y + 16, dmg.toString(), { 
            fontSize: "12px", color: colorStr, fontStyle: "bold", 
            stroke: "#000", strokeThickness: 2, fontFamily: 'Outfit' 
        }).setOrigin(0.5).setDepth(200);

        this.tweens.add({
            targets: [labelTxt, amtTxt],
            y: "-=40",
            alpha: { from: 1, to: 0 },
            duration: 1500,
            ease: 'Power1',
            onComplete: () => {
                labelTxt.destroy();
                amtTxt.destroy();
            }
        });
    }

    _playStartAnimation() {
        // Fallback: Check if party is already wiped out upon resuming battle
        const allDead = this.players.every(p => p.hp <= 0);
        if (allDead) {
            this.triggerDefeat(false);
            return;
        }

        const cx = this.cameras.main.width / 2;
        const cy = this.cameras.main.height / 2;
        const startText = this.add.text(cx, cy, "START!", {
            fontSize: "48px",
            fontStyle: "bold",
            fontFamily: "Outfit",
            color: THEME.TEXT_PRIMARY,
            letterSpacing: 8
        }).setOrigin(0.5).setDepth(200).setScale(0.5).setAlpha(0);

        this.showLog("BATTLE START!");

        this.tweens.add({
            targets: startText,
            scale: 1.2,
            alpha: 1,
            duration: 300,
            ease: 'Back.out',
            onComplete: () => {
                this.time.delayedCall(800, () => {
                    this.tweens.add({
                        targets: startText,
                        alpha: 0,
                        scale: 1.5,
                        duration: 300,
                        onComplete: () => startText.destroy()
                    });
                });
            }
        });
    }

    _startTimer() {
        this.timerEvent = this.time.addEvent({
            delay: 1000, repeat: -1, callback: () => {
                if (this.turn === "none") return;
                this._timerSec--;
                if (this._timerSec <= 0) {
                    this._timerSec = 0;
                    this.timerText.setText("00:00").setColor("#f00");
                    this.triggerDefeat(false);
                    return;
                }
                const m = Math.floor(this._timerSec / 60), s = this._timerSec % 60;
                this.timerText.setText((m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s);
                this.timerText.setColor(this._timerSec < 60 ? "#ff4444" : "#ffffff");
            }
        });
    }
    async processTurnEnd() {
        if (this.checkVictory()) return;
        if (this.players.every(p => p.hp <= 0)) {
            this.triggerDefeat(false);
            return;
        }

        try {
            const res = await BattleApi.endTurn(this.bsId);
            if (res.status === 'success') {
                await this._playActionEvents(res.data.events);
                this._syncState(res.data.stateSnapshot);
            }
        } catch (err) {
            console.error("End turn error:", err);
        }

        // Setel kembali turn ke player
        this.setTurn('player');
        
        // Cek kematian pasca DoT
        if (this.players.every(p => p.hp <= 0)) {
            this.triggerDefeat(false);
            return;
        }
        
        // Auto-sync
        this._syncStateToServer();
    }

    async _processEnemyTurn() {
        if (this.checkVictory()) return;
        if (this.players.every(p => p.hp <= 0)) {
            this.triggerDefeat(false);
            return;
        }

        try {
            const res = await BattleApi.getAiDecision(this.bsId, null, null);
            if (res.status === 'success') {
                await this._playActionEvents(res.data.events);
                this._syncState(res.data.stateSnapshot);
            }
        } catch (err) {
            console.error("Enemy turn error:", err);
        }

        if (this.players.every(p => p.hp <= 0)) {
            this.triggerDefeat(false);
            return;
        }

        this.processTurnEnd();
    }

    /**
     * Kumpulkan snapshot state saat ini dan kirim ke server (fire-and-forget).
     * Dipanggil di akhir setiap giliran (processTurnEnd).
     */
    _syncStateToServer() {
        // [FASE 1: DISABLE CLIENT-TO-SERVER SYNC]
        // In a server-authoritative model, the client should NEVER overwrite the server's state.
        // The server's BattleMemoryStore maintains the full, rich state (final_stats, elements, etc.).
        /*
        try {
            const snapshot = {
                quest_id: this.questId,
                current_turn: this.currentTurn,
                aether_gauge: this.aetherGauge,
                potions_used: this.potionsUsed,
                full_potions_used: this.fullPotionsUsed,
                potion_count: this.potionCount,
                full_potion_count: this.fullPotionCount,
                player_party: {
                    characters: this.players.map(p => ({
                        slot: p.slot,
                        name: p.charName,
                        element: p.element,
                        level: p.level,
                        final_stats: p.finalStats,
                        current_hp: p.hp,
                        current_sa: p.sa || 0,
                        active_buffs: p.activeEffects ? [...p.activeEffects] : [],
                        skills: (p.skills || []).map(s => ({
                            ...s,
                            current_cooldown: p.cooldowns[s.id] || 0
                        }))
                    }))
                },
                enemies: this.enemies.map(e => ({
                    id: e.monsterId,
                    name: e.charName,
                    element: e.element,
                    level: e.level,
                    final_stats: e.finalStats,
                    caMax: e.caMax,
                    current_hp: e.hp,
                    current_ca: e.caBar,
                    is_ca_ready: e.caBar >= e.caMax,
                    active_buffs: e.activeEffects ? [...e.activeEffects] : [],
                    mode_state: e.modeState,
                    mode_bar: e.modeBar
                }))
            };
            BattleApi.syncBattleState(this.bsId, snapshot, this._timerSec);
        } catch (e) {
            console.error('[_syncStateToServer] Error building snapshot:', e);
        }
        */
    }
    /**
     * Kumpulkan data keadaan arena (Knowledge Base) untuk AI musuh.
     * Dipanggil sesaat sebelum giliran musuh agar data selalu up-to-date.
     * @returns {object} knowledge
     */
    _buildKnowledge() {
        const alive = this.players.filter(p => p.hp > 0);

        const partyHpRatios = alive.map(p => p.hp / p.maxHp);
        const partyLowHpCount = alive.filter(p => (p.hp / p.maxHp) < 0.3).length;
        const avgHpRatio = partyHpRatios.length
            ? partyHpRatios.reduce((s, r) => s + r, 0) / partyHpRatios.length
            : 0;
        const partyHealthy = avgHpRatio > 0.7;

        // Hitung buff aktif musuh (efek bertipe Buff pada enemy)
        const targetEnemy = this.enemies[this.selectedTargetIndex] || this.enemies[0];
        const enemyBuffCount = targetEnemy && targetEnemy.activeEffects.filter(e => (e.effect_type || '').toLowerCase() === 'buff').length;
        const enemyDebuffCount = targetEnemy && targetEnemy.activeEffects.filter(e => (e.effect_type || '').toLowerCase() === 'debuff').length;

        // Hitung total buff aktif di seluruh party
        const playerBuffCount = alive.reduce((total, p) => {
            return total + p.activeEffects.filter(e => (e.effect_type || '').toLowerCase() === 'buff').length;
        }, 0);

        // Deteksi apakah ada healer/reviver masih hidup di party
        const healerAlive = alive.some(p =>
            p.skills && p.skills.some(s => {
                const t = (s.type || '').toLowerCase();
                return t === 'heal' || t === 'revive' || t === 'cleanse';
            })
        );

        return {
            partyHpRatios,
            partyLowHpCount,
            partyHealthy,
            enemyBuffCount,
            enemyDebuffCount,
            playerBuffCount,
            healerAlive
        };
    }
    async _playActionEvents(events) {
        let waveChanged = false;
        for (const ev of events) {
            await new Promise(resolve => {
                let delay = 500;
                
                let target = null;
                if (ev.targetId !== undefined && ev.targetId !== null) {
                    target = this.players.find(p => p.slot === ev.targetId);
                    if (!target) {
                        const tIdStr = String(ev.targetId);
                        if (this.enemies.some(e => String(e.monsterId) == tIdStr) || tIdStr.startsWith('enemy_') || tIdStr === 'enemy') {
                            const eIdx = tIdStr.startsWith('enemy_') ? parseInt(tIdStr.split('_')[1], 10) : 0;
                            target = this.enemies[eIdx] || this.enemies[0];
                        }
                    }
                }
                
                if (ev.type === 'damage') {
                    if (target) {
                        target.hp = Math.max(0, target.hp - ev.value);
                        if (this.enemies.includes(target)) {
                            if (ev.modeBar !== undefined && target) target.modeBar = ev.modeBar;
                            if (ev.modeState !== undefined && target) target.modeState = ev.modeState;
                            this._refreshEnemyHUD();
                            if (target) target.playHitAnim();
                        } else {
                            target.refreshVisual();
                            this.playSpriteHitAnim(target);
                        }
                        if (ev.isDoT) {
                            const colorStr = ev.effectName === 'Burn' ? "#e67e22" : "#9b59b6";
                            const emoji = ev.effectName === 'Burn' ? "🔥" : "💀";
                            this.showLog(`${emoji} ${ev.effectName} deals ${ev.value} damage to ${target.charName}!`);
                            this.showFloatingDoT(target, ev.effectName, ev.value, colorStr);
                            delay = 600;
                        } else {
                            const eIdxAct = ev.sourceId && String(ev.sourceId).startsWith('enemy_') ? parseInt(String(ev.sourceId).split('_')[1], 10) : 0;
                            const source = this.players.find(p => p.slot === ev.sourceId) || (String(ev.sourceId).startsWith('enemy') ? this.enemies[eIdxAct] : null);
                            const sourceName = source ? source.charName : ev.sourceId;
                            let logText = `${sourceName} -> ${target.charName}: ${ev.isCrit ? "💥 " : ""}${ev.value} dmg`;
                            if (ev.skillName && ev.skillName !== 'Basic Attack') {
                                logText = `[${ev.skillName}]\n` + logText;
                            }
                            this.showLog(logText);
                            delay = 800;
                        }
                    }
                } else if (ev.type === 'heal') {
                    if (target) {
                        target.hp = Math.min(target.maxHp, target.hp + ev.value);
                        if (target === this.enemy) this._refreshEnemyHUD();
                        else target.refreshVisual();
                        this.showLog(`💚 ${target.charName} healed ${ev.value}!`);
                        delay = 600;
                    }
                } else if (ev.type === 'revive') {
                    if (target) {
                        target.hp = ev.value;
                        if (target === this.enemy) this._refreshEnemyHUD();
                        else target.refreshVisual();
                        this.showLog(`✨ ${target.charName} revived!`);
                        delay = 600;
                    }
                } else if (ev.type === 'cleanse') {
                    if (target) {
                        target.activeEffects = target.activeEffects.filter(e => (e.effect_type || '').toLowerCase() !== 'debuff');
                        target.refreshVisual();
                        this.showLog(`✨ ${target.charName} debuffs cleansed!`);
                        delay = 500;
                    }
                } else if (ev.type === 'effect_applied') {
                    if (target) {
                        this.showLog(`${target.charName} got ${ev.effectName}!`);
                        delay = 500;
                    }
                } else if (ev.type === 'enrage') {
                    if (target) {
                        target.modeState = 'enraged';
                        this._enragedTurns = 3;
                        this.showLog("ENEMY ENRAGED! (3 Turns)");
                        this._refreshEnemyHUD();
                        delay = 800;
                    }
                } else if (ev.type === 'break') {
                    if (target) {
                        target.modeState = 'exhausted';
                        this._exhaustedTurns = 2;
                        this._enragedTurns = 0;
                        this.showLog("ENEMY BREAK! (Exhausted)");
                        this._refreshEnemyHUD();
                        delay = 800;
                    }
                } else if (ev.type === 'log') {
                    this.showLog(ev.message);
                    delay = 600;
                } else if (ev.type === 'wave_change') {
                    waveChanged = true;
                    this._isWaveChanging = true;
                    
                    delay = -1; // Flag for manual resolve
                    
                    // 1. Fade out the dying enemy
                    if (this.enemies.length > 0) {
                        const targetAlphas = [];
                        this.enemies.forEach((enemy, idx) => {
                            targetAlphas.push(enemy);
                            const hud = this.enemyHUDs[idx];
                            if(hud) {
                                targetAlphas.push(hud.icon, hud.hpBarBg, hud.hpFill, hud.hpPct, hud.nameText);
                                if(hud.caSegmentsBg) targetAlphas.push(...hud.caSegmentsBg);
                                if(hud.caSegments) targetAlphas.push(...hud.caSegments);
                                if(hud.modeFill) targetAlphas.push(hud.modeFill);
                                if(hud.modeBarBg) targetAlphas.push(hud.modeBarBg);
                            }
                        });
                        
                        this.tweens.add({
                            targets: targetAlphas,
                            alpha: 0,
                            duration: 1000,
                            onComplete: () => {
                                resolve();
                                
                                const waveTxt = this.add.text(CX, H/2, `WAVE ${ev.waveNum}`, {
                                    fontSize: '48px', color: THEME.GOLD, fontStyle: 'bold', fontFamily: 'Outfit'
                                }).setOrigin(0.5).setAlpha(0).setDepth(201);
                                
                                this.tweens.add({
                                    targets: waveTxt,
                                    alpha: 1,
                                    duration: 600,
                                    yoyo: true,
                                    hold: 800,
                                    onComplete: () => {
                                        waveTxt.destroy();
                                        
                                        const newTargetAlphas = [];
                                        this.enemies.forEach((enemy, idx) => {
                                            newTargetAlphas.push(enemy);
                                            const hud = this.enemyHUDs[idx];
                                            if(hud) {
                                                newTargetAlphas.push(hud.icon, hud.hpBarBg, hud.hpFill, hud.hpPct, hud.nameText);
                                                if(hud.caSegmentsBg) newTargetAlphas.push(...hud.caSegmentsBg);
                                                if(hud.modeFill && enemy.isBoss) newTargetAlphas.push(hud.modeFill);
                                                if(hud.modeBarBg && enemy.isBoss) newTargetAlphas.push(hud.modeBarBg);
                                            }
                                        });
                                        
                                        this.tweens.add({
                                            targets: newTargetAlphas,
                                            alpha: 1,
                                            duration: 800,
                                            onComplete: () => {
                                                this._isWaveChanging = false;
                                                this._refreshEnemyHUD();
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    } else {
                        resolve();
                    }
                } else {
                    delay = 100;
                }
                
                if (delay >= 0) {
                    this.time.delayedCall(delay, resolve);
                }
            });
        }
        return waveChanged;
    }

    async playerAttack() {
        const alive = this.players.filter(p => p.hp > 0);
        if (!alive.length) return;
        this.setTurn("attacking");
        this.closeSidebar();

        // 1. Player Attack Sequence
        for (const p of alive) {
            let isSaReady = p.isSAReady && p.specialBar >= p.specialMax;
            let saSkill = null;
            if (isSaReady) {
                saSkill = p.skills.find(sk => (sk.category || '').toLowerCase() === 'special');
            }

            const targetIdx = this.selectedTargetIndex !== -1 ? this.selectedTargetIndex : 0;
            const actionData = {
                sourceId: p.slot,
                targetIds: [`enemy_${targetIdx}`],
                actionType: saSkill ? 'skill' : 'attack',
                skillId: saSkill ? saSkill.id : null,
                isAttackSequence: true
            };

            // Nonaktifkan stance SA setelah dieksekusi
            if (saSkill) {
                p.setSAReady(false);
            }

            let waveChanged = false;
            try {
                const res = await BattleApi.executeAction(this.bsId, actionData);
                if (res.status === 'success') {
                    waveChanged = await this._playActionEvents(res.data.events);
                    this._syncState(res.data.stateSnapshot);
                }
            } catch (err) {
                console.error("Action error", err);
            }

            await new Promise(resolve => this.time.delayedCall(500, resolve));

            // Stop attack sequence if wave changed or enemy is dead
            if (waveChanged || this.enemies[0].hp <= 0) {
                if (waveChanged) this.setTurn("player"); // Give control back to player
                break;
            }
        }

        if (this.enemies.every(e => e.hp <= 0)) {
            this.checkVictory();
            return;
        }
        
        // If turn was reset due to wave change, do not end turn
        if (this.turn === "player") return;

        this.time.delayedCall(800, () => this._processEnemyTurn());
    }

    async useSkill(idx) {
        if (!this.activePlayer || this.activePlayer.hp <= 0) return;
        const skill = this.activePlayer.skills[idx];
        if (!skill) return;

        const isSA = (skill.category || '').toLowerCase() === "special";
        const cd = isSA ? 0 : (this.activePlayer.cooldowns[skill.id] || 0);
        const saRdy = isSA && this.activePlayer.specialBar >= this.activePlayer.specialMax;
        
        if (isSA && !saRdy) return;
        if (!isSA && cd > 0) return;

        let targetIds = [];
        const tType = skill.target_type || 'Single_Enemy';

        if (tType === 'Single_Enemy' || tType === 'All_Enemies') {
            const targetIdx = this.selectedTargetIndex !== -1 ? this.selectedTargetIndex : 0;
            targetIds = [`enemy_${targetIdx}`];
        } else if (tType === 'Self') {
            targetIds = [this.activePlayer.slot];
        } else if (tType === 'All_Allies') {
            targetIds = this.players.filter(p => p.hp > 0).map(p => p.slot);
        } else if (tType === 'Single_Ally') {
            const isRevive = (skill.type || '').toLowerCase() === 'revive';
            this._showCharacterSelectionModal(isRevive ? "REVIVE TARGET" : "SKILL TARGET", !isRevive, (targetChar) => {
                this._enqueueSkill(this.activePlayer, skill, [targetChar.slot]);
            });
            return; // Wait for modal callback
        } else {
            const targetIdx = this.selectedTargetIndex !== -1 ? this.selectedTargetIndex : 0;
            targetIds = [`enemy_${targetIdx}`];
        }

        this._enqueueSkill(this.activePlayer, skill, targetIds);
    }

    _enqueueSkill(player, skill, targetIds) {
        // Visual cooldown local to prevent spam
        player.cooldowns[skill.id] = skill.cooldown || 1;
        player.refreshVisual();
        
        if (this._sidebarOpen && this.activePlayer === player) {
            this._renderSidebar();
        }
        
        this.skillQueue.push({ player, skill, targetIds });
        
        if (!this.isProcessingQueue) {
            this._processSkillQueue();
        }
    }

    async _processSkillQueue() {
        this.isProcessingQueue = true;
        this._updateAttackButtonState();

        while (this.skillQueue.length > 0) {
            const { player, skill, targetIds, isBasic } = this.skillQueue.shift();
            
            try {
                const actType = isBasic ? 'attack' : 'skill';
                await this._sendActionAndPlay(player.slot, targetIds, actType, skill ? skill.id : null);
                
                // Queue Abort on Death
                if (this.enemies.every(e => e.hp <= 0)) {
                    this.skillQueue = [];
                    this.isProcessingQueue = false;
                    this._updateAttackButtonState();
                    this.checkVictory();
                    return;
                }
                
                // Add natural pacing between queued skills
                await new Promise(resolve => this.time.delayedCall(500, resolve));
            } catch (error) {
                console.error("Skill queue processing error:", error);
                // Flush queue on error (e.g. network down) to prevent soft-lock
                this.skillQueue = [];
                // Fallback can be added here if needed
                break;
            }
        }

        this.isProcessingQueue = false;
        this._updateAttackButtonState();
    }

    _updateAttackButtonState() {
        if (!this.attackBtn) return;
        
        if (this.isProcessingQueue) {
            this.attackBtn.setAlpha(0.5);
            this.attackBtn.disableInteractive();
        } else {
            this.attackBtn.setAlpha(1);
            this.attackBtn.setInteractive();
        }
    }

    async _sendActionAndPlay(sourceId, targetIds, actionType, skillId) {
        try {
            const actionData = { sourceId, targetIds, actionType, skillId };
            const res = await BattleApi.executeAction(this.bsId, actionData);
            if (res.status === 'success') {
                await this._playActionEvents(res.data.events);
                this._syncState(res.data.stateSnapshot);
            }
        } catch (err) {
            console.error("Action error", err);
        }
    }

    _syncState(state) {
        if (!state) return;
        
        // Sync Turn & Wave
        if (state.current_turn !== undefined) {
            this.currentTurn = state.current_turn;
            this._updateTurnText();
        }
        if (state.wave !== undefined) this.currentWave = state.wave;

        // Sync Players
        if (state.players) {
            state.players.forEach(pd => {
                const pObj = this.players.find(p => p.slot === pd.id);
                if (pObj) {
                    pObj.hp = pd.current_hp !== undefined ? pd.current_hp : pObj.hp;
                    if (pd.current_sp !== undefined) pObj.specialBar = pd.current_sp;
                    if (pd.cooldowns) pObj.cooldowns = { ...pd.cooldowns };
                    if (pd.active_buffs) pObj.activeEffects = [...pd.active_buffs];
                    else pObj.activeEffects = [];
                    pObj.refreshVisual();
                }
            });
        }

        // Sync Enemies
        if (state.enemies) {
            let needsRebuild = false;
            if (this.enemies.length !== state.enemies.length) needsRebuild = true;
            else if (this.enemies.length > 0 && state.enemies.length > 0 && this.enemies[0].monsterId !== state.enemies[0].id) needsRebuild = true;

            if (needsRebuild) {
                this.enemies.forEach(e => { if (e && e.destroy) e.destroy(); });
                this.enemies = [];
                
                const startX = CX - ((state.enemies.length - 1) * 70);
                state.enemies.forEach((eData, i) => {
                    const ex = startX + (i * 140);
                    const enemy = new Enemy(this, ex, 260, eData);
                    enemy.index = i;
                    
                    if (this._isWaveChanging) {
                        enemy.setAlpha(0);
                    }
                    
                    enemy.setInteractive(new Phaser.Geom.Rectangle(-65, -65, 130, 130), Phaser.Geom.Rectangle.Contains);
                    enemy.on("pointerdown", () => {
                        if (this.turn === "none" || this.turn === "attacking") return;
                        this.selectTarget(enemy.index);
                    });
                    
                    this.enemies.push(enemy);
                });
                
                this._buildEnemyHUD();
                
                if (this._isWaveChanging && this.enemyHUDs) {
                    this.enemyHUDs.forEach(hud => {
                        Object.values(hud).forEach(item => {
                            if (item && item.setAlpha && !Array.isArray(item)) item.setAlpha(0);
                            else if (Array.isArray(item)) item.forEach(i => i && i.setAlpha && i.setAlpha(0));
                        });
                    });
                }
                this.selectedTargetIndex = -1;
                this._updateTargetIndicator();
            }

            state.enemies.forEach((enemyData, i) => {
                const enemyObj = this.enemies[i];
                if (enemyObj && enemyData) {
                    if (enemyData.final_stats) {
                        enemyObj.finalStats = enemyData.final_stats;
                        enemyObj.maxHp = enemyData.final_stats.hp;
                        enemyObj.atk = enemyData.final_stats.atk;
                        enemyObj.def = enemyData.final_stats.def || 500;
                    }
                    enemyObj.monsterId = enemyData.id;
                    enemyObj.charName = enemyData.name;
                    enemyObj.element = enemyData.element || 'None';
                    enemyObj.level = enemyData.level || 1;
                    enemyObj.isBoss = enemyData.is_boss === true;
                    enemyObj.caMax = enemyData.caMax || 3;

                    enemyObj.hp = enemyData.current_hp !== undefined ? enemyData.current_hp : enemyObj.maxHp;
                    enemyObj.modeBar = enemyData.mode_bar || 0;
                    enemyObj.modeState = enemyData.mode_state || 'normal';
                    
                    if (enemyData.current_ca !== undefined) {
                         enemyObj.caBar = enemyData.current_ca;
                    }
                    
                    if (enemyData.active_buffs) {
                        enemyObj.activeEffects = [...enemyData.active_buffs];
                    } else {
                        enemyObj.activeEffects = [];
                    }
                    
                    enemyObj.refreshVisual();
                }
            });
            this._refreshEnemyHUD();
        }

        if (state.timeline && this.timelineContainer) {
            this.buildTimeline(state.timeline);
        }
    }
    _randAlive() { const l = this.players.filter(p => p.hp > 0); return l.length ? l[Math.floor(Math.random() * l.length)] : null; }
    _elemColor(el) { return { Fire: THEME.ELEM_FIRE, Wind: THEME.ELEM_WIND, Earth: THEME.ELEM_EARTH }[el] || THEME.BORDER; }

    useHealPotion() {
        if (this.healsRemaining <= 0) {
            this.showLog("No Green Potions left!");
            return;
        }

        this._showCharacterSelectionModal("HEAL TARGET", true, async (targetChar) => {
            try {
                const actionData = { sourceId: targetChar.slot, targetIds: [targetChar.slot], actionType: 'use_potion', skillId: null };
                const res = await BattleApi.executeAction(this.bsId, actionData);
                
                if (res.status === 'success') {
                    await this._playActionEvents(res.data.events);
                    this._syncState(res.data.stateSnapshot);
                    
                    // We increment this locally to track full count in this session (though server tracks too)
                    this.potionsUsed++;
                    
                    this.showLog(`Used Green Potion on ${targetChar.charName}!`);
                }
            } catch (err) {
                console.error("Potion error", err);
                this.showLog("Failed to use potion.");
            }
        });
    }

    _refreshHealButtonUI() {
        if (this._healText) {
            this._healText.setText("⊕  HEAL  (x" + this.healsRemaining + ")");
            if (this.healsRemaining <= 0) {
                this._healBtn.setStrokeStyle(2, 0x555555);
                this._healText.setColor("#555555");
            } else {
                this._healBtn.setStrokeStyle(2, 0x2ecc71);
                this._healText.setColor("#a8e6cf");
            }
        }
    }

    _showCharacterSelectionModal(titleText, requireAlive, onSelectedCallback) {
        const modalContainer = this.add.container(0, 0).setDepth(100);

        const cover = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.7).setInteractive();
        cover.on("pointerdown", (pointer, x, y, event) => {
            event.stopPropagation();
        });
        modalContainer.add(cover);

        const windowBg = this.add.rectangle(CX, H / 2, 360, 260, 0x0d1b2a);
        windowBg.setStrokeStyle(2, 0x4a90d9);
        modalContainer.add(windowBg);

        const title = this.add.text(CX, H / 2 - 105, titleText, { fontSize: "14px", color: "#7ec8e3", fontStyle: "bold" }).setOrigin(0.5);
        modalContainer.add(title);

        const positions = [
            { x: CX - 80, y: H / 2 - 35 },
            { x: CX + 80, y: H / 2 - 35 },
            { x: CX - 80, y: H / 2 + 35 },
            { x: CX + 80, y: H / 2 + 35 }
        ];

        this.players.forEach((p, idx) => {
            const pos = positions[idx];
            const isDead = p.hp <= 0;
            const isValid = requireAlive ? !isDead : isDead;

            const charBox = this.add.rectangle(pos.x, pos.y, 140, 52, isValid ? (requireAlive ? 0x112b1a : 0x24152e) : 0x111111);
            charBox.setStrokeStyle(1.5, isValid ? (requireAlive ? 0x2ecc71 : 0xb39ddb) : 0x333333);
            modalContainer.add(charBox);

            const nameTxt = this.add.text(pos.x - 62, pos.y - 14, p.charName, { fontSize: "11px", color: isValid ? "#e0e0ff" : "#666", fontStyle: "bold" }).setOrigin(0, 0.5);
            modalContainer.add(nameTxt);

            const barW = 124;
            const hpBarBg = this.add.rectangle(pos.x, pos.y + 4, barW, 6, 0x222222).setOrigin(0.5);
            const ratio = Math.max(0, p.hp / p.maxHp);

            let barColor = 0x2ecc71; // Hijau
            if (isDead) {
                barColor = 0x000000;
            } else if (ratio <= 0.25) {
                barColor = 0xe74c3c; // Merah
            } else if (ratio <= 0.50) {
                barColor = 0xe67e22; // Oren
            }

            const hpBarFill = this.add.rectangle(pos.x - barW / 2, pos.y + 4, barW * ratio, 6, barColor).setOrigin(0, 0.5);
            modalContainer.add([hpBarBg, hpBarFill]);

            const statusStr = isDead ? "KO 💀" : `${p.hp}/${p.maxHp}`;
            const statusColor = isDead ? "#ff8a80" : "#a8e6cf";
            const statusTxt = this.add.text(pos.x - 62, pos.y + 14, statusStr, { fontSize: "9px", color: statusColor }).setOrigin(0, 0.5);
            modalContainer.add(statusTxt);

            if (isValid) {
                charBox.setInteractive();
                charBox.on("pointerover", () => {
                    charBox.setFillStyle(requireAlive ? 0x1c452a : 0x3b214c);
                });
                charBox.on("pointerout", () => {
                    charBox.setFillStyle(requireAlive ? 0x112b1a : 0x24152e);
                });
                charBox.on("pointerdown", () => {
                    modalContainer.destroy();
                    onSelectedCallback(p);
                });
            } else {
                charBox.setAlpha(0.65);
                nameTxt.setAlpha(0.65);
                statusTxt.setAlpha(0.65);
            }
        });

        const cancelBtn = this.add.rectangle(CX, H / 2 + 95, 100, 30, 0x2a0d0d);
        cancelBtn.setStrokeStyle(1.5, 0xe74c3c);
        const cancelText = this.add.text(CX, H / 2 + 95, "CANCEL", { fontSize: "11px", color: "#ff8a80", fontStyle: "bold" }).setOrigin(0.5);
        modalContainer.add([cancelBtn, cancelText]);

        cancelBtn.setInteractive();
        cancelBtn.on("pointerover", () => cancelBtn.setFillStyle(0x401515));
        cancelBtn.on("pointerout", () => cancelBtn.setFillStyle(0x2a0d0d));
        cancelBtn.on("pointerdown", () => {
            modalContainer.destroy();
        });
    }

    checkVictory() {
        if (this.enemies.every(e => e.hp <= 0)) {
            this.turn = "none";
            this.showLog("VICTORY! 🎉");
            this.time.delayedCall(1500, () => {
                this.scene.stop();
                this.scene.start('LoadingScene', {
                    targetScene: 'VictoryScene',
                    targetData: {
                        questId: this.questId,
                        playerId: this.playerId,
                        potionsUsed: this.potionsUsed,
                        fullPotionsUsed: this.fullPotionsUsed,
                        bsId: this.bsId
                    }
                });
            });
            return true;
        }
        return false;
    }

    triggerDefeat(isRetreat = false) {
        this.turn = "none";
        
        if (isRetreat) {
            this.showLog("RETREATED");
            this.time.delayedCall(1500, () => {
                this.scene.pause();
                this.scene.launch('DefeatScene', {
                    questId: this.questId,
                    playerId: this.playerId,
                    isRetreat: isRetreat,
                    bsId: this.bsId
                });
            });
            return;
        }

        // Wipeout flow: always show the Revive Modal
        this.time.delayedCall(1500, () => {
            if (this.fullPotionsUsed >= 1) {
                // Langsung defeat jika sudah revive 1x
                this.showLog("DEFEAT... 💀");
                this.scene.pause();
                this.scene.launch('DefeatScene', {
                    questId: this.questId,
                    playerId: this.playerId,
                    isRetreat: false,
                    bsId: this.bsId
                });
            } else {
                this._showReviveModal();
            }
        });
    }

    _showReviveModal() {
        this.turn = "none";
        const mc = this.add.container(0, 0).setDepth(100);
        const ov = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.85).setInteractive();
        ov.on('pointerdown', (p, x, y, e) => e.stopPropagation());

        const pnl = this.add.rectangle(CX, H / 2, 360, 260, 0x0d1b2a).setStrokeStyle(2, 0xf39c12).setInteractive();
        pnl.on('pointerdown', (p, x, y, e) => e.stopPropagation());

        const remaining = this.fullPotionCount - this.fullPotionsUsed;
        const items = [ov, pnl];
        items.push(this.add.text(CX, H / 2 - 95, '💀 PARTY WIPEOUT', { fontSize: '16px', fontStyle: 'bold', color: '#CD5C5C', fontFamily: 'Outfit' }).setOrigin(0.5));
        items.push(this.add.text(CX, H / 2 - 60, `Full Potion tersedia: ${remaining}x`, { fontSize: '12px', color: THEME.TEXT_PRIMARY, fontFamily: 'Outfit' }).setOrigin(0.5));
        items.push(this.add.text(CX, H / 2 - 30, 'Gunakan 1x Full Potion untuk\nmenghidupkan seluruh party\ndengan 100% HP & cooldown reset?', { fontSize: '10px', color: THEME.TEXT_SECONDARY, fontFamily: 'Outfit', align: 'center' }).setOrigin(0.5));

        // Button Give Up
        const giveUpBtn = this.add.rectangle(CX, H / 2 + 80, 280, 42, 0x2a1a1a).setStrokeStyle(2, THEME.DAMAGE).setInteractive({ useHandCursor: true });
        const giveUpTxt = this.add.text(CX, H / 2 + 80, '🏳️ Menyerah', { fontSize: '12px', fontStyle: 'bold', color: '#ffaaaa', fontFamily: 'Outfit' }).setOrigin(0.5);
        giveUpBtn.on('pointerdown', () => {
            mc.destroy();
            this.turn = "none";
            this.showLog("DEFEAT... 💀");
            this.time.delayedCall(1500, () => {
                this.scene.pause();
                this.scene.launch('DefeatScene', {
                    questId: this.questId, playerId: this.playerId, isRetreat: false, bsId: this.bsId
                });
            });
        });
        items.push(giveUpBtn, giveUpTxt);
        // Button Revive
        const canRevive = remaining > 0 && this.fullPotionsUsed < 1;
        const useBtn = this.add.rectangle(CX, H / 2 + 30, 280, 42, canRevive ? 0x1a3a2a : 0x111111).setStrokeStyle(2, canRevive ? THEME.HEALTH : 0x333333);
        const useTxt = this.add.text(CX, H / 2 + 30, '🧪 Revive Party (Full Potion)', { fontSize: '12px', fontStyle: 'bold', color: canRevive ? '#a8e6cf' : '#555555', fontFamily: 'Outfit' }).setOrigin(0.5);
        
        if (canRevive) {
            useBtn.setInteractive({ useHandCursor: true });
            useBtn.on('pointerdown', async () => {
                useBtn.disableInteractive();
                try {
                    const res = await BattleApi.executeAction(this.bsId, { actionType: 'revive_party' });
                    if (res.status === 'success') {
                        mc.destroy();
                        this.fullPotionsUsed++;
                        await this._playActionEvents(res.data.events);
                        if (res.data.state) this._syncState(res.data.state);
                        this.setTurn('player');
                    } else {
                        this.showLog("Revive gagal!");
                        useBtn.setInteractive({ useHandCursor: true });
                    }
                } catch (e) {
                    console.error("Revive Error:", e);
                    this.showLog("Network Error saat Revive");
                    useBtn.setInteractive({ useHandCursor: true });
                }
            });
        }
        
        items.push(useBtn, useTxt);
        mc.add(items);
    }

    showMainMenu() {
        if (this._menu && this._menu.active) return;
        this._menu = new BattleMenu(this, CX, H / 2, W, H, THEME);
        this._menu.on('destroy', () => { this._menu = null; });
    }
}
