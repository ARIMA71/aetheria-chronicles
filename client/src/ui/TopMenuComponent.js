import { THEME } from '../main.js';
import { clearSession } from '../utils/auth.js';
import { API_BASE } from '../config.js';

export default class TopMenuComponent {
    constructor(scene) {
        this.scene = scene;
        this.W = scene.scale.width || 480;
        this.H = scene.scale.height || 830;
        this.CX = this.W / 2;

        // Coba sinkronisasi playerData dari localStorage jika scene tidak memilikinya
        this.playerData = this.scene.playerData || JSON.parse(localStorage.getItem('aetheria_player'));
        
        this.musicOn = localStorage.getItem('music_on') !== 'false';
        this.sfxOn = localStorage.getItem('sfx_on') !== 'false';

        this._ensureTextures();
        this._buildTopHUDHeader();
        this.createHomeButton();
        this.createMenuButton();
        this._buildMenuModal();

        // [GUARDRAIL 2] DOM Lifecycle Cleanup
        this.scene.events.once('shutdown', this.cleanupDOM, this);
    }

    _ensureTextures() {
        const load = this.scene.load;
        let needsStart = false;

        if (!this.scene.textures.exists('bg_card_x5')) { load.image('bg_card_x5', 'assets/ui/card/Card X5.png'); needsStart = true; }

        if (!this.scene.textures.exists('btn_a_normal')) { load.image('btn_a_normal', 'assets/ui/button/A/Normal.png'); needsStart = true; }
        if (!this.scene.textures.exists('btn_a_hover')) { load.image('btn_a_hover', 'assets/ui/button/A/Hover.png'); needsStart = true; }
        if (!this.scene.textures.exists('btn_a_active')) { load.image('btn_a_active', 'assets/ui/button/A/Active.png'); needsStart = true; }

        if (!this.scene.textures.exists('btn_b_normal')) { load.image('btn_b_normal', 'assets/ui/button/B/Button Normal 1.png'); needsStart = true; }
        if (!this.scene.textures.exists('btn_b_hover')) { load.image('btn_b_hover', 'assets/ui/button/B/Button Hover 1.png'); needsStart = true; }
        if (!this.scene.textures.exists('btn_b_active')) { load.image('btn_b_active', 'assets/ui/button/B/Button Active 1.png'); needsStart = true; }

        if (!this.scene.textures.exists('btn_icon_normal')) { load.image('btn_icon_normal', 'assets/ui/button/C/Icon Button.png'); needsStart = true; }
        if (!this.scene.textures.exists('btn_icon_hover')) { load.image('btn_icon_hover', 'assets/ui/button/C/Icon Button Hover.png'); needsStart = true; }

        if (!this.scene.textures.exists('btn_d_normal')) { load.image('btn_d_normal', 'assets/ui/button/D/Button Normal.png'); needsStart = true; }
        if (!this.scene.textures.exists('btn_d_hover')) { load.image('btn_d_hover', 'assets/ui/button/D/Button Hover.png'); needsStart = true; }
        if (!this.scene.textures.exists('btn_d_active')) { load.image('btn_d_active', 'assets/ui/button/D/Button Active.png'); needsStart = true; }

        if (needsStart) {
            load.once('complete', () => {
                if (this.scene && this.scene.sys && this.scene.sys.settings.active) {
                    this._applyCardX5Textures();
                }
            });
            load.start();
        }
    }

    _applyCardX5Textures() {
        if (!this.scene || !this.scene.textures.exists('bg_card_x5')) return;

        // Top HUD Header
        if (this.topHudBg) {
            if (this.topHudBg.setTexture) {
                this.topHudBg.setTexture('bg_card_x5');
            } else {
                if (this.topHudBg.destroy) this.topHudBg.destroy();
                this.topHudBg = this.scene.add.image(this.CX, -281, 'bg_card_x5')
                    .setDisplaySize(530, 740)
                    .setDepth(9996)
                    .setScrollFactor(0);
                this.topHudBg.setTint(0x38bdf8);
            }
        }

        // Menu Modal Panel Box (Dynamic bottom below LOGOUT/BIND button, out-of-frame top rounded corners)
        if (this.menuPanel) {
            const isGuest = this.playerData && this.playerData.is_guest === 1;
            const targetBottom = isGuest ? 475 : 425;
            const targetH = targetBottom + 30;
            const targetCenterY = (targetBottom - 30) / 2;

            if (this.menuPanel.setTexture) {
                this.menuPanel.setTexture('bg_card_x5');
                this.menuPanel.setPosition(this.CX, targetCenterY);
                this.menuPanel.setDisplaySize(530, targetH);
                this.menuPanel.setTint(0x38bdf8);
            } else if (this.menuPanel.destroy) {
                const oldPanel = this.menuPanel;
                const idx = this.menuContainer ? this.menuContainer.getIndex(oldPanel) : -1;
                this.menuPanel = this.scene.add.image(this.CX, targetCenterY, 'bg_card_x5')
                    .setDisplaySize(530, targetH);
                this.menuPanel.setTint(0x38bdf8);
                this.menuPanel.setInteractive();
                this.menuPanel.disableClickSound = true;
                this.menuPanel.on('pointerdown', (pointer, localX, localY, event) => event.stopPropagation());

                if (this.menuContainer && idx >= 0) {
                    this.menuContainer.addAt(this.menuPanel, idx);
                    oldPanel.destroy();
                }
            }
        }
    }

