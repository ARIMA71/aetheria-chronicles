import Phaser from 'phaser';
import { THEME } from '../main.js';
import { checkSession } from '../utils/auth.js';
import { playGlobalBGM } from '../utils/audioManager.js';

const W = 480, H = 800, CX = 240;

export default class AuthScene extends Phaser.Scene {
    constructor() {
        super('AuthScene');
    }

    preload() {
        this.load.audio('sfx_select', 'assets/audio/sfx/select.mp3');
        this.load.audio('bgm_authscene', 'assets/audio/bgm/bgm_authscene.mp3');
        this.load.audio('bgm_victory', 'assets/audio/bgm/victory.mp3');
        this.load.audio('bgm_defeat', 'assets/audio/bgm/defeat.mp3');
        this.load.image('game_logo', 'assets/logo/Acro Logo 1.png');
        this.load.image('bg_auth', 'assets/backgrounds/authScene.jpg');

        // Preload UI Button A Variants (New Game)
        this.load.image('btn_a_normal', 'assets/ui/button/A/Normal.png');
        this.load.image('btn_a_hover', 'assets/ui/button/A/Hover.png');
        this.load.image('btn_a_active', 'assets/ui/button/A/Active.png');
        this.load.image('btn_a_disabled', 'assets/ui/button/A/Disabled.png');

        // Preload UI Button B Variants (Continue)
        this.load.image('btn_b_normal', 'assets/ui/button/B/Button Normal 1.png');
        this.load.image('btn_b_hover', 'assets/ui/button/B/Button Hover 1.png');
        this.load.image('btn_b_active', 'assets/ui/button/B/Button Active 1.png');

        // Preload UI Button C Variants (Round Icon Buttons for Top HUD)
        this.load.image('btn_icon_normal', 'assets/ui/button/C/Icon Button.png');
        this.load.image('btn_icon_hover', 'assets/ui/button/C/Icon Button Hover.png');

        // Preload UI Button D Variants (Confirm/Submit Buttons)
        this.load.image('btn_d_normal', 'assets/ui/button/D/Button Normal.png');
        this.load.image('btn_d_hover', 'assets/ui/button/D/Button Hover.png');
        this.load.image('btn_d_active', 'assets/ui/button/D/Button Active.png');
        this.load.image('btn_d_disabled', 'assets/ui/button/D/Button Disabled.png');


        // Preload all Global SFX
        this.load.audio('sfx_buff', 'assets/audio/sfx/buff.mp3');
        this.load.audio('sfx_battleReady', 'assets/audio/sfx/battleReady.mp3');
        this.load.audio('sfx_battleStart', 'assets/audio/sfx/battleStart.mp3');
        this.load.audio('sfx_charBasicAtk', 'assets/audio/sfx/charBasicAtk.mp3');
        this.load.audio('sfx_charSkillAtk', 'assets/audio/sfx/charSkillAtk.wav');
        this.load.audio('sfx_charSpecialAttack', 'assets/audio/sfx/charSpecialAttack.mp3');
        this.load.audio('sfx_debuff', 'assets/audio/sfx/debuff.mp3');
        this.load.audio('sfx_gacha', 'assets/audio/sfx/gacha.mp3');
        this.load.audio('sfx_heal', 'assets/audio/sfx/heal.mp3');
        this.load.audio('sfx_levelUp', 'assets/audio/sfx/levelUp.mp3');
        this.load.audio('sfx_monsBasicAtk', 'assets/audio/sfx/monsBasicAtk.mp3');
        this.load.audio('sfx_monsChargeAttack', 'assets/audio/sfx/monsChargeAttack.mp3');
        this.load.audio('sfx_monsEnraged', 'assets/audio/sfx/monsEnraged.wav');
        this.load.audio('sfx_monsExhausted', 'assets/audio/sfx/monsExhausted.wav');
        this.load.audio('sfx_newCharacterUnlocked', 'assets/audio/sfx/newCharacterUnlocked.mp3');
        this.load.audio('sfx_revive', 'assets/audio/sfx/revive.mp3');
        this.load.audio('sfx_monsterDefeated', 'assets/audio/sfx/monsterDefeated.mp3');
        this.load.audio('sfx_stunned', 'assets/audio/sfx/stunned.mp3');
    }

