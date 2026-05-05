import Player from "../entities/player";
import Enemy from "../entities/enemy";
const W = 450, H = 800, CX = 225;
export default class BattleScene extends Phaser.Scene {
    constructor() { super("BattleScene"); }
    create() {
        this.turn = "player"; this.currentTurn = 1;
        this.players = []; this.activePlayer = null;
        this.aetherGauge = 0; this.aetherGaugeMax = 100;
        this._sidebarOpen = false; this._timerSec = 2699; this._exhaustedTurns = 0;
        this.add.rectangle(CX, H / 2, W, H, 0x1a1a2e);
        this.add.rectangle(CX, 26, W, 52, 0x0a0a17);
        this.add.rectangle(CX, 435, W, 2, 0x0f2040);
        this.add.rectangle(CX, 550, W, 2, 0x0a0a1a);
        this.loadingText = this.add.text(CX, H / 2, "Loading...", { fontSize: "20px", color: "#ccc" }).setOrigin(0.5);
        this.fetchBattleData();
    }
    async fetchBattleData() {
        try {
            const r = await fetch("http://localhost:3000/api/battle/init", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId: 1, presetSlot: 1, questId: 1 }) });
            if (!r.ok) throw new Error("HTTP " + r.status);
            const j = await r.json();
            if (j.status !== "success") throw new Error(j.message || "API error");
            this.loadingText.destroy();
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
        this.turnText = this.add.text(20, 15, "TURN 1", { fontSize: "13px", color: "#aaa", fontStyle: "bold" }).setOrigin(0, 0);
        this.timerText = this.add.text(CX, 15, "44:59", { fontSize: "18px", color: "#fff", fontStyle: "bold" }).setOrigin(0.5, 0);
        const mb = this.add.rectangle(420, 26, 50, 34, 0x1e3a5f).setInteractive();
        mb.setStrokeStyle(1, 0x4a90d9);
        this.add.text(420, 26, "☰", { fontSize: "18px", color: "#7ec8e3" }).setOrigin(0.5);
    }
    _buildEnemyHUD() {
        this.add.rectangle(CX, 96, W, 88, 0x0d1420);
        this.add.rectangle(CX, 140, W, 1, 0x1e3a5f);
        const ec = this._elemColor(this.enemy.element);
        this._enemyIcon = this.add.rectangle(45, 96, 50, 50, 0x2c1810);
        this._enemyIcon.setStrokeStyle(2, ec);
        this.add.text(45, 96, this.enemy.element.substring(0, 2).toUpperCase(), { fontSize: "9px", color: "#fff" }).setOrigin(0.5);
        this._hpPct = this.add.text(85, 80, "100%", { fontSize: "11px", color: "#ff8a80", fontStyle: "bold" }).setOrigin(0, 1);
        this._hpBarBg = this.add.rectangle(85, 92, 340, 14, 0x2d2d2d).setOrigin(0, 0.5);
        this._hpBarBg.setStrokeStyle(2, 0x555555);
        this._hpFill = this.add.rectangle(85, 92, 336, 12, 0xe74c3c).setOrigin(0, 0.5);
        this._hpEnrage = this.add.rectangle(85, 92, 340, 14, 0, 0).setOrigin(0, 0.5).setAlpha(0);
        this._hpEnrage.setStrokeStyle(2, 0xffffff);
        this.add.text(85, 115, "CA", { fontSize: "9px", color: "#ffaa00" }).setOrigin(0, 0.5);
        this._caSegments = [];
        for (let i = 0; i < this.enemy.caMax; i++) {
            const bg = this.add.rectangle(105 + i * 16, 115, 12, 12, 0x1a1a1a).setOrigin(0, 0.5);
            bg.setStrokeStyle(1, 0x555555);
            const f = this.add.rectangle(105 + i * 16, 115, 10, 10, 0xffaa00).setOrigin(0, 0.5).setAlpha(0);
            this._caSegments.push(f);
        }
        this.add.text(CX, 338, this.enemy.charName + " \nLv." + this.enemy.level, { fontSize: "13px", color: "#ff8a80", fontStyle: "bold" }).setOrigin(0.5, 0);
    }
    _refreshEnemyHUD() {
        if (!this._hpFill) return;
        const hr = Math.max(0, this.enemy.hp / this.enemy.maxHp);
        this._hpFill.setSize(336 * hr, 12);
        this._hpPct.setText(Math.ceil(hr * 100) + "%");
        if (this._caSegments) this._caSegments.forEach((f, i) => f.setAlpha(i < this.enemy.caBar ? 1 : 0));
        this._updateEnrageHUD(); this.enemy.updateEnrageVisual();
    }
    _updateEnrageHUD() {
        const cols = { enraged: 0xe74c3c, exhausted: 0x3498db };
        const c = cols[this.enemy.modeState];
        if (c) { this._hpEnrage.setStrokeStyle(2, c); this._hpEnrage.setAlpha(0.9); }
        else this._hpEnrage.setAlpha(0);
    }
    _applyEnemyDamage(dmg) {
        this.enemy.hp = Math.max(0, this.enemy.hp - dmg);
        const e = this.enemy;
        if (e.modeState === "normal") {
            e.modeBar += dmg;
            if (e.modeBar >= e.modeMax) { e.modeState = "enraged"; e.modeBar = e.modeMax; this.showLog("ENEMY ENRAGED!"); }
        } else if (e.modeState === "enraged") {
            e.modeBar -= dmg;
            if (e.modeBar <= 0) { e.modeState = "exhausted"; e.modeBar = 0; this._exhaustedTurns = 2; this.showLog("ENEMY BREAK/EXHAUSTED!"); }
        }
        this._refreshEnemyHUD();
        this.enemy.playHitAnim();
    }
    _buildArenaButtons() {
        const ab = this.add.rectangle(380, 400, 100, 45, 0xc0392b).setDepth(10);
        ab.setStrokeStyle(3, 0xff8a80);
        this.add.rectangle(380, 400, 96, 41, 0xe74c3c).setDepth(10);
        this.add.text(380, 400, "ATTACK ⚔", { fontSize: "16px", color: "#fff", fontStyle: "bold", align: "center" }).setOrigin(0.5).setDepth(10);
        ab.setInteractive(); ab.on("pointerdown", () => { if (this.turn === "player") this.playerAttack(); });
    }
    _buildPartySprites() {
        const cW = 85, gap = 15, total = this.players.length, totalW = total * cW + (total - 1) * gap, sx = (W - totalW) / 2 + cW / 2;
        this.players.forEach((p, i) => {
            const px = sx + i * (cW + gap);
            const b = this.add.rectangle(0, 0, 58, 58, 0x1e3a5f, 0.6);
            b.setStrokeStyle(1, 0x4a90d9);
            const t = this.add.text(0, 0, "?", { fontSize: "20px", color: "#4a90d9" }).setOrigin(0.5);
            p.spriteObj = this.add.container(px, 500, [b, t]);
        });
    }
    _playSpriteHitAnim(p) {
        if (!p || !p.spriteObj) return;
        const ox = p.spriteObj.x;
        this.tweens.add({
            targets: p.spriteObj, x: ox + 8,
            duration: 50, yoyo: true, repeat: 2,
            ease: 'Power1',
            onComplete: () => { p.spriteObj.x = ox; }
        });
    }
    _buildLayer4() {
        this._aethBarBg = this.add.rectangle(CX, 693, W - 40, 10, 0x0d1420);
        this._aethBarBg.setStrokeStyle(1, 0x7b68ee);
        this._aethFill = this.add.rectangle(20, 693, 0, 8, 0x7b68ee).setOrigin(0, 0.5);
        this._aethPct = this.add.text(W - 20, 683, "0%", { fontSize: "8px", color: "#9999cc" }).setOrigin(1, 1);
        this.add.text(20, 683, "AETHER", { fontSize: "8px", color: "#9999cc" }).setOrigin(0, 1);
        const hb = this.add.rectangle(130, 735, 220, 44, 0x0d2a1a);
        hb.setStrokeStyle(2, 0x2ecc71);
        this.add.text(130, 735, "⊕  HEAL  (Fase 3)", { fontSize: "12px", color: "#a8e6cf" }).setOrigin(0.5);
        this._abBg = this.add.rectangle(350, 735, 160, 44, 0x0d0d3a);
        this._abBg.setStrokeStyle(2, 0x5555bb);
        this._abText = this.add.text(350, 735, "✦ AETHER BURST", { fontSize: "11px", color: "#7777cc", align: "center" }).setOrigin(0.5);
        this._abBg.setInteractive(); this._abBg.on("pointerdown", () => { if (this.turn === "player") this.aetherBurst(); });
        this._refreshAetherUI();
    }
    _refreshAetherUI() {
        if (!this._aethFill) return;
        const r = Math.min(1, this.aetherGauge / this.aetherGaugeMax);
        this._aethFill.setSize((W - 40) * r, 8);
        this._aethPct.setText(Math.floor(r * 100) + "%");
        const rdy = this.aetherGauge >= this.aetherGaugeMax;
        this._abBg.setStrokeStyle(2, rdy ? 0xaa88ff : 0x5555bb);
        this._abText.setColor(rdy ? "#ccaaff" : "#7777cc");
    }
    _buildSidebar() {
        const SBW = 210, SHX = W + SBW / 2;
        this._sbShownX = W - SBW / 2; this._sbHiddenX = SHX;
        this._overlay = this.add.rectangle(CX, H / 2, W, H, 0x000000).setAlpha(0).setInteractive().setDepth(19);
        this._overlay.on("pointerdown", () => this.closeSidebar());
        this._sbPanel = this.add.container(SHX, H / 2).setDepth(20);
        const bg = this.add.rectangle(0, 0, SBW, H, 0x0d1b2a); bg.setStrokeStyle(1, 0x4a90d9);
        this._sbPanel.add([bg, this.add.text(0, -(H / 2) + 16, "SKILLS", { fontSize: "13px", color: "#7ec8e3", fontStyle: "bold" }).setOrigin(0.5, 0)]);
        this._sbBtns = this.add.container(SHX, H / 2).setDepth(20);
    }
    openSidebar() {
        this._sidebarOpen = true; this._renderSidebar();
        this.tweens.add({ targets: this._overlay, alpha: 0.5, duration: 200 });
        this.tweens.add({ targets: [this._sbPanel, this._sbBtns], x: this._sbShownX, duration: 220, ease: "Power2" });
    }
    closeSidebar() {
        this._sidebarOpen = false;
        this.tweens.add({ targets: this._overlay, alpha: 0, duration: 180 });
        this.tweens.add({ targets: [this._sbPanel, this._sbBtns], x: this._sbHiddenX, duration: 200, ease: "Power2" });
        this._setActive(null);
    }
    _renderSidebar() {
        this._sbBtns.removeAll(true);
        if (!this.activePlayer) return;
        const p = this.activePlayer, skills = p.skills;
        const sy = -(H / 2) + 48, bH = 60, bG = 5;
        const tC = { damage: "#ff8a80", buff: "#a5d6a7", heal: "#80deea", special: "#ce93d8" };
        skills.forEach((sk, i) => {
            const isSA = sk.type === "special";
            const cd = isSA ? 0 : (p.cooldowns[sk.id] || 0);
            const saRdy = isSA && p.specialBar >= p.specialMax;
            const canUse = isSA ? saRdy : (cd === 0);
            const by = sy + i * (bH + bG);
            const bgR = this.add.rectangle(0, by, 192, bH, canUse ? (isSA ? 0x1a1a4e : 0x1e3a5f) : 0x111111);
            bgR.setStrokeStyle(1, canUse ? (isSA ? 0x7b68ee : 0x4a90d9) : 0x333333);
            const nm = this.add.text(-88, by - 20, sk.name, { fontSize: "11px", color: canUse ? "#e0e0ff" : "#555", fontStyle: "bold" }).setOrigin(0, 0.5);
            const tp = this.add.text(-88, by - 6, isSA ? "[SA]" : "[" + sk.type.toUpperCase() + "]", { fontSize: "9px", color: tC[sk.type] || "#aaa" }).setOrigin(0, 0.5);
            const items = [bgR, nm, tp];
            if (isSA) {
                const bW = 140, bBg = this.add.rectangle(-88 + bW / 2, by + 10, bW, 6, 0x222222).setOrigin(0.5);
                const bF = this.add.rectangle(-88, by + 10, bW * (p.specialBar / p.specialMax), 6, 0xf39c12).setOrigin(0, 0.5);
                const bL = this.add.text(58, by + 10, p.specialBar + "/" + p.specialMax, { fontSize: "8px", color: "#f1c40f" }).setOrigin(0, 0.5);
                items.push(bBg, bF, bL);
                if (p.isSAReady) { const rd = this.add.text(0, by + 22, "✦ STANCE ACTIVE", { fontSize: "9px", color: "#f39c12" }).setOrigin(0.5); items.push(rd); }
            } else {
                const cdT = this.add.text(88, by, cd > 0 ? "CD:" + cd : "CD:" + sk.cooldown + "T", { fontSize: "9px", color: cd > 0 ? "#f55" : "#777" }).setOrigin(1, 0.5);
                items.push(cdT);
            }
            this._sbBtns.add(items);
            if (canUse) {
                bgR.setInteractive();
                bgR.on("pointerdown", () => {
                    if (isSA) { p.setSAReady(!p.isSAReady); if (p.isSAReady) this.showLog("✦ " + p.charName + ": SA STANCE!"); else this.showLog(p.charName + ": SA cancelled"); this._renderSidebar(); }
                    else { this.useSkill(i); }
                });
            }
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
                if (this._timerSec <= 0) { this._timerSec = 0; this.timerText.setText("00:00").setColor("#f00"); this.turn = "none"; this.showLog("TIME UP! ⏰ DEFEAT"); return; }
                const m = Math.floor(this._timerSec / 60), s = this._timerSec % 60;
                this.timerText.setText((m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s);
                this.timerText.setColor(this._timerSec < 60 ? "#ff4444" : "#ffffff");
            }
        });
    }
    processTurnEnd() {
        if (this.enemy.modeState === "exhausted") {
            this._exhaustedTurns--;
            if (this._exhaustedTurns <= 0) { this.enemy.modeState = "normal"; this.enemy.modeBar = 0; this._refreshEnemyHUD(); }
        }
        this.players.forEach(p => {
            if (p.hp <= 0) return;
            for (let id in p.cooldowns) if (p.cooldowns[id] > 0) p.cooldowns[id]--;
            p.activeBuffs = p.activeBuffs.filter(b => { b.duration--; if (b.duration <= 0) { p[b.stat] -= b.value; return false; } return true; });
            p.refreshVisual();
        });
        this.currentTurn++;
        this.turnText.setText("TURN " + this.currentTurn);
        if (this._sidebarOpen) this._renderSidebar();
    }
    async playerAttack() {
        const alive = this.players.filter(p => p.hp > 0);
        if (!alive.length) return;
        this.turn = "attacking";
        this.closeSidebar();
        let dead = false;

        const basicAttackers = alive.filter(p => !p.isSAReady);
        for (const p of basicAttackers) {
            const eDef = this.enemy.def * (this.enemy.modeState === "exhausted" ? 0.7 : 1);
            const pAtk = p.atk;
            let dmg = Math.max(pAtk - eDef, 1);
            const crit = Math.random() < p.crit;
            if (crit) dmg *= p.critDamage;
            dmg = Math.floor(dmg);
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
                    const eDef = this.enemy.def * (this.enemy.modeState === "exhausted" ? 0.7 : 1);
                    const pAtk = p.atk;
                    const raw = (pAtk * p.specialAttack.power) - eDef;
                    const add = Math.floor(Math.max(raw, 1) * (saUsers.length >= 2 ? mult[saUsers.length] : 1));
                    this._applyEnemyDamage(add); bonus += add;
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
        if (dead) { this.turn = "none"; this.showLog("VICTORY! 🎉"); return; }
        this.turn = "enemy";
        this.time.delayedCall(800, () => this.enemyAttack());
    }
    useSkill(idx) {
        const p = this.activePlayer, sk = p ? p.skills[idx] : null;
        if (!sk || this.turn !== "player" || !p || p.hp <= 0) return;
        if (sk.type === "special") { p.setSAReady(!p.isSAReady); this._renderSidebar(); return; }
        if (p.cooldowns[sk.id] > 0) { this.showLog(sk.name + " on cooldown!"); return; }
        if (sk.type === "damage") {
            const eDef = this.enemy.def * (this.enemy.modeState === "exhausted" ? 0.7 : 1);
            const pAtk = p.atk;
            const dmg = Math.floor(Math.max((pAtk * sk.power) - eDef, 1));
            this._applyEnemyDamage(dmg);
            this.showLog(p.charName + ": " + sk.name + " → " + dmg + " dmg");
        } else if (sk.type === "buff") {
            p.activeBuffs.push({ stat: sk.stat, value: sk.value, duration: sk.duration });
            p[sk.stat] += sk.value;
            this.showLog(p.charName + ": " + sk.name + " → " + sk.stat + " +" + sk.value);
        } else if (sk.type === "heal") {
            const h = Math.min(sk.value, p.maxHp - p.hp);
            p.hp = Math.min(p.hp + sk.value, p.maxHp);
            this.showLog(p.charName + ": " + sk.name + " → healed " + h);
        }
        if (sk.cooldown) p.cooldowns[sk.id] = sk.cooldown;
        p.refreshVisual();
        if (this.enemy.hp <= 0) { this.turn = "none"; this.showLog("VICTORY! 🎉"); }
        if (this._sidebarOpen) this._renderSidebar();
    }
    aetherBurst() {
        if (this.aetherGauge < this.aetherGaugeMax) { this.showLog("Aether Burst not ready!"); return; }
        const totalAtk = this.players.filter(p => p.hp > 0).reduce((s, p) => s + p.atk, 0);
        const dmg = Math.floor(totalAtk * 2.5);
        this._applyEnemyDamage(dmg);
        this.aetherGauge = 0;
        this._refreshAetherUI();
        this.showLog("✦✦ AETHER BURST! → " + dmg + " DMG!");
        if (this.enemy.hp <= 0) { this.turn = "none"; this.showLog("VICTORY! 🎉"); }
    }
    enemyAttack(attackCount = 1) {
        if (this.enemy.caBar >= this.enemy.caMax) { this.enemyChargeAttack(); return; }
        const t = this._randAlive(); if (!t) return;
        const eAtk = this.enemy.atk * (this.enemy.modeState === "exhausted" ? 0.7 : (this.enemy.modeState === "enraged" ? 1.5 : 1));
        let dmg = Math.max(eAtk - t.def, 1);
        const crit = Math.random() < this.enemy.crit;
        if (crit) dmg *= this.enemy.critDamage;
        dmg = Math.floor(dmg);
        t.hp = Math.max(0, t.hp - dmg); t.refreshVisual(); this._playSpriteHitAnim(t);
        if (this.enemy.modeState !== "exhausted") this.enemy.caBar = Math.min(this.enemy.caBar + 1, this.enemy.caMax);
        this._refreshEnemyHUD();
        this.showLog(crit ? this.enemy.charName + " CRIT " + t.charName + "! 💥 " + dmg : this.enemy.charName + " → " + t.charName + ": " + dmg);
        if (this.players.every(p => p.hp <= 0)) { this.turn = "none"; this.showLog("DEFEAT... 💀"); return; }
        if (this.enemy.modeState === "enraged" && attackCount === 1) {
            this.time.delayedCall(800, () => this.enemyAttack(2));
        } else {
            this.turn = "player"; this.time.delayedCall(1500, () => this.processTurnEnd());
        }
    }
    enemyChargeAttack() {
        const ca = this.enemy.skills[0], t = this._randAlive();
        if (!t || !ca) { this.turn = "player"; return; }
        const eAtk = this.enemy.atk * (this.enemy.modeState === "exhausted" ? 0.7 : (this.enemy.modeState === "enraged" ? 1.5 : 1));
        const dmg = Math.floor(Math.max((eAtk * ca.power) - t.def, 1));
        t.hp = Math.max(0, t.hp - dmg); t.refreshVisual(); this._playSpriteHitAnim(t);
        this.enemy.caBar = 0;
        this._refreshEnemyHUD();
        this.showLog("⚡ " + this.enemy.charName + ": " + ca.name + "! → " + t.charName + " -" + dmg);
        if (this.players.every(p => p.hp <= 0)) { this.turn = "none"; this.showLog("DEFEAT... 💀"); return; }
        this.turn = "player"; this.time.delayedCall(1500, () => this.processTurnEnd());
    }
    _randAlive() { const l = this.players.filter(p => p.hp > 0); return l.length ? l[Math.floor(Math.random() * l.length)] : null; }
    _elemColor(el) { return { Fire: 0xe74c3c, Wind: 0x2ecc71, Earth: 0xe67e22, Water: 0x3498db, Light: 0xf1c40f, Dark: 0x9b59b6 }[el] || 0xff5555; }
}