    _buildTopHUDHeader() {
        if (this.scene.textures.exists('bg_card_x5')) {
            this.topHudBg = this.scene.add.image(this.CX, -281, 'bg_card_x5')
                .setDisplaySize(530, 740)
                .setDepth(9996)
                .setScrollFactor(0);
            this.topHudBg.setTint(0x38bdf8);
        } else {
            const topBarGraphics = this.scene.add.graphics().setDepth(9996).setScrollFactor(0);
            topBarGraphics.fillStyle(0x0f172a, 1.0);
            topBarGraphics.fillRect(0, 0, this.W, 60);
            topBarGraphics.lineStyle(2, 0x38bdf8, 0.9);
            topBarGraphics.lineBetween(0, 59, this.W, 59);
            this.topHudBg = topBarGraphics;
        }

        // Scan and format scene title text at y ~ 30 with White fill & Sky Blue stroke
        const formatTitleText = () => {
            this.scene.children.list.forEach(child => {
                if (child.type === 'Text' && Math.abs(child.y - 30) < 15 && Math.abs(child.x - this.CX) < 60) {
                    child.setStyle({
                        color: '#ffffff',
                        stroke: '#38bdf8',
                        strokeThickness: 2,
                        fontFamily: 'Outfit',
                        letterSpacing: 2
                    });
                    child.setDepth(9997).setScrollFactor(0);
                }
                // Hide primitive rectangle topBar created in scenes so Card X5 topHudBg shows cleanly
                if (child.type === 'Rectangle' && Math.abs(child.y - 30) < 15 && child.width >= this.W - 20 && child !== this.topHudBg) {
                    child.setVisible(false);
                }
                // Hide primitive backBtn / homeTxt created by individual scenes at x ~ 40, y ~ 30
                if ((child.type === 'Text' || child.type === 'Circle') && Math.abs(child.y - 30) < 15 && Math.abs(child.x - 40) < 25) {
                    if (this.homeButton && (child === this.homeButton.btn || child === this.homeButton.circleBg || child === this.homeButton.txt)) {
                        return; // Retain TopMenuComponent's own HOME button
                    }
                    child.setVisible(false);
                }
            });
        };

        formatTitleText();
        // Run once more after a tiny delay in case scene creates text asynchronously
        this.scene.time.delayedCall(50, formatTitleText);
    }

