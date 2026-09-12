/**
 * BattleMenu.js
 * Extracts UI Menu logic from BattleScene to a modular Phaser Container.
 */
import Phaser from 'phaser';

export default class BattleMenu extends Phaser.GameObjects.Container {
    constructor(scene, cx, cy, w, h, themeConfig) {
        super(scene, 0, 0);
        this.scene = scene;
        this.CX = cx;
        this.CY = cy;
        this.W = w;
        this.H = h;
        this.THEME = themeConfig;

        // Ensure cleanup when scene shuts down
        this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);

        this.setDepth(40);
        this.scene.add.existing(this);

        this.musicOn = localStorage.getItem('music_on') !== 'false';
        this.sfxOn = localStorage.getItem('sfx_on') !== 'false';

        this._menuTab = "party";
        this._enemyCarouselIdx = 0;

        this.buildUI();
    }

    buildUI() {
        // Overlay backdrop (depth 39)
        this._menuOverlay = this.scene.add.rectangle(this.CX, this.H / 2, this.W, this.H, 0x000000, 0.75)
            .setDepth(39)
            .setInteractive();
        
        this._menuOverlay.on('pointerdown', (pointer, x, y, event) => {
            event.stopPropagation();
        });

        // Main Menu Container centered
        this.setPosition(this.CX, this.H / 2);

        // Panel Box (380x540)
        const panel = this.scene.add.rectangle(0, 0, 380, 540, 0x0a0f1d).setStrokeStyle(3, 0xf1c40f);
        this.add(panel);

        // Header Title
        const title = this.scene.add.text(0, -240, "MAIN MENU", {
            fontSize: "20px",
            color: "#f1c40f",
            fontStyle: "bold",
            fontFamily: "Outfit, Inter, sans-serif"
        }).setOrigin(0.5);
        this.add(title);

        // Close Button (✕)
        const closeBtn = this.scene.add.text(160, -240, "✕", {
            fontSize: "20px",
            color: "#8899aa",
            fontStyle: "bold"
        }).setOrigin(0.5).setInteractive();
        closeBtn.on('pointerover', () => closeBtn.setColor('#ff4757'));
        closeBtn.on('pointerout', () => closeBtn.setColor('#8899aa'));
        closeBtn.on('pointerdown', () => this.closeMenu());
        this.add(closeBtn);

        // --- SECTION 1: TABS ---
        this._tabPartyBtn = this.scene.add.rectangle(-90, -190, 160, 34, 0x1e3a5f).setInteractive();
        this._tabPartyBtn.setStrokeStyle(1.5, 0x4a90d9);
        this._tabPartyText = this.scene.add.text(-90, -190, "PARTY", { fontSize: "12px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);

        this._tabEnemyBtn = this.scene.add.rectangle(90, -190, 160, 34, 0x0d1420).setInteractive();
        this._tabEnemyBtn.setStrokeStyle(1.5, 0x3a4f66);
        this._tabEnemyText = this.scene.add.text(90, -190, "ENEMY INFO", { fontSize: "12px", color: "#8899aa", fontStyle: "bold" }).setOrigin(0.5);

        this._tabPartyBtn.on('pointerdown', () => this.switchMenuTab("party"));
        this._tabEnemyBtn.on('pointerdown', () => this.switchMenuTab("enemy"));

        this.add([this._tabPartyBtn, this._tabPartyText, this._tabEnemyBtn, this._tabEnemyText]);

        // Tab Content Container
        this._menuContentContainer = this.scene.add.container(0, 0);
        this.add(this._menuContentContainer);
        this.renderMenuTabContent();

        // Divider 1
        const div1 = this.scene.add.graphics();
        div1.lineStyle(1, 0x1f2d44, 1);
        div1.lineBetween(-170, 0, 170, 0);
        this.add(div1);

        // --- SECTION 2: AUDIO TOGGLES ---
        const settingsText = this.scene.add.text(-170, 20, "SETTINGS", { fontSize: "10px", color: "#8899aa", fontStyle: "bold", letterSpacing: 1 }).setOrigin(0, 0.5);
        this.add(settingsText);

        // Music toggle
        this._musicBtn = this.scene.add.rectangle(-85, 55, 160, 40, this.musicOn ? 0x0d2a1a : 0x2a0d0d).setInteractive();
        this._musicBtn.setStrokeStyle(1.5, this.musicOn ? 0x2ecc71 : 0xe74c3c);
        this._musicText = this.scene.add.text(-85, 55, "MUSIC: " + (this.musicOn ? "ON" : "OFF"), { fontSize: "11px", color: this.musicOn ? "#a8e6cf" : "#ff8a80", fontStyle: "bold" }).setOrigin(0.5);
        this._musicBtn.on('pointerdown', () => this.toggleMusicSetting());

        // SFX toggle
        this._sfxBtn = this.scene.add.rectangle(85, 55, 160, 40, this.sfxOn ? 0x0d2a1a : 0x2a0d0d).setInteractive();
        this._sfxBtn.setStrokeStyle(1.5, this.sfxOn ? 0x2ecc71 : 0xe74c3c);
        this._sfxText = this.scene.add.text(85, 55, "SFX: " + (this.sfxOn ? "ON" : "OFF"), { fontSize: "11px", color: this.sfxOn ? "#a8e6cf" : "#ff8a80", fontStyle: "bold" }).setOrigin(0.5);
        this._sfxBtn.on('pointerdown', () => this.toggleSfxSetting());

        this.add([this._musicBtn, this._musicText, this._sfxBtn, this._sfxText]);

        // Divider 2
        const div2 = this.scene.add.graphics();
        div2.lineStyle(1, 0x1f2d44, 1);
        div2.lineBetween(-170, 105, 170, 105);
        this.add(div2);

        // --- SECTION 3: ACTIONS ---
        const actionsText = this.scene.add.text(-170, 120, "ACTIONS", { fontSize: "10px", color: "#8899aa", fontStyle: "bold", letterSpacing: 1 }).setOrigin(0, 0.5);
        this.add(actionsText);

        // HOME button
        const homeBtn = this.scene.add.rectangle(-85, 155, 160, 44, 0x1f2d44).setInteractive();
        homeBtn.setStrokeStyle(1.5, 0x3282b8);
        const homeText = this.scene.add.text(-85, 155, "HOME", { fontSize: "12px", color: "#ffffff", fontStyle: "bold", letterSpacing: 1 }).setOrigin(0.5);
        homeBtn.on('pointerover', () => homeBtn.setFillStyle(0x3282b8));
        homeBtn.on('pointerout', () => homeBtn.setFillStyle(0x1f2d44));
        homeBtn.on('pointerdown', () => {
            this.closeMenu();
            this.scene.scene.stop('BattleScene');
            this.scene.scene.start('BattleScene'); // Restarts battle scene as initial entry
        });

        // RETREAT button
        const retreatBtn = this.scene.add.rectangle(85, 155, 160, 44, 0x2a0d0d).setInteractive();
        retreatBtn.setStrokeStyle(1.5, 0xe74c3c);
        const retreatText = this.scene.add.text(85, 155, "RETREAT", { fontSize: "12px", color: "#ff8a80", fontStyle: "bold", letterSpacing: 1 }).setOrigin(0.5);
        retreatBtn.on('pointerover', () => retreatBtn.setFillStyle(0xe74c3c));
        retreatBtn.on('pointerout', () => retreatBtn.setFillStyle(0x2a0d0d));
        retreatBtn.on('pointerdown', () => this.showRetreatConfirmation());

        this.add([homeBtn, homeText, retreatBtn, retreatText]);
    }

    closeMenu() {
        this.destroy(); // Destroy itself and overlay
    }

    switchMenuTab(tab) {
        if (this._menuTab === tab) return;
        this._menuTab = tab;

        this._tabPartyBtn.setFillStyle(tab === "party" ? 0x1e3a5f : 0x0d1420);
        this._tabPartyBtn.setStrokeStyle(1.5, tab === "party" ? 0x4a90d9 : 0x3a4f66);
        this._tabPartyText.setColor(tab === "party" ? "#ffffff" : "#8899aa");

        this._tabEnemyBtn.setFillStyle(tab === "enemy" ? 0x1e3a5f : 0x0d1420);
        this._tabEnemyBtn.setStrokeStyle(1.5, tab === "enemy" ? 0x4a90d9 : 0x3a4f66);
        this._tabEnemyText.setColor(tab === "enemy" ? "#ffffff" : "#8899aa");

        this.renderMenuTabContent();
    }

    renderMenuTabContent() {
        this._menuContentContainer.removeAll(true);

        if (this._menuTab === "party") {
            const py = -95;
            const cW = 76, gap = 8, total = this.scene.players.length, totalW = total * cW + (total - 1) * gap;
            const sx = -totalW / 2 + cW / 2;

            this.scene.players.forEach((p, idx) => {
                const px = sx + idx * (cW + gap);
                const elemColor = this.getElemColor(p.element);

                const card = this.scene.add.rectangle(px, py, cW, 114, 0x0d1b2a).setStrokeStyle(1.5, elemColor);

                let nameStr = p.charName;
                if (nameStr.length > 11) nameStr = nameStr.substring(0, 9) + "..";
                const nameTxt = this.scene.add.text(px, py - 44, nameStr, { fontSize: "9px", color: "#e0e0ff", fontStyle: "bold" }).setOrigin(0.5);

                const lvlTxt = this.scene.add.text(px, py - 28, `Lv.${p.level}`, { fontSize: "8px", color: "#8899aa" }).setOrigin(0.5);
                const elemTxt = this.scene.add.text(px, py - 12, p.element.toUpperCase(), { fontSize: "7px", color: "#fff", backgroundColor: "#0a0a1a", padding: { x: 3, y: 1 } }).setOrigin(0.5);

                const barW = cW - 12;
                const hpBg = this.scene.add.rectangle(px, py + 15, barW, 6, 0x222222);
                const hr = Math.max(0, p.hp / p.maxHp);
                let barColor = 0x2ecc71;
                if (p.hp <= 0) barColor = 0x000000;
                else if (hr <= 0.25) barColor = 0xe74c3c;
                else if (hr <= 0.50) barColor = 0xe67e22;
                const hpFill = this.scene.add.rectangle(px - barW / 2, py + 15, barW * hr, 6, barColor).setOrigin(0, 0.5);

                const hpPctTxt = this.scene.add.text(px, py + 26, Math.ceil(hr * 100) + "%", { fontSize: "7px", color: "#a8e6cf", fontStyle: "bold" }).setOrigin(0.5);

                const saW = barW;
                const saBg = this.scene.add.rectangle(px, py + 36, saW, 4, 0x222222);
                const saRatio = p.specialBar / p.specialMax;
                const saFill = this.scene.add.rectangle(px - saW / 2, py + 36, saW * saRatio, 4, 0xffaa00).setOrigin(0, 0.5);
                const saTxt = this.scene.add.text(px, py + 45, "SA " + Math.floor(saRatio * 100) + "%", { fontSize: "7px", color: "#ffaa00" }).setOrigin(0.5);

                this._menuContentContainer.add([card, nameTxt, lvlTxt, elemTxt, hpBg, hpFill, hpPctTxt, saBg, saFill, saTxt]);
            });
        } else {
            const py = -95;
            const enemies = (this.scene && this.scene.enemies && this.scene.enemies.length > 0) ? this.scene.enemies : [];
            if (enemies.length === 0) {
                const noEnemyTxt = this.scene.add.text(0, py, "No enemy data available", { fontSize: "11px", color: "#8899aa", fontStyle: "italic" }).setOrigin(0.5);
                this._menuContentContainer.add(noEnemyTxt);
                return;
            }

            if (this._enemyIdx === undefined || this._enemyIdx >= enemies.length) {
                this._enemyIdx = (this.scene.selectedTargetIndex >= 0 && this.scene.selectedTargetIndex < enemies.length)
                    ? this.scene.selectedTargetIndex
                    : 0;
            }

            const enemy = enemies[this._enemyIdx] || enemies[0];
            const elemColor = this.getElemColor(enemy.element);

            // Left side Enemy Card
            const card = this.scene.add.rectangle(-118, py, 76, 114, 0x1c0a0a).setStrokeStyle(1.5, elemColor);
            const tagLabel = enemy.isBoss ? "BOSS" : `ENEMY ${this._enemyIdx + 1}/${enemies.length}`;
            const nameTxt = this.scene.add.text(-118, py - 44, tagLabel, { fontSize: "8px", color: "#ff8a80", fontStyle: "bold" }).setOrigin(0.5);
            let bossNameStr = enemy.charName || "Enemy";
            if (bossNameStr.length > 11) bossNameStr = bossNameStr.substring(0, 9) + "..";
            const bossNameTxt = this.scene.add.text(-118, py - 28, bossNameStr, { fontSize: "8px", color: "#e0e0ff", fontStyle: "bold" }).setOrigin(0.5);
            const lvlTxt = this.scene.add.text(-118, py - 12, `Lv.${enemy.level || 1}`, { fontSize: "8px", color: "#8899aa" }).setOrigin(0.5);
            const elemTxt = this.scene.add.text(-118, py + 12, (enemy.element || 'NONE').toUpperCase(), { fontSize: "7px", color: "#fff", backgroundColor: "#0a0a1a", padding: { x: 3, y: 1 } }).setOrigin(0.5);

            this._menuContentContainer.add([card, nameTxt, bossNameTxt, lvlTxt, elemTxt]);

            // Top Right HP & CA Info
            const hpInfoBg = this.scene.add.rectangle(42, py - 38, 206, 34, 0x0d1420).setStrokeStyle(1, 0x1f2d44);
            const curHp = Math.max(0, Math.ceil(enemy.hp || 0));
            const maxHp = enemy.maxHp || 1;
            const hpInfoTxt = this.scene.add.text(-55, py - 38, `HP: ${curHp.toLocaleString()}/${maxHp.toLocaleString()}`, { fontSize: "8px", color: "#ff8a80", fontStyle: "bold" }).setOrigin(0, 0.5);
            const caMaxTxt = this.scene.add.text(138, py - 38, `CA: ${enemy.caBar || 0}/${enemy.caMax || 3}`, { fontSize: "8px", color: "#ffaa00" }).setOrigin(1, 0.5);

            this._menuContentContainer.add([hpInfoBg, hpInfoTxt, caMaxTxt]);

            // Enemy Carousel Switcher (rendered ONLY if enemies.length > 1)
            if (enemies.length > 1) {
                const prevEnemyBtn = this.scene.add.text(-150, py - 44, "◀", { fontSize: "11px", color: "#ff8a80", fontStyle: "bold" }).setOrigin(0.5).setInteractive({ useHandCursor: true });
                const nextEnemyBtn = this.scene.add.text(-86, py - 44, "▶", { fontSize: "11px", color: "#ff8a80", fontStyle: "bold" }).setOrigin(0.5).setInteractive({ useHandCursor: true });

                prevEnemyBtn.on('pointerover', () => prevEnemyBtn.setColor('#ffffff'));
                prevEnemyBtn.on('pointerout', () => prevEnemyBtn.setColor('#ff8a80'));
                prevEnemyBtn.on('pointerdown', () => {
                    this._enemyIdx = (this._enemyIdx - 1 + enemies.length) % enemies.length;
                    this._enemyCarouselIdx = 0;
                    this.renderMenuTabContent();
                });

                nextEnemyBtn.on('pointerover', () => nextEnemyBtn.setColor('#ffffff'));
                nextEnemyBtn.on('pointerout', () => nextEnemyBtn.setColor('#ff8a80'));
                nextEnemyBtn.on('pointerdown', () => {
                    this._enemyIdx = (this._enemyIdx + 1) % enemies.length;
                    this._enemyCarouselIdx = 0;
                    this.renderMenuTabContent();
                });

                this._menuContentContainer.add([prevEnemyBtn, nextEnemyBtn]);
            }

            // Bottom Right Skill Info Box
            const skillBox = this.scene.add.rectangle(42, py + 18, 206, 78, 0x0d1420).setStrokeStyle(1, 0x1f2d44);
            this._menuContentContainer.add(skillBox);

            const uniqueSkillsMap = {};
            (enemy.aiBehaviors || []).forEach(b => {
                if (b.skill && b.skill.id) {
                    uniqueSkillsMap[b.skill.id] = b.skill;
                }
            });
            const enemySkills = Object.values(uniqueSkillsMap);

            if (enemySkills.length > 0) {
                if (this._enemyCarouselIdx >= enemySkills.length) this._enemyCarouselIdx = 0;
                const skill = enemySkills[this._enemyCarouselIdx];

                let sName = skill.name || "Unknown Skill";
                if (sName.length > 18) sName = sName.substring(0, 16) + "...";
                const skillNameTxt = this.scene.add.text(42, py - 12, sName, { fontSize: "10px", color: "#7ec8e3", fontStyle: "bold" }).setOrigin(0.5);

                const sType = (skill.type || "Damage").toUpperCase();
                const sTarget = (skill.target_type || "Single_Enemy").replace('_', ' ').toUpperCase();
                const skillMetaTxt = this.scene.add.text(42, py + 4, `${sType} (${sTarget})`, { fontSize: "7px", color: "#8899aa" }).setOrigin(0.5);

                let descStr = "";
                if (skill.modifier) {
                    descStr = `Deals ${Math.round(skill.modifier * 100)}% elemental damage.`;
                } else {
                    descStr = "Support action.";
                }

                if (skill.status_effects && skill.status_effects.length > 0) {
                    const effNames = skill.status_effects.map(e => e.effect_name || e.target_stat).join(', ');
                    descStr += ` Inflicts: ${effNames}.`;
                }

                if (descStr.length > 55) descStr = descStr.substring(0, 52) + "...";

                const skillDescTxt = this.scene.add.text(42, py + 22, descStr, { fontSize: "8px", color: "#e0e0ff", align: "center", wordWrap: { width: 180 } }).setOrigin(0.5);
                this._menuContentContainer.add([skillNameTxt, skillMetaTxt, skillDescTxt]);

                if (enemySkills.length > 1) {
                    const prevBtnText = this.scene.add.text(-46, py + 18, "◀", { fontSize: "14px", color: "#7ec8e3", fontStyle: "bold" }).setOrigin(0.5).setInteractive();
                    const nextBtnText = this.scene.add.text(130, py + 18, "▶", { fontSize: "14px", color: "#7ec8e3", fontStyle: "bold" }).setOrigin(0.5).setInteractive();

                    prevBtnText.on('pointerover', () => prevBtnText.setColor('#ffffff'));
                    prevBtnText.on('pointerout', () => prevBtnText.setColor('#7ec8e3'));
                    prevBtnText.on('pointerdown', () => {
                        this._enemyCarouselIdx = (this._enemyCarouselIdx - 1 + enemySkills.length) % enemySkills.length;
                        this.renderMenuTabContent();
                    });

                    nextBtnText.on('pointerover', () => nextBtnText.setColor('#ffffff'));
                    nextBtnText.on('pointerout', () => nextBtnText.setColor('#7ec8e3'));
                    nextBtnText.on('pointerdown', () => {
                        this._enemyCarouselIdx = (this._enemyCarouselIdx + 1) % enemySkills.length;
                        this.renderMenuTabContent();
                    });

                    this._menuContentContainer.add([prevBtnText, nextBtnText]);
                }
            } else {
                const noSkillsTxt = this.scene.add.text(42, py + 18, "No active skills data", { fontSize: "9px", color: "#888", fontStyle: "italic" }).setOrigin(0.5);
                this._menuContentContainer.add(noSkillsTxt);
            }
        }
    }

    toggleMusicSetting() {
        this.musicOn = !this.musicOn;
        localStorage.setItem('music_on', this.musicOn);
        this._musicBtn.setFillStyle(this.musicOn ? 0x0d2a1a : 0x2a0d0d);
        this._musicBtn.setStrokeStyle(1.5, this.musicOn ? 0x2ecc71 : 0xe74c3c);
        this._musicText.setText("MUSIC: " + (this.musicOn ? "ON" : "OFF")).setColor(this.musicOn ? "#a8e6cf" : "#ff8a80");
        if (window.AetheriaAudioManager) window.AetheriaAudioManager.updateMuteState(this.scene);
    }

    toggleSfxSetting() {
        this.sfxOn = !this.sfxOn;
        localStorage.setItem('sfx_on', this.sfxOn);
        this._sfxBtn.setFillStyle(this.sfxOn ? 0x0d2a1a : 0x2a0d0d);
        this._sfxBtn.setStrokeStyle(1.5, this.sfxOn ? 0x2ecc71 : 0xe74c3c);
        this._sfxText.setText("SFX: " + (this.sfxOn ? "ON" : "OFF")).setColor(this.sfxOn ? "#a8e6cf" : "#ff8a80");
        if (window.AetheriaAudioManager) window.AetheriaAudioManager.updateMuteState(this.scene);
    }

    showRetreatConfirmation() {
        this._confirmOverlay = this.scene.add.rectangle(this.CX, this.H / 2, this.W, this.H, 0x000000, 0.8).setDepth(41).setInteractive();
        this._confirmOverlay.on('pointerdown', (pointer, x, y, event) => {
            event.stopPropagation();
        });

        this._confirmContainer = this.scene.add.container(this.CX, this.H / 2).setDepth(42);

        const panel = this.scene.add.rectangle(0, 0, 300, 160, 0x0d1420).setStrokeStyle(2, 0xe74c3c);
        this._confirmContainer.add(panel);

        const warnTitle = this.scene.add.text(0, -40, "CONFIRM RETREAT?", { fontSize: "14px", color: "#ff8a80", fontStyle: "bold" }).setOrigin(0.5);
        const warnDesc = this.scene.add.text(0, -10, "Mundur sekarang?\nStamina yang sudah terpakai akan HANGUS.", { fontSize: "10px", color: "#ffffff", align: "center", lineSpacing: 2 }).setOrigin(0.5);
        this._confirmContainer.add([warnTitle, warnDesc]);

        const cancelBtn = this.scene.add.rectangle(-65, 40, 110, 34, 0x1a2e3b).setInteractive();
        cancelBtn.setStrokeStyle(1, 0x3282b8);
        const cancelTxt = this.scene.add.text(-65, 40, "NO, KEEP FIGHTING", { fontSize: "8px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
        cancelBtn.on('pointerover', () => cancelBtn.setFillStyle(0x3282b8));
        cancelBtn.on('pointerout', () => cancelBtn.setFillStyle(0x1a2e3b));
        cancelBtn.on('pointerdown', () => {
            this._confirmContainer.destroy();
            this._confirmOverlay.destroy();
        });

        const confirmBtn = this.scene.add.rectangle(65, 40, 110, 34, 0x2a0d0d).setInteractive();
        confirmBtn.setStrokeStyle(1, 0xe74c3c);
        const confirmTxt = this.scene.add.text(65, 40, "YES, RETREAT", { fontSize: "8px", color: "#ff8a80", fontStyle: "bold" }).setOrigin(0.5);
        confirmBtn.on('pointerover', () => confirmBtn.setFillStyle(0xe74c3c));
        confirmBtn.on('pointerout', () => confirmBtn.setFillStyle(0x2a0d0d));
        confirmBtn.on('pointerdown', () => {
            this._confirmContainer.destroy();
            this._confirmOverlay.destroy();
            const battleScene = this.scene;
            this.closeMenu();
            battleScene.triggerDefeat(true); // Trigger retreat logic
        });

        this._confirmContainer.add([cancelBtn, cancelTxt, confirmBtn, confirmTxt]);
    }

    getElemColor(el) {
        return { Fire: this.THEME.ELEM_FIRE, Wind: this.THEME.ELEM_WIND, Earth: this.THEME.ELEM_EARTH }[el] || this.THEME.BORDER;
    }

    destroy(fromScene) {
        if (this._menuOverlay) {
            this._menuOverlay.destroy();
            this._menuOverlay = null;
        }
        if (this._confirmContainer) {
            this._confirmContainer.destroy();
            this._confirmContainer = null;
        }
        if (this._confirmOverlay) {
            this._confirmOverlay.destroy();
            this._confirmOverlay = null;
        }
        super.destroy(fromScene);
    }
}
