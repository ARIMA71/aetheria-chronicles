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

    create() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const CX = W / 2;
        const CY = H / 2;

        // Background
        this.add.rectangle(0, 0, W, H, THEME.BG).setOrigin(0);

        // Center Title/Logo
        this.add.text(CX, CY - 20, 'AETHERIA', {
            fontSize: '24px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: THEME.TEXT_PRIMARY,
            letterSpacing: 6
        }).setOrigin(0.5);

        this.add.text(CX, CY + 10, 'CHRONICLES', {
            fontSize: '14px',
            fontFamily: 'Outfit',
            color: THEME.AETHER,
            letterSpacing: 4
        }).setOrigin(0.5);

        // Center loading text below logo
        const loadingText = this.add.text(CX, CY + 50, 'Loading', {
            fontSize: '14px',
            fontStyle: 'italic',
            fontFamily: 'Outfit',
            color: THEME.TEXT_MUTED
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
        const keysToKeep = ['bgm_mainmenu_1', 'bgm_mainmenu_2', 'sfx_select'];
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
