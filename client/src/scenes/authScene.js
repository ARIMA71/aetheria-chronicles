import Phaser from 'phaser';
import { THEME } from '../main.js';
import { checkSession } from '../utils/auth.js';

const W = 480, H = 800, CX = 240;

export default class AuthScene extends Phaser.Scene {
    constructor() {
        super('AuthScene');
    }

    create() {
        if (checkSession(this)) return;

        // ── Background ──
        this.add.rectangle(CX, H / 2, W, H, THEME.BG);

        // Top Bar Panel
        const topBar = this.add.rectangle(CX, 30, W, 60, THEME.PANEL, THEME.PANEL_ALPHA);
        topBar.setStrokeStyle(1, THEME.BORDER);

        this.add.text(CX, 30, 'TITLE SCREEN', {
            fontSize: '11px',
            fontStyle: 'bold',
            color: THEME.TEXT_PRIMARY,
            fontFamily: 'Outfit',
            letterSpacing: 2
        }).setOrigin(0.5);

        // Navigation links
        const guideLink = this.add.text(35, 30, 'GUIDE', {
            fontSize: '10px',
            fontStyle: 'bold',
            color: THEME.TEXT_SECONDARY,
            fontFamily: 'Outfit',
            letterSpacing: 1
        }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

        guideLink.on('pointerover', () => guideLink.setColor('#ffffff'));
        guideLink.on('pointerout', () => guideLink.setColor(THEME.TEXT_SECONDARY));
        guideLink.on('pointerdown', () => this._showGuideModal());

        const devLink = this.add.text(W - 35, 30, 'DEV', {
            fontSize: '10px',
            fontStyle: 'bold',
            color: THEME.TEXT_SECONDARY,
            fontFamily: 'Outfit',
            letterSpacing: 1
        }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

        devLink.on('pointerover', () => devLink.setColor('#ffffff'));
        devLink.on('pointerout', () => devLink.setColor(THEME.TEXT_SECONDARY));
        devLink.on('pointerdown', () => this._showDevModal());

        // ── Title ──
        this.add.text(CX, 135, 'AETHERIA', {
            fontSize: '36px',
            fontFamily: 'Cinzel, serif',
            fontStyle: 'bold',
            color: THEME.TEXT_PRIMARY,
            letterSpacing: 4
        }).setOrigin(0.5);

        this.add.text(CX, 173, 'CHRONICLES', {
            fontSize: '13px',
            fontFamily: 'Outfit, sans-serif',
            color: THEME.TEXT_SECONDARY,
            letterSpacing: 8
        }).setOrigin(0.5);

        // ── Cover Placeholder ──
        const coverBg = this.add.rectangle(CX, 310, 220, 180, THEME.PANEL, 0.5);
        coverBg.setStrokeStyle(1, THEME.BORDER);

        this.add.text(CX, 310, '[ COVER ART ]', {
            fontSize: '12px',
            color: THEME.TEXT_MUTED
        }).setOrigin(0.5);

        // ── Decorative divider ──
        this.add.rectangle(CX, 430, 200, 1, THEME.BORDER);

        // ── Buttons ──
        this._createButton(CX, 490, 220, 48, 'START GAME', true, () => this._showForm('register'));
        this._createButton(CX, 555, 180, 42, 'LOGIN', false, () => this._showForm('login'));

        // ── Footer ──
        this.add.text(CX, H - 30, '© 2026 Aetheria Chronicles', {
            fontSize: '9px',
            color: THEME.TEXT_MUTED
        }).setOrigin(0.5);

        // ── Form Container (hidden by default) ──
        this._formContainer = null;
        this._formOverlay = null;
    }

    _createButton(x, y, w, h, label, isPrimary, onClick) {
        const btn = this.add.rectangle(x, y, w, h, isPrimary ? THEME.AETHER : THEME.PANEL);
        btn.setStrokeStyle(1, isPrimary ? 0x818cf8 : THEME.BORDER);
        btn.setInteractive({ useHandCursor: true });

        const txt = this.add.text(x, y, label, {
            fontSize: '14px',
            fontStyle: 'bold',
            color: THEME.TEXT_PRIMARY,
            letterSpacing: 2
        }).setOrigin(0.5);

        btn.on('pointerover', () => {
            btn.setFillStyle(isPrimary ? 0x4f46e5 : 0x334155);
        });
        btn.on('pointerout', () => {
            btn.setFillStyle(isPrimary ? THEME.AETHER : THEME.PANEL);
        });
        btn.on('pointerdown', onClick);
    }

    _showGuideModal() {
        this._showDialog('GUIDE & RULES', `
            <div style="text-align: left; font-size: 11px; line-height: 1.6; color: #E2E8F0; max-height: 180px; overflow-y: auto;">
                <p style="margin: 0 0 8px 0;"><strong>Sistem Elemen:</strong></p>
                <ul style="margin: 0 0 12px 0; padding-left: 16px;">
                    <li>🔥 FIRE unggul atas 🍃 WIND</li>
                    <li>🍃 WIND unggul atas 🪨 EARTH</li>
                    <li>🪨 EARTH unggul atas 🔥 FIRE</li>
                </ul>
                <p style="margin: 0 0 8px 0;"><strong>Aturan Battle Grid:</strong></p>
                <ul style="margin: 0; padding-left: 16px;">
                    <li>Gunakan skill pasif weapon di Grid untuk booster stat karakter berelemen sama.</li>
                    <li>Kumpulkan Aether Gauge hingga penuh untuk melepas serangan Ultimate!</li>
                </ul>
            </div>
        `);
    }

    _showDevModal() {
        this._showDialog('DEVELOPER INFO', `
            <div style="text-align: left; font-size: 11px; line-height: 1.6; color: #E2E8F0;">
                <p style="margin: 0 0 10px 0;"><strong>Aetheria Chronicles</strong> dikembangkan sebagai produk Tugas Akhir (Skripsi) menggunakan metodologi Extreme Programming (XP).</p>
                <p style="margin: 0 0 4px 0;"><strong>Framework:</strong> Phaser 3 & Express.js</p>
                <p style="margin: 0 0 4px 0;"><strong>Database:</strong> MySQL</p>
                <p style="margin: 0;"><strong>Status:</strong> Active (Core Battle Loop)</p>
            </div>
        `);
    }

    _showDialog(title, contentHtml) {
        if (this._formOverlay) this._formOverlay.destroy();
        if (this._formContainer) this._formContainer.destroy();

        this._formOverlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.6)
            .setInteractive().setDepth(50);
        // this._formOverlay.on('pointerdown', () => this._hideForm()); // Disabled to prevent accidental closes on mobile

        const html = `
        <div id="dialog-box" style="
            width: 300px;
            background: #1E293B;
            border: 1px solid #334155;
            padding: 24px;
            text-align: center;
            font-family: 'Outfit', sans-serif;
            color: #F8FAFC;
        ">
            <div style="
                font-size: 13px;
                font-weight: bold;
                letter-spacing: 2px;
                margin-bottom: 15px;
                color: #F8FAFC;
                border-bottom: 1px solid #334155;
                padding-bottom: 8px;
            ">${title}</div>
            
            ${contentHtml}

            <button id="dialog-close" style="
                margin-top: 18px;
                width: 100%;
                padding: 10px;
                background: #334155;
                color: #F8FAFC;
                border: none;
                font-weight: bold;
                cursor: pointer;
            ">TUTUP</button>
        </div>
        `;

        this._formContainer = this.add.dom(CX, H / 2).createFromHTML(html).setDepth(55);
        this._formContainer.addListener('click');
        this._formContainer.on('click', (event) => {
            if (event.target.id === 'dialog-close') {
                this._hideForm();
            }
        });

        const el = this._formContainer.node;
        if (el) {
            el.addEventListener('pointerdown', (e) => e.stopPropagation());
            el.addEventListener('mousedown', (e) => e.stopPropagation());
            el.addEventListener('click', (e) => e.stopPropagation());
        }
    }

    _showForm(mode) {
        // Remove existing form if any
        if (this._formOverlay) {
            this._formOverlay.destroy();
            this._formOverlay = null;
        }
        if (this._formContainer) {
            this._formContainer.destroy();
            this._formContainer = null;
        }

        // Overlay
        this._formOverlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.6)
            .setInteractive().setDepth(50);
        // this._formOverlay.on('pointerdown', () => this._hideForm()); // Disabled to prevent accidental closes on mobile

        const isRegister = mode === 'register';
        const title = isRegister ? 'CREATE ACCOUNT' : 'LOGIN';
        const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';

        // HTML Form
        const formHTML = `
        <div id="auth-form" style="
            width: 320px;
            background: #1E293B;
            border: 1px solid #334155;
            padding: 28px 24px;
            text-align: center;
            font-family: 'Outfit', sans-serif;
        ">
            <div style="
                font-size: 14px;
                font-weight: bold;
                color: #F8FAFC;
                letter-spacing: 2px;
                margin-bottom: 20px;
            ">${title}</div>

            <input id="auth-username" type="text" placeholder="Username" style="
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

            <input id="auth-password" type="password" placeholder="Password" style="
                width: 100%;
                padding: 10px 14px;
                margin-bottom: 18px;
                background: #0F172A;
                border: 1px solid #334155;
                color: #F8FAFC;
                font-size: 13px;
                font-family: 'Outfit', sans-serif;
                outline: none;
                box-sizing: border-box;
            " />

            <div id="auth-error" style="
                color: #CD5C5C;
                font-size: 11px;
                margin-bottom: 10px;
                min-height: 16px;
            "></div>

            <button id="auth-submit" style="
                width: 100%;
                padding: 10px;
                background: #334155;
                border: 1px solid #475569;
                color: #F8FAFC;
                font-size: 13px;
                font-weight: bold;
                font-family: 'Outfit', sans-serif;
                cursor: pointer;
                letter-spacing: 1px;
            ">${isRegister ? 'REGISTER' : 'LOGIN'}</button>

            <button id="auth-cancel" style="
                width: 100%;
                padding: 8px;
                margin-top: 8px;
                background: transparent;
                border: 1px solid #334155;
                color: #94A3B8;
                font-size: 11px;
                font-family: 'Outfit', sans-serif;
                cursor: pointer;
            ">CANCEL</button>
        </div>`;

        const domElement = this.add.dom(CX, H / 2).createFromHTML(formHTML).setDepth(51);
        this._formContainer = domElement;

        // Cegah klik di dalam form memicu overlay pointerdown di canvas Phaser
        if (domElement.node) {
            const preventClose = (e) => e.stopPropagation();
            domElement.node.addEventListener('pointerdown', preventClose);
            domElement.node.addEventListener('mousedown', preventClose);
            domElement.node.addEventListener('click', preventClose);
        }

        // Cancel button
        const cancelBtn = domElement.getChildByID('auth-cancel');
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._hideForm();
        });

        // Submit button
        const submitBtn = domElement.getChildByID('auth-submit');
        submitBtn.addEventListener('click', () => {
            const username = domElement.getChildByID('auth-username').value.trim();
            const password = domElement.getChildByID('auth-password').value;
            const errorDiv = domElement.getChildByID('auth-error');

            if (!username || !password) {
                errorDiv.textContent = 'Username dan password wajib diisi.';
                return;
            }

            errorDiv.textContent = '';
            submitBtn.textContent = 'LOADING...';
            submitBtn.disabled = true;

            this._doAuth(endpoint, username, password, isRegister, errorDiv, submitBtn);
        });

        // Dukungan tombol Enter
        const handleEnterKey = (e) => {
            if (e.key === 'Enter') {
                submitBtn.click();
            }
        };
        const userInp = domElement.getChildByID('auth-username');
        const passInp = domElement.getChildByID('auth-password');
        if (userInp) userInp.addEventListener('keydown', handleEnterKey);
        if (passInp) passInp.addEventListener('keydown', handleEnterKey);
    }

    async _doAuth(endpoint, username, password, isRegister, errorDiv, submitBtn) {
        try {
            const res = await fetch(`http://localhost:3000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const json = await res.json();

            if (json.status !== 'success') {
                errorDiv.textContent = json.message || 'Terjadi kesalahan.';
                submitBtn.textContent = isRegister ? 'REGISTER' : 'LOGIN';
                submitBtn.disabled = false;
                return;
            }

            if (isRegister) {
                // Auto-login setelah register berhasil
                const loginRes = await fetch('http://localhost:3000/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const loginJson = await loginRes.json();
                if (loginJson.status !== 'success') {
                    errorDiv.textContent = loginJson.message || 'Auto-login gagal.';
                    submitBtn.textContent = 'REGISTER';
                    submitBtn.disabled = false;
                    return;
                }
                this._saveAndProceed(loginJson);
            } else {
                this._saveAndProceed(json);
            }
        } catch (err) {
            errorDiv.textContent = 'Connection error: ' + err.message;
            submitBtn.textContent = isRegister ? 'REGISTER' : 'LOGIN';
            submitBtn.disabled = false;
        }
    }

    _saveAndProceed(loginData) {
        localStorage.setItem('aetheria_token', loginData.token);
        localStorage.setItem('aetheria_player', JSON.stringify(loginData.data));
        localStorage.setItem('aetheria_last_activity', Date.now().toString());
        this._hideForm();
        this.scene.start('LoadingScene', { targetScene: 'MainMenuScene' });
    }

    _hideForm() {
        if (this._formOverlay) { this._formOverlay.destroy(); this._formOverlay = null; }
        if (this._formContainer) { this._formContainer.destroy(); this._formContainer = null; }
    }
}
