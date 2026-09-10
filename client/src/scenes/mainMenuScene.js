import Phaser from 'phaser';
import { THEME } from '../main.js';
import { playGlobalBGM } from '../utils/audioManager.js';
import { checkSession, clearSession, saveCurrentScene } from '../utils/auth.js';
import BattleApi from '../services/BattleApi.js';
import TopMenuComponent from '../ui/TopMenuComponent.js';

const W = 480, H = 880, CX = 240;

export default class MainMenuScene extends Phaser.Scene {
    constructor() {
        super('MainMenuScene');
    }

    create() {
        if (!checkSession(this)) return;
        saveCurrentScene(this.scene.key);
        playGlobalBGM(this, 'main_menu');

        // Clean up timer on scene shutdown to prevent memory leaks
        this.events.on('shutdown', () => {
            if (this.staminaTimer) {
                this.staminaTimer.destroy();
                this.staminaTimer = null;
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
        this.add.rectangle(CX, H / 2, W, H, THEME.BG);

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
            const res = await fetch(`http://localhost:3000/api/player/${this.playerData.player_id}`, {
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

        // Stamina bar fill (using setSize instead of .width to force geometry redraw)
        if (this.staminaFill) {
            const maxStam = this.playerData.max_stamina || 100;
            const ratio = Math.min(1, Math.max(0, this.playerData.stamina / maxStam));
            this.staminaFill.setSize(120 * ratio, 6);
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
            const stage = this.playerData.current_quest_stage || 5;
            this.questText.setText(`Main Quest: Stage ${stage}`);
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
        const barX = 15;
        const textY = 80;
        const barY = 95;
        const barW = 120;

        // Label Stamina
        this.add.text(barX, textY, 'STAMINA', {
            fontSize: '9px',
            fontFamily: 'Outfit',
            color: THEME.TEXT_SECONDARY
        }).setOrigin(0, 0.5);

        // Stamina Bar Background
        const stBg = this.add.rectangle(barX + barW / 2, barY, barW, 8, 0x0F172A);
        stBg.setStrokeStyle(1, THEME.BORDER);

        // Stamina Bar Fill (keep reference)
        this.staminaFill = this.add.rectangle(barX, barY, barW, 6, THEME.HEALTH).setOrigin(0, 0.5);

        // Stamina Value (keep reference)
        this.staminaText = this.add.text(barX + barW, textY, '100/100', {
            fontSize: '9px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: THEME.TEXT_PRIMARY
        }).setOrigin(1, 0.5);
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
        // Floating Action Buttons dengan patokan Quest di kanan
        // Quest (Patokan Utama, nempel di kanan sejajar border stats)
        this.questFab = this._createFAB(425, 575, 40, 'Quest', '#ffffff', () => {
            this.scene.start('LoadingScene', { targetScene: 'QuestScene' });
        });

        // Party (Di atas Quest, sejajar kanan)
        this._createFAB(435, 495, 30, 'Party', '#ffffff', () => {
            this.scene.start('LoadingScene', { targetScene: 'PartyScene' });
        });

        // Gacha (Di sebelah kiri Quest)
        this._createFAB(347, 585, 30, 'Gacha', '#ffffff', () => {
            this.scene.start('LoadingScene', { targetScene: 'GachaScene' });
        });
    }

    _createFAB(x, y, radius, label, textColor, onClick) {
        const circle = this.add.circle(x, y, radius, THEME.PANEL, THEME.PANEL_ALPHA);
        circle.setStrokeStyle(1, THEME.BORDER);
        circle.setInteractive({ useHandCursor: true });

        const txt = this.add.text(x, y, label, {
            fontSize: radius > 35 ? '16px' : '13px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: textColor
        }).setOrigin(0.5);

        circle.on('pointerover', () => {
            circle.setFillStyle(0x334155);
        });
        circle.on('pointerout', () => {
            circle.setFillStyle(THEME.PANEL);
        });
        circle.on('pointerdown', onClick);
        return { circle, txt };
    }

    _buildStatsPanel() {
        const panelY = 710;
        const panelH = 130;
        const panelW = W - 30;

        // Panel background
        const panel = this.add.rectangle(CX, panelY, panelW, panelH, THEME.PANEL, THEME.PANEL_ALPHA);
        panel.setStrokeStyle(1, THEME.BORDER);

        // Header
        this.add.text(CX, panelY - panelH / 2 + 14, 'STATS', {
            fontSize: '11px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: THEME.TEXT_PRIMARY,
            letterSpacing: 2
        }).setOrigin(0.5);

        // Divider
        this.add.rectangle(CX, panelY - panelH / 2 + 26, panelW - 20, 1, THEME.BORDER);

        // Row 1: Player Name (Left) & Gold (Right)
        const row1Y = panelY - 22;
        this.usernameText = this.add.text(30, row1Y, `👤  ${this.playerData.username}`, {
            fontSize: '12px',
            fontFamily: 'Outfit',
            color: THEME.TEXT_PRIMARY
        }).setOrigin(0, 0.5);

        this.goldText = this.add.text(W - 30, row1Y, `🪙  0`, {
            fontSize: '12px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: '#FFD700'
        }).setOrigin(1, 0.5);

        // Row 2: Rank (Left) & Diamond (Right)
        const row2Y = panelY + 2;
        this.add.text(30, row2Y, `Rank:`, {
            fontSize: '10px',
            fontFamily: 'Outfit',
            color: THEME.TEXT_SECONDARY
        }).setOrigin(0, 0.5);

        this.rankText = this.add.text(65, row2Y, `${this.playerData.player_level}`, {
            fontSize: '11px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: THEME.TEXT_PRIMARY
        }).setOrigin(0, 0.5);

        this.diamondText = this.add.text(W - 30, row2Y, `💎  0`, {
            fontSize: '12px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: '#00FFFF'
        }).setOrigin(1, 0.5);

        // Rank Progress Bar
        const barY = panelY + 22;
        const rankBarW = panelW - 40;
        const rankBg = this.add.rectangle(CX, barY, rankBarW, 8, 0x0F172A);
        rankBg.setStrokeStyle(1, THEME.BORDER);
        // Fill (Placeholder 30%)
        this.rankFill = this.add.rectangle(CX - rankBarW / 2 + 2, barY, (rankBarW - 4) * 0.3, 6, THEME.HEALTH).setOrigin(0, 0.5);

        // Quest info
        this.questText = this.add.text(CX, panelY + 44, 'Main Quest: Stage 5', {
            fontSize: '10px',
            fontFamily: 'Outfit',
            color: THEME.TEXT_SECONDARY
        }).setOrigin(0.5);
    }

    _showGuestReminderModal() {
        sessionStorage.setItem('guest_reminder_shown', 'true');
        
        const rContainer = this.add.container(0, 0).setDepth(9000);
        
        const sysW = this.scale.width;
        const sysH = this.scale.height;
        const rBackdrop = this.add.rectangle(sysW/2, sysH/2, sysW, sysH, 0x000000, 0.8).setInteractive();
        
        const rPanel = this.add.rectangle(CX, H/2, 320, 180, 0x0B1120).setInteractive();
        rPanel.setStrokeStyle(2, 0xfacc15);

        const rTitle = this.add.text(CX, H/2 - 50, '⚠️ PERINGATAN KEAMANAN', {
            fontSize: '14px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#facc15'
        }).setOrigin(0.5);

        const rText = this.add.text(CX, H/2 - 10, 'Anda masih bermain menggunakan Akun Guest.\nBind akun dengan password sekarang agar data Anda tidak hilang terhapus sistem!', {
            fontSize: '12px', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY, align: 'center', wordWrap: { width: 280 }
        }).setOrigin(0.5);

        // Nanti Saja Btn
        const btnLater = this.add.rectangle(CX - 75, H/2 + 50, 120, 32, THEME.PANEL).setInteractive({useHandCursor:true}).setStrokeStyle(1, THEME.BORDER);
        const txtLater = this.add.text(CX - 75, H/2 + 50, 'Nanti Saja', { fontSize: '12px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_SECONDARY }).setOrigin(0.5);
        btnLater.on('pointerdown', () => {
            if(this.sound) this.sound.play('sfx_select');
            rContainer.destroy();
        });

        // Bind Sekarang Btn
        const btnBind = this.add.rectangle(CX + 75, H/2 + 50, 120, 32, 0xca8a04).setInteractive({useHandCursor:true}).setStrokeStyle(1, 0xfacc15);
        const txtBind = this.add.text(CX + 75, H/2 + 50, 'Bind Sekarang', { fontSize: '12px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#ffffff' }).setOrigin(0.5);
        btnBind.on('pointerdown', () => {
            if(this.sound) this.sound.play('sfx_select');
            rContainer.destroy();
            if(this.topMenu) this.topMenu.showBindAccountForm();
        });

        rContainer.add([rBackdrop, rPanel, rTitle, rText, btnLater, txtLater, btnBind, txtBind]);
    }

    async _checkActiveBattle() {
        if (!this.playerData || !this.playerData.player_id) return;
        try {
            const res = await BattleApi.checkActiveBattle(this.playerData.player_id);
            if (res.status === 'success' && res.data && res.data.has_active) {
                // Tampilkan indikator merah berkedip di tombol Quest
                if (this.questFab && this.questFab.circle) {
                    const cx = this.questFab.circle.x + 25;
                    const cy = this.questFab.circle.y - 25;
                    const redDot = this.add.circle(cx, cy, 8, 0xef4444).setDepth(50);
                    redDot.setStrokeStyle(1, 0xffffff);

                    this.tweens.add({
                        targets: redDot,
                        alpha: 0.2,
                        yoyo: true,
                        repeat: -1,
                        duration: 800
                    });
                }
            }
        } catch (e) {
            console.error('Failed to check active battle:', e);
        }
    }
}
