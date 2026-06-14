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
        this.id       = data.id;
        this.charName = data.name;
        this.element  = data.element || 'None';
        this.level    = data.level   || 1;
        this.maxHp    = data.final_stats.hp;
        this.hp       = data.final_stats.hp;
        this.atk      = data.final_stats.atk;
        this.def      = data.final_stats.def || 5;
        this.crit     = 0.2;
        this.critDamage = 2.0;

        // Base stats (untuk getStat())
        this._baseAtk = data.final_stats.atk;
        this._baseDef = data.final_stats.def || 5;

        // ── Active Effects ────────────────────────────────────────────────────
        // Setiap entry: { effect_name, effect_type, target_stat, value, duration, effect_target }
        this.activeEffects = [];

        // ── Charge Attack State ───────────────────────────────────────────────
        this.caBar = 0;
        this.caMax = data.caMax || 3;

        // ── Mode State: 'normal' | 'enraged' | 'exhausted' ──────────────────
        this.modeState = 'normal';
        this.modeBar   = 0;
        this.modeMax   = this.maxHp * 0.2; // 20% HP threshold → Enraged

        // ── AI Behaviors (raw dari API, digunakan oleh BattleScene) ──────────
        // Format setiap entry:
        //   { phase, base_utility, modifiers, skill: { id, name, type, modifier, status_effects[] } }
        this.aiBehaviors = (data.ai_behaviors || []).map(b => ({
            phase:        b.phase        || 'Normal',
            base_utility: b.base_utility || 1.0,
            modifiers:    b.modifiers    || {},
            skill: {
                id:             b.skill.id,
                name:           b.skill.name,
                type:           b.skill.type     || 'Damage',   // ms_action_type dari API
                category:       b.skill.category || 'Active',
                target_type:    b.skill.target_type || 'Single_Enemy',
                modifier:       parseFloat(b.skill.modifier ?? 1.0),
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

        const shadow = scene.add.rectangle(5, 5, 130, 130, 0x000000).setAlpha(0.4);
        this._body   = scene.add.rectangle(0, 0, 130, 130, 0x1c0a0a);
        this._body.setStrokeStyle(3, elemColor);

        const inner = scene.add.rectangle(0, 0, 110, 110, 0x000000, 0);
        inner.setStrokeStyle(1, elemColor).setAlpha(0.4);

        const h = scene.add.line(0, 0, -40, 0, 40, 0, elemColor).setAlpha(0.25);
        const v = scene.add.line(0, 0, 0, -40, 0, 40, elemColor).setAlpha(0.25);

        // Container untuk indikator status efek aktif (di-rebuild tiap refreshVisual)
        this._effectIndicators = scene.add.container(0, -80);

        this.add([shadow, this._body, inner, h, v, this._effectIndicators]);
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
            existing.value    = effectData.value;
            this.refreshVisual();
            return;
        }

        this.activeEffects.push({ ...effectData });
        this.refreshVisual();
    }

    /**
     * Hitung nilai final dari satu stat secara dinamis berdasarkan activeEffects.
     * Rumus: baseStat + (baseStat * totalMultiplier)
     * @param {string} statName - 'ATK' | 'DEF'
     * @returns {number}
     */
    getStat(statName) {
        const statMap = { 'ATK': this._baseAtk, 'DEF': this._baseDef };
        const base = statMap[statName] ?? 0;
        const numericStats = ['ATK', 'DEF'];
        if (!numericStats.includes(statName)) return base;

        const totalMult = this.activeEffects
            .filter(e => e.target_stat === statName)
            .reduce((sum, e) => sum + (Number(e.value) || 0), 0);

        return Math.max(0, base + (base * totalMult));
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
        this._effectIndicators.removeAll(true);
        const visibleEffects = this.activeEffects.filter(e =>
            ['ATK', 'DEF', 'CRIT'].includes(e.target_stat)
        );

        visibleEffects.forEach((e, idx) => {
            const isBuff   = (e.effect_type || '').toLowerCase() === 'buff';
            const arrow    = isBuff ? '⇧' : '⇩';
            const color    = isBuff ? '#55ff88' : '#ff5555';
            const shortStat = e.target_stat;
            const label    = `[${shortStat}${arrow}]`;

            const txt = this.scene.add.text(
                (idx - Math.floor(visibleEffects.length / 2)) * 32,
                0,
                label,
                { fontSize: '9px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }
            ).setOrigin(0.5, 0.5);

            this._effectIndicators.add(txt);
        });
    }

    /**
     * Pilih AI behavior yang sesuai dengan fase musuh saat ini.
     * Mengembalikan satu entry dari aiBehaviors, atau null jika kosong.
     * @returns {object|null}
     */
    pickBehavior() {
        const phase = this.modeState === 'enraged'
            ? 'Enraged'
            : this.modeState === 'exhausted'
            ? 'Exhausted'
            : 'Normal';

        // Filter berdasarkan fase; fallback ke Normal jika fase tidak ada
        const candidates = this.aiBehaviors.filter(b => b.phase === phase);
        const pool = candidates.length > 0 ? candidates : this.aiBehaviors;

        if (!pool.length) return null;

        // Pilih berdasarkan utility score (weighted random sederhana)
        // Hitung total utility dari pool
        const totalUtil = pool.reduce((s, b) => s + b.base_utility, 0);
        if (totalUtil <= 0) return pool[0];

        let rand = Math.random() * totalUtil;
        for (const b of pool) {
            rand -= b.base_utility;
            if (rand <= 0) return b;
        }
        return pool[pool.length - 1];
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
        const colors = { normal: null, enraged: 0xe74c3c, exhausted: 0x3498db };
        const col = colors[this.modeState];
        if (col) {
            this._body.setStrokeStyle(3, col);
        } else {
            this._body.setStrokeStyle(3, this._getElementColor(this.element));
        }
    }

    _getElementColor(el) {
        return { Fire: 0xe74c3c, Wind: 0x2ecc71, Earth: 0xe67e22, Water: 0x3498db, Light: 0xf1c40f, Dark: 0x9b59b6 }[el] || 0xff5555;
    }
}