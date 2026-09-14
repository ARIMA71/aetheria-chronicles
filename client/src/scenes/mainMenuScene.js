import Phaser from 'phaser';
import { THEME } from '../main.js';
import { playGlobalBGM } from '../utils/audioManager.js';
import { checkSession, clearSession, saveCurrentScene } from '../utils/auth.js';
import BattleApi from '../services/BattleApi.js';
import PartyApi from '../services/PartyApi.js';
import TopMenuComponent from '../ui/TopMenuComponent.js';
import { API_BASE } from '../config.js';

const W = 480, H = 880, CX = 240;

export default class MainMenuScene extends Phaser.Scene {
    constructor() {
        super('MainMenuScene');
    }

    preload() {
        this.load.image('bg_mainMenu', 'assets/backgrounds/mainMenu.jpg');
        if (!this.textures.exists('btn_icon_normal')) this.load.image('btn_icon_normal', 'assets/ui/button/C/Icon Button.png');
        if (!this.textures.exists('btn_icon_hover')) this.load.image('btn_icon_hover', 'assets/ui/button/C/Icon Button Hover.png');
        if (!this.textures.exists('card_x100')) this.load.image('card_x100', 'assets/ui/card/Card X100.png');
        if (!this.textures.exists('card_x12')) this.load.image('card_x12', 'assets/ui/card/Card X12.png');
        if (!this.textures.exists('progressbar_bg')) this.load.image('progressbar_bg', 'assets/ui/progressBar/ProgressBar Background.png');
        if (!this.textures.exists('progressbar_fg')) this.load.image('progressbar_fg', 'assets/ui/progressBar/ProgressBarForeground.png');
    }

    create() {
        if (!checkSession(this)) return;
        saveCurrentScene(this.scene.key);
        playGlobalBGM(this, 'main_menu');

        // Clean up timer and tweens on scene shutdown to prevent memory leaks
        this.events.on('shutdown', () => {
            if (this.staminaTimer) {
                this.staminaTimer.destroy();
                this.staminaTimer = null;
            }
            if (this._questPulseTween) {
                this._questPulseTween.stop();
                this._questPulseTween.destroy();
                this._questPulseTween = null;
            }
        });

        // Read player data from localStorage as immediate fallback
        const raw = localStorage.getItem('aetheria_player');
        this.playerData = raw ? JSON.parse(raw) : {
            player_id: 1,
            username: 'Player',
            player_level: 1,
            stamina: 100,
            gold: 0,
            diamond: 0,
            currency: 0,
            current_quest_stage: 5
        };

        // Initialize Audio setting flags from localStorage
        this.musicOn = localStorage.getItem('music_on') !== 'false';
        this.sfxOn = localStorage.getItem('sfx_on') !== 'false';

        // ── Background ──
        const bg = this.add.image(CX, H / 2, 'bg_mainMenu').setOrigin(0.5);
        const scale = Math.max(W / bg.width, H / bg.height);
        bg.setScale(scale);

        // ── Haze Effect ──
        const haze = this.add.graphics();
        // Extended smooth gradient fade from alpha 0 (at y=480, starting above Quest button) down to alpha 1 (at y=645)
        haze.fillGradientStyle(0x0f172a, 0x0f172a, 0x0f172a, 0x0f172a, 0, 0, 1, 1);
        haze.fillRect(0, 480, W, 165);
        // Solid 100% dark navy base behind the STATS panel to the bottom
        haze.fillStyle(0x0f172a, 1.0);
        haze.fillRect(0, 645, W, H - 645);

        // Build UI Layers
        this._buildTopBar();
        this._buildStaminaBar();
        this._buildCenterArea();
        this._buildFABCluster();
        this._buildStatsPanel();

        // Integrate TopMenuComponent
        this.topMenu = new TopMenuComponent(this);

        // Initial UI Update from local cache
        this.updateUIElements();

        // Fetch latest profile from backend in real-time
        this.fetchPlayerProfile();

        // Cek apakah ada pertempuran aktif yang terputus
        this._checkActiveBattle();
    }

