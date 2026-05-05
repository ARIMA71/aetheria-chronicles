/**
 * Player — Phaser.GameObjects.Container
 *
 * Portrait card 70×90 di area Party HUD.
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

        // Stats default
        this.def        = 10;
        this.crit       = 0.1;
        this.critDamage = 2.0;

        // ── Combat State ──────────────────────────────────────────────────────
        this.specialBar  = 0;
        this.specialMax  = 100;
        this.activeBuffs = [];
        this.cooldowns   = {};
        this.isSAReady   = false; // SA stance untuk Aether Link

        // ── Normalisasi Skills dari API ───────────────────────────────────────
        // Passive dibuang — tidak ditampilkan di skill window
        this.skills = (data.skills || [])
            .filter(s => {
                const cat = (s.ms_category || s.category || '').toLowerCase();
                return cat !== 'passive';
            })
            .map(s => ({
                id:       s.ms_id,
                name:     s.ms_name      || s.name,
                type:     this._mapCategory(s.ms_category || s.category),
                target:   this._mapTarget(s.ms_target_type || s.target_type || 'single'),
                power:    parseFloat(s.ms_modifier_value ?? s.modifier ?? 1.0),
                // SA (Special) tidak pakai cooldown — dikendalikan oleh specialBar
                cooldown: (s.ms_category || '').toLowerCase() === 'special' ? 0 : (s.ms_cooldown || s.cooldown || 0),
                stat:     s.stat     || null,
                value:    s.value    || 0,
                duration: s.duration || 0
            }));

        // Special Attack — skill berkategori 'special', fallback Limit Break
        const spSkill = this.skills.find(s => s.type === 'special');
        this.specialAttack = spSkill
            ? { id: spSkill.id, name: spSkill.name, power: spSkill.power }
            : { id: 'limit_break', name: 'Limit Break', power: 3.5 };

        // ── Dimensi & Warna ───────────────────────────────────────────────────
        this._W           = 70;
        this._H           = 90;
        this._elemColor   = this._getElementColor(this.element);
        this._baseX       = x;
        this._isHighlight = false;

        // ── Visual Elements ───────────────────────────────────────────────────
        // Background card
        this._bg = scene.add.rectangle(0, 0, this._W, this._H, 0x12192b);
        this._bg.setStrokeStyle(2, this._elemColor);

        // Accent strip atas (elemen)
        this._accent = scene.add.rectangle(0, -(this._H / 2) + 5, this._W, 10, this._elemColor);

        // Nama (singkat)
        this._nameText = scene.add.text(0, -(this._H / 2) + 13, this._shortName(this.charName), {
            fontSize: '8px', color: '#dddddd', fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        // HP Bar bg
        this._hpBarBg = scene.add.rectangle(0, 20, 56, 7, 0x222222);

        // HP Bar fill
        this._hpFill = scene.add.rectangle(-28, 20, 56, 7, 0x27ae60).setOrigin(0, 0.5);

        // HP angka
        this._hpText = scene.add.text(0, 30, `${this.hp}`, {
            fontSize: '8px', color: '#aaaaaa'
        }).setOrigin(0.5, 0);

        // SA Bar bg (bawah card)
        this._saBarBg   = scene.add.rectangle(0, this._H / 2 - 6, 56, 5, 0x111111);
        this._saFill    = scene.add.rectangle(-28, this._H / 2 - 6, 0, 5, 0xf1c40f).setOrigin(0, 0.5);

        // SA Ready indicator (gem menyala)
        this._saReadyGem = scene.add.circle(28, -(this._H / 2) + 6, 5, 0xf39c12);
        this._saReadyGem.setAlpha(0);

        // KO Overlay
        this._koOverlay = scene.add.rectangle(0, 0, this._W, this._H, 0x000000).setAlpha(0);
        this._koText    = scene.add.text(0, 0, 'KO', { fontSize: '18px', color: '#ff4444', fontStyle: 'bold' })
            .setOrigin(0.5).setAlpha(0);

        this.add([
            this._bg, this._accent, this._nameText,
            this._hpBarBg, this._hpFill, this._hpText,
            this._saBarBg, this._saFill, this._saReadyGem,
            this._koOverlay, this._koText
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC
    // ─────────────────────────────────────────────────────────────────────────

    /** Highlight karakter aktif: border glow + geser kiri */
    setHighlight(isActive) {
        this._isHighlight = isActive;
        if (isActive) {
            this._bg.setStrokeStyle(3, 0xffffff);
            this._accent.setFillStyle(0xffffff);
        } else {
            this._bg.setStrokeStyle(2, this._elemColor);
            this._accent.setFillStyle(this._elemColor);
        }
        this.scene.tweens.add({
            targets: this,
            x: isActive ? this._baseX - 10 : this._baseX,
            duration: 160,
            ease: 'Power2'
        });
    }

    /** Set/unset SA stance; refresh visual indikator */
    setSAReady(val) {
        this.isSAReady = val;
        if (val) {
            this._saReadyGem.setAlpha(1);
            // Pulse animation
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

    /** Refresh semua visual bar dan label */
    refreshVisual() {
        // HP
        const hpRatio = Math.max(0, this.hp / this.maxHp);
        this._hpFill.setSize(56 * hpRatio, 7);
        this._hpText.setText(`${Math.max(0, Math.floor(this.hp))}`);
        this._hpFill.setFillStyle(hpRatio > 0.5 ? 0x27ae60 : hpRatio > 0.25 ? 0xe67e22 : 0xe74c3c);

        // SA bar
        const saRatio = Math.min(1, this.specialBar / this.specialMax);
        this._saFill.setSize(56 * saRatio, 5);
        this._saFill.setFillStyle(saRatio >= 1 ? 0xf39c12 : 0xf1c40f);

        // KO
        if (this.hp <= 0) {
            this._koOverlay.setAlpha(0.65);
            this._koText.setAlpha(1);
            this._bg.setStrokeStyle(2, 0x444444);
            this._accent.setFillStyle(0x444444);
            this.setSAReady(false);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE
    // ─────────────────────────────────────────────────────────────────────────
    _shortName(n) { return n && n.length > 7 ? n.substring(0, 7) + '.' : (n || '???'); }

    _getElementColor(el) {
        return { Fire: 0xe74c3c, Wind: 0x2ecc71, Earth: 0xe67e22, Water: 0x3498db, Light: 0xf1c40f, Dark: 0x9b59b6 }[el] || 0x7f8c8d;
    }

    _mapCategory(cat) {
        if (!cat) return 'damage';
        const c = cat.toLowerCase();
        if (c.includes('special'))          return 'special';
        if (c.includes('buff'))             return 'buff';
        if (c.includes('heal'))             return 'heal';
        return 'damage';
    }

    _mapTarget(t) {
        if (!t) return 'single';
        const v = t.toLowerCase();
        if (v.includes('all'))  return 'all';
        if (v.includes('self')) return 'self';
        return 'single';
    }
}