    createHomeButton() {
        if (this.scene.scene.key === 'MainMenuScene') return;

        const baseSize = 75;
        const x = 36;
        const y = 30;

        // Solid Dark Circle Fill under Button C ring (matches authScene.js)
        const circleBg = this.scene.add.circle(x, y, (baseSize / 2) - 18, 0x0f172a, 1.0)
            .setScrollFactor(0).setDepth(9998);

        const btnKey = this.scene.textures.exists('btn_icon_normal') ? 'btn_icon_normal' : null;
        let btn;

        if (btnKey) {
            btn = this.scene.add.image(x, y, 'btn_icon_normal').setOrigin(0.5)
                .setScrollFactor(0).setDepth(9998);
            btn.setDisplaySize(baseSize, baseSize);
            btn.setInteractive({ useHandCursor: true });
            btn.setTint(0x38bdf8); // Sky Blue tint
        } else {
            btn = this.scene.add.circle(x, y, 18, 0x0f172a).setScrollFactor(0).setDepth(9998);
            btn.setStrokeStyle(2, 0x38bdf8);
            btn.setInteractive({ useHandCursor: true });
        }

        const isFromQuest = this.scene.fromScene === 'QuestScene';
        const homeLabel = isFromQuest ? 'BACK' : 'HOME';

        const txt = this.scene.add.text(x, y, homeLabel, {
            fontSize: '8px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: '#ffffff',
            letterSpacing: 0.5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(9998);

        btn.on('pointerover', () => {
            if (this.scene.textures.exists('btn_icon_hover')) btn.setTexture('btn_icon_hover');
            if (btn.setTint) btn.setTint(0x60a5fa);
            btn.setDisplaySize(baseSize * 1.05, baseSize * 1.05);
            circleBg.setScale(1.05);
            txt.setScale(1.05);
        });

        btn.on('pointerout', () => {
            if (this.scene.textures.exists('btn_icon_normal')) btn.setTexture('btn_icon_normal');
            if (btn.setTint) btn.setTint(0x38bdf8);
            btn.setDisplaySize(baseSize, baseSize);
            circleBg.setScale(1.0);
            txt.setScale(1.0);
        });

        btn.on('pointerdown', () => {
            if (btn.setTint) btn.setTint(0x2563eb);
            btn.setDisplaySize(baseSize * 0.95, baseSize * 0.95);
            circleBg.setScale(0.95);
            txt.setScale(0.95);
            if (isFromQuest) {
                this.scene.scene.start('LoadingScene', { targetScene: 'QuestScene', targetData: { openQuestId: this.scene.questId } });
            } else if (this.scene.scene.key !== 'MainMenuScene') {
                this.scene.scene.start('LoadingScene', { targetScene: 'MainMenuScene' });
            }
        });

        btn.on('pointerup', () => {
            if (this.scene.textures.exists('btn_icon_hover')) btn.setTexture('btn_icon_hover');
            if (btn.setTint) btn.setTint(0x60a5fa);
            btn.setDisplaySize(baseSize * 1.05, baseSize * 1.05);
            circleBg.setScale(1.05);
            txt.setScale(1.05);
        });

        this.homeButton = { btn, circleBg, txt };
    }

    cleanupDOM() {
        if (this._bindOverlay) {
            this._bindOverlay.destroy();
            this._bindOverlay = null;
        }
        if (this._bindContainer) {
            this._bindContainer.destroy();
            this._bindContainer = null;
        }
    }

    createMenuButton() {
        const baseSize = 75;
        const x = this.W - 36;
        const y = 30;

        // Solid Dark Circle Fill under Button C ring (matches authScene.js)
        const circleBg = this.scene.add.circle(x, y, (baseSize / 2) - 18, 0x0f172a, 1.0)
            .setScrollFactor(0).setDepth(9998);

        const btnKey = this.scene.textures.exists('btn_icon_normal') ? 'btn_icon_normal' : null;
        let btn;

        if (btnKey) {
            btn = this.scene.add.image(x, y, 'btn_icon_normal').setOrigin(0.5)
                .setScrollFactor(0).setDepth(9998);
            btn.setDisplaySize(baseSize, baseSize);
            btn.setInteractive({ useHandCursor: true });
            btn.setTint(0x38bdf8); // Sky Blue tint
        } else {
            btn = this.scene.add.circle(x, y, 18, 0x0f172a).setScrollFactor(0).setDepth(9998);
            btn.setStrokeStyle(2, 0x38bdf8);
            btn.setInteractive({ useHandCursor: true });
        }

        const txt = this.scene.add.text(x, y, 'MENU', {
            fontSize: '8px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: '#ffffff',
            letterSpacing: 0.5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(9998);

        btn.on('pointerover', () => {
            if (this.scene.textures.exists('btn_icon_hover')) btn.setTexture('btn_icon_hover');
            if (btn.setTint) btn.setTint(0x60a5fa);
            btn.setDisplaySize(baseSize * 1.05, baseSize * 1.05);
            circleBg.setScale(1.05);
            txt.setScale(1.05);
        });

        btn.on('pointerout', () => {
            if (this.scene.textures.exists('btn_icon_normal')) btn.setTexture('btn_icon_normal');
            if (btn.setTint) btn.setTint(0x38bdf8);
            btn.setDisplaySize(baseSize, baseSize);
            circleBg.setScale(1.0);
            txt.setScale(1.0);
        });

        btn.on('pointerdown', () => {
            if (btn.setTint) btn.setTint(0x2563eb);
            btn.setDisplaySize(baseSize * 0.95, baseSize * 0.95);
            circleBg.setScale(0.95);
            txt.setScale(0.95);
            this.toggleMenuModal(true);
        });

        btn.on('pointerup', () => {
            if (this.scene.textures.exists('btn_icon_hover')) btn.setTexture('btn_icon_hover');
            if (btn.setTint) btn.setTint(0x60a5fa);
            btn.setDisplaySize(baseSize * 1.05, baseSize * 1.05);
            circleBg.setScale(1.05);
            txt.setScale(1.05);
        });
    }

    _buildMenuModal() {
        // [GUARDRAIL 1] Container Menu z-depth 9999
        this.menuContainer = this.scene.add.container(0, 0).setDepth(9999).setVisible(false).setScrollFactor(0);

        const isGuest = this.playerData && this.playerData.is_guest === 1;
        this.panelTargetHeight = isGuest ? 470 : 420;

        // 1. Black low-opacity backdrop (full screen)
        const sysW = this.scene.scale.width;
        const sysH = this.scene.scale.height;
        const backdrop = this.scene.add.rectangle(sysW / 2, sysH / 2, sysW, sysH, 0x000000, 0.75).setInteractive();
        backdrop.disableClickSound = true;
        backdrop.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
            if (pointer.y > this.panelTargetHeight) {
                this.toggleMenuModal(false);
            }
        });

        // 2. Modal panel box using Card X5 UI asset (Dynamic height ending right below LOGOUT/BIND button)
        const targetBottom = isGuest ? 475 : 425;
        const targetH = targetBottom + 30;
        const targetCenterY = (targetBottom - 30) / 2;

        if (this.scene.textures.exists('bg_card_x5')) {
            this.menuPanel = this.scene.add.image(this.CX, targetCenterY, 'bg_card_x5')
                .setDisplaySize(530, targetH);
            this.menuPanel.setTint(0x38bdf8);
            this.menuPanel.setInteractive();
        } else {
            this.menuPanel = this.scene.add.rectangle(this.CX, this.panelTargetHeight / 2, this.W, this.panelTargetHeight, 0x0b1120).setInteractive();
            this.menuPanel.setStrokeStyle(2, 0x38bdf8);
        }
        this.menuPanel.disableClickSound = true;
        this.menuPanel.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
        });

        // 3. Header title with White fill & Sky Blue stroke
        const header = this.scene.add.text(this.CX, 30, 'MENU & SETTINGS', {
            fontSize: '14px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: '#ffffff',
            stroke: '#38bdf8',
            strokeThickness: 2,
            letterSpacing: 2
        }).setOrigin(0.5);

        const divider = this.scene.add.rectangle(this.CX, 60, this.W, 1, 0x1e293b);

        // ── SECTION 1: Horizontal Navigation (Round Button C) ──
        const s1Label = this.scene.add.text(this.CX, 82, 'QUICK NAVIGATION', {
            fontSize: '9px', fontFamily: 'Outfit', color: '#94a3b8', letterSpacing: 1
        }).setOrigin(0.5);

        const btnParty = this._createModalRoundBtn(this.CX - 100, 122, 'PARTY', () => {
            this.toggleMenuModal(false);
            if (this.scene.scene.key !== 'PartyScene') this.scene.scene.start('LoadingScene', { targetScene: 'PartyScene' });
        });
        const btnQuest = this._createModalRoundBtn(this.CX, 122, 'QUEST', () => {
            this.toggleMenuModal(false);
            if (this.scene.scene.key !== 'QuestScene') this.scene.scene.start('LoadingScene', { targetScene: 'QuestScene' });
        });
        const btnGacha = this._createModalRoundBtn(this.CX + 100, 122, 'GACHA', () => {
            this.toggleMenuModal(false);
            if (this.scene.scene.key !== 'GachaScene') this.scene.scene.start('LoadingScene', { targetScene: 'GachaScene' });
        });

        // ── SECTION 2: Inventory & Shop (Short Button A - Sky Blue Tint) ──
        const s2Label = this.scene.add.text(this.CX, 178, 'ITEMS & MARKET', {
            fontSize: '9px', fontFamily: 'Outfit', color: '#94a3b8', letterSpacing: 1
        }).setOrigin(0.5);

        const btnInventory = this._createModalRectBtn(this.CX - 90, 210, 160, 36, 'INVENTORY', () => {
            this.toggleMenuModal(false);
            if (this.scene.scene.key !== 'InventoryScene') this.scene.scene.start('LoadingScene', { targetScene: 'InventoryScene' });
        }, 'A', true);

        const btnShop = this._createModalRectBtn(this.CX + 90, 210, 160, 36, 'SHOP', () => {
            // Navigasi Shop
        }, 'A', true);

        // ── SECTION 3: Settings Music & SFX (Short Button A - No Sky Blue Tint) ──
        const s3Label = this.scene.add.text(this.CX, 265, 'AUDIO SETTINGS', {
            fontSize: '9px', fontFamily: 'Outfit', color: '#94a3b8', letterSpacing: 1
        }).setOrigin(0.5);

        this.musicBtnObj = this._createModalRectBtn(this.CX - 90, 298, 160, 36, '', () => this.toggleMusic(), 'A', false);
        this.musicTxt = this.scene.add.text(this.CX - 90, 298, '', {
            fontSize: '10px', fontStyle: 'bold', fontFamily: 'Outfit'
        }).setOrigin(0.5);

        this.sfxBtnObj = this._createModalRectBtn(this.CX + 90, 298, 160, 36, '', () => this.toggleSfx(), 'A', false);
        this.sfxTxt = this.scene.add.text(this.CX + 90, 298, '', {
            fontSize: '10px', fontStyle: 'bold', fontFamily: 'Outfit'
        }).setOrigin(0.5);

        this.updateAudioButtonVisuals();

        // Container array for dynamic buttons
        this.menuButtons = [];

        if (isGuest) {
            // Button D for BIND ACCOUNT (No Sky Blue Tint - Gold Tint)
            this.btnBindAccount = this._createModalRectBtn(this.CX, 375, 330, 40, 'BIND ACCOUNT (SAVE PROGRESS)', () => {
                this.toggleMenuModal(false);
                this._showBindAccountForm(false);
            }, 'D', false, 0xfacc15);
            this.menuButtons.push(this.btnBindAccount.btn, this.btnBindAccount.text);
        }

        const logoutY = isGuest ? 425 : 375;
        // Button D for LOGOUT (No Sky Blue Tint - Red Tint)
        this.btnLogoutObj = this._createModalRectBtn(this.CX, logoutY, 330, 40, 'LOGOUT', () => {
            const currentGuestStatus = this.playerData && this.playerData.is_guest === 1;
            if (currentGuestStatus) {
                this.toggleMenuModal(false);
                this._showBindAccountForm(true); // isLogoutIntercept = true
            } else {
                this.showLogoutConfirmation();
            }
        }, 'D', false, 0xef4444);
        this.menuButtons.push(this.btnLogoutObj.btn, this.btnLogoutObj.text);

        // Close Modal Button (Button C at top right with custom size 75)
        const closeBtnObj = this._createModalRoundBtn(this.W - 36, 30, 'CLOSE', () => {
            this.toggleMenuModal(false);
        }, 75);

        this.menuContainer.add([
            backdrop, this.menuPanel, header, divider,
            s1Label, btnParty.circleBg, btnParty.btn, btnParty.text,
            btnQuest.circleBg, btnQuest.btn, btnQuest.text,
            btnGacha.circleBg, btnGacha.btn, btnGacha.text,
            s2Label, btnInventory.btn, btnInventory.text, btnShop.btn, btnShop.text,
            s3Label, this.musicBtnObj.btn, this.musicTxt, this.sfxBtnObj.btn, this.sfxTxt,
            ...this.menuButtons, closeBtnObj.circleBg, closeBtnObj.btn, closeBtnObj.text
        ]);

        // ── CONFIRMATION DIALOG LAYER ──
        this.confirmContainer = this.scene.add.container(0, 0).setDepth(9999).setVisible(false).setScrollFactor(0);

        const cBackdrop = this.scene.add.rectangle(sysW / 2, sysH / 2, sysW, sysH, 0x000000, 0.8).setInteractive();
        cBackdrop.disableClickSound = true;
        cBackdrop.on('pointerdown', (pointer, localX, localY, event) => event.stopPropagation());

        const cPanel = this.scene.add.rectangle(this.CX, this.H / 2, 320, 160, 0x0b1120).setInteractive();
        cPanel.disableClickSound = true;
        cPanel.setStrokeStyle(2, 0x38bdf8); // Sky Blue border outline
        cPanel.on('pointerdown', (pointer, localX, localY, event) => event.stopPropagation());

        const cText = this.scene.add.text(this.CX, this.H / 2 - 25, 'Apakah Anda yakin ingin logout?', {
            fontSize: '12px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#ffffff', align: 'center', wordWrap: { width: 280 }
        }).setOrigin(0.5);

        // Button D for Logout Confirm
        const btnYesObj = this._createModalRectBtn(this.CX - 70, this.H / 2 + 35, 120, 36, 'LOGOUT', () => {
            clearSession(this.scene);
        }, 'D', false, 0xef4444);

        // Button B for Batal Cancel
        const btnNoObj = this._createModalRectBtn(this.CX + 70, this.H / 2 + 35, 120, 36, 'BATAL', () => {
            this.confirmContainer.setVisible(false);
        }, 'B', true);

        this.confirmContainer.add([
            cBackdrop, cPanel, cText,
            btnYesObj.btn, btnYesObj.text,
            btnNoObj.btn, btnNoObj.text
        ]);
    }