    create() {
        if (checkSession(this)) return;

        // Anti-Autoplay Policy: Putar BGM setelah ada interaksi (klik pertama di kanvas),
        // kecuali audio context sudah aktif (misal: kembali dari scene lain setelah logout).
        if (this.sound.locked) {
            this.sound.once('unlocked', () => {
                playGlobalBGM(this, 'bgm_authscene');
            });
        } else {
            playGlobalBGM(this, 'bgm_authscene');
        }

        // ── Background ──
        const bg = this.add.image(CX, H / 2, 'bg_auth').setOrigin(0.5);
        const scale = Math.max(W / bg.width, H / bg.height);
        bg.setScale(scale);

        // ── Haze Effect ──
        const haze = this.add.graphics();
        // Extended smooth gradient fade from alpha 0 (at y=280, above NEW GAME area) down to alpha 1 (at y=520)
        haze.fillGradientStyle(0x0f172a, 0x0f172a, 0x0f172a, 0x0f172a, 0, 0, 1, 1);
        haze.fillRect(0, 300, W, 270);
        // Solid 100% dark navy base at the bottom
        haze.fillStyle(0x0f172a, 1.0);
        haze.fillRect(0, 570, W, H - 570);

        // Top Bar Panel (Solid Dark Navy Header)
        const topBarGraphics = this.add.graphics();
        topBarGraphics.fillStyle(0x0f172a, 1.0);
        topBarGraphics.fillRect(0, 0, W, 60);

        // Sky Blue Bottom Accent Border Line
        topBarGraphics.lineStyle(2, 0x38bdf8, 0.9);
        topBarGraphics.lineBetween(0, 59, W, 59);

        this.add.text(CX, 30, 'TITLE SCREEN', {
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#38bdf8',
            strokeThickness: 2,
            fontFamily: 'Outfit',
            letterSpacing: 3
        }).setOrigin(0.5);

        // Navigation Icon Buttons (Round Icon Button C - Enlarged 72x72)
        this._createIconButton(50, 30, 'GUIDE', () => this._showGuideModal());
        this._createIconButton(W - 50, 30, 'DEV', () => this._showDevModal());

        // ── Title ──
        const logo = this.add.image(CX, 145, 'game_logo').setOrigin(0.5);
        // Scale logo gracefully. Assuming original might still be large, we set a target width.
        const targetWidth = 350;
        if (logo.width > targetWidth) {
            logo.setScale(targetWidth / logo.width);
        }

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
        this._createButton(CX, 490, 220, 48, 'NEW GAME', true, () => this._showGenderSelection());
        this._createButton(CX, 555, 180, 42, 'CONTINUE', false, () => this._showForm('login'));

        // ── Footer ──
        this.add.text(CX, H - 30, '© 2026 Aetheria Chronicles', {
            fontSize: '9px',
            color: THEME.TEXT_MUTED
        }).setOrigin(0.5);

        // ── Form Container (hidden by default) ──
        this._formContainer = null;
        this._formOverlay = null;
    }

