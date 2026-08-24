/**
 * Player — Phaser.GameObjects.Container
 *
 * Portrait card 85×120 di area Party HUD.
 * Tap portrait → buka Skill Window sidebar.
 * isSAReady = true saat SA dikonfirmasi dari sidebar.
 */
export default class Player extends Phaser.GameObjects.Container {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     * @param {object} data - Satu objek karakter dari API (player_party.characters[i])
     */
    constructor(scene, x, y, data) {
        super(scene, x, y);
        scene.add.existing(this);

        this.slot = data.slot;
        this.mc_id = data.mc_id || data.id || data.slot;
        this._portraitPath = data.portrait_path;
        this._fullPortraitPath = data.full_portrait_path;
        this.id = data.id || data.slot;
        this.charName = data.name;
        this.element = data.element || 'None';
        this.level = data.level || 1;
        this.finalStats = data.final_stats || { hp: 100, atk: 10, def: 10, crit: 0.1, max_sa: 100 }; // Fallback for old save states
        this.maxHp = this.finalStats.hp;
        this.hp = this.finalStats.hp;
        this.atk = this.finalStats.atk;
        // Base stats (disimpan untuk referensi getStat())
        this._baseAtk = this.finalStats.atk;
        this._baseDef = this.finalStats.def || 500;
        this._baseCrit = this.finalStats.crit !== undefined ? this.finalStats.crit : 0.1;

        this.def = this._baseDef;
        this.crit = this._baseCrit;
        this.critDamage = 2.0;

        // ── Active Effects (menggantikan activeBuffs lama) ────────────────────
        // Setiap entry: { effect_name, effect_type, target_stat, value, duration, effect_target }
        this.activeEffects = [];

        // ── Combat State ──────────────────────────────────────────────────────
        this.specialBar = 0;
        this.specialMax = this.finalStats.max_sa || 100;
        this.cooldowns = {};
        this.isSAReady = false;

        // ── Action Queue & AUTO ───────────────────────────────────────────────
        this.queuedAction = { type: 'none' };
        this.isAuto = false;

        // ── Normalisasi Skills dari API ───────────────────────────────────────
        // API sudah mengirim ms_action_type sebagai 'type' dan status_effects[]
        // Passive dibuang — tidak ditampilkan di skill window
        this.skills = (data.skills || [])
            .filter(s => {
                const cat = (s.category || '').toLowerCase();
                return cat !== 'passive';
            })
            .map(s => ({
                id: s.id,
                name: s.name,
                category: s.category || 'Active',   // 'Active' | 'Special' | 'Passive'
                type: s.type || 'Damage',   // 'Damage' | 'Support' | 'Heal' | 'Cleanse' | 'Revive'
                target_type: s.target_type || 'Single_Enemy',
                modifier: parseFloat(s.modifier ?? 1.0),
                cooldown: (s.category || '').toLowerCase() === 'special' ? 0 : (s.cooldown || 0),
                trigger_delay: s.trigger_delay,
                trigger_dispel: s.trigger_dispel,
                trigger_heal_pct: s.trigger_heal_pct,
                hp_cost_pct: s.hp_cost_pct,
                status_effects: s.status_effects || []    // array efek dari API
            }));

        // Special Attack — skill berkategori 'Special', fallback Limit Break
        const spSkill = this.skills.find(s => s.category.toLowerCase() === 'special');
        this.specialAttack = spSkill
            ? { id: spSkill.id, name: spSkill.name, modifier: spSkill.modifier, target_type: spSkill.target_type || 'Single_Enemy', trigger_delay: spSkill.trigger_delay, trigger_dispel: spSkill.trigger_dispel, trigger_heal_pct: spSkill.trigger_heal_pct, hp_cost_pct: spSkill.hp_cost_pct, status_effects: spSkill.status_effects || [] }
            : { id: 'limit_break', name: 'Limit Break', modifier: 3.5, target_type: 'Single_Enemy', status_effects: [] };

        // ── Dimensi & Warna ───────────────────────────────────────────────────
        this._W = 85;
        this._H = 145;
        this._elemColor = this._getElementColor(this.element);
        this._baseX = x;
        this._isHighlight = false;

        // ── Visual Elements ───────────────────────────────────────────────────
        this._bg = scene.add.rectangle(0, 0, this._W, this._H, 0x12192b);
        this._bg.setStrokeStyle(1, 0x334155);

        const keyId = data.mc_id || data.id || data.slot;
        let portTex = `portrait_${keyId}`;
        
        if (this._portraitPath && scene.textures.exists(portTex)) {
            this._portrait = scene.add.image(0, 0, portTex);
            // Scale based on width to maintain aspect ratio (no ugly stretching)
            const imgW = this._portrait.width || 1;
            this._portrait.setScale(this._W / imgW);
            
            const maskShape = scene.make.graphics();
            maskShape.fillStyle(0xffffff);
            maskShape.fillRect(x - (this._W / 2), y - (this._H / 2), this._W, this._H);
            this._portrait.setMask(new Phaser.Display.Masks.GeometryMask(scene, maskShape));
        } else {
            // Placeholder
            this._portrait = scene.add.text(0, 0, "?", { fontSize: "32px", color: "#94a3b8" }).setOrigin(0.5);
        }

        this._gradientFade = scene.add.graphics();
        this._gradientFade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 1.0, 1.0);
        this._gradientFade.fillRect(-(this._W / 2), -10, this._W, (this._H / 2) + 10);

