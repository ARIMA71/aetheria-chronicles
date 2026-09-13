import Player from "../entities/player";
import Enemy from "../entities/enemy";
import { THEME } from "../main.js";
import { checkSession, saveCurrentScene, getPlayerUsername } from "../utils/auth.js";
import BattleApi from "../services/BattleApi.js";
import BattleMenu from "../ui/BattleMenu.js";
import { playGlobalBGM, stopGlobalBGM, playSFX } from "../utils/audioManager.js";
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
        this.load.image('bg_battle', 'assets/backgrounds/battleScene.jpg');

        // --- Player HUD UI Assets ---
        this.load.image('bg_card_x5', 'assets/ui/card/Card X5.png');
        this.load.image('bg_card_x10', 'assets/ui/card/Card X10.png');
        this.load.image('bg_card_x12', 'assets/ui/card/Card X12.png');
        this.load.image('bg_card_x100', 'assets/ui/card/Card X100.png');
        this.load.image('bg_card_x101', 'assets/ui/card/Card X101.png');
        this.load.image('progressbar_bg', 'assets/ui/progressBar/ProgressBar Background.png');
        this.load.image('progressbar_fg', 'assets/ui/progressBar/ProgressBarForeground.png');

        this.load.image('btn_a_normal', 'assets/ui/button/A/Normal.png');
        this.load.image('btn_a_hover', 'assets/ui/button/A/Hover.png');
        this.load.image('btn_a_active', 'assets/ui/button/A/Active.png');
        this.load.image('btn_a_disabled', 'assets/ui/button/A/Disabled.png');

        this.load.image('btn_b_normal', 'assets/ui/button/B/Button Normal 1.png');
        this.load.image('btn_b_hover', 'assets/ui/button/B/Button Hover 1.png');
        this.load.image('btn_b_active', 'assets/ui/button/B/Button Active 1.png');
        this.load.image('btn_b_disabled', 'assets/ui/button/B/Button Disabled 1.png');

        this.load.image('btn_c_normal', 'assets/ui/button/C/Icon Button.png');
        this.load.image('btn_c_hover', 'assets/ui/button/C/Icon Button Hover.png');
        this.load.image('btn_close_normal', 'assets/ui/button/C/Icon Button Close.png');
        this.load.image('btn_close_hover', 'assets/ui/button/C/Icon Button Close Hover.png');

        this.load.image('btn_d_normal', 'assets/ui/button/D/Button Normal.png');
        this.load.image('btn_d_hover', 'assets/ui/button/D/Button Hover.png');
        this.load.image('btn_d_active', 'assets/ui/button/D/Button Active.png');
        this.load.image('btn_d_disabled', 'assets/ui/button/D/Button Disabled.png');

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

        // --- Preload Battle SFX ---
        const battleSfxList = [
            { key: 'sfx_charBasicAtk', url: 'assets/audio/sfx/charBasicAtk.mp3' },
            { key: 'sfx_charSkillAtk', url: 'assets/audio/sfx/charSkillAtk.wav' },
            { key: 'sfx_charSpecialAttack', url: 'assets/audio/sfx/charSpecialAttack.mp3' },
            { key: 'sfx_heal', url: 'assets/audio/sfx/heal.mp3' },
            { key: 'sfx_buff', url: 'assets/audio/sfx/buff.mp3' },
            { key: 'sfx_debuff', url: 'assets/audio/sfx/debuff.mp3' },
            { key: 'sfx_monsBasicAtk', url: 'assets/audio/sfx/monsBasicAtk.mp3' },
            { key: 'sfx_monsChargeAttack', url: 'assets/audio/sfx/monsChargeAttack.mp3' },
            { key: 'sfx_monsEnraged', url: 'assets/audio/sfx/monsEnraged.wav' },
            { key: 'sfx_monsExhausted', url: 'assets/audio/sfx/monsExhausted.wav' },
            { key: 'sfx_monsterDefeated', url: 'assets/audio/sfx/monsterDefeated.mp3' },
            { key: 'sfx_battleReady', url: 'assets/audio/sfx/battleReady.mp3' },
            { key: 'sfx_battleStart', url: 'assets/audio/sfx/battleStart.mp3' },
            { key: 'sfx_revive', url: 'assets/audio/sfx/revive.mp3' },
            { key: 'sfx_stunned', url: 'assets/audio/sfx/stunned.mp3' },
            { key: 'sfx_aetherBurst', url: 'assets/audio/sfx/aetherBurst.wav' },
            { key: 'sfx_chainBurst', url: 'assets/audio/sfx/chainBurst.wav' }
        ];
        battleSfxList.forEach(sfx => {
            if (!this.cache.audio.exists(sfx.key)) {
                this.load.audio(sfx.key, sfx.url);
            }
        });
    }

    setTurn(newTurn) {
        this.turn = newTurn;
        if (this._attackBtnContainer) {
            this._attackBtnContainer.setVisible(newTurn === "player");
        }
        if (this._globalAutoBtnContainer) {
            this._globalAutoBtnContainer.setVisible(newTurn === "player");
        }

        if (newTurn === "player") {
            this._checkAndHandleStunnedParty();
        }
    }

    _checkAndHandleStunnedParty() {
        if (!this.players || !this.players.length) return;
        const alive = this.players.filter(p => p.hp > 0);
        if (!alive.length) return;

        let stunnedCount = 0;
        alive.forEach(p => {
            if (p.isStunned) {
                stunnedCount++;
                if (p.queuedAction.type === 'none') {
                    p.queuedAction = { type: 'basic_attack' };
                }
                p.updateActionBadge();
            }
        });

        if (stunnedCount > 0) {
            if (stunnedCount === alive.length) {
                this.showLog("💫 Semua karakter ter-STUN! Tekan ATTACK untuk skip turn.", 'system');
            } else {
                this.showLog(`💫 ${stunnedCount} karakter ter-STUN! Turn karakter tersebut akan ter-skip.`, 'system');
            }
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

        const bg = this.add.image(CX, H / 2, 'bg_battle').setOrigin(0.5);
        const scale = Math.max(W / bg.width, H / bg.height);
        bg.setScale(scale);
        if (this.textures.exists('bg_card_x5')) {
            this.topHudBg = this.add.image(CX, -286, 'bg_card_x5').setDisplaySize(530, 740).setDepth(10);
            this.topHudBg.setTint(0x38bdf8);
        } else {
            this.topHudBg = this.add.rectangle(CX, 26, W + 40, 52, 0x0F192E, 1.0).setDepth(10);
            this.topHudLine = this.add.rectangle(CX, 52, W + 40, 3, 0x38BDF8).setDepth(10);
        }

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

        // Initialize wave counter & victory flags
        this.totalWaves = j.data.waves ? j.data.waves.length : 1;
        this.currentWave = 1;
        this.currentTurn = 1;
        this.aetherGauge = 0;
        this._isVictoryConfirmed = false;
        this._isVictoryTransitionStarted = false;
        this._victoryLaunched = false;

        let assetsToLoad = 0;
        const chars = j.data.player_party.characters.slice(0, 4);

        chars.forEach(d => {
            const keyId = d.mc_id || d.id || d.slot;
            const checkAndLoad = (key, path) => {
                if (!path) return;
                let fullPath = path;
                if (!fullPath.endsWith('.png') && !fullPath.endsWith('.jpg')) fullPath += '.png';
                if (this.textures.exists(key)) {
                    const tex = this.textures.get(key);
                    const src = tex && tex.source && tex.source[0] && tex.source[0].src ? tex.source[0].src : '';
                    const decodedSrc = decodeURIComponent(src);
                    if (decodedSrc && !decodedSrc.includes(fullPath) && !decodedSrc.endsWith(fullPath)) {
                        this.textures.remove(key);
                    }
                }
                if (!this.textures.exists(key)) {
                    this.load.image(key, fullPath);
                    assetsToLoad++;
                }
            };
            checkAndLoad(`sprite_${keyId}`, d.sprite_path);
            checkAndLoad(`portrait_${keyId}`, d.portrait_path);
            checkAndLoad(`portrait_full_${keyId}`, d.splash_path);
        });
        const allEnemies = j.data.waves ? j.data.waves.flat() : (j.data.enemies || []);
        allEnemies.forEach(e => {
            const monsId = e.id || e.monster_id;
            const elemKey = e.element ? e.element.toLowerCase() : 'def';
            const spriteKey = `mons_${monsId}_${elemKey}`;
            const baseSpriteKey = `mons_${monsId}`;
            const iconKey = `mons_icon_${monsId}`;

            if (e.sprite_path) {
                if (!this.textures.exists(spriteKey)) {
                    this.load.image(spriteKey, e.sprite_path);
                    assetsToLoad++;
                }
                if (!this.textures.exists(baseSpriteKey)) {
                    this.load.image(baseSpriteKey, e.sprite_path);
                    assetsToLoad++;
                }
            }
            if (e.icon_path && !this.textures.exists(iconKey)) {
                this.load.image(iconKey, e.icon_path);
                assetsToLoad++;
            }
        });

        if (!this._blackOverlay) {
            this._blackOverlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.95).setDepth(190);
        }

        if (assetsToLoad > 0) {
            let loaded = false;
            const finishLoad = () => {
                if (loaded) return;
                loaded = true;
                this.load.off('complete', finishLoad);
                this.load.off('loaderror', finishLoad);
                this._renderProcessBattleData(j, chars);
            };
            this.load.once('complete', finishLoad);
            this.load.once('loaderror', finishLoad);
            this.time.delayedCall(2000, finishLoad);
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
            p.setDepth(5);
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
                p.refreshVisual();
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
            enemy._baseX = ex;
            enemy._baseY = ey;
            enemy.setDepth(5 + i);
            this.enemies.push(enemy);
        });
        this.selectedTargetIndex = -1;
        this._setupUI();
    }

    playSFX(key, config = { volume: 0.8 }) {
        playSFX(this, key, config);
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
        this.healsRemaining = state.heals_remaining !== undefined ? state.heals_remaining : (this.potionCount > 0 ? Math.min(3, this.potionCount) : 3);
        this.fullPotionCount = state.full_potion_count !== undefined ? state.full_potion_count : 0;
        this.potionsUsed = state.potions_used || 0;
        this.fullPotionsUsed = state.full_potions_used || 0;

        // Restore turn counter & victory flags
        this.currentTurn = state.current_turn || 1;
        this.aetherGauge = state.aether_gauge || 0;
        this._isVictoryConfirmed = false;
        this._isVictoryTransitionStarted = false;
        this._victoryLaunched = false;

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
            const checkAndLoad = (key, path) => {
                if (!path) return;
                let fullPath = path;
                if (!fullPath.endsWith('.png') && !fullPath.endsWith('.jpg')) fullPath += '.png';
                if (this.textures.exists(key)) {
                    const tex = this.textures.get(key);
                    const src = tex && tex.source && tex.source[0] && tex.source[0].src ? tex.source[0].src : '';
                    const decodedSrc = decodeURIComponent(src);
                    if (decodedSrc && !decodedSrc.includes(fullPath) && !decodedSrc.endsWith(fullPath)) {
                        this.textures.remove(key);
                    }
                }
                if (!this.textures.exists(key)) {
                    this.load.image(key, fullPath);
                    assetsToLoad++;
                }
            };
            checkAndLoad(`sprite_${keyId}`, d.sprite_path);
            checkAndLoad(`portrait_${keyId}`, d.portrait_path);
            checkAndLoad(`portrait_full_${keyId}`, d.splash_path);
        });
        const allEnemies = state.waves ? state.waves.flat() : (state.enemies || []);
        allEnemies.forEach(e => {
            const monsId = e.id || e.monster_id;
            const elemKey = e.element ? e.element.toLowerCase() : 'def';
            const spriteKey = `mons_${monsId}_${elemKey}`;
            const baseSpriteKey = `mons_${monsId}`;
            const iconKey = `mons_icon_${monsId}`;

            if (e.sprite_path) {
                if (!this.textures.exists(spriteKey)) {
                    this.load.image(spriteKey, e.sprite_path);
                    assetsToLoad++;
                }
                if (!this.textures.exists(baseSpriteKey)) {
                    this.load.image(baseSpriteKey, e.sprite_path);
                    assetsToLoad++;
                }
            }
            if (e.icon_path && !this.textures.exists(iconKey)) {
                this.load.image(iconKey, e.icon_path);
                assetsToLoad++;
            }
        });

        if (!this._blackOverlay) {
            this._blackOverlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.95).setDepth(190);
        }

        if (assetsToLoad > 0) {
            let loaded = false;
            const finishLoad = () => {
                if (loaded) return;
                loaded = true;
                this.load.off('complete', finishLoad);
                this.load.off('loaderror', finishLoad);
                this._renderResumeBattle(state, chars);
            };
            this.load.once('complete', finishLoad);
            this.load.once('loaderror', finishLoad);
            this.time.delayedCall(2000, finishLoad);
            this.load.start();
        } else {
            this._renderResumeBattle(state, chars);
        }
    }

    _renderResumeBattle(state, chars) {
        // Initialize VFX Animations from manifest (essential for resume path)
        this._initVfxAnims();

        // Draw battlefield floor line
        this.add.rectangle(CX, 535, W, 1, THEME.BORDER);

        const cW = 85, gap = 15, total = chars.length, totalW = total * cW + (total - 1) * gap, sx = (W - totalW) / 2 + cW / 2;
        chars.forEach((d, i) => {
            const px = sx + i * (cW + gap);
            const p = new Player(this, px, 625, d);
            p._baseX = px;
            p.setDepth(5);

            // Inject runtime state dari resume data
            if (d.current_hp !== undefined) p.hp = d.current_hp;
            if (d.current_sa !== undefined) p.specialBar = d.current_sa;
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
                p.refreshVisual();
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
            enemy._baseX = ex;
            enemy._baseY = ey;
            enemy.setDepth(5 + i);

            // Visuals handled internally by Enemy container
            if (eData.current_hp !== undefined) enemy.hp = eData.current_hp;
            if (eData.current_ca !== undefined) enemy.caBar = eData.current_ca;
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

        // Check if victory was already achieved before refresh/resume
        if (this.enemies.length > 0 && this.enemies.every(e => e.hp <= 0)) {
            this.checkVictory();
        }
    }
    _setActive(p) {
        if (this.activePlayer && this.activePlayer !== p) this.activePlayer.setHighlight(false);
        this.activePlayer = p;
        if (p) p.setHighlight(true);
    }
    _tapPortrait(p) {
        if (p.isStunned) {
            this.showLog(`💫 ${p.charName} sedang STUN! Turn akan ter-skip otomatis.`);
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
        this.turnText = this.add.text(20, 26, "TURN 1", {
            fontSize: "13px", color: THEME.TEXT_PRIMARY, fontStyle: "bold",
            stroke: "#38bdf8", strokeThickness: 2
        }).setOrigin(0, 0.5).setDepth(11);

        const timeX = this.totalWaves > 1 ? 300 : CX;

        if (this.totalWaves > 1) {
            this.waveText = this.add.text(160, 26, `WAVE ${this.currentWave}/${this.totalWaves}`, {
                fontSize: "13px", color: THEME.TEXT_PRIMARY, fontStyle: "bold", align: "center",
                stroke: "#38bdf8", strokeThickness: 2
            }).setOrigin(0.5, 0.5).setDepth(11);
        }

        this.timerText = this.add.text(timeX, 26, "44:59", {
            fontSize: "18px", color: THEME.TEXT_PRIMARY, fontStyle: "bold",
            stroke: "#38bdf8", strokeThickness: 2
        }).setOrigin(0.5, 0.5).setDepth(11);

        const mb = this.add.rectangle(435, 26, 50, 34, 0x0F192E, 1.0).setInteractive().setDepth(11);
        mb.setStrokeStyle(1.5, 0x38BDF8);
        this.add.text(435, 26, "☰", {
            fontSize: "18px", color: THEME.TEXT_PRIMARY,
            stroke: "#38bdf8", strokeThickness: 2
        }).setOrigin(0.5).setDepth(11);
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
            const hudBaseY = 88 + (index * 45);
            const ec = this._elemColor(enemy.element);

            const icon = this.add.rectangle(56, hudBaseY + 9, 44, 44, THEME.PANEL).setStrokeStyle(2, ec);

            const monsId = enemy.monsterId || enemy.id;
            const iconTexKey = `mons_icon_${monsId}`;
            let elemText = null;

            if (this.textures.exists(iconTexKey)) {
                elemText = this.add.image(56, hudBaseY + 9, iconTexKey).setDisplaySize(40, 40);
            } else {
                elemText = this.add.text(56, hudBaseY + 9, enemy.element ? enemy.element.substring(0, 2).toUpperCase() : '??', { fontSize: "16px", fontStyle: "bold", color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
            }
            const hpPct = this.add.text(83, hudBaseY - 2, "100%", { fontSize: "14px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0, 1);

            const hpBarBg = this.add.rectangle(83, hudBaseY + 4, 360, 12, THEME.BG).setOrigin(0, 0.5).setStrokeStyle(2, THEME.BORDER);
            const hpFill = this.add.rectangle(83, hudBaseY + 4, 356, 10, THEME.DAMAGE).setOrigin(0, 0.5);
            const hpEnrage = this.add.rectangle(83, hudBaseY + 4, 360, 12, 0, 0).setOrigin(0, 0.5).setAlpha(0);

            const effectIndicators = this.add.container(123, hudBaseY - 10);

            const hitArea = this.add.rectangle(83, hudBaseY + 4, 360, 24, 0x000000, 0).setOrigin(0, 0.5);
            hitArea.setInteractive({ useHandCursor: true });
            hitArea.on('pointerdown', () => this._showStatusModal(enemy));


            const modeBarBg = this.add.rectangle(83, hudBaseY + 14, 360, 4, THEME.BG).setOrigin(0, 0.5).setStrokeStyle(1, THEME.BORDER);
            const modeFill = this.add.rectangle(83, hudBaseY + 14, 0, 4, 0xffffff).setOrigin(0, 0.5);

            if (!enemy.isBoss) {
                hpEnrage.setVisible(false);
                modeBarBg.setVisible(false);
                modeFill.setVisible(false);
            }

            const caSegmentsBg = [];
            const caSegments = [];
            for (let i = 0; i < enemy.caMax; i++) {
                const bg = this.add.rectangle(83 + i * 14, hudBaseY + 26, 10, 10, THEME.BG).setOrigin(0, 0.5).setStrokeStyle(1, THEME.BORDER);
                const f = this.add.rectangle(83 + i * 14, hudBaseY + 26, 8, 8, THEME.GOLD).setOrigin(0, 0.5).setAlpha(0);
                caSegmentsBg.push(bg);
                caSegments.push(f);
            }

            const baseX = enemy._baseX !== undefined ? enemy._baseX : enemy.x;
            const enemyBaseY = enemy._baseY !== undefined ? enemy._baseY : enemy.y;

            let spriteH = 130;
            if (enemy.battleSprite && enemy.battleSprite.displayHeight) {
                spriteH = enemy.battleSprite.displayHeight;
            } else if (enemy._body && enemy._body.displayHeight) {
                spriteH = enemy._body.displayHeight;
            }

            const nameY = enemyBaseY + (spriteH / 2) + 12;
            const nameText = this.add.text(baseX, nameY, `${enemy.charName}\nLv.${enemy.level}`, {
                fontSize: "12px",
                color: "#ffffff",
                fontStyle: "bold",
                fontFamily: "Outfit, Arial, sans-serif",
                align: "center",
                stroke: "#000000",
                strokeThickness: 3,
                lineSpacing: 1
            }).setOrigin(0.5, 0);

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
                hud.effectIndicators.setX(83 + hud.hpPct.width + 6);
                hud.effectIndicators.removeAll(true);
                const visibleEffects = enemy.activeEffects || [];
                const sups = { 0: '', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
                visibleEffects.forEach((e, idx) => {
                    const isBuff = (e.effect_type || '').toLowerCase() === 'buff';
                    const color = isBuff ? '#ef4444' : '#38bdf8';

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
                        idx * 22, 0, label,
                        { fontSize: '13px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }
                    ).setOrigin(0, 0.5);

                    hud.effectIndicators.add(txt);
                });
            }

            if (hud.nameText) {
                hud.nameText.setText(enemy.charName + " \nLv." + enemy.level);
                const baseX = enemy._baseX !== undefined ? enemy._baseX : enemy.x;
                const baseY = enemy._baseY !== undefined ? enemy._baseY : enemy.y;

                let spriteH = 130;
                if (enemy.battleSprite && enemy.battleSprite.displayHeight) {
                    spriteH = enemy.battleSprite.displayHeight;
                } else if (enemy._body && enemy._body.displayHeight) {
                    spriteH = enemy._body.displayHeight;
                }

                const nameY = baseY + (spriteH / 2) + 12;
                hud.nameText.setPosition(baseX, nameY);
                if (enemy.hp <= 0) hud.nameText.setAlpha(0.3);
            }
            if (hud.icon) {
                hud.icon.setStrokeStyle(2, this._elemColor(enemy.element));
                if (hud.elemText && typeof hud.elemText.setText === 'function') {
                    hud.elemText.setText(enemy.element ? enemy.element.substring(0, 2).toUpperCase() : '??');
                }
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
    _createBtnCanvasTexture(key, w, h, r, topCol, botCol, borderCol) {
        if (this.textures.exists(key)) this.textures.remove(key);
        const canvas = this.textures.createCanvas(key, w, h);
        const ctx = canvas.context;

        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, topCol);
        grad.addColorStop(1, botCol);

        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(w - r, 0);
        ctx.quadraticCurveTo(w, 0, w, r);
        ctx.lineTo(w, h - r);
        ctx.quadraticCurveTo(w, h, w - r, h);
        ctx.lineTo(r, h);
        ctx.quadraticCurveTo(0, h, 0, h - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();

        ctx.fillStyle = grad;
        ctx.fill();

        if (borderCol) {
            ctx.lineWidth = 2;
            ctx.strokeStyle = borderCol;
            ctx.stroke();
        }

        canvas.refresh();
    }

    _buildArenaButtons() {
        this._attackBtnContainer = this.add.container(0, 0);

        const atkW = 124;
        const atkH = 44;
        const atkX = 405;
        const atkY = 495;

        // Generate seamless 2D Canvas gradient textures (avoids Phaser WebGL diagonal triangle seam)
        this._createBtnCanvasTexture('gen_btn_atk_norm', atkW, atkH, 8, '#ef4444', '#991b1b', '#fca5a5');
        this._createBtnCanvasTexture('gen_btn_atk_hover', atkW, atkH, 8, '#f87171', '#b91c1c', '#ffedd5');
        this._createBtnCanvasTexture('gen_btn_atk_down', atkW, atkH, 8, '#991b1b', '#7f1d1d', '#fca5a5');

        const atkImg = this.add.image(atkX, atkY, 'gen_btn_atk_norm').setDepth(10);
        const atkHitZone = this.add.rectangle(atkX, atkY, atkW, atkH, 0x000000, 0).setDepth(10).setInteractive({ useHandCursor: true });
        const text = this.add.text(atkX, atkY, "ATTACK ⚔", {
            fontSize: "15px",
            color: "#ffffff",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif",
            stroke: "#000000",
            strokeThickness: 3,
            align: "center"
        }).setOrigin(0.5).setDepth(11);

        this._attackBtnContainer.add([atkImg, atkHitZone, text]);

        atkHitZone.on("pointerover", () => atkImg.setTexture('gen_btn_atk_hover'));
        atkHitZone.on("pointerout", () => atkImg.setTexture('gen_btn_atk_norm'));
        atkHitZone.on("pointerdown", () => {
            atkImg.setTexture('gen_btn_atk_down');
            if (this.turn === "player" && !this.attackBtnLocked) this.playerAttack();
        });
        atkHitZone.on("pointerup", () => atkImg.setTexture('gen_btn_atk_norm'));

        this._attackBtnContainer.setVisible(this.turn === "player");

        // GLOBAL AUTO BUTTON (Same Button A texture model as BACK button in action window)
        this.globalAutoState = false;
        this._globalAutoBtnContainer = this.add.container(0, 0);

        const autoW = 92;
        const autoH = 34;
        const autoX = 65;
        const autoY = 495;

        let autoImg;
        if (this.textures.exists('btn_a_normal')) {
            autoImg = this.add.image(autoX, autoY, 'btn_a_normal').setDisplaySize(autoW, autoH).setDepth(10);
            autoImg.setTint(0x38bdf8); // Sky blue tint matching back button
        } else {
            autoImg = this.add.rectangle(autoX, autoY, autoW, autoH, THEME.BG).setStrokeStyle(1, THEME.AETHER).setDepth(10);
        }

        const autoHitZone = this.add.rectangle(autoX, autoY, autoW, autoH, 0x000000, 0).setDepth(10).setInteractive({ useHandCursor: true });
        const gat = this.add.text(autoX, autoY, "AUTO: OFF", {
            fontSize: "11px",
            color: "#e0f2fe",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif",
            stroke: "#000000",
            strokeThickness: 3,
            align: "center"
        }).setOrigin(0.5).setDepth(11);

        this._globalAutoBtnContainer.add([autoImg, autoHitZone, gat]);

        const updateAutoBtnVisual = (state = 'norm') => {
            if (this.textures.exists('btn_a_normal')) {
                if (state === 'hover' && this.textures.exists('btn_a_hover')) autoImg.setTexture('btn_a_hover');
                else if ((state === 'down' || this.globalAutoState) && this.textures.exists('btn_a_active')) autoImg.setTexture('btn_a_active');
                else autoImg.setTexture('btn_a_normal');
            }

            autoImg.setTint(0x38bdf8); // Sky Blue tint
        };

        autoHitZone.on("pointerover", () => updateAutoBtnVisual('hover'));
        autoHitZone.on("pointerout", () => updateAutoBtnVisual('norm'));
        autoHitZone.on("pointerdown", () => {
            updateAutoBtnVisual('down');
            if (this.turn === "player") {
                this.globalAutoState = !this.globalAutoState;
                gat.setText("AUTO: " + (this.globalAutoState ? "ON" : "OFF"));
                gat.setColor(this.globalAutoState ? "#ffffff" : "#e0f2fe");
                updateAutoBtnVisual('norm');

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
        autoHitZone.on("pointerup", () => updateAutoBtnVisual('norm'));

        this._globalAutoBtnContainer.setVisible(this.turn === "player");
    }

    _buildLayer4() {
        const W = 480;
        const CX = 240;

        // Container Area Player HUD (dibawah tombol attack) — Card X5 out-of-frame on left, right, and bottom
        if (this._playerHudBg) this._playerHudBg.destroy();
        if (this.textures.exists('bg_card_x5')) {
            this._playerHudBg = this.add.image(CX, 873, 'bg_card_x5').setDisplaySize(530, 740).setDepth(1);
            this._playerHudBg.setTint(0x38bdf8); // Sky Blue tint
        } else {
            this._playerHudBg = this.add.rectangle(CX, 683, W + 40, 350, 0x0F192E, 0.95).setDepth(1);
            this._playerHudBg.setStrokeStyle(3, 0x38BDF8);
        }

        // 1. AETHER GAUGE
        if (this.textures.exists('progressbar_bg')) {
            this._aethBarBg = this.add.image(CX, 720, 'progressbar_bg').setDisplaySize(440, 14).setDepth(5);
        } else {
            this._aethBarBg = this.add.rectangle(CX, 720, 440, 10, THEME.BG).setDepth(5);
            this._aethBarBg.setStrokeStyle(1, THEME.AETHER);
        }

        if (this.textures.exists('progressbar_fg')) {
            this._aethFill = this.add.image(20, 720, 'progressbar_fg').setOrigin(0, 0.5).setDepth(6);
            this._aethFill.setTint(0x38bdf8); // Sky blue fill tint
        } else {
            this._aethFill = this.add.rectangle(20, 720, 0, 8, THEME.AETHER).setOrigin(0, 0.5).setDepth(6);
        }

        // Teks disejajarkan dengan margin kiri (20) dan kanan (460)
        this._aethPct = this.add.text(460, 700, "0%", { fontSize: "10px", color: THEME.TEXT_SECONDARY, fontStyle: "bold" }).setOrigin(1, 0).setDepth(7);
        this.add.text(20, 700, "AETHER", { fontSize: "10px", color: THEME.TEXT_SECONDARY, fontStyle: "bold" }).setOrigin(0, 0).setDepth(7);

        // 2. ACTION BUTTONS (Center Y = 762, Height = 55)
        // Tombol Heal (Lebar 210, Center X = 125)
        const healTex = this.textures.exists('btn_a_normal') ? 'btn_a_normal' : null;
        if (healTex) {
            this._healBtn = this.add.image(125, 762, healTex).setDisplaySize(210, 55).setDepth(5);
            this._healBtn.setTint(0x2ecc71); // Green tint
        } else {
            this._healBtn = this.add.rectangle(125, 762, 210, 55, THEME.PANEL).setDepth(5);
            this._healBtn.setStrokeStyle(1, THEME.HEALTH);
        }
        this._healText = this.add.text(125, 762, "⊕  HEAL  (x" + this.healsRemaining + ")", { fontSize: "14px", color: "#a8e6cf", fontStyle: "bold" }).setOrigin(0.5).setDepth(6);

        this._healBtn.setInteractive({ useHandCursor: true });
        this._healBtn.on("pointerover", () => {
            if (this.healsRemaining > 0) {
                if (this.textures.exists('btn_a_hover')) this._healBtn.setTexture('btn_a_hover');
                this._healBtn.setTint(0x52be80);
            }
        });
        this._healBtn.on("pointerout", () => {
            if (this.healsRemaining > 0) {
                if (this.textures.exists('btn_a_normal')) this._healBtn.setTexture('btn_a_normal');
                this._healBtn.setTint(0x2ecc71);
            }
        });
        this._healBtn.on("pointerdown", () => {
            if (this.healsRemaining > 0 && this.textures.exists('btn_a_active')) this._healBtn.setTexture('btn_a_active');
            if (this.turn === "player") this.useHealPotion();
        });
        this._healBtn.on("pointerup", () => {
            if (this.healsRemaining > 0 && this.textures.exists('btn_a_normal')) this._healBtn.setTexture('btn_a_normal');
        });

        // Tombol Burst (Lebar 210, Center X = 355)
        const burstTex = this.textures.exists('btn_a_normal') ? 'btn_a_normal' : null;
        if (burstTex) {
            this._abBg = this.add.image(355, 762, burstTex).setDisplaySize(210, 55).setDepth(5);
            this._abBg.setTint(0x38bdf8); // Sky blue tint
        } else {
            this._abBg = this.add.rectangle(355, 762, 210, 55, THEME.PANEL).setDepth(5);
            this._abBg.setStrokeStyle(1, THEME.BORDER);
        }
        this._abText = this.add.text(355, 762, "✦  AETHER BURST", { fontSize: "14px", color: "#a5b4fc", fontStyle: "bold", align: "center" }).setOrigin(0.5).setDepth(6);

        this._abBg.setInteractive({ useHandCursor: true });
        this._abBg.on("pointerover", () => {
            if (this.aetherGauge >= this.aetherGaugeMax) {
                if (this.textures.exists('btn_a_hover')) this._abBg.setTexture('btn_a_hover');
                this._abBg.setTint(0x60a5fa);
            }
        });
        this._abBg.on("pointerout", () => {
            if (this.aetherGauge >= this.aetherGaugeMax) {
                if (this.textures.exists('btn_a_normal')) this._abBg.setTexture('btn_a_normal');
                this._abBg.setTint(0x38bdf8);
            }
        });
        this._abBg.on("pointerdown", () => {
            if (this.aetherGauge >= this.aetherGaugeMax && this.textures.exists('btn_a_active')) this._abBg.setTexture('btn_a_active');
            if (this.turn === "player") this.aetherBurst();
        });
        this._abBg.on("pointerup", () => {
            if (this.aetherGauge >= this.aetherGaugeMax && this.textures.exists('btn_a_normal')) this._abBg.setTexture('btn_a_normal');
        });

        // 3. BATTLE LOG BUTTON (Center Y = 812, Width = 440)
        const logTex = this.textures.exists('btn_d_normal') ? 'btn_d_normal' : null;
        if (logTex) {
            this._logBtnBg = this.add.image(CX, 812, logTex).setDisplaySize(440, 30).setDepth(5);
            this._logBtnBg.setTint(0x94a3b8); // Neutral grey tint
        } else {
            this._logBtnBg = this.add.rectangle(CX, 812, 440, 30, THEME.PANEL).setDepth(5);
            this._logBtnBg.setStrokeStyle(1, THEME.BORDER);
        }
        this._logBtnText = this.add.text(CX, 812, "BATTLE LOG", { fontSize: "12px", color: "#f8fafc", fontStyle: "bold", letterSpacing: 1 }).setOrigin(0.5).setDepth(6);

        this._logBtnBg.setInteractive({ useHandCursor: true });
        this._logBtnBg.on("pointerover", () => {
            if (this.textures.exists('btn_d_hover')) this._logBtnBg.setTexture('btn_d_hover');
            this._logBtnBg.setTint(0xcbcfd5);
        });
        this._logBtnBg.on("pointerout", () => {
            if (this.textures.exists('btn_d_normal')) this._logBtnBg.setTexture('btn_d_normal');
            this._logBtnBg.setTint(0x94a3b8);
        });
        this._logBtnBg.on("pointerdown", () => {
            if (this.textures.exists('btn_d_active')) this._logBtnBg.setTexture('btn_d_active');
            this.logOverlay.setVisible(true);
            this.logContainer.setVisible(true);
        });
        this._logBtnBg.on("pointerup", () => {
            if (this.textures.exists('btn_d_normal')) this._logBtnBg.setTexture('btn_d_normal');
        });

        this._refreshAetherUI();
        this._refreshHealButtonUI();
    }

    _refreshAetherUI() {
        if (!this._aethFill) return;
        const r = Math.min(1, this.aetherGauge / this.aetherGaugeMax);
        const fillW = Math.max(0, 440 * r);
        if (typeof this._aethFill.setDisplaySize === 'function') {
            this._aethFill.setDisplaySize(fillW, 14);
        } else {
            this._aethFill.setSize(fillW, 8);
        }
        this._aethFill.setVisible(fillW > 0);
        this._aethPct.setText(Math.floor(r * 100) + "%");

        const rdy = this.aetherGauge >= this.aetherGaugeMax;
        if (this._abBg) {
            if (rdy) {
                if (this.textures.exists('btn_a_normal')) this._abBg.setTexture('btn_a_normal');
                this._abBg.setTint(0x38bdf8); // Sky blue
                if (this._abBg.setStrokeStyle) this._abBg.setStrokeStyle(1, THEME.AETHER);
            } else {
                if (this.textures.exists('btn_a_disabled')) this._abBg.setTexture('btn_a_disabled');
                this._abBg.setTint(0x555555); // Greyed out
                if (this._abBg.setStrokeStyle) this._abBg.setStrokeStyle(1, THEME.BORDER);
            }
        }
        if (this._abText) {
            this._abText.setColor(rdy ? "#e0f2fe" : THEME.TEXT_SECONDARY);
        }
    }

    async aetherBurst() {
        if (this.aetherGauge < this.aetherGaugeMax) {
            this.showLog("Aether Burst not ready! (Requires 100%)", 'system');
            return;
        }
        if (this.turn !== 'player') return;

        const sourcePlayer = this.players.find(p => p.hp > 0) || this.players[0];
        if (!sourcePlayer) return;

        const targetIdx = this.selectedTargetIndex !== -1 ? this.selectedTargetIndex : 0;
        const targetEnemy = this.enemies[targetIdx] || this.enemies[0];
        const targetId = targetEnemy ? (targetEnemy.monsterId || `enemy_${this.enemies.indexOf(targetEnemy)}`) : 'enemy_0';

        this.setTurn("attacking");
        this.closeActionWindow();

        try {
            const actionData = {
                sourceId: sourcePlayer.slot || sourcePlayer.id || 'mc',
                targetIds: [targetId],
                actionType: 'aether_burst'
            };
            const res = await BattleApi.executeAction(this.bsId, actionData);
            if (res.status === 'success') {
                try {
                    const eventsPromise = this._playActionEvents(res.data.events);
                    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 30000));
                    await Promise.race([eventsPromise, timeoutPromise]);
                } catch (eErr) {
                    console.error("Error playing Aether Burst events:", eErr);
                }
                this._syncState(res.data.stateSnapshot);

                if (this.enemies.length > 0 && this.enemies.every(e => e.hp <= 0)) {
                    this.checkVictory();
                    return;
                }
            } else {
                this.showLog(res.message || "Failed to execute Aether Burst!", 'system');
            }
        } catch (err) {
            console.error("Aether burst error", err);
        } finally {
            if (this.enemies.some(e => e.hp > 0)) {
                this.setTurn("player");
            }
        }
    }
    _buildActionWindow() {
        this._backBtnContainer = this.add.container(0, 0);

        let bb;
        if (this.textures.exists('btn_a_normal')) {
            bb = this.add.image(65, 495, 'btn_a_normal').setDisplaySize(92, 34).setDepth(30);
            bb.setTint(0x38bdf8); // Sky blue tint matching action window card_x5
        } else {
            bb = this.add.rectangle(65, 495, 92, 34, THEME.BG).setStrokeStyle(1, THEME.AETHER).setDepth(30);
        }

        const bt = this.add.text(65, 495, "◄ BACK", {
            fontSize: "11px",
            color: "#e0f2fe",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif",
            stroke: "#000000",
            strokeThickness: 3,
            align: "center"
        }).setOrigin(0.5).setDepth(31);

        this._backBtnContainer.add([bb, bt]);

        bb.setInteractive({ useHandCursor: true });
        bb.on('pointerover', () => {
            if (this.textures.exists('btn_a_hover')) bb.setTexture('btn_a_hover');
            bb.setTint(0x38bdf8);
        });
        bb.on('pointerout', () => {
            if (this.textures.exists('btn_a_normal')) bb.setTexture('btn_a_normal');
            bb.setTint(0x38bdf8);
        });
        bb.on('pointerdown', () => {
            if (this.textures.exists('btn_a_active')) bb.setTexture('btn_a_active');
            bb.setTint(0x38bdf8);
            this.closeActionWindow();
        });
        bb.on('pointerup', () => {
            if (this.textures.exists('btn_a_normal')) bb.setTexture('btn_a_normal');
            bb.setTint(0x38bdf8);
        });

        this._backBtnContainer.setVisible(false);

        // Center at X=240, offscreen Y=1200 (slides up from bottom to Y=698)
        // Depth 30 is below MainMenu (which is 40)
        this.actionWindowContainer = this.add.container(240, 1200).setDepth(30);

        let bg;
        if (this.textures.exists('bg_card_x5')) {
            bg = this.add.image(0, 0, 'bg_card_x5').setDisplaySize(480, 360);
            bg.setTint(0x38bdf8); // Sky blue tint
        } else {
            bg = this.add.rectangle(0, 0, 480, 360, 0x111827, 1);
            bg.setStrokeStyle(2, THEME.BORDER);
        }
        bg.setInteractive();

        const portraitX = -168;
        const portraitY = -65;
        if (this.textures.exists('bg_card_x10')) {
            this._awCardBg = this.add.image(portraitX, portraitY, 'bg_card_x10').setDisplaySize(92, 152);
            this._awCardBg.setTint(0x38bdf8); // Sky blue tint matching action window card_x5
        } else {
            this._awCardBg = this.add.rectangle(portraitX, portraitY, 83, 143, 0x12192b).setStrokeStyle(1, 0x334155);
        }
        this._awPortrait = this.add.image(portraitX, portraitY, '');

        if (this.textures.exists('btn_a_normal')) {
            this._awAutoBtn = this.add.image(portraitX, 35, 'btn_a_normal').setDisplaySize(83, 28);
            this._awAutoBtn.setTint(0x38bdf8);
        } else {
            this._awAutoBtn = this.add.rectangle(portraitX, 35, 83, 28, THEME.BG).setStrokeStyle(1, THEME.BORDER);
        }
        this._awAutoText = this.add.text(portraitX, 35, "AUTO: OFF", {
            fontSize: "11px",
            fontStyle: 'bold',
            color: "#e0f2fe",
            fontFamily: "Outfit, Inter, sans-serif",
            stroke: "#000000",
            strokeThickness: 3
        }).setOrigin(0.5);
        this._awAutoBtn.setInteractive({ useHandCursor: true });
        this._awAutoBtn.on('pointerover', () => {
            if (this.textures.exists('btn_a_hover')) this._awAutoBtn.setTexture('btn_a_hover');
            this._awAutoBtn.setTint(0x38bdf8);
        });
        this._awAutoBtn.on('pointerout', () => {
            const isAuto = this.activePlayer && this.activePlayer.isAuto;
            if (this.textures.exists('btn_a_normal')) {
                this._awAutoBtn.setTexture(isAuto ? (this.textures.exists('btn_a_active') ? 'btn_a_active' : 'btn_a_normal') : 'btn_a_normal');
            }
            this._awAutoBtn.setTint(0x38bdf8);
        });
        this._awAutoBtn.on('pointerdown', () => {
            if (this.activePlayer) {
                if (this.textures.exists('btn_a_active')) this._awAutoBtn.setTexture('btn_a_active');
                this._awAutoBtn.setTint(0x38bdf8);
                this.activePlayer.isAuto = !this.activePlayer.isAuto;
                this._renderActionWindow();
                this.activePlayer.updateActionBadge();
            }
        });
        this._awAutoBtn.on('pointerup', () => {
            const isAuto = this.activePlayer && this.activePlayer.isAuto;
            if (this.textures.exists('btn_a_normal')) {
                this._awAutoBtn.setTexture(isAuto ? (this.textures.exists('btn_a_active') ? 'btn_a_active' : 'btn_a_normal') : 'btn_a_normal');
            }
            this._awAutoBtn.setTint(0x38bdf8);
        });

        const secX = 48;
        const secW = 316;
        const leftLabelX = -100;

        // IN EFFECT
        const effY = -120; // Top is -136.5
        if (this.textures.exists('bg_card_x12')) {
            this._awEffectsSection = this.add.image(secX, effY, 'bg_card_x12').setDisplaySize(secW, 33);
            this._awEffectsSection.setTint(0x38bdf8);
        } else {
            this._awEffectsSection = this.add.rectangle(secX, effY, secW, 33, 0x12192b).setStrokeStyle(1, 0x334155);
        }
        this._awEffectsSection.setInteractive({ useHandCursor: true });
        this._awEffectsSection.on('pointerdown', () => {
            if (this.activePlayer) this._showStatusModal(this.activePlayer);
        });
        this._awLabelEffect = this.add.text(leftLabelX, effY - 16.5, " STATUS EFFECT ", {
            fontSize: "10px",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif",
            color: "#38bdf8",
            backgroundColor: "#070d19"
        }).setOrigin(0, 0.5);
        this._awEffectsContainer = this.add.container(leftLabelX, effY); // Icons rendered horizontally here

        // SKILL
        const skillY = -60; // Top is -96.5
        if (this.textures.exists('bg_card_x12')) {
            this._awSkillsSection = this.add.image(secX, skillY, 'bg_card_x12').setDisplaySize(secW, 73);
            this._awSkillsSection.setTint(0x38bdf8);
        } else {
            this._awSkillsSection = this.add.rectangle(secX, skillY, secW, 73, 0x12192b).setStrokeStyle(1, 0x334155);
        }
        this._awLabelSkill = this.add.text(leftLabelX, skillY - 36.5, " SKILL ", {
            fontSize: "10px",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif",
            color: "#38bdf8",
            backgroundColor: "#070d19"
        }).setOrigin(0, 0.5);
        this._awSkillsContainer = this.add.container(0, skillY);

        // MAIN ACTION
        const atkY = 17; // Top is -15
        if (this.textures.exists('bg_card_x12')) {
            this._awAtkSection = this.add.image(secX, atkY, 'bg_card_x12').setDisplaySize(secW, 64);
            this._awAtkSection.setTint(0x38bdf8);
        } else {
            this._awAtkSection = this.add.rectangle(secX, atkY, secW, 64, 0x12192b).setStrokeStyle(1, 0x334155);
        }
        this._awLabelAction = this.add.text(leftLabelX, atkY - 32, " MAIN ACTION ", {
            fontSize: "10px",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif",
            color: "#38bdf8",
            backgroundColor: "#070d19"
        }).setOrigin(0, 0.5);

        if (this.textures.exists('btn_a_normal')) {
            this._awBasicBtn = this.add.image(-32, atkY, 'btn_a_normal').setDisplaySize(134, 38);
            this._awBasicBtn.setTint(0x38bdf8); // Sky Blue tint for Basic Attack
        } else {
            this._awBasicBtn = this.add.rectangle(-32, atkY, 134, 38, THEME.PANEL).setStrokeStyle(1, THEME.BORDER);
        }
        this._awBasicText = this.add.text(-32, atkY, "BASIC ATTACK ⚔", {
            fontSize: "12px",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 3
        }).setOrigin(0.5);

        this._awBasicBtn.setInteractive({ useHandCursor: true });
        this._awBasicBtn.on('pointerover', () => {
            if (this._awBasicBtnDisabled) return;
            if (this.textures.exists('btn_a_hover')) this._awBasicBtn.setTexture('btn_a_hover');
            this._awBasicBtn.setTint(0x38bdf8);
        });
        this._awBasicBtn.on('pointerout', () => {
            if (this._awBasicBtnDisabled) return;
            if (this.textures.exists('btn_a_normal')) {
                this._awBasicBtn.setTexture(this._awBasicQueued ? (this.textures.exists('btn_a_active') ? 'btn_a_active' : 'btn_a_normal') : 'btn_a_normal');
            }
            this._awBasicBtn.setTint(0x38bdf8);
        });
        this._awBasicBtn.on('pointerdown', () => {
            if (this.activePlayer && this.activePlayer.isStunned) {
                this.showLog(`💫 ${this.activePlayer.charName} sedang STUN! Aksi dinonaktifkan.`);
                this.playStunVibrateAnim(this.activePlayer);
                return;
            }
            if (this._awBasicBtnDisabled) return;
            if (this.textures.exists('btn_a_active')) this._awBasicBtn.setTexture('btn_a_active');
            this._awBasicBtn.setTint(0x38bdf8);
            this._selectAction('basic_attack');
        });
        this._awBasicBtn.on('pointerup', () => {
            if (this._awBasicBtnDisabled) return;
            if (this.textures.exists('btn_a_normal')) {
                this._awBasicBtn.setTexture(this._awBasicQueued ? (this.textures.exists('btn_a_active') ? 'btn_a_active' : 'btn_a_normal') : 'btn_a_normal');
            }
            this._awBasicBtn.setTint(0x38bdf8);
        });

        if (this.textures.exists('btn_a_normal')) {
            this._awSpecialBtn = this.add.image(128, atkY, 'btn_a_normal').setDisplaySize(134, 38);
            this._awSpecialBtn.setTint(0x38bdf8); // Sky Blue tint
        } else {
            this._awSpecialBtn = this.add.rectangle(128, atkY, 134, 38, THEME.PANEL).setStrokeStyle(1, THEME.BORDER);
        }
        this._awSpecialText = this.add.text(128, atkY, "SPECIAL ATTACK ✦", {
            fontSize: "12px",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 3
        }).setOrigin(0.5);

        this._awSpecialBtn.setInteractive({ useHandCursor: true });
        this._awSpecialBtn.on('pointerover', () => {
            if (this._awSpecialBtnDisabled) return;
            if (this.textures.exists('btn_a_hover')) this._awSpecialBtn.setTexture('btn_a_hover');
            this._awSpecialBtn.setTint(0x38bdf8);
        });
        this._awSpecialBtn.on('pointerout', () => {
            if (this._awSpecialBtnDisabled) return;
            if (this.textures.exists('btn_a_normal')) {
                this._awSpecialBtn.setTexture(this._awSpecialQueued ? (this.textures.exists('btn_a_active') ? 'btn_a_active' : 'btn_a_normal') : 'btn_a_normal');
            }
            this._awSpecialBtn.setTint(0x38bdf8);
        });
        this._awSpecialBtn.on('pointerdown', () => {
            if (this.activePlayer && this.activePlayer.isStunned) {
                this.showLog(`💫 ${this.activePlayer.charName} sedang STUN! Aksi dinonaktifkan.`);
                this.playStunVibrateAnim(this.activePlayer);
                return;
            }
            if (this._awSpecialBtnDisabled) return;
            if (this.textures.exists('btn_a_active')) this._awSpecialBtn.setTexture('btn_a_active');
            this._awSpecialBtn.setTint(0x38bdf8);
            if (this.activePlayer && this.activePlayer.specialBar >= this.activePlayer.specialMax) {
                this._selectAction('special_attack');
            }
        });
        this._awSpecialBtn.on('pointerup', () => {
            if (this._awSpecialBtnDisabled) return;
            if (this.textures.exists('btn_a_normal')) {
                this._awSpecialBtn.setTexture(this._awSpecialQueued ? (this.textures.exists('btn_a_active') ? 'btn_a_active' : 'btn_a_normal') : 'btn_a_normal');
            }
            this._awSpecialBtn.setTint(0x38bdf8);
        });

        this.actionWindowContainer.add([
            bg,
            this._awCardBg, this._awPortrait,
            this._awAutoBtn, this._awAutoText,
            this._awEffectsSection, this._awSkillsSection, this._awAtkSection,
            this._awLabelEffect, this._awLabelSkill, this._awLabelAction,
            this._awEffectsContainer, this._awSkillsContainer,
            this._awBasicBtn, this._awBasicText,
            this._awSpecialBtn, this._awSpecialText
        ]);
    }

    openActionWindow(player) {
        if (!player) return;
        this.activePlayer = player;
        this._actionWindowOpen = true;
        this._backBtnContainer.setVisible(true);
        this._renderActionWindow();
        this.actionWindowContainer.setPosition(240, 1200);
        this.tweens.add({ targets: this.actionWindowContainer, y: 697, duration: 300, ease: 'Cubic.easeOut' });
    }

    closeActionWindow() {
        this._actionWindowOpen = false;
        this._backBtnContainer.setVisible(false);
        this.tweens.add({ targets: this.actionWindowContainer, y: 1200, duration: 300, ease: 'Cubic.easeIn' });
        this._setActive(null);
    }

    _selectAction(type, skill_id = null, skillName = null) {
        if (!this.activePlayer) return;
        const p = this.activePlayer;

        if (p.isStunned) {
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
            const imgW = this.textures.get(portTex).getSourceImage().width;
            if (imgW > 0) this._awPortrait.setScale(83 / imgW);
        } else {
            this._awPortrait.setTexture('');
        }

        this._awAutoText.setText(p.isAuto ? "AUTO: ON" : "AUTO: OFF");
        this._awAutoText.setColor(p.isAuto ? "#ffffff" : "#e0f2fe");
        if (this.textures.exists('btn_a_normal')) {
            this._awAutoBtn.setTexture(p.isAuto ? (this.textures.exists('btn_a_active') ? 'btn_a_active' : 'btn_a_normal') : 'btn_a_normal');
        }
        if (this._awAutoBtn.setTint) {
            this._awAutoBtn.setTint(0x38bdf8);
        }

        const isAnyQueued = p.queuedAction.type !== 'none';

        const isBasic = p.queuedAction.type === 'basic_attack';
        const basicDisabled = isStunned || (isAnyQueued && !isBasic);
        this._awBasicBtnDisabled = basicDisabled;
        this._awBasicQueued = isBasic;

        this._awBasicBtn.setAlpha(basicDisabled ? 0.4 : 1);
        this._awBasicText.setAlpha(basicDisabled ? 0.4 : 1);
        if (this.textures.exists('btn_a_disabled') && basicDisabled) {
            this._awBasicBtn.setTexture('btn_a_disabled');
        } else if (this.textures.exists('btn_a_normal')) {
            this._awBasicBtn.setTexture(isBasic ? (this.textures.exists('btn_a_active') ? 'btn_a_active' : 'btn_a_normal') : 'btn_a_normal');
        }
        if (this._awBasicBtn.setTint) {
            this._awBasicBtn.setTint(basicDisabled ? 0x475569 : 0x38bdf8);
        }

        const saRdy = p.specialBar >= p.specialMax;
        const isSpecial = p.queuedAction.type === 'special_attack';
        const specialDisabled = isStunned || !saRdy || (isAnyQueued && !isSpecial);
        this._awSpecialBtnDisabled = specialDisabled;
        this._awSpecialQueued = isSpecial;

        this._awSpecialBtn.setAlpha(specialDisabled ? 0.4 : 1);
        this._awSpecialText.setAlpha(specialDisabled ? 0.4 : 1);
        this._awSpecialText.setColor(saRdy ? "#ffffff" : "#94a3b8");
        if (this.textures.exists('btn_a_disabled') && specialDisabled) {
            this._awSpecialBtn.setTexture('btn_a_disabled');
        } else if (this.textures.exists('btn_a_normal')) {
            this._awSpecialBtn.setTexture(isSpecial ? (this.textures.exists('btn_a_active') ? 'btn_a_active' : 'btn_a_normal') : 'btn_a_normal');
        }
        if (this._awSpecialBtn.setTint) {
            this._awSpecialBtn.setTint(specialDisabled ? 0x475569 : 0x38bdf8);
        }

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

            const cardW = 48;
            const cardH = 48;
            const radius = 2;
            const sx = -60 + (skillIndex * 66);
            skillIndex++;

            let strokeColor = 0x334155;
            const sType = (sk.type || '').toLowerCase();

            if (sType.includes('damage')) strokeColor = 0xe74c3c;
            else if (sType.includes('debuff')) strokeColor = 0x3498db;
            else if (sType.includes('buff') || sType.includes('support')) strokeColor = 0xf1c40f;
            else if (sType.includes('heal') || sType.includes('revive') || sType.includes('cleanse')) strokeColor = 0x2ecc71;

            if (isQueued) strokeColor = 0x38bdf8;

            const skG = this.add.graphics();
            skG.fillStyle(0x070d19, 1.0);
            skG.fillRoundedRect(sx - cardW / 2, -cardH / 2, cardW, cardH, radius);
            skG.lineStyle(1.5, strokeColor, 1.0);
            skG.strokeRoundedRect(sx - cardW / 2, -cardH / 2, cardW, cardH, radius);

            const displayName = sk.name.length > 9 ? sk.name.substring(0, 7) + "..." : sk.name;
            const nm = this.add.text(sx, -3, displayName, { fontSize: "9px", color: "#ffffff", fontStyle: "bold", wordWrap: { width: 41 }, align: 'center' }).setOrigin(0.5);

            const elements = [skG, nm];

            if (cd > 0) {
                const cdOverlayG = this.add.graphics();
                cdOverlayG.fillStyle(0x000000, 0.65);
                cdOverlayG.fillRoundedRect(sx - cardW / 2, -cardH / 2, cardW, cardH, radius);
                const cdText = this.add.text(sx, 0, cd.toString(), { fontSize: "20px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
                elements.push(cdOverlayG, cdText);
            } else {
                const cdT = this.add.text(sx, 13, "READY", { fontSize: "8px", color: "#94a3b8" }).setOrigin(0.5);
                elements.push(cdT);

                const skillDisabled = isStunned || (isAnyQueued && !isQueued);
                if (skillDisabled) {
                    const disabledOverlayG = this.add.graphics();
                    disabledOverlayG.fillStyle(0x000000, 0.5);
                    disabledOverlayG.fillRoundedRect(sx - cardW / 2, -cardH / 2, cardW, cardH, radius);
                    elements.push(disabledOverlayG);
                }
            }

            const hitZone = this.add.rectangle(sx, 0, cardW, cardH, 0x000000, 0);
            elements.push(hitZone);

            this._awSkillsContainer.add(elements);

            if (canUse || isStunned) {
                hitZone.setInteractive({ useHandCursor: true });
                hitZone.on("pointerdown", () => {
                    if (p.isStunned) {
                        this.showLog(`💫 ${p.charName} sedang STUN! Aksi dinonaktifkan.`);
                        this.playStunVibrateAnim(p);
                        return;
                    }
                    this._selectAction('skill', sk.id, sk.name);
                });
            }
        });

        this._awEffectsContainer.removeAll(true);
        const visibleEffects = p.activeEffects || [];
        if (visibleEffects.length > 0) {
            const sups = { 0: '', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
            visibleEffects.forEach((e, idx) => {
                const isBuff = (e.effect_type || '').toLowerCase() === 'buff';
                const color = isBuff ? '#38bdf8' : '#ef4444';

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

                const tx = (idx * 22);
                const txt = this.add.text(tx, 0, emoji + durChar, { fontSize: "13px", color: color, stroke: '#000', strokeThickness: 2 }).setOrigin(0, 0.5);
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

            const isEnemy = this.enemies.includes(p) || p.monsterId !== undefined || String(p.slot || p.id || '').startsWith('enemy');
            const baseX = isEnemy ? 0 : (p._spriteBaseX !== undefined ? p._spriteBaseX : sprite.x);
            const baseY = isEnemy ? 0 : (p._spriteBaseY !== undefined ? p._spriteBaseY : sprite.y);
            const offset = isEnemy ? 40 : -40;

            // Simple quick bounce attack: lunge forward & yoyo back instantly
            this.tweens.add({
                targets: sprite,
                x: baseX + offset,
                y: baseY + 5,
                duration: 120,
                yoyo: true,
                ease: 'Power2',
                onComplete: () => {
                    sprite.x = baseX;
                    sprite.y = baseY;
                    resolve();
                }
            });
        });
    }

    playCharacterReturnAnim(p) {
        return new Promise(resolve => {
            const sprite = p.battleSprite || p.spriteObj;
            if (sprite) {
                const isEnemy = this.enemies.includes(p) || p.monsterId !== undefined || String(p.slot || p.id || '').startsWith('enemy');
                const baseX = isEnemy ? 0 : (p._spriteBaseX !== undefined ? p._spriteBaseX : sprite.x);
                const baseY = isEnemy ? 0 : (p._spriteBaseY !== undefined ? p._spriteBaseY : sprite.y);
                sprite.x = baseX;
                sprite.y = baseY;
            }
            resolve();
        });
    }
    playStunVibrateAnim(p) {
        this.playSFX('sfx_stunned', { volume: 0.8 });
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

        const isVictory = textStr.includes("VICTORY");
        const fontSize = isVictory ? "56px" : "44px";

        const animText = this.add.text(cx, cy, textStr, {
            fontSize: fontSize,
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif",
            align: "center",
            color: colorStr,
            letterSpacing: isVictory ? 6 : 4,
            stroke: "#000000",
            strokeThickness: 8,
            shadow: { offsetX: 0, offsetY: 4, color: '#000000', blur: 12, stroke: true, fill: true },
            wordWrap: { width: this.cameras.main.width - 40 }
        }).setOrigin(0.5).setDepth(250).setScale(2.5).setAlpha(0);

        // Micro camera impact shake on victory
        if (isVictory && this.cameras && this.cameras.main) {
            this.cameras.main.shake(200, 0.006);
        }

        // Phase 1: Heavy impact slam from 2.5x scale down to 1.0x scale
        this.tweens.add({
            targets: animText,
            scale: 1.0,
            alpha: 1,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Phase 2: Slow dramatic expansion creep during display hold
                this.tweens.add({
                    targets: animText,
                    scale: 1.15,
                    duration: 1200,
                    ease: 'Sine.easeInOut',
                    onComplete: () => {
                        // Phase 3: Explosive exit zoom and fade out
                        this.tweens.add({
                            targets: animText,
                            alpha: 0,
                            scale: 1.7,
                            duration: 300,
                            ease: 'Power2.easeIn',
                            onComplete: () => animText.destroy()
                        });
                    }
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
        const currentDelay = target._floatQueueDelay;

        if (currentDelay > 0) {
            this.time.delayedCall(currentDelay, callback);
        } else {
            callback();
        }
        target._floatQueueDelay += 350; // stagger next text on THIS specific target
        this.time.delayedCall(350, () => {
            if (target) {
                target._floatQueueDelay = Math.max(0, (target._floatQueueDelay || 0) - 350);
            }
        });
    }

    _getTargetHeadPos(target) {
        if (!target) return { tx: CX, ty: H / 2, headY: H / 2 - 30 };

        let tx = target.x !== undefined ? target.x : CX;
        let ty = target.y !== undefined ? target.y : (H / 2);
        let spriteH = 80;

        if (target._spriteBaseX !== undefined && target._spriteBaseY !== undefined) {
            tx = target._spriteBaseX;
            ty = target._spriteBaseY;
            if (target.battleSprite && target.battleSprite.displayHeight) {
                spriteH = target.battleSprite.displayHeight;
            } else if (target.spriteObj && target.spriteObj.displayHeight) {
                spriteH = target.spriteObj.displayHeight;
            }
        } else if (target.battleSprite && target.x !== undefined) {
            tx = target.x + target.battleSprite.x;
            ty = target.y + target.battleSprite.y;
            spriteH = target.battleSprite.displayHeight || 80;
        } else if (target.spriteObj && target.x !== undefined) {
            tx = target.x + target.spriteObj.x;
            ty = target.y + target.spriteObj.y;
            spriteH = target.spriteObj.displayHeight || 80;
        }

        const headY = ty - (spriteH / 2) + 15;
        return { tx, ty, headY };
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
            const { tx, headY } = this._getTargetHeadPos(target);

            const floatText = this.add.text(tx + ox, headY, effectName, {
                fontSize: "14px", color: "#ffffff", fontStyle: "bold",
                stroke: strokeColor, strokeThickness: 4, fontFamily: 'Arial'
            }).setOrigin(0.5).setDepth(200);

            this.tweens.add({
                targets: floatText, y: floatText.y - 45, alpha: 0,
                duration: Phaser.Math.Between(1400, 1600), ease: 'Cubic.easeOut',
                onComplete: () => { floatText.destroy(); }
            });
        });
    }

    showFloatingDoT(target, effectName, dmg, colorStr) {
        if (!target) return;

        const ox = Phaser.Math.Between(-20, 20);

        this._queueFloatingText(target, () => {
            const { tx, headY } = this._getTargetHeadPos(target);

            const floatText = this.add.text(tx + ox, headY, `${effectName}\n${dmg}`, {
                fontSize: "16px", color: colorStr, fontStyle: "bold",
                stroke: "#000000", strokeThickness: 3, fontFamily: 'Arial',
                align: 'center'
            }).setOrigin(0.5).setDepth(200);

            this.tweens.add({
                targets: floatText,
                y: floatText.y - 50,
                alpha: 0,
                duration: Phaser.Math.Between(1400, 1600),
                ease: 'Cubic.easeOut',
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

        const finishStartAnim = () => {
            if (this._blackOverlay) {
                this._blackOverlay.destroy();
                this._blackOverlay = null;
            }

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
        };

        // Safety fallback to guarantee overlay destruction if animation stutters (set to 3500ms so it doesn't race against normal 1800ms sequence)
        this.time.delayedCall(3500, () => {
            if (this._blackOverlay) {
                finishStartAnim();
            }
        });

        const startText = this.add.text(cx, cy, "START!", {
            fontSize: "64px",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif",
            color: "#ffed4a",
            letterSpacing: 8,
            stroke: "#000000",
            strokeThickness: 8,
            shadow: { offsetX: 0, offsetY: 4, color: '#000000', blur: 12, stroke: true, fill: true }
        }).setOrigin(0.5).setDepth(200).setScale(2.5).setAlpha(0);

        if (this.bgmKey) playGlobalBGM(this, this.bgmKey);
        this.playSFX('sfx_battleStart', { volume: 0.9 });
        if (this.cameras && this.cameras.main) {
            this.cameras.main.shake(250, 0.008);
        }

        // Phase 1: Heavy impact slam from 2.5x to 1.0x
        this.tweens.add({
            targets: startText,
            scale: 1.0,
            alpha: 1,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Phase 2: Slow expansion creep
                this.tweens.add({
                    targets: startText,
                    scale: 1.15,
                    duration: 600,
                    ease: 'Sine.easeInOut',
                    onComplete: () => {
                        // Phase 3: Explosive exit zoom and fade out
                        this.tweens.add({
                            targets: startText,
                            alpha: 0,
                            scale: 1.8,
                            duration: 250,
                            ease: 'Power2.easeIn',
                            onComplete: () => {
                                startText.destroy();
                                if (this._blackOverlay) {
                                    this.tweens.add({
                                        targets: this._blackOverlay,
                                        alpha: 0,
                                        duration: 400,
                                        ease: 'Power2',
                                        onComplete: () => {
                                            finishStartAnim();
                                        }
                                    });
                                } else {
                                    finishStartAnim();
                                }
                            }
                        });
                    }
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
                if (this.checkVictory()) return;
            }
        } catch (err) {
            console.error("End turn error:", err);
        }

        if (this.checkVictory()) return;

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
                if (this.checkVictory()) return;
            }
        } catch (err) {
            console.error("Enemy turn error:", err);
        }

        if (this.checkVictory()) return;

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

        // console.log(`[ActionEvents] 🎬 Playing ${events ? events.length : 0} total events divided into ${actionGroups.length} action groups.`);

        for (let gIdx = 0; gIdx < actionGroups.length; gIdx++) {
            const group = actionGroups[gIdx];
            this.players.forEach(p => p._floatQueueDelay = 0);
            this.enemies.forEach(e => e._floatQueueDelay = 0);

            // console.log(`[ActionEvents] ▶️ Playing group ${gIdx + 1}/${actionGroups.length}:`, group.isGroup ? `Source: ${group.sourceId}, Skill: ${group.skillName}` : group.event);

            await new Promise(resolve => {
                let isResolved = false;
                const safeResolve = () => {
                    if (isResolved) return;
                    isResolved = true;
                    clearTimeout(safetyTimer);
                    // console.log(`[ActionEvents] ⏹️ Group ${gIdx + 1}/${actionGroups.length} resolved/completed.`);
                    resolve();
                };
                // Safety timer per event group (8s max) to guarantee loop progression
                const safetyTimer = setTimeout(() => {
                    console.warn(`[ActionEvents] ⏰ Safety timer triggered for group ${gIdx + 1}/${actionGroups.length}! Forcing resolve.`);
                    safeResolve();
                }, 8000);

                (async () => {
                    try {
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
                                if (source) {
                                    const stunSrcPos = this._getVfxTargetPos(source);
                                    this.playExactVFX('stun', stunSrcPos.x, stunSrcPos.y, { scale: 1.5 });
                                    this.playStunVibrateAnim(source);
                                }
                                delay = 1000;
                                this.time.delayedCall(delay, safeResolve);
                                return;
                            }

                            const primaryEv = group.events.find(e => e.type === 'damage' && !e.isDoT) || group.events.find(e => e.type === 'heal' || e.type === 'support' || e.type === 'effect_applied' || e.type === 'cleanse' || e.type === 'revive');

                            let isSkill = false;
                            let isSA = false;

                            if (primaryEv) {
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

                            group.events.forEach(ev => {
                                if (ev.type === 'effect_applied') return;

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

                                if (ev.sourceCa !== undefined && group.sourceId) {
                                    const sIdStr = String(group.sourceId);
                                    if (sIdStr.startsWith('enemy_')) {
                                        const eIdx = parseInt(sIdStr.split('_')[1], 10);
                                        const sEnemy = this.enemies[eIdx] || this.enemies[0];
                                        if (sEnemy) {
                                            sEnemy.caBar = ev.sourceCa;
                                            this._refreshEnemyHUD();
                                        }
                                    }
                                }

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

                                        const dmgPos = this._getVfxTargetPos(target);
                                        const cat = ev.skillCategory || 'basic';
                                        if (cat === 'skill' || cat === 'special' || cat === 'charge') {
                                            const actualElement = ev.sourceElement || (source ? source.element : 'Fire');
                                            this.playRollingVFX(actualElement, dmgPos.x, dmgPos.y, 1.5);
                                        } else if (cat === 'aether_burst') {
                                            this.playExactVFX('aetherBurst', dmgPos.x, dmgPos.y, { scale: 1.5, useAddBlend: true });
                                        } else if (cat === 'chain_burst') {
                                            this.playExactVFX('chainBurst', dmgPos.x, dmgPos.y, { scale: 1.5, useAddBlend: true });
                                        } else {
                                            const isEnemySource = String(group.sourceId).startsWith('enemy');
                                            const atkKey = isEnemySource ? 'monsBasicAtk' : 'charBasicAtk';
                                            this.playExactVFX(atkKey, dmgPos.x, dmgPos.y, { scale: 0.5, useAddBlend: true });
                                        }

                                        this.showFloatingDamage(target, ev.value, ev.isCrit, ev.elementMultiplier, ev.sourceElement);
                                        delay = Math.max(delay, 250);
                                    }
                                } else if (ev.type === 'heal') {
                                    target.hp = Math.min(target.maxHp, target.hp + ev.value);
                                    if (this.enemies.includes(target)) this._refreshEnemyHUD();
                                    else target.refreshVisual();

                                    const healPos = this._getVfxTargetPos(target);
                                    this.playExactVFX('heal', healPos.x, healPos.y, { scale: 1.5, useAddBlend: true });

                                    this.showFloatingHeal(target, ev.value);
                                    this.showLog(`[Heal] ${target.charName} restored HP!`, 'popup');
                                    delay = Math.max(delay, 600);
                                } else if (ev.type === 'revive') {
                                    target.hp = ev.value;
                                    if (this.enemies.includes(target)) this._refreshEnemyHUD();
                                    else target.refreshVisual();

                                    const revPos = this._getVfxTargetPos(target);
                                    this.playExactVFX('revive', revPos.x, revPos.y, { scale: 1.5, useAddBlend: true });

                                    this.showLog(`✨ ${target.charName} revived!`, 'popup');
                                    delay = Math.max(delay, 600);
                                } else if (ev.type === 'cleanse') {
                                    target.activeEffects = (target.activeEffects || []).filter(e => (e.effect_type || '').toLowerCase() !== 'debuff');
                                    target.refreshVisual();
                                    this.showLog(`✨ ${target.charName} debuffs cleansed!`, 'popup');
                                    delay = Math.max(delay, 500);
                                } else if (ev.type === 'stun_skip') {
                                    const stunPos = this._getVfxTargetPos(target);
                                    this.playExactVFX('stun', stunPos.x, stunPos.y, { scale: 1.5, useAddBlend: true });

                                    const tgtName = target.charName || (target.monsterId ? 'ENEMY' : 'Character');
                                    this.showLog(`💫 ${tgtName} is STUNNED and cannot move!`, 'popup');
                                    this.playStunVibrateAnim(target);
                                    delay = Math.max(delay, 400);
                                }
                            });

                            if (source && source.battleSprite) {
                                await this.playCharacterReturnAnim(source);
                            }

                            const effectEvents = group.events.filter(ev => ev.type === 'effect_applied');
                            if (effectEvents.length > 0) {
                                await new Promise(r => this.time.delayedCall(400, r));

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

                                    const effPos = this._getVfxTargetPos(target);
                                    if ((ev.effectType || '').toLowerCase() === 'buff') {
                                        this.playExactVFX('buff', effPos.x, effPos.y, { scale: 1.5, useAddBlend: true });
                                        if (!playedBuffSound) {
                                            this.playSFX('sfx_buff', { volume: 0.6 });
                                            playedBuffSound = true;
                                        }
                                    } else {
                                        this.playExactVFX('debuff', effPos.x, effPos.y, { scale: 1.5, useAddBlend: true });
                                        if (!playedDebuffSound) {
                                            this.playSFX('sfx_debuff', { volume: 0.6 });
                                            playedDebuffSound = true;
                                        }
                                    }

                                    this.showFloatingEffect(target, ev.effectName, ev.effectType);
                                    this.showLog(`${target.charName} got ${ev.effectName}!`, 'popup');
                                });

                                delay = Math.max(delay, 500);
                                await new Promise(r => this.time.delayedCall(350, r));
                            }
                        } else {
                            const ev = group.event;
                            let target = null;
                            if (ev && ev.targetId !== undefined && ev.targetId !== null) {
                                target = this.players.find(p => p.slot === ev.targetId);
                                if (!target) {
                                    const tIdStr = String(ev.targetId);
                                    if (this.enemies.some(e => String(e.monsterId) == tIdStr) || tIdStr.startsWith('enemy_') || tIdStr === 'enemy') {
                                        const eIdx = tIdStr.startsWith('enemy_') ? parseInt(tIdStr.split('_')[1], 10) : 0;
                                        target = this.enemies[eIdx] || this.enemies[0];
                                    }
                                }
                            }

                            if (ev && ev.type === 'enrage') {
                                if (target) {
                                    this.playSFX('sfx_monsEnraged', { volume: 0.8 });
                                    target.modeState = 'enraged';
                                    this._enragedTurns = 3;
                                    this.showLog("ENEMY ENRAGED! (3 Turns)", 'system');
                                    this._refreshEnemyHUD();

                                    const effPos = this._getVfxTargetPos(target);
                                    const txt = this.add.text(effPos.x, effPos.y - 40, "ENRAGED", {
                                        fontSize: "36px", fontStyle: "bold", color: "#e74c3c", stroke: "#000000", strokeThickness: 5
                                    }).setOrigin(0.5).setDepth(200);
                                    this.tweens.add({ targets: txt, y: effPos.y - 100, alpha: 0, duration: 2000, ease: 'Cubic.easeOut', onComplete: () => txt.destroy() });

                                    delay = 800;
                                }
                            } else if (ev && ev.type === 'break') {
                                if (target) {
                                    this.playSFX('sfx_monsExhausted', { volume: 0.8 });
                                    target.modeState = 'exhausted';
                                    this._exhaustedTurns = 2;
                                    this._enragedTurns = 0;
                                    this.showLog("ENEMY BREAK! (Exhausted)", 'system');
                                    this._refreshEnemyHUD();

                                    const effPos = this._getVfxTargetPos(target);
                                    const txt = this.add.text(effPos.x, effPos.y - 40, "BREAK", {
                                        fontSize: "40px", fontStyle: "bold", color: "#3498db", stroke: "#000000", strokeThickness: 5
                                    }).setOrigin(0.5).setDepth(200);
                                    this.tweens.add({ targets: txt, y: effPos.y - 100, alpha: 0, duration: 2000, ease: 'Cubic.easeOut', onComplete: () => txt.destroy() });

                                    delay = 800;
                                }
                            } else if (ev && ev.type === 'effect_removed') {
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
                            } else if (ev && ev.type === 'log') {
                                this.showLog(ev.message, 'system');
                                delay = 600;
                            } else if (ev && ev.type === 'delay') {
                                delay = ev.delayMs || 500;
                            } else if (ev && ev.type === 'wave_change') {
                                waveChanged = true;
                                this._isWaveChanging = true;
                                this._isVictoryConfirmed = false;

                                delay = -1;

                                let hasResolved = false;
                                const safeWaveResolve = () => {
                                    if (hasResolved) return;
                                    hasResolved = true;
                                    this._isWaveChanging = false;
                                    this._refreshEnemyHUD();
                                    safeResolve();
                                };
                                const waveTimeout = setTimeout(safeWaveResolve, 6000);

                                this.playSFX('sfx_monsterDefeated', { volume: 0.8 });

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
                                            const characterSprites = [];
                                            this.players.forEach(p => {
                                                if (p.battleSprite) characterSprites.push(p.battleSprite);
                                                else if (p.spriteObj) characterSprites.push(p.spriteObj);
                                            });

                                            const runTargets = characterSprites.length > 0 ? characterSprites : this.players;

                                            this.tweens.add({
                                                targets: runTargets,
                                                x: "-=600",
                                                duration: 800,
                                                ease: 'Power2',
                                                onComplete: () => {
                                                    if (!this._blackOverlay) {
                                                        this._blackOverlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 1).setDepth(190).setAlpha(0);
                                                    }

                                                    this.tweens.add({
                                                        targets: this._blackOverlay,
                                                        alpha: 1,
                                                        duration: 400,
                                                        onComplete: () => {
                                                            this.players.forEach(p => {
                                                                if (p.battleSprite) p.battleSprite.x = p._spriteBaseX || 390;
                                                                else if (p.spriteObj) p.spriteObj.x = p._spriteBaseX || 390;
                                                                else p.x = p._baseX;
                                                            });

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
                                                                                if (this._blackOverlay) {
                                                                                    this._blackOverlay.destroy();
                                                                                    this._blackOverlay = null;
                                                                                }
                                                                                clearTimeout(waveTimeout);
                                                                                safeWaveResolve();
                                                                            }
                                                                        });
                                                                    } else {
                                                                        clearTimeout(waveTimeout);
                                                                        safeWaveResolve();
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
                                    clearTimeout(waveTimeout);
                                    safeWaveResolve();
                                }
                            } else {
                                delay = 100;
                            }
                        }

                        if (delay >= 0) {
                            this.time.delayedCall(delay, safeResolve);
                        }
                    } catch (err) {
                        console.error("[_playActionEvents] Error processing event group:", err);
                        safeResolve();
                    }
                })();
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
            const { tx, headY } = this._getTargetHeadPos(target);

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
                    y: container.y - 55,
                    alpha: 0,
                    duration: Phaser.Math.Between(1400, 1600),
                    ease: 'Cubic.easeOut',
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
                duration: Phaser.Math.Between(1300, 1500),
                ease: 'Cubic.easeOut',
                onComplete: () => { floatText.destroy(); }
            });
        });
    }

    showFloatingHeal(target, value) {
        if (!target) return;

        const ox = Phaser.Math.Between(-20, 20);

        this._queueFloatingText(target, () => {
            const { tx, headY } = this._getTargetHeadPos(target);

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
                duration: Phaser.Math.Between(1300, 1500),
                ease: 'Cubic.easeOut',
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
            if (p.isStunned) {
                p.queuedAction = { type: 'basic_attack' };
            } else if (p.isAuto && p.queuedAction.type === 'none') {
                const saRdy = (p.specialBar >= p.specialMax);
                p.queuedAction = { type: saRdy ? 'special_attack' : 'basic_attack' };
            }

            if (!p.isStunned && p.queuedAction.type === 'none') {
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

        // console.log(`[TurnBatch] ⚔️ Submitting turn batch for ${character_actions.length} characters:`, JSON.parse(JSON.stringify(character_actions)));

        await new Promise(r => setTimeout(r, 500));

        try {
            const res = await BattleApi.processTurnBatch(this.bsId, character_actions);
            // console.log(`[TurnBatch] 📥 Server response status: ${res ? res.status : 'null'}`, res);

            if (res && res.status === 'success') {
                try {
                    // console.log(`[TurnBatch] 🎬 Starting _playActionEvents with ${res.data.events ? res.data.events.length : 0} events...`);
                    const eventsPromise = this._playActionEvents(res.data.events);
                    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 30000));
                    await Promise.race([eventsPromise, timeoutPromise]);
                    // console.log(`[TurnBatch] ✅ Finished _playActionEvents!`);
                } catch (eErr) {
                    console.error("[TurnBatch] ❌ Error playing action events:", eErr);
                }
                // console.log(`[TurnBatch] 🔄 Syncing state snapshot from server...`);
                this._syncState(res.data.stateSnapshot);
            } else {
                console.warn(`[TurnBatch] ⚠️ Server returned non-success response:`, res);
                this.showLog(res.message || "Failed to process turn batch!", 'system');
            }
        } catch (err) {
            console.error("[TurnBatch] 💥 Network/Action error:", err);
        }

        for (const p of alive) {
            p.queuedAction = { type: 'none' };
            p.updateActionBadge();
        }

        // console.log(`[TurnBatch] 📊 Checking end of turn batch conditions. Enemy HPs:`, this.enemies.map(e => ({ id: e.monsterId, name: e.charName, hp: e.hp })));

        // Always check defeat first (players could have died during enemy phase)
        if (this.players.length > 0 && this.players.every(p => p.hp <= 0)) {
            // console.log(`[TurnBatch] 💀 All players dead. Triggering defeat!`);
            this.triggerDefeat(false);
            return;
        }

        // Always check victory (enemies could have died during player/dot phase)
        if (this.enemies.length > 0 && this.enemies.every(e => e.hp <= 0)) {
            // console.log(`[TurnBatch] 🏆 All enemies dead. Calling checkVictory()...`);
            this.checkVictory();
            return;
        }

        // console.log(`[TurnBatch] 🔄 Returning turn to player.`);
        this.setTurn("player");
    }

    _syncState(state) {
        if (!state) return;

        // Sync Turn & Wave
        if (state.current_wave_index !== undefined) {
            const newWave = state.current_wave_index + 1;
            if (newWave !== this.currentWave) this._isVictoryConfirmed = false;
            this.currentWave = newWave;
        } else if (state.wave !== undefined) {
            if (state.wave !== this.currentWave) this._isVictoryConfirmed = false;
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
            if (this.turn === 'player') {
                this._checkAndHandleStunnedParty();
            }
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

            if (needsRebuild) {
                const fadeTargets = [];
                this.enemies.forEach((enemy, idx) => {
                    if (enemy) fadeTargets.push(enemy);
                    if (this.enemyHUDs && this.enemyHUDs[idx] && this.enemyHUDs[idx].container) {
                        fadeTargets.push(this.enemyHUDs[idx].container);
                    }
                });

                if (fadeTargets.length > 0) {
                    this.tweens.add({
                        targets: fadeTargets,
                        alpha: 1,
                        duration: 800,
                        ease: 'Sine.easeOut'
                    });
                }
            }
        }

        if (state.timeline && this.timelineContainer) {
            this.buildTimeline(state.timeline);
        }

        if (this.enemies.length > 0 && this.enemies.every(e => e.hp <= 0)) {
            this.checkVictory();
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
                const targetSlot = targetChar.slot !== undefined ? targetChar.slot : targetChar.id;
                const actionData = { sourceId: targetSlot, targetIds: [targetSlot], actionType: 'use_potion', skillId: null };
                const res = await BattleApi.executeAction(this.bsId, actionData);

                if (res.status === 'success') {
                    await this._playActionEvents(res.data.events);
                    this._syncState(res.data.stateSnapshot);

                    this.potionsUsed++;
                    this.showLog(`Used Green Potion on ${targetChar.charName}!`);
                } else {
                    this.showLog(res.message || res.error_detail || "Failed to use potion.");
                }
            } catch (err) {
                console.error("Potion error", err);
                const detail = err && err.response && err.response.data && (err.response.data.error_detail || err.response.data.message);
                this.showLog(detail ? `Potion error: ${detail}` : "Failed to use potion.");
            }
        });
    }

    _refreshHealButtonUI() {
        if (this._healText) {
            this._healText.setText("⊕  HEAL  (x" + this.healsRemaining + ")");
            if (this._healBtn) {
                if (this.healsRemaining <= 0) {
                    if (this.textures.exists('btn_a_disabled')) this._healBtn.setTexture('btn_a_disabled');
                    this._healBtn.setTint(0x555555);
                    if (this._healBtn.setStrokeStyle) this._healBtn.setStrokeStyle(2, 0x555555);
                    this._healText.setColor("#555555");
                } else {
                    if (this.textures.exists('btn_a_normal')) this._healBtn.setTexture('btn_a_normal');
                    this._healBtn.setTint(0x2ecc71);
                    if (this._healBtn.setStrokeStyle) this._healBtn.setStrokeStyle(2, 0x2ecc71);
                    this._healText.setColor("#a8e6cf");
                }
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
            const isStunned = p.activeEffects && p.activeEffects.some(e => (e.target_stat || '').toUpperCase() === 'STUN' || (e.effect_name || '').toUpperCase().includes('STUN'));
            const isValid = requireAlive ? !isDead : isDead;

            const charBox = this.add.rectangle(pos.x, pos.y, 140, 52, isValid ? (requireAlive ? (isStunned ? 0x2e1f0a : 0x112b1a) : 0x24152e) : 0x111111);
            charBox.setStrokeStyle(1.5, isValid ? (requireAlive ? (isStunned ? 0xf39c12 : 0x2ecc71) : 0xb39ddb) : 0x333333);
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

            const statusStr = isDead ? "KO 💀" : (isStunned ? `STUN 💫 (${p.hp}/${p.maxHp})` : `${p.hp}/${p.maxHp}`);
            const statusColor = isDead ? "#ff8a80" : (isStunned ? "#f39c12" : "#a8e6cf");
            const statusTxt = this.add.text(pos.x - 62, pos.y + 14, statusStr, { fontSize: "9px", color: statusColor }).setOrigin(0, 0.5);
            modalContainer.add(statusTxt);

            if (isValid) {
                charBox.setInteractive();
                charBox.on("pointerover", () => {
                    charBox.setFillStyle(requireAlive ? (isStunned ? 0x4a3210 : 0x1c452a) : 0x3b214c);
                });
                charBox.on("pointerout", () => {
                    charBox.setFillStyle(requireAlive ? (isStunned ? 0x2e1f0a : 0x112b1a) : 0x24152e);
                });
                charBox.on("pointerdown", () => {
                    if (requireAlive && isStunned) {
                        this.showLog(`💫 ${p.charName} sedang STUN! Aksi dinonaktifkan.`);
                        this.playStunVibrateAnim(p);
                        return;
                    }
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
        // console.log(`[VictoryCheck] 🔍 Evaluating checkVictory: currentWave=${this.currentWave}, totalWaves=${this.totalWaves}, isVictoryConfirmed=${this._isVictoryConfirmed}, isWaveChanging=${this._isWaveChanging}`);
        // console.log(`[VictoryCheck] Enemy states:`, this.enemies.map(e => ({ id: e.monsterId, name: e.charName, hp: e.hp })));

        if (this._isVictoryConfirmed) {
            // console.log(`[VictoryCheck] ⏩ Victory already confirmed previously. TransitionStarted=${this._isVictoryTransitionStarted}`);
            if (!this._isVictoryTransitionStarted) {
                // console.log(`[VictoryCheck] ⚠️ Transition was NOT started yet! Forcing _triggerVictoryTransition() now...`);
                this._triggerVictoryTransition();
            }
            return true;
        }

        const allEnemiesDead = this.enemies.length > 0 && this.enemies.every(e => e.hp <= 0);
        if (allEnemiesDead && this.currentWave < this.totalWaves && !this._isWaveChanging) {
            // console.log(`[VictoryCheck] 🔄 All current enemies dead. Auto-syncing currentWave (${this.currentWave}) -> totalWaves (${this.totalWaves})`);
            this.currentWave = this.totalWaves;
        }

        if (this.currentWave < this.totalWaves) {
            // console.log(`[VictoryCheck] ⏳ currentWave (${this.currentWave}) < totalWaves (${this.totalWaves}). Not final wave yet.`);
            return false;
        }

        if (allEnemiesDead) {
            // console.log(`[VictoryCheck] 🏆 VICTORY CONDITIONS PASSED! Triggering defeat SFX and fade-out...`);
            this._isVictoryConfirmed = true;
            this.turn = "none";

            // Play monster defeated roar while BGM is still playing
            this.playSFX('sfx_monsterDefeated', { volume: 0.8 });

            // FADE OUT ENEMIES FIRST (Include monster battleSprite so sprite actually fades out!)
            const fadeTargets = [];
            this.enemies.forEach((enemy, idx) => {
                if (enemy) fadeTargets.push(enemy);
                if (enemy && enemy.battleSprite) fadeTargets.push(enemy.battleSprite);
                if (this.enemyHUDs && this.enemyHUDs[idx] && this.enemyHUDs[idx].container) {
                    fadeTargets.push(this.enemyHUDs[idx].container);
                }
            });

            let victoryTriggered = false;
            const triggerOnce = () => {
                if (victoryTriggered) return;
                victoryTriggered = true;
                // console.log(`[VictoryCheck] 🚀 Calling _triggerVictoryTransition()!`);
                this._triggerVictoryTransition();
            };

            if (fadeTargets.length > 0) {
                this.tweens.add({
                    targets: fadeTargets,
                    alpha: 0,
                    duration: 1000,
                    ease: 'Sine.easeInOut',
                    onComplete: triggerOnce
                });
                // Multi-layered fail-safe triggers
                this.time.delayedCall(1100, triggerOnce);
                setTimeout(triggerOnce, 1200);
            } else {
                // console.log(`[VictoryCheck] 🚀 No fadeTargets. Calling _triggerVictoryTransition() directly!`);
                triggerOnce();
            }

            return true;
        }
        // console.log(`[VictoryCheck] ❌ Not all enemies dead yet.`);
        return false;
    }

    _triggerVictoryTransition() {
        if (this._isVictoryTransitionStarted) {
            // console.log("[VictoryTransition] ⏩ Transition already started, skipping duplicate invocation.");
            return;
        }
        this._isVictoryTransitionStarted = true;

        // console.log("[VictoryTransition] 🚀 Executing _triggerVictoryTransition...");
        try {
            stopGlobalBGM();
            playGlobalBGM(this, 'bgm_victory');
        } catch (err) {
            console.warn("[VictoryTransition] Audio switch error:", err);
        }

        try {
            this._showCenterAnim("VICTORY!", "#ffeb3b");
        } catch (err) {
            console.warn("[VictoryTransition] Banner error:", err);
        }

        const launchVictory = () => {
            if (this._victoryLaunched) return;
            this._victoryLaunched = true;

            // console.log("[VictoryTransition] 🚀 Launching VictoryScene now! bsId=", this.bsId);
            try {
                this.scene.pause();
                if (this.scene.isActive('VictoryScene')) {
                    this.scene.stop('VictoryScene');
                }
                this.scene.launch('VictoryScene', {
                    questId: this.questId,
                    playerId: this.playerId,
                    potionsUsed: this.potionsUsed,
                    fullPotionsUsed: this.fullPotionsUsed,
                    bsId: this.bsId
                });
            } catch (err) {
                console.error("[VictoryTransition] 💥 Error launching VictoryScene with pause/launch, falling back to scene.start:", err);
                try {
                    this.scene.start('VictoryScene', {
                        questId: this.questId,
                        playerId: this.playerId,
                        potionsUsed: this.potionsUsed,
                        fullPotionsUsed: this.fullPotionsUsed,
                        bsId: this.bsId
                    });
                } catch (err2) {
                    console.error("[VictoryTransition] 💥 Hard failure launching VictoryScene:", err2);
                }
            }
        };

        // Extended delay (2.2s) so VICTORY banner and audio flourish finish gracefully before VictoryScene loads
        this.time.delayedCall(2000, launchVictory);
        setTimeout(launchVictory, 2200);
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

        const isEnemy = !!(this.enemies && this.enemies.includes(entity));
        const themeTint = isEnemy ? 0xef4444 : 0x38bdf8;
        const themeColor = isEnemy ? "#ef4444" : "#38bdf8";

        const modalContainer = this.add.container(0, 0).setDepth(150);

        const cover = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.75).setInteractive();
        cover.on("pointerdown", (pointer, x, y, event) => {
            event.stopPropagation();
        });
        modalContainer.add(cover);

        let windowBg;
        const modalW = 420;
        const modalH = 460;
        if (this.textures.exists('bg_card_x100')) {
            windowBg = this.add.image(CX, H / 2, 'bg_card_x100').setDisplaySize(modalW, modalH);
            windowBg.setTint(themeTint);
        } else {
            windowBg = this.add.rectangle(CX, H / 2, modalW, modalH, 0x0d1b2a);
            windowBg.setStrokeStyle(2, themeTint);
        }
        windowBg.setInteractive();
        windowBg.on("pointerdown", (pointer, x, y, event) => event.stopPropagation());
        modalContainer.add(windowBg);

        const title = this.add.text(CX, H / 2 - 170, `${entity.charName} - STATUS`, {
            fontSize: "16px",
            color: themeColor,
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif",
            stroke: "#000000",
            strokeThickness: 3
        }).setOrigin(0.5);
        modalContainer.add(title);

        let currentY = H / 2 - 125;

        const visibleEffects = entity.activeEffects || [];
        if (visibleEffects.length === 0) {
            const noEffectTxt = this.add.text(CX, currentY + 40, "No Active Status Effects", {
                fontSize: "13px",
                color: isEnemy ? "#f87171" : "#7dd3fc",
                fontStyle: "italic",
                fontFamily: "Outfit, Inter, sans-serif"
            }).setOrigin(0.5);
            modalContainer.add(noEffectTxt);
        } else {
            visibleEffects.forEach((e) => {
                const isBuff = (e.effect_type || '').toLowerCase() === 'buff';

                let boxTint, textColor, valColor;
                if (isEnemy) {
                    // Monster Buff = Red (dangerous), Monster Debuff = Sky Blue (advantage for player)
                    boxTint = isBuff ? 0xef4444 : 0x38bdf8;
                    textColor = isBuff ? "#ef4444" : "#38bdf8";
                    valColor = isBuff ? "#fca5a5" : "#e0f2fe";
                } else {
                    // Player Buff = Sky Blue (advantage for player), Player Debuff = Red (dangerous)
                    boxTint = isBuff ? 0x38bdf8 : 0xef4444;
                    textColor = isBuff ? "#38bdf8" : "#ef4444";
                    valColor = isBuff ? "#e0f2fe" : "#fca5a5";
                }

                let emoji = '🔮';
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

                let box;
                const itemW = 340;
                const itemH = 42;
                if (this.textures.exists('bg_card_x12')) {
                    box = this.add.image(CX, currentY, 'bg_card_x12').setDisplaySize(itemW, itemH);
                    box.setTint(boxTint);
                } else {
                    box = this.add.rectangle(CX, currentY, itemW, itemH, 0x111827).setStrokeStyle(1, boxTint);
                }

                const emojiTxt = this.add.text(CX - 145, currentY, emoji, { fontSize: "16px" }).setOrigin(0.5);
                const nameTxt = this.add.text(CX - 120, currentY, `${effectName} ${durText}`, {
                    fontSize: "12px",
                    color: textColor,
                    fontStyle: "bold",
                    fontFamily: "Outfit, Inter, sans-serif",
                    stroke: "#070d19",
                    strokeThickness: 3
                }).setOrigin(0, 0.5);
                const valTxt = this.add.text(CX + 145, currentY, valueText, {
                    fontSize: "11px",
                    color: valColor,
                    fontStyle: "bold",
                    fontFamily: "Outfit, Inter, sans-serif",
                    stroke: "#070d19",
                    strokeThickness: 2
                }).setOrigin(1, 0.5);

                modalContainer.add([box, emojiTxt, nameTxt, valTxt]);
                currentY += 48;
            });
        }

        // Close Button using Button B asset
        let closeBtn;
        const btnW = 120;
        const btnH = 36;
        const closeY = H / 2 + 165;

        if (this.textures.exists('btn_b_normal')) {
            closeBtn = this.add.image(CX, closeY, 'btn_b_normal').setDisplaySize(btnW, btnH);
            closeBtn.setTint(themeTint);
        } else {
            closeBtn = this.add.rectangle(CX, closeY, btnW, btnH, 0x111827).setStrokeStyle(1.5, themeTint);
        }

        const closeText = this.add.text(CX, closeY, "CLOSE", {
            fontSize: "12px",
            color: "#ffffff",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif",
            stroke: "#000000",
            strokeThickness: 3
        }).setOrigin(0.5);

        modalContainer.add([closeBtn, closeText]);

        closeBtn.setInteractive({ useHandCursor: true });
        closeBtn.on("pointerover", () => {
            if (this.textures.exists('btn_b_hover')) closeBtn.setTexture('btn_b_hover');
            closeBtn.setTint(themeTint);
        });
        closeBtn.on("pointerout", () => {
            if (this.textures.exists('btn_b_normal')) closeBtn.setTexture('btn_b_normal');
            closeBtn.setTint(themeTint);
        });
        closeBtn.on("pointerdown", () => {
            if (this.textures.exists('btn_b_active')) closeBtn.setTexture('btn_b_active');
            closeBtn.setTint(themeTint);
            modalContainer.destroy();
        });
        closeBtn.on("pointerup", () => {
            if (this.textures.exists('btn_b_normal')) closeBtn.setTexture('btn_b_normal');
        });
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
        if (!target) return { x: CX, y: H / 2 };
        let tx = target.x;
        let ty = target.y;

        if (target._spriteBaseX !== undefined && target._spriteBaseY !== undefined) {
            tx = target._spriteBaseX;
            ty = target._spriteBaseY;
        } else if (target.battleSprite && target.x !== undefined) {
            tx = target.x + target.battleSprite.x;
            ty = target.y + target.battleSprite.y;
        } else if (target.spriteObj && target.x !== undefined) {
            tx = target.x + target.spriteObj.x;
            ty = target.y + target.spriteObj.y;
        }

        return { x: tx !== undefined ? tx : CX, y: ty !== undefined ? ty : (H / 2) };
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
        const useAddBlend = opts.useAddBlend !== undefined ? opts.useAddBlend : true;

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
