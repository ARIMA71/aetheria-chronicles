import Player from "../entities/player";
import Enemy from "../entities/enemy";
import { THEME } from "../main.js";
import { checkSession, saveCurrentScene, getPlayerUsername } from "../utils/auth.js";
import BattleApi from "../services/BattleApi.js";
import BattleMenu from "../ui/BattleMenu.js";
import { playGlobalBGM, stopGlobalBGM } from "../utils/audioManager.js";
import vfxManifest from "../data/vfxManifest.json";
// Element icons are loaded as PNGs in preload

const W = 480, H = 880, CX = 240;
export default class BattleScene extends Phaser.Scene {
    constructor() { super("BattleScene"); }
    init(data) {
        // Accept data from QuestScene if available
        this._sceneData = data || {};
        saveCurrentScene(this.scene.key, this._sceneData);
    }
    preload() {
        this.load.image('element_fire', 'assets/icons/elements/fire.png');
        this.load.image('element_wind', 'assets/icons/elements/wind.png');
        this.load.image('element_earth', 'assets/icons/elements/rock.png');

        // --- VFX Spritesheet Preload (from vfxManifest.json) ---
        // Exact VFX (single-file)
        for (const [key, data] of Object.entries(vfxManifest.exact)) {
            this.load.spritesheet(key, data.path, {
                frameWidth: data.frameWidth,
                frameHeight: data.frameHeight
            });
        }
        // Rolling VFX (element skill folders)
        for (const [category, items] of Object.entries(vfxManifest.rolling)) {
            items.forEach(item => {
                this.load.spritesheet(item.key, item.path, {
                    frameWidth: item.frameWidth,
                    frameHeight: item.frameHeight
                });
            });
        }

        // Note: Character and Monster Sprites are handled dynamically or use placeholders
    }
    setTurn(newTurn) {

        this.turn = newTurn;
        if (this._attackBtnContainer) {
            this._attackBtnContainer.setVisible(newTurn === "player");
        }
        if (this._globalAutoBtnContainer) {
            this._globalAutoBtnContainer.setVisible(newTurn === "player");
        }
    }
    create() {
        if (!checkSession(this)) return;

        // bgmKey will be read and played in _playStartAnimation
        this.bgmKey = this._sceneData.bgmKey || 'bgm_normalbattle';

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
        this.playerGender = playerData.gender || 'Male';

        this.add.rectangle(CX, H / 2, W, H, THEME.BG);
        this.add.rectangle(CX, 26, W, 52, THEME.PANEL, THEME.PANEL_ALPHA);
        
        // Immediately add the black overlay so there is no blue flash from the background
        // Using 0.95 transparency so the player can faintly see the arena, as requested
        this._blackOverlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.95).setDepth(190);

        // === RESUME PATH: data resume dari MainMenu Pop-up ===
        if (this._sceneData.resumeData) {
            this._resumeBattle(this._sceneData);
        }
        // === NORMAL PATH: initData dari QuestScene (battle baru) ===
        else if (this._sceneData.initData && this._sceneData.initData.status === 'success') {
            this._processBattleData(this._sceneData.initData);
        } else {
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
        
        // Initialize wave counter
        this.totalWaves = j.data.waves ? j.data.waves.length : 1;
        this.currentWave = 1;
        this.currentTurn = 1;
        this.aetherGauge = 0;

        let assetsToLoad = 0;
        const chars = j.data.player_party.characters.slice(0, 4);

        chars.forEach(d => {
            const keyId = d.mc_id || d.id || d.slot;
            if (d.sprite_path) { this.load.image(`sprite_${keyId}`, d.sprite_path); assetsToLoad++; }
            if (d.portrait_path) { this.load.image(`portrait_${keyId}`, d.portrait_path); assetsToLoad++; }
            if (d.full_portrait_path) { this.load.image(`portrait_full_${keyId}`, d.full_portrait_path); assetsToLoad++; }
        });
        j.data.enemies.forEach(e => {
            if (e.sprite_path) { this.load.image(`mons_${e.id || e.monster_id}`, e.sprite_path); assetsToLoad++; }
        });

        if (!this._blackOverlay) {
            this._blackOverlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.95).setDepth(190);
        }

