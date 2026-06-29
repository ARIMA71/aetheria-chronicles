import Phaser from 'phaser';
import { THEME } from '../main.js';
import { checkSession, clearSession } from '../utils/auth.js';

const W = 450, H = 800, CX = 225;

export default class MainMenuScene extends Phaser.Scene {
    constructor() {
        super('MainMenuScene');
    }

    create() {
        if (!checkSession(this)) return;

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
        this._buildMenuModal();

        // Initial UI Update from local cache
        this.updateUIElements();

        // Fetch latest profile from backend in real-time
        this.fetchPlayerProfile();
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
            }
        } catch (err) {
            console.error('Failed to fetch player profile:', err);
        }
    }

    updateUIElements() {
        if (!this.playerData) return;

        // Stamina text & bar fill
        if (this.staminaText) {
            this.staminaText.setText(`${this.playerData.stamina}/100`);
        }
        if (this.staminaFill) {
            const ratio = Math.min(1, Math.max(0, this.playerData.stamina / 100));
            this.staminaFill.width = 120 * ratio;
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

        // Pojok kanan atas: Bulat bertulisan MENU
        const menuBtn = this.add.circle(W - 40, 30, 18, THEME.PANEL, THEME.PANEL_ALPHA);
        menuBtn.setStrokeStyle(1, THEME.BORDER);
        menuBtn.setInteractive({ useHandCursor: true });

        const menuText = this.add.text(W - 40, 30, 'MENU', {
            fontSize: '8px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: THEME.TEXT_PRIMARY
        }).setOrigin(0.5);

        menuBtn.on('pointerover', () => {
            menuBtn.setFillStyle(0x334155);
            menuText.setColor('#ffffff');
        });
        menuBtn.on('pointerout', () => {
            menuBtn.setFillStyle(THEME.PANEL);
            menuText.setColor(THEME.TEXT_PRIMARY);
        });
        menuBtn.on('pointerdown', () => {
            this.toggleMenuModal(true);
        });
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
        this._createFAB(395, 575, 40, 'Quest', THEME.TEXT_PRIMARY, () => {
            this.scene.start('QuestScene');
        });

        // Party (Di atas Quest, sejajar kanan)
        this._createFAB(405, 495, 30, 'Party', THEME.TEXT_MUTED, () => {
            // Placeholder
        });

        // Gacha (Di sebelah kiri Quest)
        this._createFAB(317, 585, 30, 'Gacha', THEME.TEXT_MUTED, () => {
            // Placeholder
        });
    }

    _createFAB(x, y, radius, label, textColor, onClick) {
        const circle = this.add.circle(x, y, radius, THEME.PANEL, THEME.PANEL_ALPHA);
        circle.setStrokeStyle(1, THEME.BORDER);
        circle.setInteractive({ useHandCursor: true });

        const txt = this.add.text(x, y, label, {
            fontSize: radius > 35 ? '12px' : '10px',
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

    _buildMenuModal() {
        // Container Menu (modal meluncur/tampil dari atas)
        this.menuContainer = this.add.container(0, 0).setDepth(95).setVisible(false);

        // 1. Black low-opacity backdrop (full screen)
        const backdrop = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.75).setInteractive();
        // Prevent click propagation
        backdrop.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
            if (pointer.y > 420) {
                this.toggleMenuModal(false);
            }
        });

        // 2. Modal panel box (half screen dari atas, tinggi 420px)
        const panel = this.add.rectangle(CX, 210, W, 420, 0x0a0f1d).setInteractive();
        panel.setStrokeStyle(1, THEME.BORDER);
        panel.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation(); // Cegah interaksi menembus ke canvas utama
        });

        // 3. Header
        const header = this.add.text(CX, 30, 'MENU & SETTINGS', {
            fontSize: '14px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: THEME.TEXT_PRIMARY,
            letterSpacing: 2
        }).setOrigin(0.5);

        // Seamless divider at Y = 60, spanning full screen width W
        const divider = this.add.rectangle(CX, 60, W, 1, THEME.BORDER);

        // ── SECTION 1: Horizontal Navigation ──
        const s1Label = this.add.text(CX, 85, 'QUICK NAVIGATION', {
            fontSize: '9px',
            fontFamily: 'Outfit',
            color: THEME.TEXT_SECONDARY,
            letterSpacing: 1
        }).setOrigin(0.5);

        // 3 Button bulat navigasi horizontal (shifted to Y = 125)
        const btnParty = this._createModalRoundBtn(CX - 100, 125, 'PARTY', () => {
            this.toggleMenuModal(false);
            // Navigasi ke scene Party jika ada
        });
        const btnQuest = this._createModalRoundBtn(CX, 125, 'QUEST', () => {
            this.toggleMenuModal(false);
            this.scene.start('QuestScene');
        });
        const btnGacha = this._createModalRoundBtn(CX + 100, 125, 'GACHA', () => {
            this.toggleMenuModal(false);
            // Navigasi ke scene Gacha jika ada
        });

        // ── SECTION 2: Inventory & Shop ──
        const s2Label = this.add.text(CX, 185, 'ITEMS & MARKET', {
            fontSize: '9px',
            fontFamily: 'Outfit',
            color: THEME.TEXT_SECONDARY,
            letterSpacing: 1
        }).setOrigin(0.5);

        const btnInventory = this._createModalRectBtn(CX - 90, 215, 160, 30, 'INVENTORY', () => {
            // Navigasi Inventory
        });
        const btnShop = this._createModalRectBtn(CX + 90, 215, 160, 30, 'SHOP', () => {
            // Navigasi Shop
        });

        // ── SECTION 3: Settings Music & SFX ──
        const s3Label = this.add.text(CX, 270, 'AUDIO SETTINGS', {
            fontSize: '9px',
            fontFamily: 'Outfit',
            color: THEME.TEXT_SECONDARY,
            letterSpacing: 1
        }).setOrigin(0.5);

        // Music toggle button
        this.musicBtn = this._createModalRectBtn(CX - 90, 300, 160, 30, '', () => this.toggleMusic());
        this.musicTxt = this.add.text(CX - 90, 300, '', {
            fontSize: '10px',
            fontStyle: 'bold',
            fontFamily: 'Outfit'
        }).setOrigin(0.5);

        // SFX toggle button
        this.sfxBtn = this._createModalRectBtn(CX + 90, 300, 160, 30, '', () => this.toggleSfx());
        this.sfxTxt = this.add.text(CX + 90, 300, '', {
            fontSize: '10px',
            fontStyle: 'bold',
            fontFamily: 'Outfit'
        }).setOrigin(0.5);

        this.updateAudioButtonVisuals();

        // ── SECTION 4: Logout Button ──
        const btnLogout = this._createModalRectBtn(CX, 360, 340, 32, 'LOGOUT', () => {
            this.showLogoutConfirmation();
        }, 0x7f1d1d, 0xef4444); // Red tones for logout

        // Pojok kanan atas: Bulat bertulisan CLOSE (sama persis posisinya dengan tombol MENU)
        const closeBtnCircle = this.add.circle(W - 40, 30, 18, THEME.PANEL, THEME.PANEL_ALPHA);
        closeBtnCircle.setStrokeStyle(1, THEME.BORDER);
        closeBtnCircle.setInteractive({ useHandCursor: true });

        const closeBtnText = this.add.text(W - 40, 30, 'CLOSE', {
            fontSize: '8px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: THEME.TEXT_PRIMARY
        }).setOrigin(0.5);

        closeBtnCircle.on('pointerover', () => {
            closeBtnCircle.setFillStyle(0x334155);
            closeBtnText.setColor('#ffffff');
        });
        closeBtnCircle.on('pointerout', () => {
            closeBtnCircle.setFillStyle(THEME.PANEL);
            closeBtnText.setColor(THEME.TEXT_PRIMARY);
        });
        closeBtnCircle.on('pointerdown', () => {
            this.toggleMenuModal(false);
        });

        // Add to container (closeText has been removed)
        this.menuContainer.add([
            backdrop, panel, header, divider,
            s1Label, btnParty.circle, btnParty.text, btnQuest.circle, btnQuest.text, btnGacha.circle, btnGacha.text,
            s2Label, btnInventory.rect, btnInventory.text, btnShop.rect, btnShop.text,
            s3Label, this.musicBtn.rect, this.musicTxt, this.sfxBtn.rect, this.sfxTxt,
            btnLogout.rect, btnLogout.text, closeBtnCircle, closeBtnText
        ]);

        // ── CONFIRMATION DIALOG LAYER (hidden by default) ──
        this.confirmContainer = this.add.container(0, 0).setDepth(100).setVisible(false);

        const cBackdrop = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.8).setInteractive();
        cBackdrop.on('pointerdown', (pointer, localX, localY, event) => event.stopPropagation());

        const cPanel = this.add.rectangle(CX, H / 2, 300, 150, 0x0d1425).setInteractive();
        cPanel.setStrokeStyle(2, 0xe74c3c);
        cPanel.on('pointerdown', (pointer, localX, localY, event) => event.stopPropagation());

        const cText = this.add.text(CX, H / 2 - 25, 'Apakah Anda yakin ingin logout?', {
            fontSize: '12px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: THEME.TEXT_PRIMARY,
            align: 'center',
            wordWrap: { width: 260 }
        }).setOrigin(0.5);

        // YES Button
        const btnYesObj = this._createModalRectBtn(CX - 65, H / 2 + 30, 100, 32, 'LOGOUT', () => {
            clearSession(this);
        }, 0x7f1d1d, 0xef4444);

        // CANCEL Button
        const btnNoObj = this._createModalRectBtn(CX + 65, H / 2 + 30, 100, 32, 'BATAL', () => {
            this.confirmContainer.setVisible(false);
        }, THEME.PANEL, THEME.BORDER);

        this.confirmContainer.add([
            cBackdrop, cPanel, cText,
            btnYesObj.rect, btnYesObj.text,
            btnNoObj.rect, btnNoObj.text
        ]);
    }

    _createModalRoundBtn(x, y, label, onClick) {
        const circle = this.add.circle(x, y, 22, THEME.PANEL);
        circle.setStrokeStyle(1, THEME.BORDER);
        circle.setInteractive({ useHandCursor: true });

        const text = this.add.text(x, y, label, {
            fontSize: '8px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: THEME.TEXT_PRIMARY
        }).setOrigin(0.5);

        circle.on('pointerover', () => circle.setFillStyle(0x334155));
        circle.on('pointerout', () => circle.setFillStyle(THEME.PANEL));
        circle.on('pointerdown', onClick);

        return { circle, text };
    }

    _createModalRectBtn(x, y, w, h, label, onClick, bgColor = THEME.PANEL, borderColor = THEME.BORDER) {
        const rect = this.add.rectangle(x, y, w, h, bgColor);
        rect.setStrokeStyle(1, borderColor);
        rect.setInteractive({ useHandCursor: true });

        const text = this.add.text(x, y, label, {
            fontSize: '10px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: THEME.TEXT_PRIMARY
        }).setOrigin(0.5);

        rect.on('pointerover', () => rect.setFillStyle(0x334155));
        rect.on('pointerout', () => rect.setFillStyle(bgColor));
        rect.on('pointerdown', onClick);

        return { rect, text };
    }

    toggleMenuModal(show) {
        this.menuContainer.setVisible(show);
        if (show) {
            // Update audio visuals each time modal opens in case changed elsewhere
            this.updateAudioButtonVisuals();
        }
    }

    toggleMusic() {
        this.musicOn = !this.musicOn;
        localStorage.setItem('music_on', this.musicOn);
        this.updateAudioButtonVisuals();
        this.sound.mute = !this.musicOn && !this.sfxOn;
    }

    toggleSfx() {
        this.sfxOn = !this.sfxOn;
        localStorage.setItem('sfx_on', this.sfxOn);
        this.updateAudioButtonVisuals();
        this.sound.mute = !this.musicOn && !this.sfxOn;
    }

    updateAudioButtonVisuals() {
        if (!this.musicBtn || !this.sfxBtn) return;

        // Music button visual
        this.musicBtn.rect.setFillStyle(this.musicOn ? 0x0d2a1a : 0x2a0d0d);
        this.musicBtn.rect.setStrokeStyle(1, this.musicOn ? 0x2ecc71 : 0xe74c3c);
        this.musicTxt.setText(`MUSIC: ${this.musicOn ? 'ON' : 'OFF'}`).setColor(this.musicOn ? '#a8e6cf' : '#ff8a80');

        // SFX button visual
        this.sfxBtn.rect.setFillStyle(this.sfxOn ? 0x0d2a1a : 0x2a0d0d);
        this.sfxBtn.rect.setStrokeStyle(1, this.sfxOn ? 0x2ecc71 : 0xe74c3c);
        this.sfxTxt.setText(`SFX: ${this.sfxOn ? 'ON' : 'OFF'}`).setColor(this.sfxOn ? '#a8e6cf' : '#ff8a80');
    }

    showLogoutConfirmation() {
        this.confirmContainer.setVisible(true);
    }
}