    _createModalRoundBtn(x, y, label, onClick, customSize = 80) {
        const baseSize = customSize;
        const innerSubtract = baseSize >= 80 ? 20 : 18;

        // Solid Dark Circle Fill under Button C ring
        const circleBg = this.scene.add.circle(x, y, (baseSize / 2) - innerSubtract, 0x0f172a, 1.0);

        const btnKey = this.scene.textures.exists('btn_icon_normal') ? 'btn_icon_normal' : null;
        let btn;

        if (btnKey) {
            btn = this.scene.add.image(x, y, 'btn_icon_normal').setOrigin(0.5);
            btn.setDisplaySize(baseSize, baseSize);
            btn.setInteractive({ useHandCursor: true });
            btn.setTint(0x38bdf8); // Sky Blue Tint
        } else {
            btn = this.scene.add.circle(x, y, baseSize / 2, 0x0f172a);
            btn.setStrokeStyle(2, 0x38bdf8);
            btn.setInteractive({ useHandCursor: true });
        }

        const text = this.scene.add.text(x, y, label, {
            fontSize: '9px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#ffffff', letterSpacing: 0.5
        }).setOrigin(0.5);

        btn.on('pointerover', () => {
            if (this.scene.textures.exists('btn_icon_hover')) btn.setTexture('btn_icon_hover');
            if (btn.setTint) btn.setTint(0x60a5fa);
            btn.setDisplaySize(baseSize * 1.05, baseSize * 1.05);
            circleBg.setScale(1.05);
            text.setScale(1.05);
        });

        btn.on('pointerout', () => {
            if (this.scene.textures.exists('btn_icon_normal')) btn.setTexture('btn_icon_normal');
            if (btn.setTint) btn.setTint(0x38bdf8);
            btn.setDisplaySize(baseSize, baseSize);
            circleBg.setScale(1.0);
            text.setScale(1.0);
        });

        btn.on('pointerdown', () => {
            if (btn.setTint) btn.setTint(0x2563eb);
            btn.setDisplaySize(baseSize * 0.95, baseSize * 0.95);
            circleBg.setScale(0.95);
            text.setScale(0.95);
            onClick();
        });

        btn.on('pointerup', () => {
            if (this.scene.textures.exists('btn_icon_hover')) btn.setTexture('btn_icon_hover');
            if (btn.setTint) btn.setTint(0x60a5fa);
            btn.setDisplaySize(baseSize * 1.05, baseSize * 1.05);
            circleBg.setScale(1.05);
            text.setScale(1.05);
        });

        return { btn, circleBg, text };
    }