    async fetchPlayerProfile() {
        const token = localStorage.getItem('aetheria_token');
        if (!this.playerData || !this.playerData.player_id) return;

        try {
            const res = await fetch(`${API_BASE}/api/player/${this.playerData.player_id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const json = await res.json();
            if (json.status === 'success') {
                this.playerData = json.data;
                localStorage.setItem('aetheria_player', JSON.stringify(json.data));
                this.updateUIElements();

                if (this.playerData.is_guest === 1 && !sessionStorage.getItem('guest_reminder_shown')) {
                    this._showGuestReminderModal();
                }
            }
        } catch (err) {
            console.error('Failed to fetch player profile:', err);
        }
    }

    updateUIElements() {
        if (!this.playerData) return;

        // Stamina bar fill (using setDisplaySize for progressbar_fg)
        if (this.staminaFill) {
            const maxStam = this.playerData.max_stamina || 100;
            const ratio = Math.min(1, Math.max(0, this.playerData.stamina / maxStam));
            const barW = 160;
            const targetW = Math.max(1, barW * ratio);
            if (this.staminaFill.setDisplaySize) {
                this.staminaFill.setDisplaySize(targetW, 8);
            } else if (this.staminaFill.setSize) {
                this.staminaFill.setSize(targetW, 6);
            }
        }

        // Start or update stamina regen countdown timer (5 mins)
        if (this.staminaTimer) {
            this.staminaTimer.destroy();
            this.staminaTimer = null;
        }

        const maxStam = this.playerData.max_stamina || 100;
        if (this.playerData.stamina < maxStam && this.playerData.stamina_refill_in > 0) {
            this.staminaRefillSeconds = this.playerData.stamina_refill_in;
            this.updateStaminaText();
            this.staminaTimer = this.time.addEvent({
                delay: 1000,
                callback: () => {
                    this.staminaRefillSeconds--;
                    if (this.staminaRefillSeconds <= 0) {
                        if (this.staminaTimer) this.staminaTimer.destroy();
                        this.staminaTimer = null;
                        this.fetchPlayerProfile();
                    } else {
                        this.updateStaminaText();
                    }
                },
                loop: true
            });
        } else {
            this.updateStaminaText();
        }

        // Stats panel texts
        if (this.usernameText) {
            this.usernameText.setText(`👤  ${this.playerData.username}`);
        }
        if (this.goldText) {
            this.goldText.setText(`🪙  ${this.playerData.gold || 0}`);
        }
        if (this.diamondText) {
            this.diamondText.setText(`💎  ${this.playerData.diamond || 0}`);
        }
        if (this.rankText) {
            this.rankText.setText(`${this.playerData.player_level}`);
        }
        if (this.questText) {
            const stage = this.playerData.current_quest_stage || 1;
            this.questText.setText(`📍 Quest: Stage ${stage}`);
        }
        this.updateRankExpUI();
    }

    _getRankCumulativeExp(lvl) {
        if (lvl <= 1) return 0;
        let total = 0;
        for (let i = 2; i <= lvl; i++) {
            total += Math.floor(100 * Math.pow(i, 1.8));
        }
        return total;
    }

    updateRankExpUI() {
        if (!this.playerData || (!this.rankFill && !this.rankExpText)) return;

        const currentLevel = Math.max(1, this.playerData.player_level || 1);
        const totalExp = this.playerData.player_exp || 0;
        const maxLevel = 100;

        const baseExp = this._getRankCumulativeExp(currentLevel);
        const nextExp = this._getRankCumulativeExp(currentLevel + 1);

        let currentLevelExp = totalExp - baseExp;
        let neededExp = nextExp - baseExp;

        const rankBarW = this.rankBarW || ((this.cameras.main.width - 40) - 55);
        const maxFillW = Math.max(1, rankBarW - 4);

        if (currentLevel >= maxLevel) {
            if (this.rankExpText) this.rankExpText.setText('EXP MAX');
            if (this.rankFill) {
                if (this.rankFill.setDisplaySize) this.rankFill.setDisplaySize(maxFillW, 10);
                else if (this.rankFill.setSize) this.rankFill.setSize(maxFillW, 8);
            }
        } else {
            if (currentLevelExp < 0) currentLevelExp = 0;
            if (neededExp <= 0) neededExp = 1;

            const ratio = Math.min(1, Math.max(0, currentLevelExp / neededExp));
            const targetW = Math.max(1, maxFillW * ratio);

            if (this.rankExpText) {
                this.rankExpText.setText(`EXP ${currentLevelExp} / ${neededExp}`);
            }

            if (this.rankFill) {
                if (this.rankFill.setDisplaySize) {
                    this.rankFill.setDisplaySize(targetW, 10);
                } else if (this.rankFill.setSize) {
                    this.rankFill.setSize(targetW, 8);
                }
            }
        }
    }

    updateStaminaText() {
        if (!this.playerData || !this.staminaText) return;
        const maxStam = this.playerData.max_stamina || 100;
        if (this.playerData.stamina >= maxStam) {
            this.staminaText.setText(`${this.playerData.stamina}/${maxStam}`);
        } else if (this.staminaRefillSeconds > 0) {
            const minutes = Math.floor(this.staminaRefillSeconds / 60);
            const seconds = this.staminaRefillSeconds % 60;
            const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            this.staminaText.setText(`${this.playerData.stamina}/${maxStam} (${timeStr})`);
        } else {
            this.staminaText.setText(`${this.playerData.stamina}/${maxStam}`);
        }
    }

    _buildTopBar() {
        // Top Bar Panel
        const topBar = this.add.rectangle(CX, 30, W, 60, THEME.PANEL, THEME.PANEL_ALPHA);
        topBar.setStrokeStyle(1, THEME.BORDER);

        this.add.text(CX, 30, 'HOME', {
            fontSize: '15px',
            fontStyle: 'bold',
            color: THEME.TEXT_PRIMARY,
            fontFamily: 'Outfit',
            letterSpacing: 2
        }).setOrigin(0.5);
    }

    _buildStaminaBar() {
        const boxX = 10;
        const boxY = 68;
        const boxW = 180;
        const boxH = 46;

        // Container Box Background using Card X12.png (Tinted Sky Blue)
        if (this.textures.exists('card_x12')) {
            this.add.image(boxX + boxW / 2, boxY + boxH / 2, 'card_x12').setDisplaySize(boxW, boxH).setTint(0x38bdf8);
        } else {
            const stamContainer = this.add.rectangle(boxX + boxW / 2, boxY + boxH / 2, boxW, boxH, 0x0f172a, 0.95);
            stamContainer.setStrokeStyle(1.5, 0x38bdf8);
        }

        const textY = boxY + 14;
        const barY = boxY + 30;
        const barW = boxW - 20;
        const barX = boxX + 10;

        // Pure White Stamina Label
        this.add.text(barX, textY, '⚡ STAMINA', {
            fontSize: '10px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: '#ffffff',
            letterSpacing: 0.5
        }).setOrigin(0, 0.5);

        // Pure White Stamina Value (keep reference)
        this.staminaText = this.add.text(boxX + boxW - 10, textY, '100/100', {
            fontSize: '10px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: '#ffffff'
        }).setOrigin(1, 0.5);

        // Stamina Bar Inner Background & Fill using ProgressBar assets
        if (this.textures.exists('progressbar_bg')) {
            this.add.image(barX + barW / 2, barY, 'progressbar_bg').setDisplaySize(barW, 10);
        } else {
            const stBg = this.add.rectangle(barX + barW / 2, barY, barW, 8, 0x1e293b);
            stBg.setStrokeStyle(1, 0x334155);
        }

        if (this.textures.exists('progressbar_fg')) {
            this.staminaFill = this.add.image(barX + 1, barY, 'progressbar_fg').setOrigin(0, 0.5);
            this.staminaFill.setDisplaySize(Math.max(1, barW - 2), 8);
        } else {
            this.staminaFill = this.add.rectangle(barX, barY, barW, 6, THEME.HEALTH).setOrigin(0, 0.5);
        }

        // Interactive Hit Zone for Stamina Container Box
        const staminaHitZone = this.add.rectangle(boxX + boxW / 2, boxY + boxH / 2, boxW, boxH, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        staminaHitZone.on('pointerdown', () => {
            this.showStaminaRefillModal();
        });
    }

    async showStaminaRefillModal() {
        if (this.staminaModalContainer) this.staminaModalContainer.destroy();
        this.staminaModalContainer = this.add.container(0, 0).setDepth(400);

        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const CX = W / 2;
        const CY = H / 2;

        // 1. Dark Overlay Backdrop
        const ov = this.add.rectangle(CX, CY, W, H, 0x000000, 0.85).setInteractive();
        ov.on('pointerdown', (p, x, y, e) => e.stopPropagation());

        // 2. Main Box Panel (card_x101 or fallback)
        const panelW = 380;
        const panelH = 430;
        let pnl;
        if (this.textures.exists('card_x101')) {
            pnl = this.add.image(CX, CY, 'card_x101').setDisplaySize(panelW, panelH);
            pnl.setTint(0x38bdf8);
        } else {
            pnl = this.add.rectangle(CX, CY, panelW, panelH, 0x0d1b2a).setStrokeStyle(2, 0x38bdf8);
        }
        pnl.setInteractive();
        pnl.on('pointerdown', (p, x, y, e) => e.stopPropagation());

        // Title
        const titleTxt = this.add.text(CX, CY - 165, '⚡ ISI ULANG STAMINA', {
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#f59e0b',
            fontFamily: 'Outfit, Inter, sans-serif',
            stroke: '#000000',
            strokeThickness: 3,
            letterSpacing: 2
        }).setOrigin(0.5);

        const loadingTxt = this.add.text(CX, CY - 20, 'Memuat data inventory...', {
            fontSize: '13px',
            color: THEME.TEXT_MUTED,
            fontFamily: 'Outfit, Inter, sans-serif'
        }).setOrigin(0.5);

        this.staminaModalContainer.add([ov, pnl, titleTxt, loadingTxt]);

        let potionCount = 0;
        try {
            const res = await fetch(`${API_BASE}/api/party/${this.playerId}/inventory/all`);
            const json = await res.json();
            if (json.status === 'success') {
                const materials = json.data.materials || [];
                const pot = materials.find(m => m.mat_id === 7 || m.mat_id === 8);
                potionCount = pot ? pot.quantity : 0;
            }
        } catch (e) {
            console.error('Failed to fetch inventory for stamina modal:', e);
        }

        loadingTxt.destroy();

        const maxStam = this.playerData ? (this.playerData.max_stamina || 100) : 100;
        const currentStam = this.playerData ? (this.playerData.stamina || 0) : 0;

        // Info Text: Natural Refill
        const infoRefill = this.add.text(CX, CY - 125, `⚡ Refill Alami: 1 Stamina / 5 Menit (Max ${maxStam})`, {
            fontSize: '12px',
            color: '#94a3b8',
            fontFamily: 'Outfit, Inter, sans-serif'
        }).setOrigin(0.5);

        // Info Text: Potion Effect
        const infoPotion = this.add.text(CX, CY - 100, `🧪 1x Full Potion memulihkan +120 Stamina (Max Cap 999)`, {
            fontSize: '12px',
            color: '#38bdf8',
            fontStyle: 'bold',
            fontFamily: 'Outfit, Inter, sans-serif'
        }).setOrigin(0.5);

        // Stock Info
        const stockTxt = this.add.text(CX, CY - 75, `Stok Full Potion: ${potionCount}x tersedia`, {
            fontSize: '14px',
            fontStyle: 'bold',
            color: potionCount > 0 ? '#10b981' : '#ef4444',
            fontFamily: 'Outfit, Inter, sans-serif'
        }).setOrigin(0.5);

        // Separator line
        const sep = this.add.rectangle(CX, CY - 55, panelW - 60, 1, 0x334155);

        let selectedQty = potionCount > 0 ? 1 : 0;

        // Quantity Selector UI
        const qtyLabel = this.add.text(CX, CY - 38, 'Jumlah yang ingin digunakan:', {
            fontSize: '12px',
            color: '#cbd5e1',
            fontFamily: 'Outfit, Inter, sans-serif'
        }).setOrigin(0.5);

        const qtyY = CY - 5;
        const qtyValueTxt = this.add.text(CX, qtyY, `${selectedQty}`, {
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#ffffff',
            fontFamily: 'Outfit, Inter, sans-serif'
        }).setOrigin(0.5);

        const minusBtn = this.add.text(CX - 50, qtyY, '-', {
            fontSize: '22px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#334155', padding: { x: 12, y: 3 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const plusBtn = this.add.text(CX + 50, qtyY, '+', {
            fontSize: '22px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#334155', padding: { x: 12, y: 3 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const minus10Btn = this.add.text(CX - 100, qtyY, '-10', {
            fontSize: '14px', fontStyle: 'bold', color: '#94a3b8', backgroundColor: '#1e293b', padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const plus10Btn = this.add.text(CX + 100, qtyY, '+10', {
            fontSize: '14px', fontStyle: 'bold', color: '#94a3b8', backgroundColor: '#1e293b', padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        // Result calculation text
        const resultTxt = this.add.text(CX, CY + 30, `Pemulihan: +${selectedQty * 120} Stamina ➔ Total: ${Math.min(999, currentStam + selectedQty * 120)} Stamina`, {
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#facc15',
            fontFamily: 'Outfit, Inter, sans-serif'
        }).setOrigin(0.5);

        // Buttons (2 Vertical Buttons: USE above CANCEL)
        const btnW = 300;
        const btnH = 44;

        // 1. USE BUTTON (Top)
        const btnUseY = CY + 80;
        let useBtnImg;
        if (this.textures.exists('btn_a_normal')) {
            useBtnImg = this.add.image(CX, btnUseY, 'btn_a_normal').setDisplaySize(btnW, btnH);
        } else {
            useBtnImg = this.add.rectangle(CX, btnUseY, btnW, btnH, 0x1a3a2a).setStrokeStyle(2, 0x2ecc71);
        }
        useBtnImg.setTint(potionCount > 0 ? 0x2ecc71 : 0x555555);

        const useBtnTxt = this.add.text(CX, btnUseY, potionCount > 0 ? `🧪 GUNAKAN (${selectedQty})` : 'STOK HABIS', {
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#ffffff',
            fontFamily: 'Outfit, Inter, sans-serif',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        const updateQty = (delta) => {
            if (potionCount <= 0) {
                selectedQty = 0;
            } else {
                let n = selectedQty + delta;
                if (n < 1) n = 1;
                if (n > potionCount) n = potionCount;
                selectedQty = n;
            }
            qtyValueTxt.setText(`${selectedQty}`);
            const added = selectedQty * 120;
            const finalStam = Math.min(999, currentStam + added);
            resultTxt.setText(`Pemulihan: +${added} Stamina ➔ Total: ${finalStam} Stamina`);

            if (selectedQty > 0) {
                useBtnTxt.setText(`🧪 GUNAKAN (${selectedQty})`);
                useBtnImg.setTint(0x2ecc71);
            } else {
                useBtnTxt.setText('STOK HABIS');
                useBtnImg.setTint(0x555555);
            }
        };

        minusBtn.on('pointerdown', () => updateQty(-1));
        plusBtn.on('pointerdown', () => updateQty(1));
        minus10Btn.on('pointerdown', () => updateQty(-10));
        plus10Btn.on('pointerdown', () => updateQty(10));

        const useHitZone = this.add.rectangle(CX, btnUseY, btnW, btnH, 0x000000, 0).setInteractive({ useHandCursor: true });
        useHitZone.on('pointerover', () => {
            if (selectedQty > 0) {
                if (this.textures.exists('btn_a_hover')) useBtnImg.setTexture('btn_a_hover');
                useBtnImg.setTint(0x52be80);
            }
        });
        useHitZone.on('pointerout', () => {
            if (selectedQty > 0) {
                if (this.textures.exists('btn_a_normal')) useBtnImg.setTexture('btn_a_normal');
                useBtnImg.setTint(0x2ecc71);
            }
        });
        useHitZone.on('pointerdown', async () => {
            if (selectedQty <= 0) return;
            useBtnTxt.setText('MEMPROSES...').setColor('#f59e0b');
            try {
                const res = await fetch(`${API_BASE}/api/player/use-stamina-potion`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playerId: this.playerId, quantity: selectedQty })
                });
                const json = await res.json();
                if (json.status === 'success') {
                    if (this.playerData) {
                        this.playerData.stamina = json.data.stamina;
                    }
                    const pd = JSON.parse(localStorage.getItem('aetheria_player') || '{}');
                    pd.stamina = json.data.stamina;
                    localStorage.setItem('aetheria_player', JSON.stringify(pd));

                    this.updateUIElements();
                    if (this.staminaModalContainer) this.staminaModalContainer.destroy();
                } else {
                    useBtnTxt.setText(json.message || 'GAGAL').setColor('#ef4444');
                }
            } catch (e) {
                console.error('Use stamina potion error:', e);
                useBtnTxt.setText('ERROR JARINGAN').setColor('#ef4444');
            }
        });

        // 2. CANCEL BUTTON (Bottom)
        const btnCancelY = CY + 140;
        let cancelBtnImg;
        if (this.textures.exists('btn_a_normal')) {
            cancelBtnImg = this.add.image(CX, btnCancelY, 'btn_a_normal').setDisplaySize(btnW, 40);
            cancelBtnImg.setTint(0xe74c3c);
        } else {
            cancelBtnImg = this.add.rectangle(CX, btnCancelY, btnW, 40, 0x2a0d0d).setStrokeStyle(1, 0xe74c3c);
        }

        const cancelTxt = this.add.text(CX, btnCancelY, 'BATAL', {
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#ffffff',
            fontFamily: 'Outfit, Inter, sans-serif',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        const cancelHitZone = this.add.rectangle(CX, btnCancelY, btnW, 40, 0x000000, 0).setInteractive({ useHandCursor: true });
        cancelHitZone.on('pointerover', () => {
            if (this.textures.exists('btn_a_hover')) cancelBtnImg.setTexture('btn_a_hover');
            cancelBtnImg.setTint(0xec7063);
        });
        cancelHitZone.on('pointerout', () => {
            if (this.textures.exists('btn_a_normal')) cancelBtnImg.setTexture('btn_a_normal');
            cancelBtnImg.setTint(0xe74c3c);
        });
        cancelHitZone.on('pointerdown', () => {
            if (this.staminaModalContainer) this.staminaModalContainer.destroy();
        });

        this.staminaModalContainer.add([
            infoRefill, infoPotion, stockTxt, sep, qtyLabel, qtyValueTxt,
            minusBtn, plusBtn, minus10Btn, plus10Btn, resultTxt,
            useBtnImg, useBtnTxt, useHitZone,
            cancelBtnImg, cancelTxt, cancelHitZone
        ]);
    }

    _buildCenterArea() {
        const centerY = 290;
        const frameW = 260, frameH = 340;

        const frame = this.add.rectangle(CX, centerY, frameW, frameH, THEME.PANEL, 0.4);
        frame.setStrokeStyle(1, THEME.BORDER);

        this.add.text(CX, centerY, '[ CHARACTER ART ]', {
            fontSize: '12px',
            fontFamily: 'Outfit',
            color: THEME.TEXT_MUTED
        }).setOrigin(0.5);
    }

    _buildFABCluster() {
        const skyBlue = 0x38bdf8;
        const skyBlueHover = 0x60a5fa;

        // Party (Kiri - Y=555, size=94)
        this.partyFab = this._createButtonC(155, 555, 94, 'PARTY', skyBlue, skyBlueHover, () => {
            this.scene.start('LoadingScene', { targetScene: 'PartyScene' });
        });

        // Quest (Tengah - Y=520, size=119)
        this.questFab = this._createButtonC(CX, 520, 119, 'QUEST', skyBlue, skyBlueHover, () => {
            this.scene.start('LoadingScene', { targetScene: 'QuestScene' });
        });

        // Gacha (Kanan - Y=555, size=94)
        this.gachaFab = this._createButtonC(325, 555, 94, 'GACHA', skyBlue, skyBlueHover, () => {
            this.scene.start('LoadingScene', { targetScene: 'GachaScene' });
        });
    }

    _createButtonC(x, y, baseSize, label, defaultTint, hoverTint, onClick) {
        const circleBg = this.add.circle(x, y, (baseSize / 2) - 18, 0x0f172a, 1.0);

        const btnKey = this.textures.exists('btn_icon_normal') ? 'btn_icon_normal' : null;
        let btn;

        if (btnKey) {
            btn = this.add.image(x, y, 'btn_icon_normal').setOrigin(0.5);
            btn.setDisplaySize(baseSize, baseSize);
            btn.setInteractive({ useHandCursor: true });
            btn.setTint(defaultTint);
        } else {
            btn = this.add.circle(x, y, baseSize / 2, 0x0f172a);
            btn.setStrokeStyle(2, defaultTint);
            btn.setInteractive({ useHandCursor: true });
        }

        const txt = this.add.text(x, y, label, {
            fontSize: baseSize > 100 ? '14px' : '11px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: '#ffffff',
            letterSpacing: 1
        }).setOrigin(0.5);

        btn.on('pointerover', () => {
            btn._isHovered = true;
            if (this.textures.exists('btn_icon_hover')) btn.setTexture('btn_icon_hover');
            if (btn.setTint) btn.setTint(hoverTint);
            btn.setDisplaySize(baseSize * 1.06, baseSize * 1.06);
            circleBg.setScale(1.06);
            txt.setScale(1.06);
        });

        btn.on('pointerout', () => {
            btn._isHovered = false;
            if (this.textures.exists('btn_icon_normal')) btn.setTexture('btn_icon_normal');
            if (btn.setTint && !btn._isPulsing) btn.setTint(defaultTint);
            btn.setDisplaySize(baseSize, baseSize);
            circleBg.setScale(1.0);
            txt.setScale(1.0);
        });

        btn.on('pointerdown', () => {
            btn.setDisplaySize(baseSize * 0.95, baseSize * 0.95);
            circleBg.setScale(0.95);
            txt.setScale(0.95);
        });

        btn.on('pointerup', () => {
            btn.setDisplaySize(baseSize, baseSize);
            circleBg.setScale(1.0);
            txt.setScale(1.0);
            if (onClick) onClick();
        });

        return { btn, circleBg, txt };
    }

    _buildStatsPanel() {
        const panelY = 720;
        const panelH = 146;
        const panelW = W - 20;

        // 1. Container Background using Card X100.png (Tinted Sky Blue)
        if (this.textures.exists('card_x100')) {
            this.add.image(CX, panelY, 'card_x100').setDisplaySize(panelW, panelH).setTint(0x38bdf8);
        } else {
            const panel = this.add.rectangle(CX, panelY, panelW, panelH, THEME.PANEL, THEME.PANEL_ALPHA);
            panel.setStrokeStyle(1, THEME.BORDER);
        }

        // Header
        this.add.text(CX, panelY - panelH / 2 + 16, 'PLAYER PROFILE', {
            fontSize: '11px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: '#A5B4FC',
            letterSpacing: 2
        }).setOrigin(0.5);

        // Divider Line
        this.add.rectangle(CX, panelY - panelH / 2 + 30, panelW - 30, 1, 0x334155);

        // Row 1: Player Name (Left) & Gold (Right)
        const row1Y = panelY - 20;
        this.usernameText = this.add.text(35, row1Y, `👤  ${this.playerData.username || 'Player'}`, {
            fontSize: '12px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: THEME.TEXT_PRIMARY
        }).setOrigin(0, 0.5);

        this.goldText = this.add.text(W - 35, row1Y, `🪙  ${this.playerData.gold || 0}`, {
            fontSize: '12px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: '#FFD700'
        }).setOrigin(1, 0.5);

        // Row 2: Rank (Left) & Diamond (Right)
        const row2Y = panelY + 4;
        this.add.text(35, row2Y, `Rank:`, {
            fontSize: '10px',
            fontFamily: 'Outfit',
            color: THEME.TEXT_SECONDARY
        }).setOrigin(0, 0.5);

        this.rankText = this.add.text(70, row2Y, `${this.playerData.player_level || 1}`, {
            fontSize: '11px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: THEME.TEXT_PRIMARY
        }).setOrigin(0, 0.5);

        this.diamondText = this.add.text(W - 35, row2Y, `💎  ${this.playerData.diamond || 0}`, {
            fontSize: '12px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: '#00FFFF'
        }).setOrigin(1, 0.5);

        // Row 3: EXP Progress Bar (Using assets/ui/progressBar/ProgressBar Background & Foreground)
        const barY = panelY + 28;
        const rankBarW = panelW - 55;
        this.rankBarW = rankBarW;
        if (this.textures.exists('progressbar_bg')) {
            this.add.image(CX, barY, 'progressbar_bg').setDisplaySize(rankBarW, 14);
        } else {
            this.add.rectangle(CX, barY, rankBarW, 10, 0x0f172a).setStrokeStyle(1, THEME.BORDER);
        }

        const fillStartX = CX - rankBarW / 2 + 2;
        if (this.textures.exists('progressbar_fg')) {
            this.rankFill = this.add.image(fillStartX, barY, 'progressbar_fg').setOrigin(0, 0.5);
            this.rankFill.setDisplaySize(1, 10);
        } else {
            this.rankFill = this.add.rectangle(fillStartX, barY, 1, 8, THEME.HEALTH).setOrigin(0, 0.5);
        }

        this.rankExpText = this.add.text(CX, barY, 'EXP 0 / 100', {
            fontSize: '9px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        this.updateRankExpUI();

        // Row 4: Main Quest Info (Left) & Highest Party Power (Right)
        const bottomRowY = panelY + 52;
        const stage = this.playerData.current_quest_stage || 1;
        this.questText = this.add.text(35, bottomRowY, `📍 Quest: Stage ${stage}`, {
            fontSize: '10px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: '#a5b4fc'
        }).setOrigin(0, 0.5);

        this.partyPowerText = this.add.text(W - 35, bottomRowY, `⚡ Max Power: --`, {
            fontSize: '10px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: '#f59e0b'
        }).setOrigin(1, 0.5);

        // Compute highest party power from player's presets
        this._loadHighestPartyPower();
    }

    async _loadHighestPartyPower() {
        try {
            const playerId = this.playerData.player_id || 1;
            const presetsRes = await PartyApi.getPresets(playerId);
            const invRes = await PartyApi.getInventory(playerId);

            if (presetsRes.status === 'success' && invRes.status === 'success') {
                const presets = presetsRes.data;
                const characters = invRes.data.characters;
                const weapons = invRes.data.weapons;

                let maxPower = 0;

                presets.forEach(preset => {
                    const slotInvIds = [
                        preset.main_char_inv_id,
                        preset.char_slot_1_inv_id,
                        preset.char_slot_2_inv_id,
                        preset.char_slot_3_inv_id
                    ].filter(id => id !== null);

                    const charsInPreset = slotInvIds.map(invId => characters.find(c => c.inv_id === invId)).filter(c => c);

                    let totalHp = 0;
                    let totalAtk = 0;
                    let totalDef = 0;

                    charsInPreset.forEach(c => {
                        const level = c.item_level || 1;
                        totalHp += c.mc_base_hp + (c.mc_hp_growth * (level - 1));
                        totalAtk += c.mc_base_atk + (c.mc_atk_growth * (level - 1));
                        totalDef += c.mc_base_def + (c.mc_def_growth * (level - 1));
                    });

                    const weapIds = [preset.weap_grid_1_inv_id, preset.weap_grid_2_inv_id, preset.weap_grid_3_inv_id, preset.weap_grid_4_inv_id, preset.weap_grid_5_inv_id];
                    weapIds.forEach(id => {
                        if (id && weapons) {
                            const w = weapons.find(x => x.inv_id === id);
                            if (w) {
                                const level = w.item_level || 1;
                                totalHp += w.mw_base_hp + (w.mw_hp_growth * (level - 1));
                                totalAtk += w.mw_base_atk + (w.mw_atk_growth * (level - 1));
                            }
                        }
                    });

                    const power = Math.floor((totalHp / 5) + totalAtk + totalDef);
                    if (power > maxPower) maxPower = power;
                });

                if (this.partyPowerText) {
                    this.partyPowerText.setText(`⚡ Max Power: ${maxPower}`);
                }
            }
        } catch (e) {
            console.error('Failed to load highest party power:', e);
        }
    }

    _showGuestReminderModal() {
        sessionStorage.setItem('guest_reminder_shown', 'true');

        const rContainer = this.add.container(0, 0).setDepth(9000);

        const sysW = this.scale.width;
        const sysH = this.scale.height;
        const rBackdrop = this.add.rectangle(sysW / 2, sysH / 2, sysW, sysH, 0x000000, 0.8).setInteractive();

        const rPanel = this.add.rectangle(CX, H / 2, 320, 180, 0x0B1120).setInteractive();
        rPanel.setStrokeStyle(2, 0xfacc15);

        const rTitle = this.add.text(CX, H / 2 - 50, '⚠️ PERINGATAN KEAMANAN', {
            fontSize: '14px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#facc15'
        }).setOrigin(0.5);

        const rText = this.add.text(CX, H / 2 - 10, 'Anda masih bermain menggunakan Akun Guest.\nBind akun dengan password sekarang agar data Anda tidak hilang terhapus sistem!', {
            fontSize: '12px', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY, align: 'center', wordWrap: { width: 280 }
        }).setOrigin(0.5);

        // Nanti Saja Btn
        const btnLater = this.add.rectangle(CX - 75, H / 2 + 50, 120, 32, THEME.PANEL).setInteractive({ useHandCursor: true }).setStrokeStyle(1, THEME.BORDER);
        const txtLater = this.add.text(CX - 75, H / 2 + 50, 'Nanti Saja', { fontSize: '12px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_SECONDARY }).setOrigin(0.5);
        btnLater.on('pointerdown', () => {
            rContainer.destroy();
        });

        // Bind Sekarang Btn
        const btnBind = this.add.rectangle(CX + 75, H / 2 + 50, 120, 32, 0xca8a04).setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0xfacc15);
        const txtBind = this.add.text(CX + 75, H / 2 + 50, 'Bind Sekarang', { fontSize: '12px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#ffffff' }).setOrigin(0.5);
        btnBind.on('pointerdown', () => {
            rContainer.destroy();
            if (this.topMenu) this.topMenu._showBindAccountForm(false);
        });

        rContainer.add([rBackdrop, rPanel, rTitle, rText, btnLater, txtLater, btnBind, txtBind]);
    }

    async _checkActiveBattle() {
        if (!this.playerData || !this.playerData.player_id) return;
        try {
            const res = await BattleApi.checkActiveBattle(this.playerData.player_id);
            if (res.status === 'success' && res.data && res.data.has_active) {
                // Tampilkan indikator berkedip di tombol Quest HANYA jika ada battle aktif yang belum selesai
                if (this.questFab && this.questFab.btn) {
                    this.questFab.btn._isPulsing = true;

                    if (!this._questPulseTween) {
                        const redColor = Phaser.Display.Color.ValueToColor(0xef4444);
                        const blueColor = Phaser.Display.Color.ValueToColor(0x38bdf8);

                        this._questPulseTween = this.tweens.addCounter({
                            from: 0,
                            to: 100,
                            duration: 1500,
                            yoyo: true,
                            repeat: -1,
                            ease: 'Sine.easeInOut',
                            onUpdate: (tween) => {
                                const value = tween.getValue();
                                const col = Phaser.Display.Color.Interpolate.ColorWithColor(blueColor, redColor, 100, value);
                                const tint = Phaser.Display.Color.GetColor(col.r, col.g, col.b);
                                if (this.questFab && this.questFab.btn && !this.questFab.btn._isHovered) {
                                    if (this.questFab.btn.setTint) {
                                        this.questFab.btn.setTint(tint);
                                    }
                                }
                            }
                        });
                    }
                }

                // Indikator red dot berkedip di pojok kanan atas tombol Quest
                if (this.questFab && (this.questFab.btn || this.questFab.circleBg)) {
                    const baseObj = this.questFab.btn || this.questFab.circleBg;
                    const cx = baseObj.x + 30;
                    const cy = baseObj.y - 30;
                    if (!this._redDot) {
                        this._redDot = this.add.circle(cx, cy, 8, 0xef4444).setDepth(50);
                        this._redDot.setStrokeStyle(1, 0xffffff);

                        this.tweens.add({
                            targets: this._redDot,
                            alpha: 0.2,
                            yoyo: true,
                            repeat: -1,
                            duration: 800
                        });
                    }
                }
            } else {
                // Jika tidak ada battle aktif, kembalikan tombol Quest ke Sky Blue tanpa efek berkedip
                if (this.questFab && this.questFab.btn) {
                    this.questFab.btn._isPulsing = false;
                    if (this.questFab.btn.setTint) {
                        this.questFab.btn.setTint(0x38bdf8);
                    }
                }
                if (this._questPulseTween) {
                    this._questPulseTween.stop();
                    this._questPulseTween.destroy();
                    this._questPulseTween = null;
                }
                if (this._redDot) {
                    this._redDot.destroy();
                    this._redDot = null;
                }
            }
        } catch (e) {
            console.error('Failed to check active battle:', e);
        }
    }
}
