import Phaser from 'phaser';
import { THEME } from '../main.js';
import { stopGlobalBGM } from '../utils/audioManager.js';

export default class LoadingScene extends Phaser.Scene {
    constructor() {
        super('LoadingScene');
    }

    init(data) {
        this.targetScene = data.targetScene || 'MainMenuScene';
        this.targetData = data.targetData || {};
        this.minLoadTimeMs = data.minLoadTimeMs || 800;
    }

    preload() {
        if (!this.textures.exists('game_logo')) {
            this.load.image('game_logo', 'assets/logo/Acro Logo 1.png');
        }
    }

    create() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const CX = W / 2;
        const CY = H / 2;

        // Solid Black Background
        this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0);

        // Center Title/Logo with breathing scale animation
        const logo = this.add.image(CX, CY - 15, 'game_logo').setOrigin(0.5);
        const targetWidth = 220; // Slightly smaller than title screen
        const baseScale = logo.width > targetWidth ? (targetWidth / logo.width) : 1;
        logo.setScale(baseScale);

        this.tweens.add({
            targets: logo,
            scaleX: baseScale * 1.06,
            scaleY: baseScale * 1.06,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Center loading text below logo with White fill & Sky Blue stroke
        const loadingText = this.add.text(CX, CY + 55, 'Loading', {
            fontSize: '14px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: '#ffffff',
            stroke: '#38bdf8',
            strokeThickness: 2,
            letterSpacing: 1
        }).setOrigin(0.5, 0.5);

        // Dot animation
        this.time.addEvent({
            delay: 400,
            repeat: -1,
            callback: () => {
                let txt = loadingText.text;
                if (txt === 'Loading...') txt = 'Loading';
                else txt += '.';
                loadingText.setText(txt);
            }
        });


        // Loading sequence
        let loaded = false;
        let delayPassed = false;

        const finish = () => {
            if (loaded && delayPassed) {
                this.scene.start(this.targetScene, this.targetData);
            }
        };

        this.time.delayedCall(this.minLoadTimeMs, () => {
            delayPassed = true;
            finish();
        });

        this._loadDynamicAudio(() => {
            loaded = true;
            finish();
        });
    }

    _loadDynamicAudio(onComplete) {
        // Aturan 2: Manajemen Cache (Bersihkan BGM yang tak terpakai)
        const keysToKeep = ['bgm_mainmenu_1', 'bgm_mainmenu_2', 'sfx_select', 'bgm_victory', 'bgm_defeat', 'bgm_authscene'];
        const requiredAudio = [];

        if (['MainMenuScene', 'PartyScene', 'InventoryScene', 'CharacterDetailScene', 'WeaponDetailScene'].includes(this.targetScene)) {
            requiredAudio.push({ key: 'bgm_mainmenu_1', url: 'assets/audio/bgm/bgm_mainmenu_1.mp3' });
            requiredAudio.push({ key: 'bgm_mainmenu_2', url: 'assets/audio/bgm/bgm_mainmenu_2.mp3' });
        } else if (this.targetScene === 'GachaScene') {
            requiredAudio.push({ key: 'bgm_gacha', url: 'assets/audio/bgm/bgm_gacha.mp3' });
            keysToKeep.push('bgm_gacha');
        } else if (this.targetScene === 'QuestScene') {
            requiredAudio.push({ key: 'bgm_quest_selection', url: 'assets/audio/bgm/bgm_quest_selection.mp3' });
            keysToKeep.push('bgm_quest_selection');
        } else if (this.targetScene === 'BattleScene' || this.targetScene === 'ReadyScene') {
            const questId = this.targetData ? (this.targetData.questId || 0) : 0;
            const initData = this.targetData ? (this.targetData.initData || {}) : {};

            let bgmKey = 'bgm_normalbattle';
            if (questId == 9) bgmKey = 'bgm_mqid_9';
            else if (questId == 10) bgmKey = 'bgm_mqid_10';
            else if (questId == 11) bgmKey = 'bgm_mqid_11';
            else if (initData.isBoss || initData.type === 'boss' || (this.targetData && this.targetData.isBoss)) {
                bgmKey = 'bgm_bossbattle';
            }

            if (this.targetData) this.targetData.bgmKey = bgmKey;

            requiredAudio.push({ key: bgmKey, url: `assets/audio/bgm/${bgmKey}.mp3` });
            keysToKeep.push(bgmKey);

            // Preload Battle SFX
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
                requiredAudio.push(sfx);
                keysToKeep.push(sfx.key);
            });
        }

        // Bersihkan memori audio yang tidak lagi diperlukan
        const currentKeys = this.cache.audio.getKeys();
        currentKeys.forEach(k => {
            if (!keysToKeep.includes(k) && k.startsWith('bgm_')) {
                this.cache.audio.remove(k);
            }
        });

        // Muat yang belum ada di cache
        let needsLoad = false;
        requiredAudio.forEach(aud => {
            if (!this.cache.audio.exists(aud.key)) {
                this.load.audio(aud.key, aud.url);
                needsLoad = true;
            }
        });

        if (needsLoad) {
            this.load.once('complete', () => {
                onComplete();
            });
            this.load.start();
        } else {
            onComplete();
        }
    }
}