    _createModalRectBtn(x, y, w, h, label, onClick, buttonType = 'A', shouldTintSkyBlue = true, customTint = null) {
        let normalKey = 'btn_a_normal';
        let hoverKey  = 'btn_a_hover';
        let activeKey = 'btn_a_active';

        if (buttonType === 'D') {
            normalKey = 'btn_d_normal';
            hoverKey  = 'btn_d_hover';
            activeKey = 'btn_d_active';
        } else if (buttonType === 'B') {
            normalKey = 'btn_b_normal';
            hoverKey  = 'btn_b_hover';
            activeKey = 'btn_b_active';
        }

        let btn;
        if (this.scene.textures.exists(normalKey)) {
            btn = this.scene.add.image(x, y, normalKey).setOrigin(0.5);
            btn.setDisplaySize(w, h);
        } else {
            btn = this.scene.add.rectangle(x, y, w, h, 0x0f172a);
            btn.setStrokeStyle(1, 0x38bdf8);
        }

        btn.setInteractive({ useHandCursor: true });

        const baseTint = shouldTintSkyBlue ? 0x38bdf8 : (customTint !== null ? customTint : 0xffffff);
        const hoverTint = shouldTintSkyBlue ? 0x60a5fa : (customTint !== null ? customTint : 0xffffff);
        const downTint = shouldTintSkyBlue ? 0x2563eb : (customTint !== null ? customTint : 0xffffff);

        if (btn.setTint && baseTint !== 0xffffff) {
            btn.setTint(baseTint);
        } else if (btn.clearTint) {
            btn.clearTint();
        }

        const text = this.scene.add.text(x, y, label, {
            fontSize: '10px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#ffffff', letterSpacing: 1
        }).setOrigin(0.5);

        btn.on('pointerover', () => {
            if (this.scene.textures.exists(hoverKey)) btn.setTexture(hoverKey);
            if (btn.setTint && hoverTint !== 0xffffff) btn.setTint(hoverTint);
            btn.setDisplaySize(w * 1.03, h * 1.03);
            text.setScale(1.03);
        });

        btn.on('pointerout', () => {
            if (this.scene.textures.exists(normalKey)) btn.setTexture(normalKey);
            if (btn.setTint && baseTint !== 0xffffff) btn.setTint(baseTint);
            else if (btn.clearTint) btn.clearTint();
            btn.setDisplaySize(w, h);
            text.setScale(1.0);
        });

        btn.on('pointerdown', () => {
            if (this.scene.textures.exists(activeKey)) btn.setTexture(activeKey);
            if (btn.setTint && downTint !== 0xffffff) btn.setTint(downTint);
            btn.setDisplaySize(w * 0.97, h * 0.97);
            text.setScale(0.97);
            onClick();
        });

        btn.on('pointerup', () => {
            if (this.scene.textures.exists(hoverKey)) btn.setTexture(hoverKey);
            if (btn.setTint && hoverTint !== 0xffffff) btn.setTint(hoverTint);
            btn.setDisplaySize(w * 1.03, h * 1.03);
            text.setScale(1.03);
        });

        return { btn, text };
    }