        this._accent = scene.add.rectangle(0, -(this._H / 2) + 5, this._W, 10, this._elemColor);

        // HP Bar
        this._hpBarBg = scene.add.rectangle(0, 42, 60, 10, 0x222222);
        this._hpFill = scene.add.rectangle(-30, 42, 60, 10, 0x27ae60).setOrigin(0, 0.5);
        this._hpText = scene.add.text(0, 42, `${this.hp}`, {
            fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5, 0.5);

        // SA Bar
        this._saBarBg = scene.add.rectangle(0, 56, 60, 6, 0x111111);
        this._saFill = scene.add.rectangle(-30, 56, (this.specialBar / this.specialMax) * 60, 6, 0xf1c40f).setOrigin(0, 0.5);
        this._saPctText = scene.add.text(32, 56, `${Math.floor((this.specialBar / this.specialMax) * 100)}%`, {
            fontSize: '8px', color: '#f1c40f', fontStyle: 'bold'
        }).setOrigin(0, 0.5);

        // SA Ready indicator
        this._saReadyGem = scene.add.circle(28, -(this._H / 2) + 6, 5, 0xf39c12);
        this._saReadyGem.setAlpha(0);

        // KO Overlay
        this._koOverlay = scene.add.rectangle(0, 0, this._W, this._H, 0x000000).setAlpha(0);
        this._koText = scene.add.text(0, 0, 'KO', {
            fontSize: '18px', color: '#ff4444', fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0);

        // Container untuk indikator status efek aktif (di-rebuild tiap refreshVisual)
        this._effectIndicators = scene.add.container(0, 16);

        // ── Action Badge ──────────────────────────────────────────────────────
        this._actionBadgeBg = scene.add.circle(28, -(this._H / 2) + 20, 12, 0x1e293b).setStrokeStyle(1, 0x94a3b8).setAlpha(0);
        this._actionBadgeText = scene.add.text(28, -(this._H / 2) + 20, '', { fontSize: '12px' }).setOrigin(0.5).setAlpha(0);

        this.add([
            this._bg, this._portrait, this._gradientFade, this._accent,
            this._hpBarBg, this._hpFill, this._hpText,
            this._saBarBg, this._saFill, this._saPctText, this._saReadyGem,
            this._koOverlay, this._koText,
            this._effectIndicators,
            this._actionBadgeBg, this._actionBadgeText
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTIVE EFFECTS SYSTEM
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Tambahkan satu efek status ke activeEffects.
     * @param {object} effectData - Satu item dari status_effects array API:
     *   { effect_name, effect_type, target_stat, value, duration, effect_target }
     */
    addEffect(effectData) {
        if (!effectData || !effectData.target_stat) return;

        // Hindari duplikasi: jika efek dengan nama sama sudah ada,
        // reset durasinya saja (refresh / overwrite)
        const existing = this.activeEffects.find(e => e.effect_name === effectData.effect_name);
        if (existing) {
            existing.duration = effectData.duration;
            existing.value = effectData.value;
            return;
        }

        this.activeEffects.push({ ...effectData });
    }

    /**
     * Hitung nilai final dari satu stat secara dinamis berdasarkan activeEffects.
     * Rumus: baseStat * (1 + clampedMultiplier)
     * Hard Cap: multiplier dibatasi ±50% untuk mencegah stat inflation.
     * @param {string} statName - 'ATK' | 'DEF' | 'CRIT'
     * @returns {number}
     */
    getStat(statName) {
        const statMap = {
            'ATK': this._baseAtk,
            'DEF': this._baseDef,
            'CRIT': this._baseCrit
        };
        const base = statMap[statName] ?? 0;

        if (statName === 'CRIT') {
            const hasGuarantee = this.activeEffects.some(e => (e.effect_name || '').toLowerCase().includes('guarantee'));
            if (hasGuarantee) return 1.0;

            const totalMult = this.activeEffects
                .filter(e => e.target_stat === 'CRIT' && !(e.effect_name || '').toLowerCase().includes('damage'))
                .reduce((sum, e) => sum + (Number(e.value) || 0), 0);

            const clampedMult = Math.max(-0.5, Math.min(0.5, totalMult));
            return Math.max(0, this._baseCrit + clampedMult);
        }

        const numericStats = ['ATK', 'DEF'];
        if (!numericStats.includes(statName)) return base;

        const totalMult = this.activeEffects
            .filter(e => e.target_stat === statName)
            .reduce((sum, e) => sum + (Number(e.value) || 0), 0);

        // Hard Cap: batasi multiplier antara -50% dan +50%
        const clampedMult = Math.max(-0.5, Math.min(0.5, totalMult));

        return Math.max(0, base * (1 + clampedMult));
    }

    getCritDamage() {
        const totalBuff = this.activeEffects
            .filter(e => e.target_stat === 'CRIDMG' || (e.target_stat === 'CRIT' && (e.effect_name || '').toLowerCase().includes('damage')))
            .reduce((sum, e) => sum + (Number(e.value) || 0), 0);

        const clampedBuff = Math.max(0, Math.min(0.5, totalBuff));
        return 2.0 + clampedBuff;
    }

    /**
     * Panggil setiap akhir turn: kurangi durasi semua efek aktif,
     * hapus yang sudah habis, lalu refresh visual.
     */
    updateEffectsTurn() {
        if (this.hp <= 0) return;
        this.activeEffects = this.activeEffects.filter(e => {
            // duration null/0 = permanen dalam pertarungan (tidak dikurangi)
            if (e.duration === null || e.duration <= 0) return true;
            e.duration--;
            return e.duration > 0;
        });
        this.refreshVisual();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION QUEUE & AUTO
    // ─────────────────────────────────────────────────────────────────────────

    updateActionBadge() {
        if (this.hp <= 0) {
            this._actionBadgeBg.setAlpha(0);
            this._actionBadgeText.setAlpha(0);
            return;
        }
        
        let icon = '';
        let color = 0x94a3b8;
        
        if (this.isAuto) {
            icon = '🤖';
            color = 0x3b82f6; // blue
        } else if (this.queuedAction.type === 'basic_attack') {
            icon = '⚔️';
            color = 0xef4444; // red
        } else if (this.queuedAction.type === 'special_attack') {
            icon = '✦';
            color = 0xf59e0b; // gold
        } else if (this.queuedAction.type === 'skill') {
            icon = '🌀';
            color = 0x8b5cf6; // purple
        } else if (this.queuedAction.type === 'skip') {
            icon = '💤';
            color = 0x64748b; // gray
        }

        if (icon) {
            this._actionBadgeBg.setStrokeStyle(1, color);
            this._actionBadgeText.setText(icon);
            this._actionBadgeBg.setAlpha(1);
            this._actionBadgeText.setAlpha(1);
        } else {
            this._actionBadgeBg.setAlpha(0);
            this._actionBadgeText.setAlpha(0);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC VISUAL
    // ─────────────────────────────────────────────────────────────────────────

    setHighlight(isActive) {
        this._isHighlight = isActive;
        if (isActive) {
            this._bg.setStrokeStyle(3, 0xffffff);
            this._accent.setFillStyle(0xffffff);
        } else {
            this._bg.setStrokeStyle(1, 0x334155);
            this._accent.setFillStyle(this._elemColor);
        }
    }

    setSAReady(val) {
        this.isSAReady = val;
        if (val) {
            this._saReadyGem.setAlpha(1);
            this.scene.tweens.add({
                targets: this._saReadyGem,
                scaleX: 1.4, scaleY: 1.4,
                yoyo: true, repeat: -1,
                duration: 500, ease: 'Sine.easeInOut'
            });
        } else {
            this.scene.tweens.killTweensOf(this._saReadyGem);
            this._saReadyGem.setAlpha(0).setScale(1);
        }
    }

    /** Refresh semua visual bar, label, dan indikator status efek */
    refreshVisual() {
        // ── HP ──
        const hpRatio = Math.max(0, this.hp / this.maxHp);
        this._hpFill.setSize(60 * hpRatio, 10);
        this._hpText.setText(`${Math.max(0, Math.floor(this.hp))}`);
        this._hpFill.setFillStyle(hpRatio > 0.5 ? 0x27ae60 : hpRatio > 0.25 ? 0xe67e22 : 0xe74c3c);

        // ── SA Bar ──
        const saRatio = Math.min(1, this.specialBar / this.specialMax);
        this._saFill.setSize(42 * saRatio, 4);
        this._saFill.setFillStyle(saRatio >= 1 ? 0xf39c12 : 0xf1c40f);
        this._saPctText.setText(`${Math.floor(saRatio * 100)}%`);

        // ── KO ──
        if (this.hp <= 0) {
            this._koOverlay.setAlpha(0.65);
            this._koText.setAlpha(1);
            this._bg.setStrokeStyle(1, 0x444444);
            this._accent.setFillStyle(0x444444);
            this.setSAReady(false);
            if (this.battleSprite) {
                this.battleSprite.setAlpha(0.25);
                this.battleSprite.setTint(0x555555);
            }
        } else {
            this._koOverlay.setAlpha(0);
            this._koText.setAlpha(0);
            this._bg.setStrokeStyle(1, 0x334155);
            this._accent.setFillStyle(this._elemColor);
            if (this.battleSprite) {
                this.battleSprite.setAlpha(1.0);
                this.battleSprite.clearTint();
            }
        }

        // ── Status Effect Indicators ──
        // Rebuild teks indikator kecil di atas HP bar setiap refresh
        this._effectIndicators.removeAll(true);
        const visibleEffects = this.activeEffects || [];

        const sups = { 0: '', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
        visibleEffects.forEach((e, idx) => {
            const isBuff = (e.effect_type || '').toLowerCase() === 'buff';
            const color = isBuff ? '#f1c40f' : '#7ec8e3'; // Kuning untuk Buff, Biru Muda untuk Debuff

            let emoji = '❓';
            const stat = (e.target_stat || '').toUpperCase();
            if (stat === 'ATK') emoji = '⚔️';
            else if (stat === 'DEF') emoji = '🛡️';
            else if (stat === 'CRIT') emoji = '✨';
            else if (stat === 'STUN') emoji = '💫';
            else if (stat === 'POISON') emoji = '🤢';
            else if (stat === 'BURN') emoji = '🔥';
            else if (stat === 'HP') emoji = '💚';
            else if (stat === 'AGI') emoji = '💨';

            const durSup = sups[e.duration] || e.duration || '';
            const label = `${emoji}${durSup}`;

            const txt = this.scene.add.text(
                (idx - Math.floor(visibleEffects.length / 2)) * 24,
                0,
                label,
                { fontSize: '10px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }
            ).setOrigin(0.5, 0.5);

            this._effectIndicators.add(txt);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE
    // ─────────────────────────────────────────────────────────────────────────
    _shortName(n) { return n && n.length > 7 ? n.substring(0, 7) + '.' : (n || '???'); }

    _getElementColor(el) {
        return { Fire: 0xe74c3c, Wind: 0x2ecc71, Earth: 0xe67e22, Water: 0x3498db, Light: 0xf1c40f, Dark: 0x9b59b6 }[el] || 0x7f8c8d;
    }
}