        if (assetsToLoad > 0) {
            this.load.once('complete', () => {
                this._renderProcessBattleData(j, chars);
            });
            this.load.start();
        } else {
            this._renderProcessBattleData(j, chars);
        }
    }

    _renderProcessBattleData(j, chars) {
        // Initialize VFX Animations from manifest
        this._initVfxAnims();

        // Draw battlefield floor line
        this.add.rectangle(CX, 535, W, 1, THEME.BORDER);

        const cW = 85, gap = 15, total = chars.length, totalW = total * cW + (total - 1) * gap, sx = (W - totalW) / 2 + cW / 2;
        chars.forEach((d, i) => {
            const px = sx + i * (cW + gap);
            const p = new Player(this, px, 625, d);
            p._baseX = px;
            p.setInteractive(new Phaser.Geom.Rectangle(-42.5, -67.5, 85, 135), Phaser.Geom.Rectangle.Contains);
            p.on("pointerdown", () => { if (this.turn !== "player") return; this._tapPortrait(p); });
            this.players.push(p);

            // Render Player Sprite on Battlefield (Right Side - Straight Vertical Line with Generous Y Space)
            const keyId = d.mc_id || d.id || d.slot;
            let texKey = `sprite_${keyId}`;
            const spriteX = 390;
            const spriteY = 160 + (i * 85);
            if (d.sprite_path && this.textures.exists(texKey)) {
                p.battleSprite = this.add.sprite(spriteX, spriteY, texKey).setScale(1.5);
                p.battleSprite.setDepth(i + 5);
                p._spriteBaseX = spriteX;
                p._spriteBaseY = spriteY;
                // Idle Breathing Tween Animation
                this.tweens.add({
                    targets: p.battleSprite,
                    scaleY: 1.54,
                    duration: 1200,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            } else {
                console.warn(`Sprite missing for Player ${d.name}. Using placeholder.`);
                // Placeholder
                const b = this.add.rectangle(0, 0, 58, 58, THEME.PANEL, 0.7);
                b.setStrokeStyle(1, THEME.BORDER);
                const t = this.add.text(0, 0, "?", { fontSize: "20px", color: THEME.TEXT_SECONDARY }).setOrigin(0.5);
                p.spriteObj = this.add.container(spriteX, spriteY, [b, t]);
            }
        });
        this.activePlayer = null;
        this.enemies = [];
        const startX = 130;
        const totalE = j.data.enemies.length;
        const startY = 287.5 - ((totalE - 1) * 40);
        j.data.enemies.forEach((eData, i) => {
            const ex = startX - (i * 35);
            const ey = startY + (i * 80);
            const enemy = new Enemy(this, ex, ey, eData);
            enemy.index = i;
            enemy.setDepth(5 + i);
            this.enemies.push(enemy);
        });
        this.selectedTargetIndex = -1;
        this._setupUI();
    }

    playSFX(key, config = { volume: 0.8 }) {
        const isSfxOn = localStorage.getItem('sfx_on') !== 'false';
        if (!isSfxOn) return;
        if (this.sound.get(key) || this.cache.audio.exists(key)) {
            this.sound.play(key, config);
        }
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
        
        this.totalWaves = state.waves ? state.waves.length : 1;
        if (state.current_wave_index !== undefined) {
             this.currentWave = state.current_wave_index + 1;
        } else if (state.wave !== undefined) {
             this.currentWave = state.wave;
        } else {
             this.currentWave = 1;
        }

        let assetsToLoad = 0;
        const chars = state.player_party.characters.slice(0, 4);

        chars.forEach(d => {
            const keyId = d.mc_id || d.id || d.slot;
            if (d.sprite_path) { this.load.image(`sprite_${keyId}`, d.sprite_path); assetsToLoad++; }
            if (d.portrait_path) { this.load.image(`portrait_${keyId}`, d.portrait_path); assetsToLoad++; }
            if (d.full_portrait_path) { this.load.image(`portrait_full_${keyId}`, d.full_portrait_path); assetsToLoad++; }
        });
        state.enemies.forEach(e => {
            if (e.sprite_path) { this.load.image(`mons_${e.id || e.monster_id}`, e.sprite_path); assetsToLoad++; }
        });

        if (!this._blackOverlay) {
            this._blackOverlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.95).setDepth(190);
        }

        if (assetsToLoad > 0) {
            this.load.once('complete', () => {
                this._renderResumeBattle(state, chars);
            });
            this.load.start();
        } else {
            this._renderResumeBattle(state, chars);
        }
    }

    _renderResumeBattle(state, chars) {
        // Draw battlefield floor line
        this.add.rectangle(CX, 535, W, 1, THEME.BORDER);

        const cW = 85, gap = 15, total = chars.length, totalW = total * cW + (total - 1) * gap, sx = (W - totalW) / 2 + cW / 2;
        chars.forEach((d, i) => {
            const px = sx + i * (cW + gap);
            const p = new Player(this, px, 625, d);
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

            p.setInteractive(new Phaser.Geom.Rectangle(-42.5, -67.5, 85, 135), Phaser.Geom.Rectangle.Contains);
            p.on("pointerdown", () => { if (this.turn !== "player") return; this._tapPortrait(p); });
            this.players.push(p);

            // Render Player Sprite on Battlefield (Right Side - Straight Vertical Line with Generous Y Space)
            const keyId = d.mc_id || d.id || d.slot;
            let texKey = `sprite_${keyId}`;
            const spriteX = 390;
            const spriteY = 160 + (i * 85);
            if (d.sprite_path && this.textures.exists(texKey)) {
                p.battleSprite = this.add.sprite(spriteX, spriteY, texKey).setScale(1.5);
                p.battleSprite.setDepth(i + 5);
                p._spriteBaseX = spriteX;
                p._spriteBaseY = spriteY;
                // Idle Breathing Tween Animation
                this.tweens.add({
                    targets: p.battleSprite,
                    scaleY: 1.54,
                    duration: 1200,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            } else {
                console.warn(`Sprite missing for Player ${d.name}. Using placeholder.`);
                // Placeholder
                const b = this.add.rectangle(0, 0, 58, 58, THEME.PANEL, 0.7);
                b.setStrokeStyle(1, THEME.BORDER);
                const t = this.add.text(0, 0, "?", { fontSize: "20px", color: THEME.TEXT_SECONDARY }).setOrigin(0.5);
                p.spriteObj = this.add.container(spriteX, spriteY, [b, t]);
            }

            // Fix: Sinkronisasi visual agar tidak terlihat "sehat" padahal sebenarnya terluka
            p.refreshVisual();
        });
        this.activePlayer = null;

        // Build enemy entity with resume state
        this.enemies = [];
        const startX = 130;
        const totalE = state.enemies.length;
        const startY = 287.5 - ((totalE - 1) * 40);
        state.enemies.forEach((eData, i) => {
            const ex = startX - (i * 35);
            const ey = startY + (i * 80);
            const enemy = new Enemy(this, ex, ey, eData);
            enemy.index = i;
            enemy.setDepth(5 + i);

            // Visuals handled internally by Enemy container
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
    }
    _tapPortrait(p) {
        if (p.activeEffects && p.activeEffects.some(e => (e.target_stat || '').toUpperCase() === 'STUN')) {
            this.showLog(`💫 ${p.charName} sedang STUN! Aksi dinonaktifkan.`);
            this.playStunVibrateAnim(p);
        }
        if (this.activePlayer === p && this._actionWindowOpen) { this.closeActionWindow(); return; }
        if (!this._actionWindowOpen) this.openActionWindow(p); else this._renderActionWindow();
        this._setActive(p);
    }
    _setupUI() {
        this._buildLayer1(); this._buildEnemyHUD(true); this._buildArenaButtons();
        this._buildLayer4(); this._buildActionWindow(); this._buildBattleLog();
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
        this.turnText.setText("TURN " + this.currentTurn);
        if (this.waveText && this.totalWaves > 1) {
            this.waveText.setText(`WAVE ${this.currentWave}/${this.totalWaves}`);
        }
    }
    _buildLayer1() {
        this.turnText = this.add.text(20, 26, "TURN 1", { fontSize: "13px", color: THEME.TEXT_SECONDARY, fontStyle: "bold" }).setOrigin(0, 0.5);
        
        const timeX = this.totalWaves > 1 ? 300 : CX;
        
        if (this.totalWaves > 1) {
            this.waveText = this.add.text(160, 26, `WAVE ${this.currentWave}/${this.totalWaves}`, { fontSize: "13px", color: THEME.TEXT_SECONDARY, fontStyle: "bold", align: "center" }).setOrigin(0.5, 0.5);
        }
        
        this.timerText = this.add.text(timeX, 26, "44:59", { fontSize: "18px", color: THEME.TEXT_PRIMARY, fontStyle: "bold" }).setOrigin(0.5, 0.5);

        const mb = this.add.rectangle(435, 26, 50, 34, THEME.PANEL).setInteractive();
        mb.setStrokeStyle(1, THEME.BORDER);
        this.add.text(435, 26, "☰", { fontSize: "18px", color: THEME.TEXT_SECONDARY }).setOrigin(0.5);
        mb.on("pointerdown", () => {
            if (this.turn === "none" || this.turn === "attacking") return;
            this.showMainMenu();
        });
    }
    _buildEnemyHUD(isHidden = false) {
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
            const container = this.add.container(0, 0);
            const baseY = 88 + (index * 45);
            const ec = this._elemColor(enemy.element);

            const icon = this.add.rectangle(58, baseY + 10, 40, 40, THEME.PANEL).setStrokeStyle(2, ec);
            const elemText = this.add.text(58, baseY + 10, enemy.element.substring(0, 2).toUpperCase(), { fontSize: "14px", fontStyle: "bold", color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
            const hpPct = this.add.text(83, baseY - 2, "100%", { fontSize: "10px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0, 1);

            const hpBarBg = this.add.rectangle(83, baseY + 4, 360, 12, THEME.BG).setOrigin(0, 0.5).setStrokeStyle(2, THEME.BORDER);
            const hpFill = this.add.rectangle(83, baseY + 4, 356, 10, THEME.DAMAGE).setOrigin(0, 0.5);
            const hpEnrage = this.add.rectangle(83, baseY + 4, 360, 12, 0, 0).setOrigin(0, 0.5).setAlpha(0);
            
            const effectIndicators = this.add.container(123, baseY - 12);
            
            const hitArea = this.add.rectangle(83, baseY + 4, 360, 24, 0x000000, 0).setOrigin(0, 0.5);
            hitArea.setInteractive({ useHandCursor: true });
            hitArea.on('pointerdown', () => this._showStatusModal(enemy));


            const modeBarBg = this.add.rectangle(83, baseY + 14, 360, 4, THEME.BG).setOrigin(0, 0.5).setStrokeStyle(1, THEME.BORDER);
            const modeFill = this.add.rectangle(83, baseY + 14, 0, 4, 0xffffff).setOrigin(0, 0.5);

            if (!enemy.isBoss) {
                hpEnrage.setVisible(false);
                modeBarBg.setVisible(false);
                modeFill.setVisible(false);
            }

            const caSegmentsBg = [];
            const caSegments = [];
            for (let i = 0; i < enemy.caMax; i++) {
                const bg = this.add.rectangle(83 + i * 14, baseY + 26, 10, 10, THEME.BG).setOrigin(0, 0.5).setStrokeStyle(1, THEME.BORDER);
                const f = this.add.rectangle(83 + i * 14, baseY + 26, 8, 8, THEME.GOLD).setOrigin(0, 0.5).setAlpha(0);
                caSegmentsBg.push(bg);
                caSegments.push(f);
            }

            const nameY = enemy.y + (enemy.battleSprite ? (enemy.battleSprite.displayHeight / 2) + 10 : 65);
            const nameText = this.add.text(enemy.x, nameY, enemy.charName + " \nLv." + enemy.level, { fontSize: "11px", color: "#ffffff", fontStyle: "bold", align: "center" }).setOrigin(0.5, 0);

            container.add([icon, elemText, hpPct, hpBarBg, hpFill, hpEnrage, effectIndicators, hitArea, modeBarBg, modeFill, nameText]);
            caSegmentsBg.forEach(s => container.add(s));
            caSegments.forEach(s => container.add(s));

            if (isHidden) {
                container.setAlpha(0);
                enemy.setAlpha(0);
            }

            this.enemyHUDs.push({
                container, icon, elemText, hpPct, hpBarBg, hpFill, hpEnrage, modeBarBg, modeFill, caSegmentsBg, caSegments, nameText, effectIndicators, hitArea
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
            
            if (hud.effectIndicators) {
                hud.effectIndicators.removeAll(true);
                const visibleEffects = enemy.activeEffects || [];
                const sups = { 0: '', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
                visibleEffects.forEach((e, idx) => {
                    const isBuff = (e.effect_type || '').toLowerCase() === 'buff';
                    const color = isBuff ? '#f1c40f' : '#7ec8e3'; 

                    let emoji = '❓';
                    const stat = (e.target_stat || '').toUpperCase();
                    if (stat === 'ATK') emoji = '⚔️';
                    else if (stat === 'DEF') emoji = '🛡️';
                    else if (stat === 'CRIT') emoji = '✨';
                    else if (stat === 'STUN') emoji = '💫';
                    else if (stat === 'POISON') emoji = '🤢';
                    else if (stat === 'BURN') emoji = '🔥';
                    else if (stat === 'HP') emoji = '💚';
                    else if (stat === 'AGI') emoji = '💨';

                    const durSup = sups[e.duration] || e.duration || '';
                    const label = `${emoji}${durSup}`;

                    const txt = this.add.text(
                        idx * 24, 0, label, 
                        { fontSize: '11px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }
                    ).setOrigin(0, 0.5);

                    hud.effectIndicators.add(txt);
                });
            }

            if (hud.nameText) {
                hud.nameText.setText(enemy.charName + " \nLv." + enemy.level);
                const nameY = enemy.y + (enemy.battleSprite ? (enemy.battleSprite.displayHeight / 2) + 10 : 65);
                hud.nameText.setPosition(enemy.x, nameY);
                if (enemy.hp <= 0) hud.nameText.setAlpha(0.3);
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
        const ab = this.add.rectangle(410, 505, 100, 40, THEME.DAMAGE).setDepth(10);
        ab.setStrokeStyle(1, THEME.BORDER);
        const text = this.add.text(410, 505, "ATTACK ⚔", { fontSize: "14px", color: THEME.TEXT_PRIMARY, fontStyle: "bold", align: "center" }).setOrigin(0.5).setDepth(10);
        this._attackBtnContainer.add([ab, text]);
        ab.setInteractive(); ab.on("pointerdown", () => {
            if (this.turn === "player" && !this.attackBtnLocked) this.playerAttack();
        });
        this._attackBtnContainer.setVisible(this.turn === "player");

        // GLOBAL AUTO BUTTON
        this.globalAutoState = false;
        this._globalAutoBtnContainer = this.add.container(0, 0);
        const gab = this.add.rectangle(70, 505, 100, 40, THEME.BG).setDepth(10);
        gab.setStrokeStyle(1, THEME.BORDER);
        const gat = this.add.text(70, 505, "AUTO: OFF", { fontSize: "12px", color: THEME.TEXT_SECONDARY, fontStyle: "bold", align: "center" }).setOrigin(0.5).setDepth(10);
        this._globalAutoBtnContainer.add([gab, gat]);
        gab.setInteractive(); gab.on("pointerdown", () => {
            if (this.turn === "player") {
                this.globalAutoState = !this.globalAutoState;
                gat.setText("AUTO: " + (this.globalAutoState ? "ON" : "OFF"));
                gat.setColor(this.globalAutoState ? THEME.TEXT_PRIMARY : THEME.TEXT_SECONDARY);
                gab.setStrokeStyle(1, this.globalAutoState ? THEME.AETHER : THEME.BORDER);
                
                // Toggle all players
                this.players.forEach(p => {
                    p.isAuto = this.globalAutoState;
                    p.updateActionBadge();
                });
                
                // Update local action window auto button if open
                if (this.activePlayer) {
                    this._renderActionWindow();
                }
            }
        });
        this._globalAutoBtnContainer.setVisible(this.turn === "player");
    }

    _buildLayer4() {
        const W = 480;
        const CX = 240;

        // 1. AETHER GAUGE
        this._aethBarBg = this.add.rectangle(CX, 720, 440, 10, THEME.BG);
        this._aethBarBg.setStrokeStyle(1, THEME.AETHER);

        // Fill dimulai dari batas margin kiri (X = 20)
        this._aethFill = this.add.rectangle(20, 720, 0, 8, THEME.AETHER).setOrigin(0, 0.5);

        // Teks disejajarkan dengan margin kiri (20) dan kanan (460)
        this._aethPct = this.add.text(460, 700, "0%", { fontSize: "10px", color: THEME.TEXT_SECONDARY }).setOrigin(1, 0);
        this.add.text(20, 700, "AETHER", { fontSize: "10px", color: THEME.TEXT_SECONDARY }).setOrigin(0, 0);

        // 2. ACTION BUTTONS (Center Y = 720, Height = 55)
        // Tombol Heal (Lebar 210, Center X = 125)
        this._healBtn = this.add.rectangle(125, 762, 210, 55, THEME.PANEL);
        this._healBtn.setStrokeStyle(1, THEME.HEALTH);
        this._healText = this.add.text(125, 762, "⊕ HEAL (x" + this.healsRemaining + ")", { fontSize: "14px", color: THEME.TEXT_SECONDARY }).setOrigin(0.5);
        this._healBtn.setInteractive();
        this._healBtn.on("pointerdown", () => {
            if (this.turn === "player") this.useHealPotion();
        });

        // Tombol Burst (Lebar 210, Center X = 355)
        this._abBg = this.add.rectangle(355, 762, 210, 55, THEME.PANEL);
        this._abBg.setStrokeStyle(1, THEME.BORDER);
        this._abText = this.add.text(355, 762, "✦ AETHER BURST", { fontSize: "14px", color: THEME.TEXT_SECONDARY, align: "center" }).setOrigin(0.5);
        this._abBg.setInteractive();
        this._abBg.on("pointerdown", () => {
            if (this.turn === "player") this.aetherBurst();
        });

        // 3. BATTLE LOG BUTTON (Center Y = 830, Width = 440)
        this._logBtnBg = this.add.rectangle(CX, 812, 440, 30, THEME.PANEL);
        this._logBtnBg.setStrokeStyle(1, THEME.BORDER);
        this.add.text(CX, 812, "BATTLE LOG", { fontSize: "12px", color: THEME.TEXT_SECONDARY, fontStyle: "bold", letterSpacing: 1 }).setOrigin(0.5);
        this._logBtnBg.setInteractive();
        this._logBtnBg.on("pointerdown", () => {
            this.logOverlay.setVisible(true);
            this.logContainer.setVisible(true);
        });

        this._refreshAetherUI();
        this._refreshHealButtonUI();
    }
    _refreshAetherUI() {
        if (!this._aethFill) return;
        const r = Math.min(1, this.aetherGauge / this.aetherGaugeMax);
        this._aethFill.setSize(440 * r, 8);
        this._aethPct.setText(Math.floor(r * 100) + "%");
        const rdy = this.aetherGauge >= this.aetherGaugeMax;
        this._abBg.setStrokeStyle(1, rdy ? THEME.AETHER : THEME.BORDER);
        this._abText.setColor(rdy ? "#A5B4FC" : THEME.TEXT_SECONDARY);
    }
    _buildActionWindow() {
        this._backBtnContainer = this.add.container(0, 0);
        const bb = this.add.rectangle(70, 505, 100, 40, THEME.BG).setStrokeStyle(1, THEME.BORDER).setDepth(30);
        const bt = this.add.text(70, 505, "◄ BACK", { fontSize: "14px", color: THEME.TEXT_PRIMARY, fontStyle: "bold", align: "center" }).setOrigin(0.5).setDepth(30);
        this._backBtnContainer.add([bb, bt]);
        bb.setInteractive(); bb.on('pointerdown', () => this.closeActionWindow());
        this._backBtnContainer.setVisible(false);

        // Center at Y=690, width 480, height 310 to cover the HUD but stay below ATTACK btn
        // Depth 30 is below MainMenu (which is 40)
        this.actionWindowContainer = this.add.container(750, 690).setDepth(30);
        
        const bg = this.add.rectangle(0, 0, 480, 310, 0x111827, 1);
        bg.setStrokeStyle(2, THEME.BORDER);
        bg.setInteractive();

        const portraitX = -182;
        const portraitY = -65;
        this._awCardBg = this.add.rectangle(portraitX, portraitY, 85, 145, 0x12192b).setStrokeStyle(1, 0x334155);
        this._awPortrait = this.add.image(portraitX, portraitY, '');
        
        this._awAutoBtn = this.add.rectangle(portraitX, 35, 85, 30, THEME.BG).setStrokeStyle(1, THEME.BORDER).setInteractive();
        this._awAutoText = this.add.text(portraitX, 35, "AUTO: OFF", { fontSize: "11px", fontStyle: 'bold', color: THEME.TEXT_SECONDARY }).setOrigin(0.5);
        this._awAutoBtn.on('pointerdown', () => {
            if (this.activePlayer) {
                this.activePlayer.isAuto = !this.activePlayer.isAuto;
                this._renderActionWindow();
                this.activePlayer.updateActionBadge();
            }
        });

        const secX = 50;
        const secW = 350;

        // IN EFFECT
        const effY = -120; // Top is -137.5
        this._awEffectsSection = this.add.rectangle(secX, effY, secW, 35, 0x12192b).setStrokeStyle(1, 0x334155).setInteractive({ useHandCursor: true });
        this._awEffectsSection.on('pointerdown', () => {
            if (this.activePlayer) this._showStatusModal(this.activePlayer);
        });
        this._awLabelEffect = this.add.text(-115, effY - 17.5, " STATUS EFFECT ", { fontSize: "10px", fontStyle: "bold", color: THEME.TEXT_MUTED, backgroundColor: "#111827" }).setOrigin(0, 0.5);
        this._awEffectsContainer = this.add.container(-115, effY); // Icons rendered horizontally here

        // SKILL
        const skillY = -60; // Top is -97.5, Bottom is -22.5
        this._awSkillsSection = this.add.rectangle(secX, skillY, secW, 75, 0x12192b).setStrokeStyle(1, 0x334155);
        this._awLabelSkill = this.add.text(-115, skillY - 37.5, " SKILL ", { fontSize: "10px", fontStyle: "bold", color: THEME.TEXT_MUTED, backgroundColor: "#111827" }).setOrigin(0, 0.5);
        this._awSkillsContainer = this.add.container(-125, skillY);

        // MAIN ACTION
        const atkY = 17; // Top is -16, Bottom is 50
        this._awAtkSection = this.add.rectangle(secX, atkY, secW, 66, 0x12192b).setStrokeStyle(1, 0x334155);
        this._awLabelAction = this.add.text(-115, atkY - 33, " MAIN ACTION ", { fontSize: "10px", fontStyle: "bold", color: THEME.TEXT_MUTED, backgroundColor: "#111827" }).setOrigin(0, 0.5);
        
        this._awBasicBtn = this.add.rectangle(-35, atkY, 140, 40, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive();
        this._awBasicText = this.add.text(-35, atkY, "BASIC ATTACK ⚔", { fontSize: "12px", fontStyle: "bold", color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        this._awBasicOverlay = this.add.rectangle(-35, atkY, 140, 40, 0x000000, 0.5).setVisible(false);
        this._awBasicBtn.on('pointerdown', () => this._selectAction('basic_attack'));

        this._awSpecialBtn = this.add.rectangle(135, atkY, 140, 40, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive();
        this._awSpecialText = this.add.text(135, atkY, "SPECIAL ATTACK ✦", { fontSize: "12px", fontStyle: "bold", color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        this._awSpecialOverlay = this.add.rectangle(135, atkY, 140, 40, 0x000000, 0.5).setVisible(false);
        this._awSpecialBtn.on('pointerdown', () => {
            if (this.activePlayer && this.activePlayer.specialBar >= this.activePlayer.specialMax) {
                this._selectAction('special_attack');
            }
        });
        
        this.actionWindowContainer.add([
            bg, 
            this._awCardBg, this._awPortrait, 
            this._awAutoBtn, this._awAutoText,
            this._awEffectsSection, this._awLabelEffect, this._awEffectsContainer,
            this._awSkillsSection, this._awLabelSkill, this._awSkillsContainer, 
            this._awAtkSection, this._awLabelAction, this._awBasicBtn, this._awBasicText, this._awBasicOverlay,
            this._awSpecialBtn, this._awSpecialText, this._awSpecialOverlay
        ]);
    }

    openActionWindow(player) {
        if (!player) return;
        this.activePlayer = player;
        this._actionWindowOpen = true;
        this._backBtnContainer.setVisible(true);
        this._renderActionWindow();
        this.tweens.add({ targets: this.actionWindowContainer, x: 240, duration: 250, ease: 'Cubic.easeOut' });
    }

    closeActionWindow() {
        this._actionWindowOpen = false;
        this._backBtnContainer.setVisible(false);
        this.tweens.add({ targets: this.actionWindowContainer, x: 750, duration: 250, ease: 'Cubic.easeIn' });
        this._setActive(null);
    }

    _selectAction(type, skill_id = null, skillName = null) {
        if (!this.activePlayer) return;
        const p = this.activePlayer;
        
        if (p.activeEffects && p.activeEffects.some(e => (e.target_stat || '').toUpperCase() === 'STUN')) {
            this.showLog(`💫 ${p.charName} sedang STUN! Aksi dinonaktifkan.`);
            this.playStunVibrateAnim(p);
            return;
        }
        
        if (p.queuedAction.type === type && p.queuedAction.skill_id === skill_id) {
            p.queuedAction = { type: 'none' };
        } else {
            p.queuedAction = { type, skill_id, skillName };
        }
        
        p.updateActionBadge();
        this._renderActionWindow();
    }

    _renderActionWindow() {
        if (!this.activePlayer) return;
        const p = this.activePlayer;

        const isStunned = p.activeEffects && p.activeEffects.some(e => (e.target_stat || '').toUpperCase() === 'STUN');

        const keyId = p.mc_id || p.id || p.slot;
        let portTex = `portrait_${keyId}`;
        if (this.textures.exists(portTex)) {
            this._awPortrait.setTexture(portTex);
            const imgW = this._awPortrait.width || 1;
            this._awPortrait.setScale(85 / imgW);
        } else {
            this._awPortrait.setTexture('');
        }

        this._awAutoText.setText(p.isAuto ? "AUTO: ON" : "AUTO: OFF");
        this._awAutoText.setColor(p.isAuto ? "#3b82f6" : THEME.TEXT_SECONDARY);
        this._awAutoBtn.setStrokeStyle(1, p.isAuto ? 0x3b82f6 : THEME.BORDER);

        const isAnyQueued = p.queuedAction.type !== 'none';

        const isBasic = p.queuedAction.type === 'basic_attack';
        const basicDisabled = isStunned || (isAnyQueued && !isBasic);
        this._awBasicBtn.setAlpha(1);
        this._awBasicText.setAlpha(1);
        this._awBasicOverlay.setVisible(basicDisabled);
        this._awBasicBtn.setStrokeStyle(1, isBasic ? THEME.HEALTH : THEME.BORDER);

        const saRdy = p.specialBar >= p.specialMax;
        const isSpecial = p.queuedAction.type === 'special_attack';
        const specialDisabled = isStunned || !saRdy || (isAnyQueued && !isSpecial);
        this._awSpecialBtn.setAlpha(1);
        this._awSpecialText.setAlpha(1);
        this._awSpecialText.setColor(saRdy ? (isSpecial ? "#fff" : "#f1c40f") : THEME.TEXT_MUTED);
        this._awSpecialOverlay.setVisible(specialDisabled);
        this._awSpecialBtn.setStrokeStyle(1, isSpecial ? 0xf1c40f : THEME.BORDER);

        this._awSkillsContainer.removeAll(true);
        const skills = [...p.skills].sort((a, b) => {
            const isSaA = (a.category || '').toLowerCase() === 'special';
            const isSaB = (b.category || '').toLowerCase() === 'special';
            if (isSaA && !isSaB) return 1;
            if (!isSaA && isSaB) return -1;
            return 0;
        });

        let skillIndex = 0;
        skills.forEach((sk, i) => {
            const isSA = (sk.category || '').toLowerCase() === 'special';
            if (isSA) return; 

            const cd = p.cooldowns[sk.id] || 0;
            const canUse = (cd === 0) && !isStunned;
            const isQueued = p.queuedAction.type === 'skill' && p.queuedAction.skill_id === sk.id;
            
            const sx = 55 + (skillIndex * 80);
            skillIndex++;

            let strokeColor = THEME.BORDER;
            const sType = (sk.type || '').toLowerCase();
            
            if (sType.includes('damage')) strokeColor = 0xe74c3c;
            else if (sType.includes('debuff')) strokeColor = 0x3498db;
            else if (sType.includes('buff') || sType.includes('support')) strokeColor = 0xf1c40f;
            else if (sType.includes('heal') || sType.includes('revive') || sType.includes('cleanse')) strokeColor = 0x2ecc71;

            if (isQueued) strokeColor = THEME.AETHER;

            const bgR = this.add.rectangle(sx, 0, 60, 60, THEME.PANEL).setStrokeStyle(1, strokeColor);
            bgR.setAlpha(1);
            
            const displayName = sk.name.length > 10 ? sk.name.substring(0, 8) + "..." : sk.name;
            const nm = this.add.text(sx, -5, displayName, { fontSize: "10px", color: THEME.TEXT_PRIMARY, fontStyle: "bold", wordWrap: {width: 55}, align: 'center' }).setOrigin(0.5);
            nm.setAlpha(1);
            
            const elements = [bgR, nm];

            if (cd > 0) {
                const cdOverlay = this.add.rectangle(sx, 0, 60, 60, 0x000000, 0.6);
                const cdText = this.add.text(sx, 0, cd.toString(), { fontSize: "24px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
                elements.push(cdOverlay, cdText);
            } else {
                const cdT = this.add.text(sx, 15, "READY", { fontSize: "9px", color: THEME.TEXT_MUTED }).setOrigin(0.5);
                elements.push(cdT);
                
                const skillDisabled = isStunned || (isAnyQueued && !isQueued);
                if (skillDisabled) {
                    const disabledOverlay = this.add.rectangle(sx, 0, 60, 60, 0x000000, 0.5);
                    elements.push(disabledOverlay);
                }
            }
            
            this._awSkillsContainer.add(elements);

            if (canUse) {
                bgR.setInteractive();
                bgR.on("pointerdown", () => this._selectAction('skill', sk.id, sk.name));
            }
        });

        this._awEffectsContainer.removeAll(true);
        const visibleEffects = p.activeEffects || [];
        if (visibleEffects.length > 0) {
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

                const dur = e.duration || e.mse_duration || 0;
                let durChar = '';
                if (dur > 0 && dur <= 9) durChar = sups[dur];
                
                const tx = 20 + (idx * 30);
                const txt = this.add.text(tx, 0, emoji + durChar, { fontSize: "14px", color: color, stroke: '#000', strokeThickness: 2 }).setOrigin(0.5);
                this._awEffectsContainer.add(txt);
            });
        }
    }
    playSpriteHitAnim(p) {
        const sprite = p.battleSprite || p.spriteObj;
        if (!sprite) return;
        const ox = p._spriteBaseX !== undefined ? p._spriteBaseX : sprite.x;
        this.tweens.add({
            targets: sprite, x: ox + 8,
            duration: 50, yoyo: true, repeat: 2,
            ease: 'Power1',
            onComplete: () => { sprite.x = ox; }
        });
    }
    playCharacterLungeAnim(p) {
        return new Promise(resolve => {
            const sprite = p.battleSprite || p.spriteObj;
            if (!sprite) {
                resolve();
                return;
            }

            const baseX = p._spriteBaseX !== undefined ? p._spriteBaseX : sprite.x;
            const baseY = p._spriteBaseY !== undefined ? p._spriteBaseY : sprite.y;

            // Forward Lunge towards enemy (Left)
            this.tweens.add({
                targets: sprite,
                x: baseX - 80,
                y: baseY + 10,
                duration: 180,
                ease: 'Power2',
                onComplete: resolve
            });
        });
    }

    playCharacterReturnAnim(p) {
        return new Promise(resolve => {
            const sprite = p.battleSprite || p.spriteObj;
            if (!sprite) {
                resolve();
                return;
            }

            const baseX = p._spriteBaseX !== undefined ? p._spriteBaseX : sprite.x;
            const baseY = p._spriteBaseY !== undefined ? p._spriteBaseY : sprite.y;

            // Return to base position
            this.tweens.add({
                targets: sprite,
                x: baseX,
                y: baseY,
                duration: 220,
                ease: 'Power1',
                onComplete: resolve
            });
        });
    }
    playStunVibrateAnim(p) {
        const sprite = p ? (p.battleSprite || p.spriteObj) : null;
        if (!sprite) return;
        const baseX = p._spriteBaseX !== undefined ? p._spriteBaseX : sprite.x;
        this.tweens.add({
            targets: sprite,
            x: baseX + 3,
            duration: 40,
            yoyo: true,
            repeat: 5,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                sprite.x = baseX;
            }
        });
    }
    _buildBattleLog() {
        // Popup Log Area (Top of Main Arena)
        this.battleLogBg = this.add.rectangle(0, 50, W, 60, 0x000000, 0.7).setOrigin(0, 0).setDepth(300).setVisible(false);
        this.battleLogText = this.add.text(15, 65, "", { fontSize: "14px", color: "#fff", align: "left", wordWrap: { width: W - 30 } }).setOrigin(0, 0).setDepth(300).setVisible(false);

        this.logOverlay = this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.8)
            .setOrigin(0, 0).setDepth(249).setInteractive().setVisible(false);

        // BATTLE LOG UI (Fixed)
        this.logContainer = this.add.container(240, 100).setDepth(300).setVisible(false);

        const titleBg = this.add.rectangle(0, -25, 400, 30, 0x111111).setStrokeStyle(1, 0x333333);
        const title = this.add.text(0, -25, "BATTLE LOG HISTORY (Drag/Scroll)", { fontSize: "14px", color: "#f39c12", fontStyle: "bold" }).setOrigin(0.5);
        this.logContainer.add([titleBg, title]);

        // MASKING UNTUK SCROLL
        const maskShape = this.make.graphics();
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(20, 100, 440, 600); // Batas scroll area
        const mask = maskShape.createGeometryMask();

        // CONTAINER ISI LOG (Scrollable)
        this.logScrollContainer = this.add.container(0, 10);
        this.logContainer.add(this.logScrollContainer);
        this.logScrollContainer.setMask(mask);

        // LOGIC DRAG & SCROLL
        let isDragging = false;
        let startY = 0;
        let lastY = 0;

        this.logOverlay.on('wheel', (pointer, dx, dy, dz, event) => {
            this.logScrollContainer.y -= dy * 0.5;
            this._clampLogScroll();
        });

        this.logOverlay.on('pointerdown', (pointer) => {
            isDragging = true;
            startY = pointer.y;
            lastY = pointer.y;
        });

        this.logOverlay.on('pointermove', (pointer) => {
            if (isDragging) {
                const dy = pointer.y - lastY;
                this.logScrollContainer.y += dy;
                lastY = pointer.y;
                this._clampLogScroll();
            }
        });

        const handlePointerUp = (pointer) => {
            isDragging = false;
            // Jika drag sangat kecil, anggap sebagai click/tap -> Close Modal
            if (Math.abs(pointer.y - startY) < 5) {
                this.logOverlay.setVisible(false);
                this.logContainer.setVisible(false);
            }
        };

        this.logOverlay.on('pointerup', handlePointerUp);
        this.logOverlay.on('pointerout', handlePointerUp);

        this.battleHistory = [];
        this.logHistoryObjs = [];
        this._logTotalHeight = 0;
    }

    _clampLogScroll() {
        const maxY = 10; // Posisi awal Y dari logScrollContainer
        const maskHeight = 600;
        const paddingBottom = 40;

        // Jika isi lebih pendek dari layar, jangan discroll
        if (this._logTotalHeight + paddingBottom < maskHeight) {
            this.logScrollContainer.y = maxY;
            return;
        }

        const minY = maxY - (this._logTotalHeight + paddingBottom - maskHeight);
        if (this.logScrollContainer.y > maxY) this.logScrollContainer.y = maxY;
        if (this.logScrollContainer.y < minY) this.logScrollContainer.y = minY;
    }

    _showCenterAnim(textStr, colorStr = "#ffffff") {
        const cx = this.cameras.main.width / 2;
        const cy = this.cameras.main.height / 2;
        const animText = this.add.text(cx, cy, textStr, {
            fontSize: "36px", fontStyle: "bold", fontFamily: "Outfit", align: "center",
            color: colorStr, letterSpacing: 4, stroke: "#000", strokeThickness: 4,
            wordWrap: { width: this.cameras.main.width - 60 }
        }).setOrigin(0.5).setDepth(250).setScale(0.5).setAlpha(0);

        this.tweens.add({
            targets: animText, scale: 1.2, alpha: 1, duration: 400, ease: 'Back.out',
            onComplete: () => {
                this.time.delayedCall(1200, () => {
                    this.tweens.add({
                        targets: animText, alpha: 0, scale: 1.5, duration: 300,
                        onComplete: () => animText.destroy()
                    });
                });
            }
        });
    }

    showLog(msg, source = 'system') {
        if (source === 'system' || source === 'popup') {
            if (this._popupTimer) this._popupTimer.remove();
            this.battleLogText.setText(msg);
            this.battleLogBg.setVisible(true);
            this.battleLogText.setVisible(true);
            this._popupTimer = this.time.delayedCall(2000, () => {
                this.battleLogBg.setVisible(false);
                this.battleLogText.setVisible(false);
            });
            if (source === 'popup') return;
        } else if (msg.includes("ENRAGED") || msg.includes("BREAK") || msg.includes("STANCE")) {
            if (this._popupTimer) this._popupTimer.remove();
            this.battleLogText.setText(msg);
            this.battleLogBg.setVisible(true);
            this.battleLogText.setVisible(true);
            this._popupTimer = this.time.delayedCall(2000, () => {
                this.battleLogBg.setVisible(false);
                this.battleLogText.setVisible(false);
            });
        }

        this.battleHistory.push({ msg, source });
        if (this.battleHistory.length > 50) this.battleHistory.shift();

        this._renderHistoryLogs();
    }

    _renderHistoryLogs() {
        this.logHistoryObjs.forEach(obj => obj.destroy());
        this.logHistoryObjs = [];

        let currentY = 10;
        this.battleHistory.forEach(item => {
            let color = "#ffffff";
            let align = "center";
            let originX = 0.5;
            let posX = 0;
            let bgOriginX = 0.5;
            let bgPosX = 0;

            if (item.source === 'player') {
                color = "#4fc3f7"; align = "left"; originX = 0; posX = -190;
                bgOriginX = 0; bgPosX = -200;
            } else if (item.source === 'enemy') {
                color = "#ff8a65"; align = "right"; originX = 1; posX = 190;
                bgOriginX = 1; bgPosX = 200;
            }

            const t = this.add.text(posX, currentY, item.msg, {
                fontSize: "12px", color: color,
                wordWrap: { width: 320 }, align: align, lineSpacing: 4
            }).setOrigin(originX, 0);

            const bgW = t.displayWidth + 20;
            const bgH = t.displayHeight + 10;

            const bgColor = color === "#ffffff" ? 0x222222 : (item.source === 'player' ? 0x0d1b2a : 0x2a0d0d);
            const strokeCol = color === "#ffffff" ? 0x555555 : (item.source === 'player' ? 0x1a3a5a : 0x5a1a1a);

            const bg = this.add.rectangle(bgPosX, currentY - 5, bgW, bgH, bgColor).setOrigin(bgOriginX, 0).setStrokeStyle(1, strokeCol);

            this.logScrollContainer.add([bg, t]);
            this.logHistoryObjs.push(bg, t);
            currentY += bg.height + 10;
        });

        this._logTotalHeight = currentY;
        this.logScrollContainer.y = 10; // Reset scroll ke atas tiap ada log baru
    }

    _queueFloatingText(target, callback) {
        if (!target) return;
        target._floatQueueDelay = target._floatQueueDelay || 0;
        
        if (target._floatQueueDelay > 0) {
            this.time.delayedCall(target._floatQueueDelay, callback);
        } else {
            callback();
        }
        target._floatQueueDelay += 350; // stagger next text on THIS specific target
    }

    showFloatingEffect(target, effectName, effectType) {
        if (!target) return;

        const typeStr = (effectType || '').toLowerCase();
        let strokeColor = "#000000"; // default fallback

        if (['buff', 'cleanse', 'heal'].includes(typeStr)) {
            strokeColor = "#00e676"; // Hijau Terang
        } else if (['debuff', 'stun', 'stat down', 'stat_down'].includes(typeStr)) {
            strokeColor = "#d50000"; // Merah Crimson
        }

        const ox = Phaser.Math.Between(-20, 20);

        this._queueFloatingText(target, () => {
            let tx = target.x;
            let ty = target.y;
            let spriteH = 80;

            if (target.battleSprite) {
                tx = target.battleSprite.x;
                ty = target.battleSprite.y;
                spriteH = target.battleSprite.displayHeight || 80;
            } else if (target._spriteBaseX !== undefined && target._spriteBaseY !== undefined) {
                tx = target._spriteBaseX;
                ty = target._spriteBaseY;
            } else if (target.spriteObj) {
                tx = target.spriteObj.x;
                ty = target.spriteObj.y;
            }
            const headY = ty - (spriteH / 2) - 15;

            const floatText = this.add.text(tx + ox, headY, effectName, {
                fontSize: "14px", color: "#ffffff", fontStyle: "bold",
                stroke: strokeColor, strokeThickness: 4, fontFamily: 'Arial'
            }).setOrigin(0.5).setDepth(200);

            this.tweens.add({
                targets: floatText, y: floatText.y - 40, alpha: 0,
                duration: Phaser.Math.Between(1000, 1200), ease: 'Power1',
                onComplete: () => { floatText.destroy(); }
            });
        });
    }

    showFloatingDoT(target, effectName, dmg, colorStr) {
        if (!target) return;

        const ox = Phaser.Math.Between(-20, 20);

        this._queueFloatingText(target, () => {
            let tx = target.x;
            let ty = target.y;
            let spriteH = 80;

            if (target.battleSprite) {
                tx = target.battleSprite.x;
                ty = target.battleSprite.y;
                spriteH = target.battleSprite.displayHeight || 80;
            } else if (target._spriteBaseX !== undefined && target._spriteBaseY !== undefined) {
                tx = target._spriteBaseX;
                ty = target._spriteBaseY;
            } else if (target.spriteObj) {
                tx = target.spriteObj.x;
                ty = target.spriteObj.y;
            }
            const headY = ty - (spriteH / 2) - 15;

            const floatText = this.add.text(tx + ox, headY, `${effectName}\n${dmg}`, {
                fontSize: "16px", color: colorStr, fontStyle: "bold",
                stroke: "#000000", strokeThickness: 3, fontFamily: 'Arial',
                align: 'center'
            }).setOrigin(0.5).setDepth(200);

            this.tweens.add({
                targets: floatText,
                y: floatText.y - 50,
                alpha: 0,
                duration: Phaser.Math.Between(1000, 1200),
                ease: 'Power1',
                onComplete: () => {
                    floatText.destroy();
                }
            });
        });
    }

    _playStartAnimation() {
        // Fallback: Check if party is already wiped out upon resuming battle
        const allDead = this.players.every(p => p.hp <= 0);
        if (allDead) {
            if (this._blackOverlay) {
                this._blackOverlay.destroy();
                this._blackOverlay = null;
            }
            this.triggerDefeat(false);
            return;
        }

        const cx = this.cameras.main.width / 2;
        const cy = this.cameras.main.height / 2;
        
        if (!this._blackOverlay) {
            this._blackOverlay = this.add.rectangle(cx, cy, W, H, 0x000000, 0.95).setDepth(190);
        }

        const startText = this.add.text(cx, cy, "START!", {
            fontSize: "48px",
            fontStyle: "bold",
            fontFamily: "Outfit",
            color: THEME.TEXT_PRIMARY,
            letterSpacing: 8
        }).setOrigin(0.5).setDepth(200).setScale(0.5).setAlpha(0);

        this.tweens.add({
            targets: startText,
            scale: 1.2,
            alpha: 1,
            duration: 300,
            ease: 'Back.out',
            onStart: () => {
                if (this.bgmKey) playGlobalBGM(this, this.bgmKey);
                this.playSFX('sfx_battleStart', { volume: 0.9 });
            },
            onComplete: () => {
                this.time.delayedCall(800, () => {
                    this.tweens.add({
                        targets: startText,
                        scale: 1.5,
                        alpha: 0,
                        duration: 300,
                        onComplete: () => { 
                            startText.destroy(); 
                            if (this._blackOverlay) {
                                this.tweens.add({
                                    targets: this._blackOverlay,
                                    alpha: 0,
                                    duration: 400,
                                    ease: 'Power2',
                                    onComplete: () => {
                                        this._blackOverlay.destroy();
                                        this._blackOverlay = null;

                                        // FADE IN ENEMIES (Sprite + HUD)
                                        const fadeTargets = [];
                                        this.enemies.forEach((enemy, idx) => {
                                            fadeTargets.push(enemy);
                                            if (this.enemyHUDs[idx] && this.enemyHUDs[idx].container) {
                                                fadeTargets.push(this.enemyHUDs[idx].container);
                                            }
                                        });

                                        if (fadeTargets.length > 0) {
                                            this.tweens.add({
                                                targets: fadeTargets,
                                                alpha: 1,
                                                duration: 1000,
                                                ease: 'Sine.easeInOut'
                                            });
                                        }
                                    }
                                });
                            }
                        }
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

        // --- BATTLE HISTORY AGGREGATION ---
        const turnAgg = new Map();
        events.forEach(ev => {
            if (!ev.sourceId) return;
            if (ev.type === 'wave_change' || ev.type === 'enrage' || ev.type === 'break' || ev.type === 'log') return;

            const key = `${ev.sourceId}_${ev.skillName || 'Basic Attack'}`;
            if (!turnAgg.has(key)) {
                turnAgg.set(key, {
                    sourceId: ev.sourceId,
                    skillName: ev.skillName || 'Basic Attack',
                    totalDmg: 0,
                    totalHeal: 0,
                    effects: new Set(),
                    targets: new Set()
                });
            }
            const agg = turnAgg.get(key);

            if (ev.targetId !== undefined && ev.targetId !== null) {
                let tName = null;
                const pTarget = this.players.find(p => p.slot === ev.targetId);
                if (pTarget) tName = pTarget.charName;
                if (!tName) {
                    const tIdStr = String(ev.targetId);
                    if (this.enemies.some(e => String(e.monsterId) == tIdStr) || tIdStr.startsWith('enemy_') || tIdStr === 'enemy') {
                        const eIdx = tIdStr.startsWith('enemy_') ? parseInt(tIdStr.split('_')[1], 10) : 0;
                        const eTarget = this.enemies[eIdx] || this.enemies[0];
                        if (eTarget) tName = eTarget.charName || "Monster";
                    }
                }
                if (tName) agg.targets.add(tName);
            }

            if (ev.type === 'damage') {
                agg.totalDmg += (ev.value || 0);
            }
            if (ev.type === 'heal') {
                agg.totalHeal += (ev.value || 0);
            }
            if (ev.type === 'effect_applied') {
                agg.effects.add(ev.effectName);
            }
        });

        // Push aggregated logs
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        let addedHistory = false;
        turnAgg.forEach(agg => {
            const source = this.players.find(p => p.slot === agg.sourceId) ||
                (String(agg.sourceId).startsWith('enemy') ? this.enemies[0] : null);
            const sourceName = source ? source.charName : agg.sourceId;
            const logSource = String(agg.sourceId).startsWith('enemy') ? 'enemy' : 'player';

            let titleStr = `${timeStr} ${sourceName} used ${agg.skillName}`;

            if (logSource === 'enemy') {
                if (agg.targets.size === 1) {
                    titleStr += ` -> ${Array.from(agg.targets)[0]}`;
                }
            }

            let detailStr = [];
            if (agg.totalDmg > 0) detailStr.push(`Total dmg: ${agg.totalDmg}`);
            if (agg.totalHeal > 0) detailStr.push(`Total heal: ${agg.totalHeal}`);
            if (agg.effects.size > 0) detailStr.push(Array.from(agg.effects).join(' & '));

            if (detailStr.length > 0 || logSource === 'enemy' || agg.skillName !== 'Basic Attack') {
                let historyMsg = titleStr;
                if (detailStr.length > 0) {
                    historyMsg += `\n${detailStr.join('\n')}`;
                }
                this.battleHistory.push({ msg: historyMsg, source: logSource });
                addedHistory = true;
            }
        });

        if (addedHistory) {
            if (this.battleHistory.length > 50) this.battleHistory.splice(0, this.battleHistory.length - 50);
            this._renderHistoryLogs();
        }

        const actionGroups = [];
        let currentGroup = null;

        for (const ev of events) {
            if ((ev.type === 'damage' || ev.type === 'heal' || ev.type === 'effect_applied' || ev.type === 'cleanse' || ev.type === 'revive' || ev.type === 'stun_skip') && ev.sourceId) {
                // Relax grouping: check only sourceId for consecutive actions, picking up skillName if present
                if (currentGroup && currentGroup.sourceId === ev.sourceId) {
                    currentGroup.events.push(ev);
                    if (ev.skillName && (!currentGroup.skillName || currentGroup.skillName === 'Unknown Skill')) {
                        currentGroup.skillName = ev.skillName;
                    }
                } else {
                    currentGroup = { isGroup: true, sourceId: ev.sourceId, skillName: ev.skillName, events: [ev] };
                    actionGroups.push(currentGroup);
                }
            } else {
                currentGroup = null;
                actionGroups.push({ isGroup: false, event: ev });
            }
        }

        for (const group of actionGroups) {
            this.players.forEach(p => p._floatQueueDelay = 0);
            this.enemies.forEach(e => e._floatQueueDelay = 0);

            await new Promise(async resolve => {
                let delay = 500;

                if (group.isGroup) {
                    let source = null;
                    if (String(group.sourceId).startsWith('enemy_') || String(group.sourceId) === 'enemy') {
                        const eIdx = String(group.sourceId).startsWith('enemy_') ? parseInt(String(group.sourceId).split('_')[1], 10) : 0;
                        source = this.enemies[eIdx] || this.enemies[0];
                    } else {
                        source = this.players.find(p => (p.slot || p.id) === group.sourceId);
                    }
                    const sourceName = source ? (source.charName || source.name || 'Unknown') : 'Entity';
                    
                    const isStunnedAction = group.skillName === 'STUNNED' || group.events.some(e => e.type === 'stun_skip');
                    if (isStunnedAction) {
                        this.showLog(`💫 ${sourceName} is STUNNED and cannot move!`, 'popup');
                        // VFX: Stun on stunned source
                        if (source) {
                            const stunSrcPos = this._getVfxTargetPos(source);
                            this.playExactVFX('stun', stunSrcPos.x, stunSrcPos.y, { scale: 1.5 });
                            this.playStunVibrateAnim(source);
                        }
                        delay = 1000;
                        this.time.delayedCall(delay, resolve);
                        return;
                    }

                    // Extract the primary damage/heal event to figure out the skill info
                    const primaryEv = group.events.find(e => e.type === 'damage' && !e.isDoT) || group.events.find(e => e.type === 'heal' || e.type === 'support' || e.type === 'effect_applied' || e.type === 'cleanse' || e.type === 'revive');
                    
                    let isSkill = false;
                    let isSA = false;
                    
                    if (primaryEv) {
                        console.log('DEBUG: primaryEv', primaryEv, 'events:', group.events);
                        const skillDisplay = group.skillName || 'Basic Attack';
                        this.showLog(`[${skillDisplay}] ${sourceName} attacks!`, 'popup');
                        isSA = primaryEv.skillCategory === 'special' || primaryEv.skillCategory === 'chain_burst' || primaryEv.skillCategory === 'aether_burst';
                        isSkill = primaryEv.skillCategory && primaryEv.skillCategory !== 'basic';
                        
                        const isEnemy = String(group.sourceId).startsWith('enemy');
                        if (isEnemy) {
                            const monsSfx = isSkill ? 'sfx_monsChargeAttack' : 'sfx_monsBasicAtk';
                            this.playSFX(monsSfx, { volume: 0.7 });
                        } else {
                            const hasHealOrBuff = group.events.some(e => e.type === 'heal' || e.type === 'cleanse' || e.type === 'revive' || (e.type === 'effect_applied' && (e.effectType || '').toLowerCase() === 'buff'));
                            
                            let atkSfx = 'sfx_charBasicAtk';
                            if (hasHealOrBuff) atkSfx = 'sfx_heal';
                            else if (isSA) atkSfx = 'sfx_charSpecialAttack';
                            else if (isSkill) atkSfx = 'sfx_charSkillAtk';
                            this.playSFX(atkSfx, { volume: 0.7 });
                        }
                    }

                    if (source && source.battleSprite) {
                        await this.playCharacterLungeAnim(source);
                    }

                    // First pass: Process damage, heal, revive, cleanse, stun_skip
                    group.events.forEach(ev => {
                        if (ev.type === 'effect_applied') return; // Process later

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

                        if (!target) return;

                        if (ev.type === 'damage') {
                            target.hp = Math.max(0, target.hp - ev.value);
                            if (this.enemies.includes(target)) {
                                if (ev.modeBar !== undefined && target) target.modeBar = ev.modeBar;
                                if (ev.modeState !== undefined && target) target.modeState = ev.modeState;
                                this._refreshEnemyHUD();
                            } else {
                                target.refreshVisual();
                            }

                            if (ev.isDoT) {
                                if (this.enemies.includes(target) && target && ev.skillName !== 'STUNNED') target.playHitAnim();
                                else if (!this.enemies.includes(target)) this.playSpriteHitAnim(target);

                                // VFX: DoT effect (Burn/Poison)
                                const dotPos = this._getVfxTargetPos(target);
                                const dotKey = (ev.effectName || '').toLowerCase() === 'burn' ? 'burn' : 'poison';
                                this.playExactVFX(dotKey, dotPos.x, dotPos.y, { scale: 1.5, useAddBlend: true });

                                const colorStr = ev.effectName === 'Burn' ? "#e67e22" : "#9b59b6";
                                const emoji = ev.effectName === 'Burn' ? "🔥" : "💀";
                                const logSource = String(target.slot || target.monsterId).startsWith('enemy') ? 'enemy' : 'player';
                                this.showLog(`${emoji} ${ev.effectName} deals ${ev.value} damage to ${target.charName}!`, logSource);
                                this.showFloatingDoT(target, ev.effectName, ev.value, colorStr);
                                delay = Math.max(delay, 600);
                            } else {
                                if (this.enemies.includes(target) && target && ev.skillName !== 'STUNNED') target.playHitAnim();
                                else if (!this.enemies.includes(target)) this.playSpriteHitAnim(target);
                                
                                // VFX: Damage (Skill/Special/Charge = Rolling, Basic = Exact)
                                const dmgPos = this._getVfxTargetPos(target);
                                const cat = ev.skillCategory || 'basic';
                                if (cat === 'skill' || cat === 'special' || cat === 'charge') {
                                    this.playRollingVFX(ev.sourceElement, dmgPos.x, dmgPos.y, 1.5);
                                } else if (cat === 'aether_burst') {
                                    this.playExactVFX('aetherBurst', dmgPos.x, dmgPos.y, { scale: 1.5, useAddBlend: true });
                                } else if (cat === 'chain_burst') {
                                    this.playExactVFX('chainBurst', dmgPos.x, dmgPos.y, { scale: 1.5, useAddBlend: true });
                                } else {
                                    // Basic Attack: charBasicAtk (player) or monsBasicAtk (enemy)
                                    const isEnemySource = String(group.sourceId).startsWith('enemy');
                                    const atkKey = isEnemySource ? 'monsBasicAtk' : 'charBasicAtk';
                                    this.playExactVFX(atkKey, dmgPos.x, dmgPos.y, { scale: 0.5, useAddBlend: true });
                                }

                                this.showFloatingDamage(target, ev.value, ev.isCrit, ev.elementMultiplier, ev.sourceElement);
                                delay = Math.max(delay, 250);
                            }
                        } else if (ev.type === 'heal') {
                            target.hp = Math.min(target.maxHp, target.hp + ev.value);
                            if (target === this.enemy) this._refreshEnemyHUD();
                            else target.refreshVisual();

                            // VFX: Heal
                            const healPos = this._getVfxTargetPos(target);
                            this.playExactVFX('heal', healPos.x, healPos.y, { scale: 1.5 });

                            this.showFloatingHeal(target, ev.value);
                            this.showLog(`[Heal] ${target.charName} restored HP!`, 'popup');
                            delay = Math.max(delay, 600);
                        } else if (ev.type === 'revive') {
                            target.hp = ev.value;
                            if (target === this.enemy) this._refreshEnemyHUD();
                            else target.refreshVisual();

                            // VFX: Revive
                            const revPos = this._getVfxTargetPos(target);
                            this.playExactVFX('revive', revPos.x, revPos.y, { scale: 1.5 });

                            this.showLog(`✨ ${target.charName} revived!`, 'popup');
                            delay = Math.max(delay, 600);
                        } else if (ev.type === 'cleanse') {
                            target.activeEffects = target.activeEffects.filter(e => (e.effect_type || '').toLowerCase() !== 'debuff');
                            target.refreshVisual();
                            this.showLog(`✨ ${target.charName} debuffs cleansed!`, 'popup');
                            delay = Math.max(delay, 500);
                        } else if (ev.type === 'stun_skip') {
                            // VFX: Stun
                            const stunPos = this._getVfxTargetPos(target);
                            this.playExactVFX('stun', stunPos.x, stunPos.y, { scale: 1.5 });

                            const tgtName = target.charName || (target.monsterId ? 'ENEMY' : 'Character');
                            this.showLog(`💫 ${tgtName} is STUNNED and cannot move!`, 'popup');
                            this.playStunVibrateAnim(target);
                            delay = Math.max(delay, 400);
                        }
                    });

                    // Return character to original base position
                    if (source && source.battleSprite) {
                        await this.playCharacterReturnAnim(source);
                    }

                    // Second pass: Process effect_applied AFTER character returned to base position
                    const effectEvents = group.events.filter(ev => ev.type === 'effect_applied');
                    if (effectEvents.length > 0) {
                        await new Promise(r => this.time.delayedCall(400, r)); // wait longer so damage text moves up
                        
                        let playedBuffSound = false;
                        let playedDebuffSound = false;

                        effectEvents.forEach(ev => {
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
                            if (!target) return;

                            // VFX: Buff or Debuff
                            const effPos = this._getVfxTargetPos(target);
                            if ((ev.effectType || '').toLowerCase() === 'buff') {
                                this.playExactVFX('buff', effPos.x, effPos.y, { scale: 1.5 });
                                if (!playedBuffSound) {
                                    this.playSFX('sfx_buff', { volume: 0.6 });
                                    playedBuffSound = true;
                                }
                            } else {
                                this.playExactVFX('debuff', effPos.x, effPos.y, { scale: 1.5 });
                                if (!playedDebuffSound) {
                                    this.playSFX('sfx_debuff', { volume: 0.6 });
                                    playedDebuffSound = true;
                                }
                            }

                            this.showFloatingEffect(target, ev.effectName, ev.effectType);
                            this.showLog(`${target.charName} got ${ev.effectName}!`, 'popup');
                        });
                        
                        // Extra delay to let player see the buff applying
                        delay = Math.max(delay, 500);
                        await new Promise(r => this.time.delayedCall(350, r)); 
                    }
                } else {
                    const ev = group.event;
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

                    if (ev.type === 'enrage') {
                        if (target) {
                            this.playSFX('sfx_monsEnraged', { volume: 0.8 });
                            target.modeState = 'enraged';
                            this._enragedTurns = 3;
                            this.showLog("ENEMY ENRAGED! (3 Turns)", 'system');
                            this._refreshEnemyHUD();
                            delay = 800;
                        }
                    } else if (ev.type === 'break') {
                        if (target) {
                            this.playSFX('sfx_monsExhausted', { volume: 0.8 });
                            target.modeState = 'exhausted';
                            this._exhaustedTurns = 2;
                            this._enragedTurns = 0;
                            this.showLog("ENEMY BREAK! (Exhausted)", 'system');
                            this._refreshEnemyHUD();
                            delay = 800;
                        }
                    } else if (ev.type === 'effect_removed') {
                        if (target) {
                            const effName = ev.effectName || '';
                            target.activeEffects = (target.activeEffects || []).filter(
                                e => (e.effect_name || e.target_stat || '') !== effName
                            );
                            if (this.enemies.includes(target)) {
                                this._refreshEnemyHUD();
                            } else {
                                target.refreshVisual();
                            }
                            delay = 100;
                        }
                    } else if (ev.type === 'log') {
                        this.showLog(ev.message, 'system');
                        delay = 600;
                    } else if (ev.type === 'delay') {
                        delay = ev.delayMs || 500;
                    } else if (ev.type === 'wave_change') {
                        waveChanged = true;
                        this._isWaveChanging = true;
    
                        delay = -1; // Flag for manual resolve
    
                        // 1. Fade out the dying enemy
                        if (this.enemies.length > 0) {
                            const targetAlphas = [];
                            this.enemies.forEach((enemy, idx) => {
                                targetAlphas.push(enemy);
                                if (this.enemyHUDs[idx] && this.enemyHUDs[idx].container) {
                                    targetAlphas.push(this.enemyHUDs[idx].container);
                                }
                            });
    
                            this.tweens.add({
                                targets: targetAlphas,
                                alpha: 0,
                                duration: 1000,
                                onComplete: () => {
                                    resolve(); // Allow _syncState to rebuild new enemies in background
    
                                    // 2. Karakter berlari ke kiri (maju)
                                    this.tweens.add({
                                        targets: this.players,
                                        x: "-=600",
                                        duration: 800,
                                        ease: 'Power2',
                                        onComplete: () => {
                                            // 3. Buka tirai hitam pekat (transparency 100%)
                                            if (!this._blackOverlay) {
                                                this._blackOverlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 1).setDepth(190).setAlpha(0);
                                            }
                                            
                                            this.tweens.add({
                                                targets: this._blackOverlay,
                                                alpha: 1,
                                                duration: 400,
                                                onComplete: () => {
                                                    // Kembalikan posisi karakter ke posisi semula secara instan di balik tirai
                                                    this.players.forEach(p => { p.x = p._baseX; });

                                                    const waveTxt = this.add.text(CX, H / 2, `WAVE ${ev.waveNum}`, {
                                                        fontSize: '48px', color: '#ffd700', fontStyle: 'bold', fontFamily: 'Outfit'
                                                    }).setOrigin(0.5).setAlpha(0).setDepth(200);

                                                    this.tweens.add({
                                                        targets: waveTxt,
                                                        alpha: 1,
                                                        duration: 600,
                                                        yoyo: true,
                                                        hold: 800,
                                                        onComplete: () => {
                                                            waveTxt.destroy();

                                                            if (this._blackOverlay) {
                                                                this.tweens.add({
                                                                    targets: this._blackOverlay,
                                                                    alpha: 0,
                                                                    duration: 400,
                                                                    ease: 'Power2',
                                                                    onComplete: () => {
                                                                        this._blackOverlay.destroy();
                                                                        this._blackOverlay = null;

                                                                        const newTargetAlphas = [];
                                                                        this.enemies.forEach((enemy, idx) => {
                                                                            newTargetAlphas.push(enemy);
                                                                            if (this.enemyHUDs[idx] && this.enemyHUDs[idx].container) {
                                                                                newTargetAlphas.push(this.enemyHUDs[idx].container);
                                                                            }
                                                                        });
                                
                                                                        this.tweens.add({
                                                                            targets: newTargetAlphas,
                                                                            alpha: 1,
                                                                            duration: 1000,
                                                                            onComplete: () => {
                                                                                this._isWaveChanging = false;
                                                                                this._refreshEnemyHUD();
                                                                            }
                                                                        });
                                                                    }
                                                                });
                                                            }
                                                        }
                                                    });
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
                }

                if (delay >= 0) {
                    this.time.delayedCall(delay, resolve);
                }
            });
        }
        return waveChanged;
    }

    showFloatingDamage(target, value, isCrit, elementMultiplier, sourceElement) {
        if (!target) return;

        let color = '#ffffff';
        const el = (sourceElement || '').toLowerCase();
        if (el === 'fire') color = '#ff4747';
        else if (el === 'earth') color = '#ffeb3b';
        else if (el === 'wind') color = '#4caf50';

        const ox = Phaser.Math.Between(-20, 20);
        
        this._queueFloatingText(target, () => {
            let tx = target.x;
            let ty = target.y;
            let spriteH = 80;

            if (target.battleSprite) {
                tx = target.battleSprite.x;
                ty = target.battleSprite.y;
                spriteH = target.battleSprite.displayHeight || 80;
            } else if (target._spriteBaseX !== undefined && target._spriteBaseY !== undefined) {
                tx = target._spriteBaseX;
                ty = target._spriteBaseY;
            } else if (target.spriteObj) {
                tx = target.spriteObj.x;
                ty = target.spriteObj.y;
            }
            const headY = ty - (spriteH / 2) - 15;

            if (isCrit) {
                const container = this.add.container(tx + ox, headY).setDepth(200);

                const critLabel = this.add.text(0, -18, "CRITICAL", {
                    fontSize: "14px",
                    fontFamily: "Arial",
                    fontStyle: "bold",
                    color: "#ffeb3b",
                    stroke: "#000000",
                    strokeThickness: 3,
                    align: "left"
                }).setOrigin(0, 0.5);

                const dmgText = this.add.text(0, 6, `${value}`, {
                    fontSize: "28px",
                    fontFamily: "Arial",
                    fontStyle: "bold",
                    color: color,
                    stroke: "#000000",
                    strokeThickness: 4,
                    align: "left"
                }).setOrigin(0, 0.5);

                container.add([critLabel, dmgText]);

                this.tweens.add({
                    targets: container,
                    y: container.y - 50,
                    alpha: 0,
                    duration: Phaser.Math.Between(900, 1100),
                    ease: 'Power1',
                    onComplete: () => { container.destroy(); }
                });
                return;
            }

            let fontSize = '24px';
            let strokeThickness = 3;
            const mult = elementMultiplier !== undefined ? elementMultiplier : 1;
            if (mult > 1) {
                fontSize = '28px';
            } else if (mult < 1) {
                fontSize = '16px';
            }

            const floatText = this.add.text(tx + ox, headY, `${value}`, {
                fontSize: fontSize,
                fontFamily: 'Arial',
                fontStyle: 'bold',
                color: color,
                stroke: '#000000',
                strokeThickness: strokeThickness,
                align: 'center'
            }).setOrigin(0.5).setDepth(200);

            this.tweens.add({
                targets: floatText,
                y: floatText.y - 50,
                alpha: 0,
                duration: Phaser.Math.Between(800, 1000),
                ease: 'Power1',
                onComplete: () => { floatText.destroy(); }
            });
        });
    }

    showFloatingHeal(target, value) {
        if (!target) return;

        const ox = Phaser.Math.Between(-20, 20);

        this._queueFloatingText(target, () => {
            let tx = target.x;
            let ty = target.y;
            let spriteH = 80;

            if (target.battleSprite) {
                tx = target.battleSprite.x;
                ty = target.battleSprite.y;
                spriteH = target.battleSprite.displayHeight || 80;
            } else if (target._spriteBaseX !== undefined && target._spriteBaseY !== undefined) {
                tx = target._spriteBaseX;
                ty = target._spriteBaseY;
            } else if (target.spriteObj) {
                tx = target.spriteObj.x;
                ty = target.spriteObj.y;
            }
            const headY = ty - (spriteH / 2) - 15;

            const floatText = this.add.text(tx + ox, headY, `+${value}`, {
                fontSize: '26px',
                fontFamily: 'Arial',
                fontStyle: 'bold',
                color: '#00e676',
                stroke: '#000000',
                strokeThickness: 3,
                align: 'center'
            }).setOrigin(0.5).setDepth(200);

            this.tweens.add({
                targets: floatText,
                y: floatText.y - 50,
                alpha: 0,
                duration: Phaser.Math.Between(800, 1000),
                ease: 'Power1',
                onComplete: () => { floatText.destroy(); }
            });
        });
    }

    async playerAttack() {
        const alive = this.players.filter(p => p.hp > 0);
        if (!alive.length) return;

        let allValid = true;
        let missingSelection = false;
        const character_actions = [];

        for (const p of alive) {
            if (p.isAuto && p.queuedAction.type === 'none') {
                const saRdy = p.specialBar >= p.specialMax;
                p.queuedAction = { type: saRdy ? 'special_attack' : 'basic_attack' };
            }

            if (p.queuedAction.type === 'none') {
                missingSelection = true;
                allValid = false;
            } else {
                let target_index = this.selectedTargetIndex !== -1 ? this.selectedTargetIndex : 0;
                character_actions.push({
                    slot: p.slot,
                    action_type: p.queuedAction.type,
                    skill_id: p.queuedAction.skill_id || null,
                    target_index: target_index
                });
            }
        }

        if (missingSelection) {
            this.showLog("Select action for all characters!", 'system');
            return;
        }

        this.setTurn("attacking");
        this.closeActionWindow();

        await new Promise(r => setTimeout(r, 500));

        try {
            const res = await BattleApi.processTurnBatch(this.bsId, character_actions);
            if (res.status === 'success') {
                await this._playActionEvents(res.data.events);
                this._syncState(res.data.stateSnapshot);
            }
        } catch (err) {
            console.error("Action error", err);
        }

        for (const p of alive) {
            p.queuedAction = { type: 'none' };
            p.updateActionBadge();
        }

        if (this.enemies.every(e => e.hp <= 0)) {
            this.checkVictory();
            return;
        }

        this.setTurn("player");
    }

    _syncState(state) {
        if (!state) return;

        // Sync Turn & Wave
        if (state.current_wave_index !== undefined) {
            this.currentWave = state.current_wave_index + 1;
        } else if (state.wave !== undefined) {
            this.currentWave = state.wave;
        }
        
        if (state.current_turn !== undefined) {
            this.currentTurn = state.current_turn;
            this._updateTurnText(); // Akan mengupdate Turn Text dan Wave Text dengan benar
        }

        // [Fix Bug #2] Sync Aether Gauge dari server snapshot
        // Server mengelola state.aether_gauge sepenuhnya (SA gain, Burst consume, dll.)
        if (state.aether_gauge !== undefined) {
            this.aetherGauge = state.aether_gauge;
            this._refreshAetherUI();
        }

        // [Fix Bug #3] Sync Heal counters dari server snapshot agar tidak desync
        if (state.heals_remaining !== undefined) {
            this.healsRemaining = state.heals_remaining;
            this._refreshHealButtonUI();
        }
        if (state.potions_used !== undefined) this.potionsUsed = state.potions_used;

        // Sync Players
        if (state.player_party && state.player_party.characters) {
            state.player_party.characters.forEach(pd => {
                const pObj = this.players.find(p => p.slot === pd.slot || p.id === pd.id);
                if (pObj) {
                    pObj.hp = pd.current_hp !== undefined ? pd.current_hp : pObj.hp;
                    if (pd.current_sa !== undefined) pObj.specialBar = pd.current_sa;
                    
                    if (pd.skills) {
                        pObj.cooldowns = {};
                        pd.skills.forEach(sk => {
                            if (sk.current_cooldown !== undefined && sk.current_cooldown > 0) {
                                pObj.cooldowns[sk.id] = sk.current_cooldown;
                            }
                        });
                    }

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

                const startX = 130;
                const totalE = state.enemies.length;
                const startY = 287.5 - ((totalE - 1) * 40);
                state.enemies.forEach((eData, i) => {
                    const ex = startX - (i * 35);
                    const ey = startY + (i * 80);
                    const enemy = new Enemy(this, ex, ey, eData);
                    enemy.index = i;
                    enemy.setDepth(5 + i);

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

                this._buildEnemyHUD(this._isWaveChanging);
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
        if (this._isVictoryConfirmed) return true;

        if (this.enemies.every(e => e.hp <= 0)) {
            this._isVictoryConfirmed = true;
            this.turn = "none";
            
            // Play monster defeated roar while BGM is still playing
            this.playSFX('sfx_monsterDefeated', { volume: 0.8 });

            // FADE OUT ENEMIES FIRST
            const fadeTargets = [];
            this.enemies.forEach((enemy, idx) => {
                fadeTargets.push(enemy);
                if (this.enemyHUDs[idx] && this.enemyHUDs[idx].container) {
                    fadeTargets.push(this.enemyHUDs[idx].container);
                }
            });

            if (fadeTargets.length > 0) {
                this.tweens.add({
                    targets: fadeTargets,
                    alpha: 0,
                    duration: 1000,
                    ease: 'Sine.easeInOut',
                    onComplete: () => this._triggerVictoryTransition()
                });
            } else {
                this._triggerVictoryTransition();
            }

            return true;
        }
        return false;
    }

    _triggerVictoryTransition() {
        // Stop Battle BGM only when fade-out finishes and VICTORY appears
        stopGlobalBGM();
        
        // Play victory BGM
        playGlobalBGM(this, 'bgm_victory');
        
        this._showCenterAnim("VICTORY!", "#ffeb3b");
        this.time.delayedCall(1500, () => {
            this.scene.pause();
            this.scene.launch('VictoryScene', {
                questId: this.questId,
                playerId: this.playerId,
                potionsUsed: this.potionsUsed,
                fullPotionsUsed: this.fullPotionsUsed,
                bsId: this.bsId
            });
        });
    }

    triggerDefeat(isRetreat = false) {
        this.turn = "none";

        if (isRetreat) {
            this._showCenterAnim("RETREATED", "#aaaaaa");
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
                this._showCenterAnim("DEFEAT... 💀", "#e74c3c");
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
            this._showCenterAnim("DEFEAT... 💀", "#e74c3c");
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
                        // [Fix Minor #3] Key yang benar adalah stateSnapshot, bukan state
                        if (res.data.stateSnapshot) this._syncState(res.data.stateSnapshot);
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
    
    _showStatusModal(entity) {
        if (!entity || entity.hp <= 0) return;
        
        const modalContainer = this.add.container(0, 0).setDepth(150);

        const cover = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.7).setInteractive();
        cover.on("pointerdown", (pointer, x, y, event) => {
            event.stopPropagation();
        });
        modalContainer.add(cover);

        const windowBg = this.add.rectangle(CX, H / 2, 380, 400, 0x0d1b2a);
        windowBg.setStrokeStyle(2, 0xe74c3c);
        modalContainer.add(windowBg);

        const title = this.add.text(CX, H / 2 - 170, `${entity.charName} - STATUS`, { fontSize: "16px", color: "#e74c3c", fontStyle: "bold" }).setOrigin(0.5);
        modalContainer.add(title);

        let currentY = H / 2 - 130;
        
        const visibleEffects = entity.activeEffects || [];
        if (visibleEffects.length === 0) {
            const noEffectTxt = this.add.text(CX, currentY + 50, "No Active Status Effects", { fontSize: "13px", color: "#aaaaaa", fontStyle: "italic" }).setOrigin(0.5);
            modalContainer.add(noEffectTxt);
        } else {
            visibleEffects.forEach((e) => {
                const isBuff = (e.effect_type || '').toLowerCase() === 'buff';
                const color = isBuff ? '#f1c40f' : '#7ec8e3'; 

                let emoji = '❓';
                const stat = (e.target_stat || '').toUpperCase();
                if (stat === 'ATK') emoji = '⚔️';
                else if (stat === 'DEF') emoji = '🛡️';
                else if (stat === 'CRIT') emoji = '✨';
                else if (stat === 'STUN') emoji = '💫';
                else if (stat === 'POISON') emoji = '🤢';
                else if (stat === 'BURN') emoji = '🔥';
                else if (stat === 'HP') emoji = '💚';
                else if (stat === 'AGI') emoji = '💨';

                const effectName = e.effect_name || e.target_stat;
                const dur = e.duration || e.mse_duration || 0;
                const durText = dur > 0 ? `(${dur} Turns)` : "(Permanent)";
                const valueText = e.value ? `Value: ${Math.floor(e.value * 100)}%` : "";
                
                const box = this.add.rectangle(CX, currentY, 340, 40, 0x111111).setStrokeStyle(1, 0x333333);
                const emojiTxt = this.add.text(CX - 150, currentY, emoji, { fontSize: "16px" }).setOrigin(0.5);
                const nameTxt = this.add.text(CX - 120, currentY, `${effectName} ${durText}`, { fontSize: "12px", color: color, fontStyle: "bold" }).setOrigin(0, 0.5);
                const valTxt = this.add.text(CX + 150, currentY, valueText, { fontSize: "11px", color: "#aaaaaa" }).setOrigin(1, 0.5);
                
                modalContainer.add([box, emojiTxt, nameTxt, valTxt]);
                currentY += 45;
            });
        }
        
        const closeBtn = this.add.rectangle(CX, H / 2 + 160, 100, 30, 0x2a0d0d).setStrokeStyle(1.5, 0xe74c3c).setInteractive({ useHandCursor: true });
        const closeText = this.add.text(CX, H / 2 + 160, "CLOSE", { fontSize: "11px", color: "#ff8a80", fontStyle: "bold" }).setOrigin(0.5);
        modalContainer.add([closeBtn, closeText]);

        closeBtn.on("pointerover", () => closeBtn.setFillStyle(0x401515));
        closeBtn.on("pointerout", () => closeBtn.setFillStyle(0x2a0d0d));
        closeBtn.on("pointerdown", () => modalContainer.destroy());
    }

    // ===== VFX SYSTEM =====

    /** Initialize all VFX animations from the manifest (called once in create phase) */
    _initVfxAnims() {
        // Exact VFX animations
        for (const [key, data] of Object.entries(vfxManifest.exact)) {
            if (this.anims.exists(`anim_${key}`)) continue;
            this.anims.create({
                key: `anim_${key}`,
                frames: this.anims.generateFrameNumbers(key, { start: 0, end: data.totalFrames - 1 }),
                frameRate: 24,
                repeat: 0
            });
        }
        // Rolling VFX animations
        for (const [category, items] of Object.entries(vfxManifest.rolling)) {
            items.forEach(item => {
                if (this.anims.exists(`anim_${item.key}`)) return;
                this.anims.create({
                    key: `anim_${item.key}`,
                    frames: this.anims.generateFrameNumbers(item.key, { start: 0, end: item.totalFrames - 1 }),
                    frameRate: 24,
                    repeat: 0
                });
            });
        }
    }

    /**
     * Get the target position for VFX placement.
     * Returns { x, y } centered on the target's battle sprite.
     */
    _getVfxTargetPos(target) {
        let tx = target.x || CX;
        let ty = target.y || H / 2;
        if (target.battleSprite) {
            tx = target.battleSprite.x;
            ty = target.battleSprite.y;
        } else if (target._spriteBaseX !== undefined && target._spriteBaseY !== undefined) {
            tx = target._spriteBaseX;
            ty = target._spriteBaseY;
        } else if (target.spriteObj) {
            tx = target.spriteObj.x;
            ty = target.spriteObj.y;
        }
        return { x: tx, y: ty };
    }

    /**
     * Play a Rolling VFX (random selection from element skill pool).
     * Used for: Skill, Special Attack (player), Charge Attack (monster).
     * @param {string} element - 'Fire', 'Wind', or 'Earth'
     * @param {number} targetX
     * @param {number} targetY
     * @param {number} [scale=1.5] - Scale multiplier for the VFX sprite
     */
    playRollingVFX(element, targetX, targetY, scale = 1.5) {
        const el = (element || '').toLowerCase();
        let categoryKey = 'skillFire';
        if (el === 'wind') categoryKey = 'skillWind';
        else if (el === 'earth') categoryKey = 'skillEarth';

        const pool = vfxManifest.rolling[categoryKey];
        if (!pool || pool.length === 0) return;

        // Random selection from pool
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        const animKey = `anim_${chosen.key}`;

        if (!this.anims.exists(animKey)) return;

        const vfx = this.add.sprite(targetX, targetY, chosen.key);
        vfx.setDepth(50);
        vfx.setScale(scale);
        vfx.setBlendMode(Phaser.BlendModes.ADD);
        vfx.play(animKey);
        vfx.on('animationcomplete', () => { vfx.destroy(); });
    }

    /**
     * Play an Exact VFX (specific single-file spritesheet).
     * Used for: Basic Attack, Heal, Buff, Debuff, DoT, Stun, etc.
     * @param {string} key - Manifest key (e.g., 'charBasicAtk', 'buff', 'heal', 'poison')
     * @param {number} targetX
     * @param {number} targetY
     * @param {object} [opts={}] - Optional overrides { scale, useAddBlend, depth }
     */
    playExactVFX(key, targetX, targetY, opts = {}) {
        const data = vfxManifest.exact[key];
        if (!data) return;

        const animKey = `anim_${key}`;
        if (!this.anims.exists(animKey)) return;

        const scale = opts.scale !== undefined ? opts.scale : 1.5;
        const depth = opts.depth !== undefined ? opts.depth : 50;
        const useAddBlend = opts.useAddBlend !== undefined ? opts.useAddBlend : false;

        const vfx = this.add.sprite(targetX, targetY, key);
        vfx.setDepth(depth);
        vfx.setScale(scale);
        if (useAddBlend) {
            vfx.setBlendMode(Phaser.BlendModes.ADD);
        }
        vfx.play(animKey);
        vfx.on('animationcomplete', () => { vfx.destroy(); });
    }
}