    toggleMenuModal(show) {
        this.menuContainer.setVisible(show);
        if (show) {
            this.updateAudioButtonVisuals();
        }
    }

    toggleMusic() {
        this.musicOn = !this.musicOn;
        localStorage.setItem('music_on', this.musicOn);
        this.updateAudioButtonVisuals();
        if (window.AetheriaAudioManager) window.AetheriaAudioManager.updateMuteState(this.scene);
    }

    toggleSfx() {
        this.sfxOn = !this.sfxOn;
        localStorage.setItem('sfx_on', this.sfxOn);
        this.updateAudioButtonVisuals();
        if (window.AetheriaAudioManager) window.AetheriaAudioManager.updateMuteState(this.scene);
    }

    updateAudioButtonVisuals() {
        if (!this.musicBtnObj || !this.sfxBtnObj) return;

        const musicColor = this.musicOn ? 0x10b981 : 0xef4444;
        if (this.musicBtnObj.btn.setTint) this.musicBtnObj.btn.setTint(musicColor);
        this.musicTxt.setText(`MUSIC: ${this.musicOn ? 'ON' : 'OFF'}`).setColor(this.musicOn ? '#ffffff' : '#ff8a80');

        const sfxColor = this.sfxOn ? 0x10b981 : 0xef4444;
        if (this.sfxBtnObj.btn.setTint) this.sfxBtnObj.btn.setTint(sfxColor);
        this.sfxTxt.setText(`SFX: ${this.sfxOn ? 'ON' : 'OFF'}`).setColor(this.sfxOn ? '#ffffff' : '#ff8a80');
    }