    _createIconButton(x, y, label, onClick) {
        const baseSize = 72;

        // Solid Dark Circle Fill under Button C ring (matches Button A dark base)
        const circleBg = this.add.circle(x, y, (baseSize / 2) - 18, 0x0f172a, 1.0);

        const btn = this.add.image(x, y, 'btn_icon_normal').setOrigin(0.5);
        btn.setDisplaySize(baseSize, baseSize);
        btn.setInteractive({ useHandCursor: true });
        btn.setTint(0x38bdf8); // Sky Blue tint

        const txt = this.add.text(x, y, label, {
            fontSize: '9px',
            fontStyle: 'bold',
            color: THEME.TEXT_PRIMARY,
            fontFamily: 'Outfit',
            letterSpacing: 0.5
        }).setOrigin(0.5);

        btn.on('pointerover', () => {
            if (this.textures.exists('btn_icon_hover')) btn.setTexture('btn_icon_hover');
            btn.setTint(0x60a5fa); // Bright Sky Blue hover
            btn.setDisplaySize(baseSize * 1.05, baseSize * 1.05);
            circleBg.setScale(1.05);
            txt.setScale(1.05);
        });

        btn.on('pointerout', () => {
            if (this.textures.exists('btn_icon_normal')) btn.setTexture('btn_icon_normal');
            btn.setTint(0x38bdf8); // Sky Blue base
            btn.setDisplaySize(baseSize, baseSize);
            circleBg.setScale(1.0);
            txt.setScale(1.0);
        });

        btn.on('pointerdown', () => {
            btn.setTint(0x2563eb); // Deep Blue click
            btn.setDisplaySize(baseSize * 0.95, baseSize * 0.95);
            circleBg.setScale(0.95);
            txt.setScale(0.95);
            onClick();
        });

        btn.on('pointerup', () => {
            if (this.textures.exists('btn_icon_hover')) btn.setTexture('btn_icon_hover');
            btn.setTint(0x60a5fa);
            btn.setDisplaySize(baseSize * 1.05, baseSize * 1.05);
            circleBg.setScale(1.05);
            txt.setScale(1.05);
        });
    }

    _createButton(x, y, w, h, label, isPrimary, onClick) {
        const normalKey = isPrimary ? 'btn_a_normal' : 'btn_b_normal';
        const hoverKey = isPrimary ? 'btn_a_hover' : 'btn_b_hover';
        const activeKey = isPrimary ? 'btn_a_active' : 'btn_b_active';

        const btn = this.add.image(x, y, normalKey).setOrigin(0.5);
        btn.setDisplaySize(w, h);
        btn.setInteractive({ useHandCursor: true });

        // Apply Sky Blue Tint to ALL scene buttons
        btn.setTint(0x38bdf8);

        const txt = this.add.text(x, y, label, {
            fontSize: '13px',
            fontStyle: 'bold',
            color: THEME.TEXT_PRIMARY,
            fontFamily: 'Outfit',
            letterSpacing: 2
        }).setOrigin(0.5);

        btn.on('pointerover', () => {
            if (this.textures.exists(hoverKey)) btn.setTexture(hoverKey);
            btn.setTint(0x60a5fa);
            btn.setDisplaySize(w * 1.04, h * 1.04);
            txt.setScale(1.04);
        });

        btn.on('pointerout', () => {
            if (this.textures.exists(normalKey)) btn.setTexture(normalKey);
            btn.setTint(0x38bdf8);
            btn.setDisplaySize(w, h);
            txt.setScale(1.0);
        });

        btn.on('pointerdown', () => {
            if (this.textures.exists(activeKey)) btn.setTexture(activeKey);
            btn.setTint(0x2563eb);
            btn.setDisplaySize(w * 0.96, h * 0.96);
            txt.setScale(0.96);
            onClick();
        });

        btn.on('pointerup', () => {
            if (this.textures.exists(hoverKey)) btn.setTexture(hoverKey);
            btn.setTint(0x60a5fa);
            btn.setDisplaySize(w * 1.04, h * 1.04);
            txt.setScale(1.04);
        });
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

        this._formOverlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.75)
            .setInteractive().setDepth(50);

