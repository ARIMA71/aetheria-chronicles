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

        // ── Data Mapping ──────────────────────────────────────────────────────
        this.charName = data.name;
        this.element  = data.element || 'None';
        this.level    = data.level   || 1;
        this.maxHp    = data.final_stats.hp;
        this.hp       = data.final_stats.hp;
        this.atk      = data.final_stats.atk;

        // Base stats (disimpan untuk referensi getStat())
        this._baseAtk  = data.final_stats.atk;
        this._baseDef  = data.final_stats.def || 500;
        this._baseCrit = 0.1;

        this.def        = this._baseDef;
        this.crit       = this._baseCrit;
        this.critDamage = 2.0;

        // ── Active Effects (menggantikan activeBuffs lama) ────────────────────
        // Setiap entry: { effect_name, effect_type, target_stat, value, duration, effect_target }
        this.activeEffects = [];

        // ── Combat State ──────────────────────────────────────────────────────
        this.specialBar = 0;
        this.specialMax = data.final_stats.max_sa || 100;
        this.cooldowns  = {};
        this.isSAReady  = false;

        // ── Normalisasi Skills dari API ───────────────────────────────────────
        // API sudah mengirim ms_action_type sebagai 'type' dan status_effects[]
        // Passive dibuang — tidak ditampilkan di skill window
        this.skills = (data.skills || [])
            .filter(s => {
                const cat = (s.category || '').toLowerCase();
                return cat !== 'passive';
            })
            .map(s => ({
                id:             s.id,
                name:           s.name,
                category:       s.category || 'Active',   // 'Active' | 'Special' | 'Passive'
                type:           s.type     || 'Damage',   // 'Damage' | 'Support' | 'Heal' | 'Cleanse' | 'Revive'
                target_type:    s.target_type || 'Single_Enemy',
                modifier:       parseFloat(s.modifier ?? 1.0),
                cooldown:       (s.category || '').toLowerCase() === 'special' ? 0 : (s.cooldown || 0),
                status_effects: s.status_effects || []    // array efek dari API
            }));

        // Special Attack — skill berkategori 'Special', fallback Limit Break
        const spSkill = this.skills.find(s => s.category.toLowerCase() === 'special');
        this.specialAttack = spSkill
            ? { id: spSkill.id, name: spSkill.name, modifier: spSkill.modifier, target_type: spSkill.target_type || 'Single_Enemy', status_effects: spSkill.status_effects || [] }
            : { id: 'limit_break', name: 'Limit Break', modifier: 3.5, target_type: 'Single_Enemy', status_effects: [] };

        // ── Dimensi & Warna ───────────────────────────────────────────────────
        this._W         = 85;
        this._H         = 120;
        this._elemColor = this._getElementColor(this.element);
        this._baseX     = x;
        this._isHighlight = false;

        // ── Visual Elements ───────────────────────────────────────────────────
        this._bg = scene.add.rectangle(0, 0, this._W, this._H, 0x12192b);
        this._bg.setStrokeStyle(2, this._elemColor);

        this._accent = scene.add.rectangle(0, -(this._H / 2) + 5, this._W, 10, this._elemColor);

        this._nameText = scene.add.text(0, -(this._H / 2) + 13, this._shortName(this.charName), {
            fontSize: '8px', color: '#dddddd', fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        // HP Bar
        this._hpBarBg = scene.add.rectangle(0, 32, 60, 10, 0x222222);
        this._hpFill  = scene.add.rectangle(-30, 32, 60, 10, 0x27ae60).setOrigin(0, 0.5);
        this._hpText  = scene.add.text(0, 32, `${this.hp}`, {
            fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5, 0.5);

        // SA Bar
        this._saBarBg   = scene.add.rectangle(-8, 44, 42, 4, 0x111111);
        this._saFill    = scene.add.rectangle(-29, 44, 0, 4, 0xf1c40f).setOrigin(0, 0.5);
        this._saPctText = scene.add.text(15, 44, '0%', {
            fontSize: '8px', color: '#f1c40f', fontStyle: 'bold'
        }).setOrigin(0, 0.5);

        // SA Ready indicator
        this._saReadyGem = scene.add.circle(28, -(this._H / 2) + 6, 5, 0xf39c12);
        this._saReadyGem.setAlpha(0);

        // KO Overlay
        this._koOverlay = scene.add.rectangle(0, 0, this._W, this._H, 0x000000).setAlpha(0);
        this._koText    = scene.add.text(0, 0, 'KO', {
            fontSize: '18px', color: '#ff4444', fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0);

        // Container untuk indikator status efek aktif (di-rebuild tiap refreshVisual)
        this._effectIndicators = scene.add.container(0, -this._H / 2 + 30);

        this.add([
            this._bg, this._accent, this._nameText,
            this._hpBarBg, this._hpFill, this._hpText,
            this._saBarBg, this._saFill, this._saPctText, this._saReadyGem,
            this._koOverlay, this._koText,
            this._effectIndicators
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
            existing.value    = effectData.value;
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
            'ATK':  this._baseAtk,
            'DEF':  this._baseDef,
            'CRIT': this._baseCrit
        };
        const base = statMap[statName] ?? 0;

        // Jumlahkan semua multiplier dari efek yang target_stat-nya cocok
        // Hanya proses efek Buff/Debuff dengan target_stat biasa (bukan STUN, POISON, dll)
        const numericStats = ['ATK', 'DEF', 'CRIT'];
        if (!numericStats.includes(statName)) return base;

        const totalMult = this.activeEffects
            .filter(e => e.target_stat === statName)
            .reduce((sum, e) => sum + (Number(e.value) || 0), 0);

        // Hard Cap: batasi multiplier antara -50% dan +50%
        const clampedMult = Math.max(-0.5, Math.min(0.5, totalMult));

        return Math.max(0, base * (1 + clampedMult));
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
    // PUBLIC VISUAL
    // ─────────────────────────────────────────────────────────────────────────

    setHighlight(isActive) {
        this._isHighlight = isActive;
        if (isActive) {
            this._bg.setStrokeStyle(3, 0xffffff);
            this._accent.setFillStyle(0xffffff);
        } else {
            this._bg.setStrokeStyle(2, this._elemColor);
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
            this._bg.setStrokeStyle(2, 0x444444);
            this._accent.setFillStyle(0x444444);
            this.setSAReady(false);
        }

        // ── Status Effect Indicators ──
        // Rebuild teks indikator kecil di atas HP bar setiap refresh
        this._effectIndicators.removeAll(true);
        const visibleEffects = this.activeEffects.filter(e =>
            ['ATK', 'DEF', 'CRIT'].includes(e.target_stat)
        );

        visibleEffects.forEach((e, idx) => {
            const isBuff   = (e.effect_type || '').toLowerCase() === 'buff';
            const arrow    = isBuff ? '⇧' : '⇩';
            const color    = isBuff ? '#55ff88' : '#ff5555';
            const shortStat = e.target_stat; // 'ATK', 'DEF', 'CRIT'
            const label    = `[${shortStat}${arrow}]`;

            const txt = this.scene.add.text(
                (idx - Math.floor(visibleEffects.length / 2)) * 24,
                0,
                label,
                { fontSize: '7px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }
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