    showLogoutConfirmation() {
        this.confirmContainer.setVisible(true);
    }

    _showBindAccountForm(isLogoutIntercept = false) {
        this.cleanupDOM();

        // 1. Overlay background (Z-Depth 9999 form)
        this._bindOverlay = this.scene.add.rectangle(this.CX, this.H / 2, this.W, this.H, 0x000000, 0.75)
            .setInteractive().setDepth(9999).setScrollFactor(0);
        this._bindOverlay.disableClickSound = true;

        let headerMessage = '';
        if (isLogoutIntercept) {
            headerMessage = `
                <div style="font-size: 12px; color: #fbbf24; margin-bottom: 15px; font-weight: bold; background: rgba(251,191,36,0.1); padding: 8px; border-radius: 4px; border: 1px solid #fbbf24;">
                    ⚠️ Anda menggunakan akun Guest. Buat password sebelum keluar agar progres tidak hilang!
                </div>
            `;
        }

        const html = `
        <div style="
            width: 320px;
            background: #0B1120;
            border: 2px solid #38bdf8;
            border-radius: 8px;
            padding: 24px;
            text-align: center;
            font-family: 'Outfit', sans-serif;
            color: #F8FAFC;
            box-shadow: 0 10px 30px rgba(0,0,0,0.9), 0 0 15px rgba(56, 189, 248, 0.25);
        ">
            <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #38bdf8; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">BIND ACCOUNT</h2>
            
            ${headerMessage}

            <div style="font-size: 12px; color: #94a3b8; margin-bottom: 20px;">
                Tambahkan password untuk mengamankan akun ini selamanya.
            </div>

            <input id="bind-password" type="password" placeholder="New Password" style="
                width: 100%;
                padding: 10px 14px;
                margin-bottom: 12px;
                background: #0F172A;
                border: 1px solid #334155;
                border-radius: 4px;
                color: #F8FAFC;
                font-size: 13px;
                font-family: 'Outfit', sans-serif;
                outline: none;
                box-sizing: border-box;
            " />

            <input id="bind-confirm" type="password" placeholder="Confirm Password" style="
                width: 100%;
                padding: 10px 14px;
                margin-bottom: 12px;
                background: #0F172A;
                border: 1px solid #334155;
                border-radius: 4px;
                color: #F8FAFC;
                font-size: 13px;
                font-family: 'Outfit', sans-serif;
                outline: none;
                box-sizing: border-box;
            " />

            <div id="bind-error" style="
                color: #ef4444;
                font-size: 11px;
                margin-bottom: 10px;
                min-height: 14px;
            "></div>

            <button id="btn-submit-bind" style="
                width: 100%;
                height: 44px;
                background: url('assets/ui/button/D/Button Normal.png') no-repeat center / 100% 100%;
                border: none;
                color: #FFFFFF;
                font-size: 13px;
                font-weight: bold;
                font-family: 'Outfit', sans-serif;
                cursor: pointer;
                margin-bottom: 10px;
                letter-spacing: 1px;
            ">SAVE PROGRESS</button>
            
            <button id="btn-cancel-bind" style="
                width: 100%;
                height: 38px;
                background: url('assets/ui/button/B/Button Normal 1.png') no-repeat center / 100% 100%;
                filter: sepia(1) hue-rotate(162deg) saturate(3.5) brightness(1.0);
                border: none;
                color: #E2E8F0;
                font-size: 11px;
                font-weight: bold;
                font-family: 'Outfit', sans-serif;
                letter-spacing: 1px;
                cursor: pointer;
            ">${isLogoutIntercept ? 'BATAL LOGOUT' : 'TUTUP'}</button>
            
            ${isLogoutIntercept ? `
            <button id="btn-force-logout" style="
                background: none;
                border: none;
                margin-top: 15px;
                color: #ef4444;
                font-size: 11px;
                font-family: 'Outfit', sans-serif;
                text-decoration: underline;
                cursor: pointer;
                width: 100%;
            ">Hapus Progres & Tetap Keluar</button>
            ` : ''}
        </div>
        `;

        this._bindContainer = this.scene.add.dom(this.CX, this.H / 2).createFromHTML(html).setDepth(9999).setScrollFactor(0);
        
        const dom = this._bindContainer.node;
        if (!dom) return;

        const stopProp = (e) => e.stopPropagation();
        dom.addEventListener('pointerdown', stopProp);
        dom.addEventListener('mousedown', stopProp);
        dom.addEventListener('click', stopProp);

        const btnCancel = dom.querySelector('#btn-cancel-bind');
        const btnSubmit = dom.querySelector('#btn-submit-bind');
        const btnForceLogout = dom.querySelector('#btn-force-logout');
        const errorDiv = dom.querySelector('#bind-error');
        const passInp = dom.querySelector('#bind-password');
        const confirmInp = dom.querySelector('#bind-confirm');

        btnCancel.addEventListener('click', () => {
            this.cleanupDOM();
        });

        if (btnForceLogout) {
            btnForceLogout.addEventListener('click', () => {
                this.cleanupDOM();
                this.showLogoutConfirmation();
            });
        }

        btnSubmit.addEventListener('click', async () => {
            const pwd = passInp.value;
            const confirm = confirmInp.value;

            if (!pwd || !confirm) {
                errorDiv.textContent = 'Semua kolom harus diisi.';
                return;
            }
            if (pwd !== confirm) {
                errorDiv.textContent = 'Password tidak cocok.';
                return;
            }
            if (pwd.length < 6) {
                errorDiv.textContent = 'Password minimal 6 karakter.';
                return;
            }

            btnSubmit.textContent = 'SAVING...';
            btnSubmit.disabled = true;
            errorDiv.textContent = '';

            try {
                const token = localStorage.getItem('aetheria_token');
                const res = await fetch(`${API_BASE}/api/auth/bind-account`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ password: pwd })
                });

                const json = await res.json();
                if (json.status === 'success') {
                    // [GUARDRAIL 3] Sinkronisasi Global Bind Account
                    this.playerData.is_guest = 0;
                    if (this.scene.playerData) this.scene.playerData.is_guest = 0;
                    localStorage.setItem('aetheria_player', JSON.stringify(this.playerData));

                    const successText = this.scene.add.text(this.CX, this.H / 2, 'Akun Berhasil Disimpan!', {
                        fontSize: '16px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#4ade80'
                    }).setOrigin(0.5).setDepth(9999).setScrollFactor(0);

                    this.scene.tweens.add({
                        targets: successText,
                        y: this.H / 2 - 50,
                        alpha: 0,
                        duration: 2000,
                        ease: 'Power2',
                        onComplete: () => successText.destroy()
                    });

                    if (this.btnBindAccount) {
                        this.btnBindAccount.btn.destroy();
                        this.btnBindAccount.text.destroy();
                        this.btnBindAccount = null;
                        
                        if (this.btnLogoutObj) {
                            this.scene.tweens.add({
                                targets: [this.btnLogoutObj.btn, this.btnLogoutObj.text],
                                y: 375,
                                duration: 300,
                                ease: 'Power2'
                            });
                        }

                        if (this.menuPanel) {
                            this.panelTargetHeight = 420;
                            this.scene.tweens.addCounter({
                                from: 505,
                                to: 455,
                                duration: 300,
                                ease: 'Power2',
                                onUpdate: (tween) => {
                                    const val = tween.getValue();
                                    const cY = (val - 60) / 2;
                                    if (this.menuPanel.setDisplaySize) {
                                        this.menuPanel.setDisplaySize(530, val);
                                        this.menuPanel.y = cY;
                                    } else {
                                        this.menuPanel.setSize(this.W, val - 35);
                                        this.menuPanel.y = (val - 35) / 2;
                                    }
                                }
                            });
                        }
                    }

                    this.cleanupDOM();
                } else {
                    errorDiv.textContent = json.message || 'Gagal menyimpan akun.';
                    btnSubmit.textContent = 'SAVE PROGRESS';
                    btnSubmit.disabled = false;
                }
            } catch (err) {
                errorDiv.textContent = 'Terjadi kesalahan jaringan.';
                btnSubmit.textContent = 'SAVE PROGRESS';
                btnSubmit.disabled = false;
            }
        });
    }

    showBindAccountForm() {
        this.toggleMenuModal(false);
        this._showBindAccountForm(false);
    }
}