        const html = `
        <div id="dialog-box" style="
            width: 320px;
            background: #0B1120;
            border: 2px solid #38bdf8;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.9), 0 0 15px rgba(56, 189, 248, 0.25);
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
                color: #38bdf8;
                border-bottom: 1px solid #1E293B;
                padding-bottom: 8px;
            ">${title}</div>
            
            ${contentHtml}

            <button id="dialog-close" style="
                margin-top: 18px;
                width: 100%;
                height: 38px;
                background: url('assets/ui/button/B/Button Normal 1.png') no-repeat center / 100% 100%;
                filter: sepia(1) hue-rotate(162deg) saturate(3.5) brightness(1.0);
                color: #F8FAFC;
                border: none;
                font-family: 'Outfit', sans-serif;
                font-size: 11px;
                font-weight: bold;
                letter-spacing: 1px;
                cursor: pointer;
                transition: transform 0.1s;
            ">TUTUP</button>
        </div>
        `;

        this._formContainer = this.add.dom(CX, H / 2).createFromHTML(html).setDepth(55);

        const el = this._formContainer.node;
        if (el) {
            const closeBtn = el.querySelector('#dialog-close');
            if (closeBtn) {
                closeBtn.addEventListener('pointerover', () => { closeBtn.style.backgroundImage = "url('assets/ui/button/B/Button Hover 1.png')"; });
                closeBtn.addEventListener('pointerout', () => { closeBtn.style.backgroundImage = "url('assets/ui/button/B/Button Normal 1.png')"; });
                closeBtn.addEventListener('pointerdown', () => { closeBtn.style.backgroundImage = "url('assets/ui/button/B/Button Active 1.png')"; });
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._hideForm();
                });
            }
            el.addEventListener('pointerdown', (e) => e.stopPropagation());
            el.addEventListener('mousedown', (e) => e.stopPropagation());
            el.addEventListener('click', (e) => e.stopPropagation());
        }
    }

    _showGenderSelection() {
        if (this._formOverlay) this._formOverlay.destroy();
        if (this._formContainer) this._formContainer.destroy();

        this._formOverlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.75)
            .setInteractive().setDepth(50);

        const html = `
        <div style="
            width: 400px;
            background: #0B1120;
            padding: 30px;
            border: 2px solid #38bdf8;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.9), 0 0 15px rgba(56, 189, 248, 0.25);
            text-align: center;
            font-family: 'Outfit', sans-serif;
            color: #F8FAFC;
        ">
            <h2 style="margin: 0 0 15px 0; font-size: 20px; font-weight: bold; color: #38bdf8; text-shadow: 0 2px 4px rgba(0,0,0,0.9); letter-spacing: 1px;">Gender Setting</h2>
            <p style="font-size: 14px; line-height: 1.5; margin: 0 0 25px 0; color: #E2E8F0; text-shadow: 0 1px 3px rgba(0,0,0,0.9);">
                Choose the gender of the main character.<br/>
                Gender can be changed anytime after the tutorial is completed.
            </p>
            
            <div style="display: flex; justify-content: center; gap: 24px; margin-bottom: 30px;">
                <!-- Male Card -->
                <div id="card-male" style="
                    width: 140px;
                    height: 140px;
                    background: linear-gradient(to bottom, #1e3a8a, #3b82f6);
                    border: 2px solid #334155;
                    border-radius: 6px;
                    cursor: pointer;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.5);
                    transition: all 0.2s;
                ">
                    <img src="assets/portraits/char/1-mc-male-square.png" style="
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                        position: absolute;
                        top: 0;
                        left: 0;
                        pointer-events: none;
                    "/>
                    <div style="
                        position: absolute;
                        bottom: 0;
                        width: 100%;
                        background: linear-gradient(to top, rgba(0,0,0,0.9) 10%, transparent);
                        padding: 15px 0 8px 0;
                        font-size: 16px;
                        font-family: 'Outfit', sans-serif;
                        font-weight: bold;
                        text-shadow: 0 2px 4px rgba(0,0,0,0.9);
                        pointer-events: none;
                    ">Male</div>
                </div>

                <!-- Female Card -->
                <div id="card-female" style="
                    width: 140px;
                    height: 140px;
                    background: linear-gradient(to bottom, #7f1d1d, #ef4444);
                    border: 2px solid #334155;
                    border-radius: 6px;
                    cursor: pointer;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.5);
                    transition: all 0.2s;
                ">
                    <img src="assets/portraits/char/1-mc-female-square.png" style="
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                        position: absolute;
                        top: 0;
                        left: 0;
                        pointer-events: none;
                    "/>
                    <div style="
                        position: absolute;
                        bottom: 0;
                        width: 100%;
                        background: linear-gradient(to top, rgba(0,0,0,0.9) 10%, transparent);
                        padding: 15px 0 8px 0;
                        font-size: 16px;
                        font-family: 'Outfit', sans-serif;
                        font-weight: bold;
                        text-shadow: 0 2px 4px rgba(0,0,0,0.9);
                        pointer-events: none;
                    ">Female</div>
                </div>
            </div>

            <button id="btn-start" style="
                width: 100%;
                height: 44px;
                background: url('assets/ui/button/D/Button Disabled.png') no-repeat center / 100% 100%;
                filter: sepia(1) hue-rotate(162deg) saturate(1.5) brightness(0.6);
                border: none;
                color: #FFFFFF;
                text-shadow: 0 1px 2px rgba(0,0,0,0.8);
                font-size: 13px;
                font-weight: bold;
                font-family: 'Outfit', sans-serif;
                cursor: not-allowed;
                letter-spacing: 1.5px;
                transition: transform 0.1s, opacity 0.2s, filter 0.2s;
                opacity: 0.5;
            ">START</button>
            
            <button id="btn-cancel" style="
                width: 100%;
                height: 38px;
                margin-top: 10px;
                background: url('assets/ui/button/B/Button Normal 1.png') no-repeat center / 100% 100%;
                filter: sepia(1) hue-rotate(162deg) saturate(3.5) brightness(1.0);
                border: none;
                color: #E2E8F0;
                font-size: 11px;
                font-weight: bold;
                font-family: 'Outfit', sans-serif;
                letter-spacing: 1px;
                cursor: pointer;
                transition: transform 0.1s;
            ">CANCEL</button>
        </div>
        `;

        this._formContainer = this.add.dom(CX, H / 2).createFromHTML(html).setDepth(55);

        let selectedGender = null;
        const dom = this._formContainer.node;

        if (dom) {
            const cardMale = dom.querySelector('#card-male');
            const cardFemale = dom.querySelector('#card-female');
            const btnStart = dom.querySelector('#btn-start');
            const btnCancel = dom.querySelector('#btn-cancel');

            const selectGender = (gender) => {
                selectedGender = gender;
                btnStart.style.opacity = '1';
                btnStart.style.cursor = 'pointer';
                btnStart.style.backgroundImage = "url('assets/ui/button/D/Button Normal.png')";
                btnStart.style.filter = "sepia(1) hue-rotate(162deg) saturate(3.5) brightness(1.0)";

                if (gender === 'Male') {
                    cardMale.style.borderColor = '#38bdf8'; // Sky Blue Glow
                    cardMale.style.boxShadow = '0 0 20px rgba(56, 189, 248, 0.9)';
                    cardMale.style.transform = 'scale(1.05)';

                    cardFemale.style.borderColor = '#334155';
                    cardFemale.style.boxShadow = '0 4px 6px rgba(0,0,0,0.5)';
                    cardFemale.style.transform = 'scale(1)';
                } else {
                    cardFemale.style.borderColor = '#38bdf8'; // Sky Blue Glow
                    cardFemale.style.boxShadow = '0 0 20px rgba(56, 189, 248, 0.9)';
                    cardFemale.style.transform = 'scale(1.05)';

                    cardMale.style.borderColor = '#334155';
                    cardMale.style.boxShadow = '0 4px 6px rgba(0,0,0,0.5)';
                    cardMale.style.transform = 'scale(1)';
                }
            };

            btnStart.addEventListener('pointerover', () => {
                if (selectedGender) btnStart.style.backgroundImage = "url('assets/ui/button/D/Button Hover.png')";
            });
            btnStart.addEventListener('pointerout', () => {
                if (selectedGender) btnStart.style.backgroundImage = "url('assets/ui/button/D/Button Normal.png')";
            });
            btnStart.addEventListener('pointerdown', () => {
                if (selectedGender) btnStart.style.backgroundImage = "url('assets/ui/button/D/Button Active.png')";
            });

            btnCancel.addEventListener('pointerover', () => { btnCancel.style.backgroundImage = "url('assets/ui/button/B/Button Hover 1.png')"; });
            btnCancel.addEventListener('pointerout', () => { btnCancel.style.backgroundImage = "url('assets/ui/button/B/Button Normal 1.png')"; });
            btnCancel.addEventListener('pointerdown', () => { btnCancel.style.backgroundImage = "url('assets/ui/button/B/Button Active 1.png')"; });

            cardMale.addEventListener('click', () => {
                selectGender('Male');
            });
            cardFemale.addEventListener('click', () => {
                selectGender('Female');
            });

            btnStart.addEventListener('click', () => {
                if (selectedGender) {
                    this._showForm('register', selectedGender);
                }
            });

            btnCancel.addEventListener('click', () => {
                this._hideForm();
            });

            dom.addEventListener('pointerdown', (e) => e.stopPropagation());
            dom.addEventListener('mousedown', (e) => e.stopPropagation());
            dom.addEventListener('click', (e) => e.stopPropagation());
        }
    }

    _showForm(mode, gender = null) {
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
        this._formOverlay = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.75)
            .setInteractive().setDepth(50);

        const isRegister = mode === 'register';
        const title = isRegister ? 'CREATE ACCOUNT' : 'LOGIN';
        const submitLabel = isRegister ? 'REGISTER' : 'START LOGIN';
        const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';

        // HTML Form
        const formHTML = `
        <div id="auth-form" style="
            width: 320px;
            background: #0B1120;
            border: 2px solid #38bdf8;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.9), 0 0 15px rgba(56, 189, 248, 0.25);
            padding: 28px 24px;
            text-align: center;
            font-family: 'Outfit', sans-serif;
        ">
            <div style="
                font-size: 14px;
                font-weight: bold;
                color: #38bdf8;
                letter-spacing: 2px;
                margin-bottom: 20px;
                text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            ">${title}</div>

            <input id="auth-username" type="text" placeholder="Username" style="
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
                transition: border-color 0.2s;
            " />

            ${!isRegister ? `
            <input id="auth-password" type="password" placeholder="Password" style="
                width: 100%;
                padding: 10px 14px;
                margin-bottom: 18px;
                background: #0F172A;
                border: 1px solid #334155;
                border-radius: 4px;
                color: #F8FAFC;
                font-size: 13px;
                font-family: 'Outfit', sans-serif;
                outline: none;
                box-sizing: border-box;
                transition: border-color 0.2s;
            " />
            ` : ''}

            <div id="auth-error" style="
                color: #F87171;
                font-size: 11px;
                margin-bottom: 10px;
                min-height: 16px;
            "></div>

            <button id="auth-submit" style="
                width: 100%;
                height: 44px;
                background: url('assets/ui/button/D/Button Normal.png') no-repeat center / 100% 100%;
                filter: sepia(1) hue-rotate(162deg) saturate(3.5) brightness(1.0);
                border: none;
                color: #FFFFFF;
                font-size: 13px;
                font-weight: bold;
                font-family: 'Outfit', sans-serif;
                cursor: pointer;
                letter-spacing: 1.5px;
                text-shadow: 0 1px 2px rgba(0,0,0,0.8);
                transition: transform 0.1s;
            ">${submitLabel}</button>

            <button id="auth-cancel" style="
                width: 100%;
                height: 38px;
                margin-top: 10px;
                background: url('assets/ui/button/B/Button Normal 1.png') no-repeat center / 100% 100%;
                filter: sepia(1) hue-rotate(162deg) saturate(3.5) brightness(1.0);
                border: none;
                color: #E2E8F0;
                font-size: 11px;
                font-weight: bold;
                font-family: 'Outfit', sans-serif;
                letter-spacing: 1px;
                cursor: pointer;
                transition: transform 0.1s;
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

            // Add Sky Blue focus effect to input fields
            const inputs = domElement.node.querySelectorAll('input');
            inputs.forEach(inp => {
                inp.addEventListener('focus', () => { inp.style.borderColor = '#38bdf8'; });
                inp.addEventListener('blur', () => { inp.style.borderColor = '#334155'; });
            });
        }

        // Cancel button
        const cancelBtn = domElement.getChildByID('auth-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('pointerover', () => { cancelBtn.style.backgroundImage = "url('assets/ui/button/B/Button Hover 1.png')"; });
            cancelBtn.addEventListener('pointerout', () => { cancelBtn.style.backgroundImage = "url('assets/ui/button/B/Button Normal 1.png')"; });
            cancelBtn.addEventListener('pointerdown', () => { cancelBtn.style.backgroundImage = "url('assets/ui/button/B/Button Active 1.png')"; });
            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._hideForm();
            });
        }

        // Submit button
        const submitBtn = domElement.getChildByID('auth-submit');
        if (submitBtn) {
            submitBtn.addEventListener('pointerover', () => { if (!submitBtn.disabled) submitBtn.style.backgroundImage = "url('assets/ui/button/D/Button Hover.png')"; });
            submitBtn.addEventListener('pointerout', () => { if (!submitBtn.disabled) submitBtn.style.backgroundImage = "url('assets/ui/button/D/Button Normal.png')"; });
            submitBtn.addEventListener('pointerdown', () => { if (!submitBtn.disabled) submitBtn.style.backgroundImage = "url('assets/ui/button/D/Button Active.png')"; });

            submitBtn.addEventListener('click', () => {
                const username = domElement.getChildByID('auth-username').value.trim();
                const passwordNode = domElement.getChildByID('auth-password');
                const password = passwordNode ? passwordNode.value : null;
                const errorDiv = domElement.getChildByID('auth-error');

                if (!username || (!isRegister && !password)) {
                    errorDiv.textContent = isRegister ? 'Username wajib diisi.' : 'Username dan password wajib diisi.';
                    return;
                }

                errorDiv.textContent = '';
                submitBtn.textContent = 'LOADING...';
                submitBtn.disabled = true;
                submitBtn.style.backgroundImage = "url('assets/ui/button/D/Button Disabled.png')";

                this._doAuth(endpoint, username, password, gender, isRegister, errorDiv, submitBtn);
            });
        }

        // Dukungan tombol Enter
        const handleEnterKey = (e) => {
            if (e.key === 'Enter') {
                if (submitBtn) submitBtn.click();
            }
        };
        const userInp = domElement.getChildByID('auth-username');
        const passInp = domElement.getChildByID('auth-password');
        if (userInp) userInp.addEventListener('keydown', handleEnterKey);
        if (passInp) passInp.addEventListener('keydown', handleEnterKey);
    }

    async _doAuth(endpoint, username, password, gender, isRegister, errorDiv, submitBtn) {
        try {
            const payload = isRegister ? { username, gender } : { username, password };
            const res = await fetch(`http://localhost:3000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();

            if (json.status !== 'success') {
                errorDiv.textContent = json.message || 'Terjadi kesalahan.';
                submitBtn.textContent = isRegister ? 'REGISTER' : 'START LOGIN';
                submitBtn.disabled = false;
                submitBtn.style.backgroundImage = "url('assets/ui/button/D/Button Normal.png')";
                return;
            }

            this._saveAndProceed(json);
        } catch (err) {
            errorDiv.textContent = 'Connection error: ' + err.message;
            submitBtn.textContent = isRegister ? 'REGISTER' : 'START LOGIN';
            submitBtn.disabled = false;
            submitBtn.style.backgroundImage = "url('assets/ui/button/D/Button Normal.png')";
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
