/**
 * Enemy — Phaser.GameObjects.Container
 *
 * Hanya berisi sprite placeholder di arena (kotak 130×130).
 * Enemy HUD (HP bar, CA bar, icon) dikelola oleh BattleScene._buildEnemyHUD()
 * agar pemisahan concern lebih bersih.
 *
 * Data: response.data.enemies[0]
 */
export default class Enemy extends Phaser.GameObjects.Container {
    constructor(scene, x, y, data) {
        super(scene, x, y);
        scene.add.existing(this);

        // ── Data ──────────────────────────────────────────────────────────────
        this.id = data.id;
        this.charName = data.name;
        this.element = data.element || 'None';
        this.level = data.level || 1;
        this.isBoss = data.is_boss === true;
        this.finalStats = data.final_stats || { hp: 1000, atk: 50, def: 50 }; // Needed for state sync & fallback
        this.maxHp = this.finalStats.hp;
        this.hp = this.finalStats.hp;
        this.atk = this.finalStats.atk;
        this.def = this.finalStats.def || 500;
        this.crit = 0.1;
        this.critDamage = 2.0;

        // Base stats (untuk getStat())
        this._baseAtk = this.finalStats.atk;
        this._baseDef = this.finalStats.def || 500;
        this._baseCrit = 0.1;

        // ── Active Effects ────────────────────────────────────────────────────
        // Setiap entry: { effect_name, effect_type, target_stat, value, duration, effect_target }
        this.activeEffects = [];

        // ── Charge Attack State ───────────────────────────────────────────────
        this.caBar = 0;
        this.caMax = data.caMax || 3;

        // ── Mode State: 'normal' | 'enraged' | 'exhausted' ──────────────────
        this.modeState = 'normal';
        this.modeBar = 0;
        this.modeMax = this.maxHp * 0.20; // 20% HP threshold → Enraged

        // ── AI Behaviors (raw dari API, digunakan oleh BattleScene) ──────────
        // Format setiap entry:
        //   { phase, base_utility, modifiers, skill: { id, name, type, modifier, status_effects[] } }
        this.aiBehaviors = (data.ai_behaviors || []).map(b => ({
            phase: b.phase || 'Normal',
            base_utility: b.base_utility || 1.0,
            modifiers: b.modifiers || {},
            skill: {
                id: b.skill.id,
                name: b.skill.name,
                type: b.skill.type || 'Damage',   // ms_action_type dari API
                category: b.skill.category || 'Active',
                target_type: b.skill.target_type || 'Single_Enemy',
                modifier: parseFloat(b.skill.modifier ?? 1.0),
                trigger_delay: b.skill.trigger_delay,
                trigger_dispel: b.skill.trigger_dispel,
                trigger_heal_pct: b.skill.trigger_heal_pct,
                hp_cost_pct: b.skill.hp_cost_pct,
                status_effects: b.skill.status_effects || []
            }
        }));

        // Skill sederhana (fallback jika aiBehaviors kosong)
        if (this.aiBehaviors.length === 0) {
            this.aiBehaviors = [{
                phase: 'Normal', base_utility: 1.0, modifiers: {},
                skill: { id: 'roar', name: 'Roar', type: 'Damage', category: 'Active', target_type: 'Single_Enemy', modifier: 1.5, status_effects: [] }
            }];
        }

        // ── Visual: Sprite Placeholder di Arena ───────────────────────────────
        const elemColor = this._getElementColor(this.element);

        this._spritePath = data.sprite_path;
        this.iconPath = data.icon_path;
        const monsId = data.id || data.monster_id;
        const elemKey = data.element ? data.element.toLowerCase() : 'def';
        let texKey = `mons_${monsId}_${elemKey}`;
        if (!scene.textures.exists(texKey)) {
            texKey = `mons_${monsId}`;
        }

        this._glow = scene.add.rectangle(0, 0, 138, 138, 0xffffff).setAlpha(0); // Glow Background
        if (!this._spritePath || !scene.textures.exists(texKey)) {
            const shadow = scene.add.rectangle(5, 5, 130, 130, 0x000000).setAlpha(0.4);
            this._body = scene.add.rectangle(0, 0, 130, 130, 0x1c0a0a);
            this._body.setStrokeStyle(3, elemColor);

            const inner = scene.add.rectangle(0, 0, 110, 110, 0x000000, 0);
            inner.setStrokeStyle(1, elemColor).setAlpha(0.4);

            const h = scene.add.line(0, 0, -40, 0, 40, 0, elemColor).setAlpha(0.25);
            const v = scene.add.line(0, 0, 0, -40, 0, 40, elemColor).setAlpha(0.25);

            this.add([shadow, this._glow, this._body, inner, h, v]);
        } else {
            this.battleSprite = scene.add.sprite(0, 0, texKey);
            const baseScale = this.isBoss ? 1.2 : 0.75;
            this.battleSprite.setScale(baseScale);

            scene.tweens.add({
                targets: this.battleSprite,
                scaleY: baseScale * 1.03,
                duration: 1300,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            // Glow behind real sprite is kept clean (alpha 0), tint applied via updateEnrageVisual
            this.add([this._glow, this.battleSprite]);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTIVE EFFECTS SYSTEM
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Tambahkan satu efek status ke activeEffects.
     * @param {object} effectData - { effect_name, effect_type, target_stat, value, duration, effect_target }
     */
    addEffect(effectData) {
        if (!effectData || !effectData.target_stat) return;

        // Overwrite jika efek dengan nama sama sudah ada (refresh durasi)
        const existing = this.activeEffects.find(e => e.effect_name === effectData.effect_name);
        if (existing) {
            existing.duration = effectData.duration;
            existing.value = effectData.value;
            this.refreshVisual();
            return;
        }

        this.activeEffects.push({ ...effectData });
        this.refreshVisual();
    }

    /**
     * Hitung nilai final dari satu stat secara dinamis berdasarkan activeEffects.
     * Rumus: baseStat * (1 + clampedMultiplier)
     * Hard Cap: multiplier dibatasi ±50% untuk mencegah stat inflation.
     * @param {string} statName - 'ATK' | 'DEF'
     * @returns {number}
     */
    getStat(statName) {
        const statMap = { 'ATK': this._baseAtk, 'DEF': this._baseDef, 'CRIT': this._baseCrit };
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
     * hapus yang sudah habis.
     */
    updateEffectsTurn() {
        this.activeEffects = this.activeEffects.filter(e => {
            if (e.duration === null || e.duration <= 0) return true;
            e.duration--;
            return e.duration > 0;
        });
        this.refreshVisual();
    }

    /** Refresh visual indikator efek status aktif pada musuh */
    refreshVisual() {
        // Only glow update remains here, effect indicators moved to BattleScene HUD
        if (this._glow) {
            if (this.modeState === 'enraged') {
                this._glow.setAlpha(0.4);
                this._glow.setFillStyle(0xff0000);
            } else if (this.modeState === 'exhausted') {
                this._glow.setAlpha(0.2);
                this._glow.setFillStyle(0x3498db);
            } else {
                this._glow.setAlpha(0);
            }
        }
    }



    // ─────────────────────────────────────────────────────────────────────────
    // VISUAL
    // ─────────────────────────────────────────────────────────────────────────

    playHitAnim() {
        const ox = this.x;
        this.scene.tweens.add({
            targets: this, x: ox + 10,
            duration: 50, yoyo: true, repeat: 2,
            ease: 'Power1',
            onComplete: () => { this.x = ox; }
        });
    }

    updateEnrageVisual() {
        if (!this.isBoss) {
            if (this._body) this._body.setStrokeStyle(3, this._getElementColor(this.element));
            if (this._glow) this._glow.setAlpha(0);
            if (this.battleSprite) this.battleSprite.clearTint();
            return;
        }

        if (this.modeState === 'enraged') {
            if (this.battleSprite) {
                this.battleSprite.setTint(0xff8888);
                if (this._glow) this._glow.setAlpha(0);
            } else if (this._glow) {
                if (this._body) this._body.setStrokeStyle(3, 0xe74c3c);
                this._glow.setFillStyle(0xe74c3c).setAlpha(0.6);
            }
        } else if (this.modeState === 'exhausted') {
            if (this.battleSprite) {
                this.battleSprite.setTint(0x77ccff);
                if (this._glow) this._glow.setAlpha(0);
            } else if (this._glow) {
                if (this._body) this._body.setStrokeStyle(3, 0x3498db);
                this._glow.setFillStyle(0x3498db).setAlpha(0.6);
            }
        } else {
            if (this.battleSprite) {
                this.battleSprite.clearTint();
            }
            if (this._body) this._body.setStrokeStyle(3, this._getElementColor(this.element));
            if (this._glow) this._glow.setAlpha(0);
        }
    }

    _getElementColor(el) {
        return { Fire: 0xe74c3c, Wind: 0x2ecc71, Earth: 0xe67e22, Water: 0x3498db, Light: 0xf1c40f, Dark: 0x9b59b6 }[el] || 0xff5555;
    }
}