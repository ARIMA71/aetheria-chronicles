import { THEME } from '../main.js';
import { clearSession } from '../utils/auth.js';

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

        this.createMenuButton();
        this._buildMenuModal();

        // [GUARDRAIL 2] DOM Lifecycle Cleanup
        this.scene.events.once('shutdown', this.cleanupDOM, this);
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
        // [GUARDRAIL 1] Z-Depth 9998 untuk tombol pemanggil
        const menuBtn = this.scene.add.circle(this.W - 40, 30, 18, THEME.PANEL, THEME.PANEL_ALPHA).setScrollFactor(0).setDepth(9998);
        menuBtn.setStrokeStyle(1, THEME.BORDER);
        menuBtn.setInteractive({ useHandCursor: true });

        const menuText = this.scene.add.text(this.W - 40, 30, 'MENU', {
            fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY
        }).setOrigin(0.5).setScrollFactor(0).setDepth(9998);

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

    _buildMenuModal() {
        // [GUARDRAIL 1] Container Menu z-depth 9999
        this.menuContainer = this.scene.add.container(0, 0).setDepth(9999).setVisible(false).setScrollFactor(0);

        const isGuest = this.playerData && this.playerData.is_guest === 1;
        this.panelTargetHeight = isGuest ? 460 : 420;

        // 1. Black low-opacity backdrop (full screen)
        const sysW = this.scene.scale.width;
        const sysH = this.scene.scale.height;
        const backdrop = this.scene.add.rectangle(sysW / 2, sysH / 2, sysW, sysH, 0x000000, 0.75).setInteractive();
        backdrop.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
            if (pointer.y > this.panelTargetHeight) {
                this.toggleMenuModal(false);
            }
        });

        // 2. Modal panel box
        this.menuPanel = this.scene.add.rectangle(this.CX, this.panelTargetHeight / 2, this.W, this.panelTargetHeight, 0x0a0f1d).setInteractive();
        this.menuPanel.setStrokeStyle(1, THEME.BORDER);
        this.menuPanel.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
        });

        // 3. Header
        const header = this.scene.add.text(this.CX, 30, 'MENU & SETTINGS', {
            fontSize: '14px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY, letterSpacing: 2
        }).setOrigin(0.5);

        const divider = this.scene.add.rectangle(this.CX, 60, this.W, 1, THEME.BORDER);

        // ── SECTION 1: Horizontal Navigation ──
        const s1Label = this.scene.add.text(this.CX, 85, 'QUICK NAVIGATION', {
            fontSize: '9px', fontFamily: 'Outfit', color: THEME.TEXT_SECONDARY, letterSpacing: 1
        }).setOrigin(0.5);

        const btnParty = this._createModalRoundBtn(this.CX - 100, 125, 'PARTY', () => {
            this.toggleMenuModal(false);
            if (this.scene.scene.key !== 'PartyScene') this.scene.scene.start('LoadingScene', { targetScene: 'PartyScene' });
        });
        const btnQuest = this._createModalRoundBtn(this.CX, 125, 'QUEST', () => {
            this.toggleMenuModal(false);
            if (this.scene.scene.key !== 'QuestScene') this.scene.scene.start('LoadingScene', { targetScene: 'QuestScene' });
        });
        const btnGacha = this._createModalRoundBtn(this.CX + 100, 125, 'GACHA', () => {
            this.toggleMenuModal(false);
            if (this.scene.scene.key !== 'GachaScene') this.scene.scene.start('LoadingScene', { targetScene: 'GachaScene' });
        });

        // ── SECTION 2: Inventory & Shop ──
        const s2Label = this.scene.add.text(this.CX, 185, 'ITEMS & MARKET', {
            fontSize: '9px', fontFamily: 'Outfit', color: THEME.TEXT_SECONDARY, letterSpacing: 1
        }).setOrigin(0.5);

        const btnInventory = this._createModalRectBtn(this.CX - 90, 215, 160, 30, 'INVENTORY', () => {
            this.toggleMenuModal(false);
            if (this.scene.scene.key !== 'InventoryScene') this.scene.scene.start('LoadingScene', { targetScene: 'InventoryScene' });
        });
        const btnShop = this._createModalRectBtn(this.CX + 90, 215, 160, 30, 'SHOP', () => {
            // Navigasi Shop
        });

        // ── SECTION 3: Settings Music & SFX ──
        const s3Label = this.scene.add.text(this.CX, 270, 'AUDIO SETTINGS', {
            fontSize: '9px', fontFamily: 'Outfit', color: THEME.TEXT_SECONDARY, letterSpacing: 1
        }).setOrigin(0.5);

        this.musicBtn = this._createModalRectBtn(this.CX - 90, 300, 160, 30, '', () => this.toggleMusic());
        this.musicTxt = this.scene.add.text(this.CX - 90, 300, '', {
            fontSize: '10px', fontStyle: 'bold', fontFamily: 'Outfit'
        }).setOrigin(0.5);

        this.sfxBtn = this._createModalRectBtn(this.CX + 90, 300, 160, 30, '', () => this.toggleSfx());
        this.sfxTxt = this.scene.add.text(this.CX + 90, 300, '', {
            fontSize: '10px', fontStyle: 'bold', fontFamily: 'Outfit'
        }).setOrigin(0.5);

        this.updateAudioButtonVisuals();

        // Container array for dynamic buttons
        this.menuButtons = [];

        if (isGuest) {
            this.btnBindAccount = this._createModalRectBtn(this.CX, 380, 340, 32, 'BIND ACCOUNT (SAVE PROGRESS)', () => {
                this.toggleMenuModal(false);
                this._showBindAccountForm(false);
            }, 0xca8a04, 0xfacc15);
            this.menuButtons.push(this.btnBindAccount.rect, this.btnBindAccount.text);
        }

        const logoutY = isGuest ? 420 : 380;
        this.btnLogoutObj = this._createModalRectBtn(this.CX, logoutY, 340, 32, 'LOGOUT', () => {
            // Evaluasi ulang secara live untuk menangkap perubahan state tanpa reload
            const currentGuestStatus = this.playerData && this.playerData.is_guest === 1;
            if (currentGuestStatus) {
                this.toggleMenuModal(false);
                this._showBindAccountForm(true); // isLogoutIntercept = true
            } else {
                this.showLogoutConfirmation();
            }
        }, 0x7f1d1d, 0xef4444);
        this.menuButtons.push(this.btnLogoutObj.rect, this.btnLogoutObj.text);

        const closeBtnCircle = this.scene.add.circle(this.W - 40, 30, 18, THEME.PANEL, THEME.PANEL_ALPHA);
        closeBtnCircle.setStrokeStyle(1, THEME.BORDER);
        closeBtnCircle.setInteractive({ useHandCursor: true });

        const closeBtnText = this.scene.add.text(this.W - 40, 30, 'CLOSE', {
            fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY
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

        this.menuContainer.add([
            backdrop, this.menuPanel, header, divider,
            s1Label, btnParty.circle, btnParty.text, btnQuest.circle, btnQuest.text, btnGacha.circle, btnGacha.text,
            s2Label, btnInventory.rect, btnInventory.text, btnShop.rect, btnShop.text,
            s3Label, this.musicBtn.rect, this.musicTxt, this.sfxBtn.rect, this.sfxTxt,
            ...this.menuButtons, closeBtnCircle, closeBtnText
        ]);

        // ── CONFIRMATION DIALOG LAYER ──
        this.confirmContainer = this.scene.add.container(0, 0).setDepth(9999).setVisible(false).setScrollFactor(0);

        const cBackdrop = this.scene.add.rectangle(sysW / 2, sysH / 2, sysW, sysH, 0x000000, 0.8).setInteractive();
        cBackdrop.on('pointerdown', (pointer, localX, localY, event) => event.stopPropagation());

        const cPanel = this.scene.add.rectangle(this.CX, this.H / 2, 300, 150, 0x0d1425).setInteractive();
        cPanel.setStrokeStyle(2, 0xe74c3c);
        cPanel.on('pointerdown', (pointer, localX, localY, event) => event.stopPropagation());

        const cText = this.scene.add.text(this.CX, this.H / 2 - 25, 'Apakah Anda yakin ingin logout?', {
            fontSize: '12px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY, align: 'center', wordWrap: { width: 260 }
        }).setOrigin(0.5);

        const btnYesObj = this._createModalRectBtn(this.CX - 65, this.H / 2 + 30, 100, 32, 'LOGOUT', () => {
            clearSession(this.scene);
        }, 0x7f1d1d, 0xef4444);

        const btnNoObj = this._createModalRectBtn(this.CX + 65, this.H / 2 + 30, 100, 32, 'BATAL', () => {
            this.confirmContainer.setVisible(false);
        }, THEME.PANEL, THEME.BORDER);

        this.confirmContainer.add([
            cBackdrop, cPanel, cText,
            btnYesObj.rect, btnYesObj.text,
            btnNoObj.rect, btnNoObj.text
        ]);
    }

    _createModalRoundBtn(x, y, label, onClick) {
        const circle = this.scene.add.circle(x, y, 22, THEME.PANEL);
        circle.setStrokeStyle(1, THEME.BORDER);
        circle.setInteractive({ useHandCursor: true });

        const text = this.scene.add.text(x, y, label, {
            fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY
        }).setOrigin(0.5);

        circle.on('pointerover', () => circle.setFillStyle(0x334155));
        circle.on('pointerout', () => circle.setFillStyle(THEME.PANEL));
        circle.on('pointerdown', onClick);

        return { circle, text };
    }

    _createModalRectBtn(x, y, w, h, label, onClick, bgColor = THEME.PANEL, borderColor = THEME.BORDER) {
        const rect = this.scene.add.rectangle(x, y, w, h, bgColor);
        rect.setStrokeStyle(1, borderColor);
        rect.setInteractive({ useHandCursor: true });

        const text = this.scene.add.text(x, y, label, {
            fontSize: '10px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY
        }).setOrigin(0.5);

        rect.on('pointerover', () => rect.setFillStyle(0x334155));
        rect.on('pointerout', () => rect.setFillStyle(bgColor));
        rect.on('pointerdown', onClick);

        return { rect, text };
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
        if (!this.musicBtn || !this.sfxBtn) return;

        this.musicBtn.rect.setFillStyle(this.musicOn ? 0x0d2a1a : 0x2a0d0d);
        this.musicBtn.rect.setStrokeStyle(1, this.musicOn ? 0x2ecc71 : 0xe74c3c);
        this.musicTxt.setText(`MUSIC: ${this.musicOn ? 'ON' : 'OFF'}`).setColor(this.musicOn ? '#a8e6cf' : '#ff8a80');

        this.sfxBtn.rect.setFillStyle(this.sfxOn ? 0x0d2a1a : 0x2a0d0d);
        this.sfxBtn.rect.setStrokeStyle(1, this.sfxOn ? 0x2ecc71 : 0xe74c3c);
        this.sfxTxt.setText(`SFX: ${this.sfxOn ? 'ON' : 'OFF'}`).setColor(this.sfxOn ? '#a8e6cf' : '#ff8a80');
    }

    showLogoutConfirmation() {
        this.confirmContainer.setVisible(true);
    }

    _showBindAccountForm(isLogoutIntercept = false) {
        this.cleanupDOM();

        // 1. Overlay background (Z-Depth 9999 form)
        this._bindOverlay = this.scene.add.rectangle(this.CX, this.H / 2, this.W, this.H, 0x000000, 0.75)
            .setInteractive().setDepth(9999).setScrollFactor(0);

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
            border: 2px solid #1E293B;
            border-radius: 8px;
            padding: 24px;
            text-align: center;
            font-family: 'Outfit', sans-serif;
            color: #F8FAFC;
            box-shadow: 0 10px 30px rgba(0,0,0,0.9);
        ">
            <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #facc15;">BIND ACCOUNT</h2>
            
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
                padding: 10px;
                background: #ca8a04;
                border: 1px solid #facc15;
                color: #FFFFFF;
                font-size: 13px;
                font-weight: bold;
                cursor: pointer;
                margin-bottom: 10px;
            ">SAVE PROGRESS</button>
            
            <button id="btn-cancel-bind" style="
                width: 100%;
                padding: 8px;
                background: transparent;
                border: 1px solid #334155;
                color: #94A3B8;
                font-size: 12px;
                cursor: pointer;
            ">${isLogoutIntercept ? 'BATAL LOGOUT' : 'TUTUP'}</button>
            
            ${isLogoutIntercept ? `
            <div id="btn-force-logout" style="
                margin-top: 15px;
                color: #ef4444;
                font-size: 11px;
                text-decoration: underline;
                cursor: pointer;
            ">Hapus Progres & Tetap Keluar</div>
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
            if (this.scene.sound) this.scene.sound.play('sfx_select');
            this.cleanupDOM();
        });

        if (btnForceLogout) {
            btnForceLogout.addEventListener('click', () => {
                if (this.scene.sound) this.scene.sound.play('sfx_select');
                this.cleanupDOM();
                this.showLogoutConfirmation();
            });
        }

        btnSubmit.addEventListener('click', async () => {
            if (this.scene.sound) this.scene.sound.play('sfx_select');
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
                const res = await fetch('http://localhost:3000/api/auth/bind-account', {
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
                    if (this.scene.playerData) this.scene.playerData.is_guest = 0; // Sync ke scene juga jika ada
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
                        this.btnBindAccount.rect.destroy();
                        this.btnBindAccount.text.destroy();
                        this.btnBindAccount = null;
                        
                        if (this.btnLogoutObj) {
                            this.scene.tweens.add({
                                targets: [this.btnLogoutObj.rect, this.btnLogoutObj.text],
                                y: 380,
                                duration: 300,
                                ease: 'Power2'
                            });
                        }

                        if (this.menuPanel) {
                            this.panelTargetHeight = 420;
                            this.scene.tweens.addCounter({
                                from: 460,
                                to: 420,
                                duration: 300,
                                ease: 'Power2',
                                onUpdate: (tween) => {
                                    const val = tween.getValue();
                                    this.menuPanel.setSize(this.W, val);
                                    this.menuPanel.y = val / 2;
                                    this.menuPanel.input.hitArea.setTo(0, 0, this.W, val);
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

    // Ekstra untuk memunculkan modal Bind secara paksa (untuk Reminder)
    showBindAccountForm() {
        this.toggleMenuModal(false);
        this._showBindAccountForm(false);
    }
}
