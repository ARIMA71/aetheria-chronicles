import Player from "../entities/player";
import Enemy from "../entities/enemy";
import { THEME } from "../main.js";
import { checkSession } from "../utils/auth.js";
import BattleApi from "../services/BattleApi.js";
import CombatManager from "../services/CombatManager.js";
import BattleMenu from "../ui/BattleMenu.js";
const W = 450, H = 800, CX = 225;
export default class BattleScene extends Phaser.Scene {
    constructor() { super("BattleScene"); }
    setTurn(newTurn) {
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
        this._sidebarOpen = false; this._timerSec = 2699; this._exhaustedTurns = 0; this._enragedTurns = 0;
        this.potionCount = 0;
        this.potionsUsed = 0;
        this.healsRemaining = 0;

        const playerRaw = localStorage.getItem('aetheria_player');
        const playerData = playerRaw ? JSON.parse(playerRaw) : { player_id: 1, current_quest_stage: 5 };
        this.playerId = playerData.player_id || 1;
        this.questId = playerData.current_quest_stage || 5;

        this.add.rectangle(CX, H / 2, W, H, THEME.BG);
        this.add.rectangle(CX, 26, W, 52, THEME.PANEL, THEME.PANEL_ALPHA);
        this.add.rectangle(CX, 435, W, 2, THEME.BORDER);
        this.add.rectangle(CX, 550, W, 2, THEME.BORDER);
        this.loadingText = this.add.text(CX, H / 2, "Loading...", { fontSize: "20px", color: "#ccc" }).setOrigin(0.5);
        this.fetchBattleData();
    }
    async fetchBattleData() {
        try {
            const j = await BattleApi.initBattle(this.questId, this.playerId);
            if (j.status !== "success") throw new Error(j.message || "API error");
            this.loadingText.destroy();
            this.bsId = j.data.bs_id;
            this.potionCount = j.data.potion_count !== undefined ? j.data.potion_count : 0;
            this.healsRemaining = Math.min(3, this.potionCount);
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
            this.enemy = new Enemy(this, CX, 270, j.data.enemies[0]);
            this._setupUI();
        } catch (e) {
            console.error(e);
            this.loadingText.setText("Error: " + e.message).setColor("#f55").setAlign("center");
        }
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
    }
    _buildLayer1() {
        this.turnText = this.add.text(20, 15, "TURN 1", { fontSize: "13px", color: THEME.TEXT_SECONDARY, fontStyle: "bold" }).setOrigin(0, 0);
        this.timerText = this.add.text(CX, 15, "44:59", { fontSize: "18px", color: THEME.TEXT_PRIMARY, fontStyle: "bold" }).setOrigin(0.5, 0);
        const mb = this.add.rectangle(405, 26, 50, 34, THEME.PANEL).setInteractive();
        mb.setStrokeStyle(1, THEME.BORDER);
        this.add.text(405, 26, "☰", { fontSize: "18px", color: THEME.TEXT_SECONDARY }).setOrigin(0.5);
        mb.on("pointerdown", () => {
            if (this.turn === "none" || this.turn === "attacking") return;
            this.showMainMenu();
        });
    }
    _buildEnemyHUD() {
        this.add.rectangle(CX, 96, W, 88, THEME.PANEL, THEME.PANEL_ALPHA);
        this.add.rectangle(CX, 140, W, 1, THEME.BORDER);
        const ec = this._elemColor(this.enemy.element);
        this._enemyIcon = this.add.rectangle(45, 96, 50, 50, THEME.PANEL);
        this._enemyIcon.setStrokeStyle(2, ec);
        this.add.text(45, 96, this.enemy.element.substring(0, 2).toUpperCase(), { fontSize: "9px", color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        this._hpPct = this.add.text(85, 80, "100%", { fontSize: "11px", color: "#CD5C5C", fontStyle: "bold" }).setOrigin(0, 1);
        this._hpBarBg = this.add.rectangle(85, 92, 340, 14, THEME.BG).setOrigin(0, 0.5);
        this._hpBarBg.setStrokeStyle(2, THEME.BORDER);
        this._hpFill = this.add.rectangle(85, 92, 336, 12, THEME.DAMAGE).setOrigin(0, 0.5);
        this._hpEnrage = this.add.rectangle(85, 92, 340, 14, 0, 0).setOrigin(0, 0.5).setAlpha(1);
        this._hpEnrage.setStrokeStyle(2, 0xffffff);
        // Mode Gauge (Bar tipis di bawah HP)
        this._modeFill = this.add.rectangle(85, 100, 0, 4, 0xffffff).setOrigin(0, 0.5);
        this.add.text(85, 115, "CA", { fontSize: "9px", color: "#ffaa00" }).setOrigin(0, 0.5);
        this._caSegments = [];
        for (let i = 0; i < this.enemy.caMax; i++) {
            const bg = this.add.rectangle(105 + i * 16, 115, 12, 12, THEME.BG).setOrigin(0, 0.5);
            bg.setStrokeStyle(1, THEME.BORDER);
            const f = this.add.rectangle(105 + i * 16, 115, 10, 10, THEME.GOLD).setOrigin(0, 0.5).setAlpha(0);
            this._caSegments.push(f);
        }
        this.add.text(CX, 338, this.enemy.charName + " \nLv." + this.enemy.level, { fontSize: "13px", color: "#CD5C5C", fontStyle: "bold" }).setOrigin(0.5, 0);
    }
    _refreshEnemyHUD() {
        if (!this._hpFill) return;
        const hr = Math.max(0, this.enemy.hp / this.enemy.maxHp);
        this._hpFill.setSize(336 * hr, 12);
        this._hpPct.setText(Math.ceil(hr * 100) + "%");

        // Update Mode Bar Gauge
        const mr = Math.min(1, this.enemy.modeBar / this.enemy.modeMax);
        this._modeFill.setSize(340 * mr, 4);

        if (this._caSegments) {
            const caColor = (this.enemy.modeState === "exhausted") ? 0x3498db : 0xffaa00;
            this._caSegments.forEach((f, i) => { f.setFillStyle(caColor); f.setAlpha(i < this.enemy.caBar ? 1 : 0); });
        }
        this._updateEnrageHUD(); this.enemy.updateEnrageVisual();
    }
    _updateEnrageHUD() {
        const state = this.enemy.modeState;
        const ratio = this.enemy.modeBar / this.enemy.modeMax;

        let color = 0xffffff; // Default Putih
        let alpha = 0.5;

        if (state === "enraged") {
            color = 0xe74c3c; // Merah
            alpha = 1;
        } else if (state === "exhausted") {
            color = 0x3498db; // Biru
            alpha = 1;
        } else if (state === "normal") {
            if (ratio >= 0.75) {
                color = 0xf1c40f; // Kuning (Warning)
                alpha = 1;
            } else {
                color = 0xffffff; // Putih
                alpha = 0.5;
            }
        }

        this._hpEnrage.setStrokeStyle(2, color);
        this._hpEnrage.setAlpha(alpha);
        this._modeFill.setFillStyle(color);
    }
    _applyEnemyDamage(dmg) {
        this.enemy.hp = Math.max(0, this.enemy.hp - dmg);
        const e = this.enemy;
        if (e.modeState === "normal") {
            e.modeBar += dmg;
            if (e.modeBar >= e.modeMax) {
                e.modeState = "enraged";
                e.modeBar = e.modeMax;
                this._enragedTurns = 3;
                this.showLog("ENEMY ENRAGED! (3 Turns)");
            }
        } else if (e.modeState === "enraged") {
            e.modeBar -= dmg;
            if (e.modeBar <= 0) {
                e.modeState = "exhausted";
                e.modeBar = 0;
                this._enragedTurns = 0;
                this._exhaustedTurns = 2;
                this.showLog("ENEMY BREAK! (Exhausted)");
            }
        }
        this._refreshEnemyHUD();
        this.enemy.playHitAnim();
    }
    _buildArenaButtons() {
        this._attackBtnContainer = this.add.container(0, 0);
        const ab = this.add.rectangle(380, 400, 100, 45, THEME.DAMAGE).setDepth(10);
        ab.setStrokeStyle(1, THEME.BORDER);
        const text = this.add.text(380, 400, "ATTACK ⚔", { fontSize: "16px", color: THEME.TEXT_PRIMARY, fontStyle: "bold", align: "center" }).setOrigin(0.5).setDepth(10);
        this._attackBtnContainer.add([ab, text]);
        ab.setInteractive(); ab.on("pointerdown", () => { if (this.turn === "player") this.playerAttack(); });
        this._attackBtnContainer.setVisible(this.turn === "player");
    }
    _buildPartySprites() {
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
        const p = this.activePlayer, skills = p.skills;

        // --- SECTION 1: Portrait & Stats ---
        const portBg = this.add.rectangle(0, -260, 180, 180, THEME.PANEL);
        portBg.setStrokeStyle(3, p._elemColor); // Border tebal berwarna elemen

        const nameText = this.add.text(-75, -335, p.charName, { fontSize: "13px", fontStyle: "bold", color: THEME.TEXT_PRIMARY }).setOrigin(0, 0.5);
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
        const visibleEffects = p.activeEffects.filter(e =>
            ['ATK', 'DEF', 'CRIT', 'STUN', 'POISON'].includes(e.target_stat)
        );

        if (visibleEffects.length === 0) {
            const noEffText = this.add.text(0, -105, "No active effects", { fontSize: "9px", color: THEME.TEXT_MUTED }).setOrigin(0.5);
            this._sbBtns.add(noEffText);
        } else {
            const sups = { 0: '', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
            visibleEffects.forEach((e, idx) => {
                const isBuff = (e.effect_type || '').toLowerCase() === 'buff';
                const color = isBuff ? '#f1c40f' : '#7ec8e3';

                let emoji = '❓';
                if (e.target_stat === 'ATK') emoji = '⚔️';
                else if (e.target_stat === 'DEF') emoji = '🛡️';
                else if (e.target_stat === 'CRIT') emoji = '✨';
                else if (e.target_stat === 'STUN') emoji = '💫';
                else if (e.target_stat === 'POISON') emoji = '🤢';

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
    processTurnEnd() {
        if (this.enemy.modeState === "enraged") {
            this._enragedTurns--;
            if (this._enragedTurns <= 0) {
                this.enemy.modeState = "exhausted";
                this.enemy.modeBar = 0;
                this._exhaustedTurns = 2;
                this.showLog("ENEMY ENRAGE ENDED! Entering Exhausted...");
            }
        } else if (this.enemy.modeState === "exhausted") {
            this._exhaustedTurns--;
            if (this._exhaustedTurns <= 0) {
                this.enemy.modeState = "normal";
                this.enemy.modeBar = 0;
                this._refreshEnemyHUD();
            }
        }
        // Tick down cooldowns & active effects untuk semua player hidup
        this.players.forEach(p => {
            if (p.hp <= 0) return;

            // Terapkan damage Poison jika ada sebelum durasi berkurang
            const poisonEffects = p.activeEffects.filter(e => e.target_stat === 'POISON');
            poisonEffects.forEach(eff => {
                const dmg = Math.floor(Math.abs(Number(eff.value) || 0.05) * p.maxHp);
                p.hp = Math.max(0, p.hp - dmg);
                this.showLog(`💀 Poison deals ${dmg} damage to ${p.charName}!`);
                p.refreshVisual();
            });

            for (let id in p.cooldowns) if (p.cooldowns[id] > 0) p.cooldowns[id]--;
            p.updateEffectsTurn(); // tick efek status, hapus yang expired, refresh visual
        });

        // Terapkan damage Poison pada musuh jika ada
        if (this.enemy.hp > 0) {
            const poisonEffects = this.enemy.activeEffects.filter(e => e.target_stat === 'POISON');
            let totalPoisonDmg = 0;
            poisonEffects.forEach(eff => {
                const dmg = Math.floor(Math.abs(Number(eff.value) || 0.05) * this.enemy.maxHp);
                totalPoisonDmg += dmg;
            });
            if (totalPoisonDmg > 0) {
                this._applyEnemyDamage(totalPoisonDmg);
                this.showLog(`💀 Poison deals ${totalPoisonDmg} damage to ${this.enemy.charName}!`);
            }
            this.enemy.updateEffectsTurn();
        }

        if (this.checkVictory()) return;

        if (this.players.every(p => p.hp <= 0)) {
            this.triggerDefeat(false);
            return;
        }

        this.currentTurn++;
        this.turnText.setText("TURN " + this.currentTurn);
        if (this._sidebarOpen) this._renderSidebar();
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
        const enemyBuffCount = this.enemy.activeEffects.filter(e => (e.effect_type || '').toLowerCase() === 'buff').length;
        const enemyDebuffCount = this.enemy.activeEffects.filter(e => (e.effect_type || '').toLowerCase() === 'debuff').length;

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
    async playerAttack() {
        const alive = this.players.filter(p => p.hp > 0);
        if (!alive.length) return;
        this.setTurn("attacking");
        this.closeSidebar();
        let dead = false;

        // Cek jika seluruh party yang hidup dalam keadaan Stun
        const allStunned = alive.every(p => p.activeEffects.some(e => e.target_stat === 'STUN'));
        if (allStunned) {
            this.showLog("⚡ Seluruh party dalam keadaan STUN dan tidak bisa menyerang!");
            await new Promise(resolve => this.time.delayedCall(1500, resolve));
            this.setTurn("enemy");
            this.time.delayedCall(800, () => this.enemyAttack());
            return;
        }

        const basicAttackers = alive.filter(p => !p.isSAReady);
        for (const p of basicAttackers) {
            // Cek jika karakter ini stun
            if (p.activeEffects.some(e => e.target_stat === 'STUN')) {
                this.showLog(`⚡ ${p.charName} terkena STUN dan tidak bisa menyerang!`);
                await new Promise(resolve => this.time.delayedCall(800, resolve));
                continue;
            }

            const pAtk = p.getStat('ATK');
            const rawDmg = pAtk;
            let dmg = CombatManager.calcMitigatedDmg(rawDmg, p, this.enemy, this.enemy);
            const crit = Math.random() < p.getStat('CRIT');
            if (crit) dmg = Math.floor(dmg * p.getCritDamage());
            else dmg = Math.floor(dmg);
            this._applyEnemyDamage(dmg);
            p.specialBar = Math.min(p.specialBar + 20, p.specialMax);
            p.refreshVisual();
            this.showLog(`${p.charName} attacks... ${crit ? "💥 " : ""}${dmg} dmg`);
            await new Promise(resolve => this.time.delayedCall(800, resolve));
            if (this.enemy.hp <= 0) { dead = true; break; }
        }

        if (!dead) {
            const saUsers = alive.filter(p => p.isSAReady);
            if (saUsers.length > 0) {
                const mult = [0, 1, 0.5, 1.0, 2.0];
                const lNames = ["", "", "Small", "Medium", "Big"];
                let bonus = 0;
                for (const p of saUsers) {
                    // Cek jika karakter ini stun
                    if (p.activeEffects.some(e => e.target_stat === 'STUN')) {
                        this.showLog(`⚡ ${p.charName} terkena STUN dan batal melancarkan Special Attack!`);
                        p.setSAReady(false);
                        p.refreshVisual();
                        await new Promise(resolve => this.time.delayedCall(800, resolve));
                        continue;
                    }

                    const pAtk = p.getStat('ATK');
                    const rawSA = pAtk * p.specialAttack.modifier;
                    const mitigated = CombatManager.calcMitigatedDmg(rawSA, p, this.enemy, this.enemy);
                    const add = Math.floor(Math.max(mitigated, 1) * (saUsers.length >= 2 ? mult[saUsers.length] : 1));
                    this._applyEnemyDamage(add); bonus += add;
                    // Terapkan status_effects dari SA skill
                    CombatManager.applyStatusEffects(p, p.specialAttack, p.specialAttack.status_effects, this.players, this.enemy, this.showLog.bind(this), this._refreshEnemyHUD.bind(this));
                    p.specialBar = 0; p.setSAReady(false); p.refreshVisual();
                    this.aetherGauge = Math.min(this.aetherGaugeMax, this.aetherGauge + 10);
                    this.showLog(`✦ ${p.charName} casts SA! ${add} dmg`);
                    await new Promise(resolve => this.time.delayedCall(800, resolve));
                    if (this.enemy.hp <= 0) { dead = true; break; }
                }
                if (!dead && saUsers.length >= 2) {
                    this.showLog(`⚡AETHER LINK (${lNames[saUsers.length] || "Boost"})! Bonus Dmg: ${bonus}`);
                    await new Promise(resolve => this.time.delayedCall(800, resolve));
                }
            }
        }
        this._refreshAetherUI();
        if (dead) {
            this.checkVictory();
            return;
        }
        this.setTurn("enemy");
        this.time.delayedCall(800, () => this.enemyAttack());
    }
    useSkill(idx) {
        const p = this.activePlayer, sk = p ? p.skills[idx] : null;
        if (!sk || this.turn !== "player" || !p || p.hp <= 0) return;

        // Cek jika karakter ini stun
        if (p.activeEffects.some(e => e.target_stat === 'STUN')) {
            this.showLog(`⚡ ${p.charName} terkena STUN dan tidak bisa menggunakan skill!`);
            return;
        }

        if (sk.category.toLowerCase() === "special") { p.setSAReady(!p.isSAReady); this._renderSidebar(); return; }
        if (p.cooldowns[sk.id] > 0) { this.showLog(sk.name + " on cooldown!"); return; }

        const type = (sk.type || '').toLowerCase();

        if (type === "damage") {
            // Damage: kalkulasi dengan getStat() + mitigasi DEF & elemen
            const pAtk = p.getStat('ATK');
            const rawDmg = pAtk * sk.modifier;
            const dmg = CombatManager.calcMitigatedDmg(rawDmg, p, this.enemy, this.enemy);
            this._applyEnemyDamage(dmg);
            this.showLog(p.charName + ": " + sk.name + " → " + dmg + " dmg");
            CombatManager.applyStatusEffects(p, sk, sk.status_effects, this.players, this.enemy, this.showLog.bind(this), this._refreshEnemyHUD.bind(this));

        } else if (type === "support") {
            // Support: tidak ada damage, langsung terapkan status_effects
            CombatManager.applyStatusEffects(p, sk, sk.status_effects, this.players, this.enemy, this.showLog.bind(this), this._refreshEnemyHUD.bind(this));

        } else if (type === "heal") {
            // Heal: pulihkan HP berdasarkan modifier * maxHp
            const healAmt = Math.floor(p.maxHp * (sk.modifier || 0.2));
            p.hp = Math.min(p.hp + healAmt, p.maxHp);
            this.showLog(p.charName + ": " + sk.name + " → healed " + healAmt);
            CombatManager.applyStatusEffects(p, sk, sk.status_effects, this.players, this.enemy, this.showLog.bind(this), this._refreshEnemyHUD.bind(this));

        } else if (type === "cleanse") {
            // Cleanse: hapus semua debuff dari target (all_allies biasanya)
            const targets = sk.target_type === 'All_Allies'
                ? this.players.filter(pl => pl.hp > 0)
                : [p];
            targets.forEach(tgt => {
                tgt.activeEffects = tgt.activeEffects.filter(e => e.effect_type !== 'Debuff');
                // Heal bonus jika modifier > 0
                if (sk.modifier > 0) {
                    tgt.hp = Math.min(tgt.hp + Math.floor(tgt.maxHp * sk.modifier), tgt.maxHp);
                }
                tgt.refreshVisual();
            });
            this.showLog(p.charName + ": " + sk.name + " → Debuffs cleared!");

        } else if (type === "revive") {
            // Revive: hidupkan kembali karakter KO dengan HP sebagian
            const deadPlayers = this.players.filter(pl => pl.hp <= 0);
            if (deadPlayers.length === 0) {
                this.showLog("No KO ally to revive!");
                return;
            }

            // Tampilkan modal pemilihan karakter untuk di-revive secara asinkron
            this._showCharacterSelectionModal("REVIVE TARGET", false, (targetChar) => {
                targetChar.hp = Math.floor(targetChar.maxHp * (sk.modifier || 0.2));
                targetChar.refreshVisual();
                this.showLog(p.charName + ": " + sk.name + " → " + targetChar.charName + " revived!");

                CombatManager.applyStatusEffects(p, sk, sk.status_effects, this.players, this.enemy, this.showLog.bind(this), this._refreshEnemyHUD.bind(this));
                if (sk.cooldown) p.cooldowns[sk.id] = sk.cooldown;
                p.refreshVisual();
                if (this.checkVictory()) return;
                if (this._sidebarOpen) this._renderSidebar();
            });
            return;
        }

        if (sk.cooldown) p.cooldowns[sk.id] = sk.cooldown;
        p.refreshVisual();
        if (this.checkVictory()) return;
        if (this._sidebarOpen) this._renderSidebar();
    }
    aetherBurst() {
        if (this.aetherGauge < this.aetherGaugeMax) { this.showLog("Aether Burst not ready!"); return; }
        const totalAtk = this.players.filter(p => p.hp > 0).reduce((s, p) => s + p.getStat('ATK'), 0);
        const rawDmg = totalAtk * 2.5;

        // Cari elemen dari Main Character (MC)
        const mc = this.players.find(p => p.charName.includes("MC") || p.charName.includes("Main Character")) || this.players[0];
        const mcElement = mc ? mc.element : 'None';

        const dmg = CombatManager.calcMitigatedDmg(rawDmg, { element: mcElement }, this.enemy, this.enemy);
        this._applyEnemyDamage(dmg);
        this.aetherGauge = 0;
        this._refreshAetherUI();
        this.showLog("✦✦ AETHER BURST (" + mcElement.toUpperCase() + ")! → " + dmg + " DMG!");
        this.checkVictory();
    }
    /**
     * Giliran musuh — Alur Keputusan:
     *   1. HP Trigger (Skala Prioritas Utama): Otomatis cast skill (utility=0) saat HP bos melewati threshold,
     *      mengabaikan kondisi CA bar penuh/tidak dan status exhausted.
     *   2. Charge Attack (Normal Skill): Jika CA bar penuh DAN tidak exhausted, gunakan skill biasa (utility > 0). Reset CA bar -> 0.
     *   3. Penahanan CA (Exhausted): Jika CA bar penuh tapi exhausted, dilarang CA. Tahan CA bar (jangan reset/tambah), fallback ke Basic Attack.
     *   4. Turn Biasa (Pengisian CA): Jika CA belum penuh, gunakan Basic Attack dan tambahkan CA bar +1 jika tidak exhausted.
     */
    async enemyAttack() {
        const isStunned = this.enemy.activeEffects.some(e => e.target_stat === 'STUN');
        if (isStunned) {
            this.showLog(`⚡ ${this.enemy.charName} is STUNNED and cannot move!`);
            this.setTurn('player');
            this.time.delayedCall(1500, () => this.processTurnEnd());
            return;
        }

        const modeMult = this.enemy.modeState.toLowerCase() === 'exhausted' ? 0.7
            : this.enemy.modeState.toLowerCase() === 'enraged' ? 1.5
                : 1.0;
        const isExhausted = this.enemy.modeState.toLowerCase() === 'exhausted';

        // Prepare current battle state to send to backend
        const battleState = {
            player_party: {
                characters: this.players.map(p => ({
                    id: p.id,
                    hp: p.hp,
                    maxHp: p.maxHp,
                    activeEffects: (p.activeEffects || []).map(e => ({
                        effect_name: e.effect_name || e.name,
                        effect_type: e.effect_type || e.type,
                        target_stat: e.target_stat,
                        value: e.value,
                        duration: e.duration
                    }))
                }))
            },
            boss: {
                hp: this.enemy.hp,
                maxHp: this.enemy.maxHp,
                phase: this.enemy.modeState,
                isCaReady: this.enemy.caBar >= this.enemy.caMax && !isExhausted,
                activeEffects: (this.enemy.activeEffects || []).map(e => ({
                    effect_name: e.effect_name || e.name,
                    effect_type: e.effect_type || e.type,
                    target_stat: e.target_stat,
                    value: e.value,
                    duration: e.duration
                }))
            },
            usedSkills: Array.from(this.enemy._usedOneTimeSkills || [])
        };

        const bossSkills = (this.enemy.aiBehaviors || []).map(b => ({
            id: b.id,
            phase: b.phase,
            base_utility: b.base_utility,
            score_modifiers: b.modifiers,
            skill: b.skill
        }));

        let chosenBehavior = null;

        try {
            const j = await BattleApi.getAiDecision(this.bsId, battleState, bossSkills);
            if (j.status === "success" && j.data && j.data.selected_skill) {
                const selected = j.data.selected_skill;
                chosenBehavior = this.enemy.aiBehaviors.find(b => b.id === selected.id);
            }
        } catch (e) {
            console.error("AI decision failed, triggering fallback:", e);
        }

        // --- AI FALLBACK MECHANISM ---
        if (!chosenBehavior) {
            console.warn("[AI_FALLBACK_ENGAGED] Enemy AI decision failed or returned null. Using fallback heuristic.");
            // Visual Toaster for User / QA
            const toast = this.add.text(CX, H / 2 - 100, "⚠️ [System: Network Timeout - AI Heuristic Fallback Engaged]", {
                fontSize: "10px", color: "#ff4757", backgroundColor: "#1e0b0b", padding: { x: 8, y: 4 }, fontStyle: "bold"
            }).setOrigin(0.5).setDepth(100);
            this.time.delayedCall(3000, () => toast.destroy());

            // Retrieve heuristic fallback action locally
            const isCaReady = this.enemy.caBar >= this.enemy.caMax && !isExhausted;
            chosenBehavior = CombatManager.getAiFallbackAction(this.enemy, isCaReady);
            
            // Note: Snapshot Integrity is intrinsically maintained because chosenBehavior will be executed below,
            // which internally modifies hp/caBar. The next time 'battleState' snapshot is constructed on the next turn,
            // it captures these valid fallback results directly from the entity properties.
        }

        if (chosenBehavior) {
            this.enemy.caBar = 0;
            this._refreshEnemyHUD();

            // Track One_Time_Use if selected
            if (chosenBehavior.modifiers && chosenBehavior.modifiers.One_Time_Use === true) {
                if (!this.enemy._usedOneTimeSkills) this.enemy._usedOneTimeSkills = new Set();
                this.enemy._usedOneTimeSkills.add(chosenBehavior.skill.id);
            }

            this._executeEnemySkill(chosenBehavior, modeMult);

            if (this.players.every(p => p.hp <= 0)) { this.triggerDefeat(false); return; }
            this.setTurn('player');
            this.time.delayedCall(1500, () => this.processTurnEnd());
            return;
        }

        // ── 3. Penahanan CA (jika exhausted dan CA penuh) ──────────────────────
        if (this.enemy.caBar >= this.enemy.caMax && isExhausted) {
            const handledAsync = this._executeEnemyBasicAttack(modeMult, false);

            if (!handledAsync) {
                if (this.players.every(p => p.hp <= 0)) { this.triggerDefeat(false); return; }
                this.setTurn('player');
                this.time.delayedCall(1500, () => this.processTurnEnd());
            }
            return;
        }

        // ── 4. Turn Biasa (Basic Attack & Pengisian CA) ───────────────────────
        const incrementCA = !isExhausted;
        const handledAsync = this._executeEnemyBasicAttack(modeMult, incrementCA);

        if (!handledAsync) {
            if (this.players.every(p => p.hp <= 0)) { this.triggerDefeat(false); return; }
            this.setTurn('player');
            this.time.delayedCall(1500, () => this.processTurnEnd());
        }
    }

    _executeEnemySkill(behavior, modeMult) {
        const sk = behavior.skill;
        const type = (sk.type || '').toLowerCase();
        const targetType = (sk.target_type || '').toLowerCase();
        const aliveChars = this.players.filter(p => p.hp > 0);

        if (targetType === 'all_enemies' || targetType === 'all_allies') {
            if (type === 'damage') {
                const eAtk = this.enemy.getStat('ATK') * modeMult;
                const rawDmg = eAtk * (sk.modifier || 1);
                let totalDmg = 0;
                for (const t of aliveChars) {
                    const dmg = CombatManager.calcMitigatedDmg(rawDmg, this.enemy, t, this.enemy);
                    t.hp = Math.max(0, t.hp - dmg);
                    t.refreshVisual(); this.playSpriteHitAnim(t);
                    totalDmg += dmg;
                }
                this.showLog(`⚡ ${this.enemy.charName}: ${sk.name}! → All party -${totalDmg} total`);
            } else {
                this.showLog(`⚡ ${this.enemy.charName}: ${sk.name}!`);
            }
            this._applyStatusEffects(this.enemy, sk, sk.status_effects);
        } else {
            let t;
            if (behavior.modifiers && behavior.modifiers.Target_Lowest_HP && aliveChars.length > 0) {
                t = aliveChars.reduce((lowest, p) =>
                    (p.hp / p.maxHp) < (lowest.hp / lowest.maxHp) ? p : lowest
                );
            } else {
                t = this._randAlive();
            }

            if (t) {
                if (type === 'damage') {
                    const eAtk = this.enemy.getStat('ATK') * modeMult;
                    const rawDmg = eAtk * (sk.modifier || 1);
                    const dmg = CombatManager.calcMitigatedDmg(rawDmg, this.enemy, t, this.enemy);
                    t.hp = Math.max(0, t.hp - dmg);
                    t.refreshVisual(); this.playSpriteHitAnim(t);
                    this.showLog(`⚡ ${this.enemy.charName}: ${sk.name}! → ${t.charName} -${dmg}`);
                } else {
                    this.showLog(`⚡ ${this.enemy.charName}: ${sk.name}!`);
                }
                CombatManager.applyStatusEffects(this.enemy, sk, sk.status_effects, this.players, this.enemy, this.showLog.bind(this), this._refreshEnemyHUD.bind(this));
            }
        }
        this._refreshEnemyHUD();
    }

    _executeEnemyBasicAttack(modeMult, incrementCA) {
        const t = this._randAlive();
        if (!t) return false;

        const eAtk = this.enemy.getStat('ATK') * modeMult;
        let dmg = CombatManager.calcMitigatedDmg(eAtk, this.enemy, t, this.enemy);
        const crit = Math.random() < this.enemy.getStat('CRIT');
        if (crit) dmg = Math.floor(dmg * this.enemy.getCritDamage());

        t.hp = Math.max(0, t.hp - dmg);
        t.refreshVisual(); this.playSpriteHitAnim(t);

        if (incrementCA) {
            this.enemy.caBar = Math.min(this.enemy.caBar + 1, this.enemy.caMax);
        }
        this._refreshEnemyHUD();
        this.showLog(crit
            ? `${this.enemy.charName} CRIT ${t.charName}! 💥 ${dmg}`
            : `${this.enemy.charName} → ${t.charName}: ${dmg}`);

        // Jika Enraged, ada peluang 70% untuk menyerang 2 kali
        if (this.enemy.modeState.toLowerCase() === 'enraged' && Math.random() < 0.7) {
            this.time.delayedCall(800, () => {
                const t2 = this._randAlive();
                if (!t2) {
                    if (this.players.every(p => p.hp <= 0)) { this.triggerDefeat(false); return; }
                    this.setTurn('player');
                    this.time.delayedCall(1500, () => this.processTurnEnd());
                    return;
                }
                let dmg2 = CombatManager.calcMitigatedDmg(eAtk, this.enemy, t2, this.enemy);
                const crit2 = Math.random() < this.enemy.getStat('CRIT');
                if (crit2) dmg2 = Math.floor(dmg2 * this.enemy.getCritDamage());
                t2.hp = Math.max(0, t2.hp - dmg2);
                t2.refreshVisual(); this.playSpriteHitAnim(t2);
                this.showLog(crit2
                    ? `${this.enemy.charName} CRIT ${t2.charName}! 💥 ${dmg2}`
                    : `${this.enemy.charName} → ${t2.charName}: ${dmg2}`);

                if (this.players.every(p => p.hp <= 0)) { this.triggerDefeat(false); return; }
                this.setTurn('player');
                this.time.delayedCall(1500, () => this.processTurnEnd());
            });
            return true;
        }
        return false;
    }

    _randAlive() { const l = this.players.filter(p => p.hp > 0); return l.length ? l[Math.floor(Math.random() * l.length)] : null; }
    _elemColor(el) { return { Fire: THEME.ELEM_FIRE, Wind: THEME.ELEM_WIND, Earth: THEME.ELEM_EARTH }[el] || THEME.BORDER; }

    useHealPotion() {
        if (this.healsRemaining <= 0) {
            this.showLog("No Green Potions left!");
            return;
        }

        this._showCharacterSelectionModal("HEAL TARGET", true, (targetChar) => {
            const healAmt = Math.floor(targetChar.maxHp * 0.25);
            targetChar.hp = Math.min(targetChar.hp + healAmt, targetChar.maxHp);
            targetChar.refreshVisual();

            this.healsRemaining--;
            this.potionsUsed++;
            this._refreshHealButtonUI();

            this.showLog(`Used Green Potion -> ${targetChar.charName} healed ${healAmt}!`);
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
        if (this.enemy.hp <= 0) {
            this.turn = "none";
            this.showLog("VICTORY! 🎉");
            this.time.delayedCall(1500, () => {
                this.scene.pause();
                this.scene.launch('VictoryScene', {
                    questId: this.questId,
                    playerId: this.playerId,
                    potionsUsed: this.potionsUsed,
                    bsId: this.bsId
                });
            });
            return true;
        }
        return false;
    }

    triggerDefeat(isRetreat = false) {
        this.turn = "none";
        this.showLog(isRetreat ? "RETREATED" : "DEFEAT... 💀");
        this.time.delayedCall(1500, () => {
            this.scene.pause();
            this.scene.launch('DefeatScene', {
                questId: this.questId,
                playerId: this.playerId,
                isRetreat: isRetreat,
                bsId: this.bsId
            });
        });
    }

    showMainMenu() {
        if (this._menu && this._menu.active) return;
        this._menu = new BattleMenu(this, CX, H / 2, W, H, THEME);
        this._menu.on('destroy', () => { this._menu = null; });
    }
}
