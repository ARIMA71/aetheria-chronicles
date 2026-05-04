/**
 * Enemy — Phaser.GameObjects.Container
 *
 * Visual berupa kotak besar (150x150) di area arena tengah-atas layar.
 * Data berasal dari API: response.data.enemies[0]
 */
export default class Enemy extends Phaser.GameObjects.Container {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} x - Default: 225 (tengah canvas 450px)
     * @param {number} y - Default: 240 (arena zone)
     * @param {object} data - Satu objek musuh dari API.
     */
    constructor(scene, x, y, data) {
        super(scene, x, y);
        scene.add.existing(this);

        // ── Data Mapping dari API ──────────────────────────────────────────────
        this.id      = data.id;
        this.charName = data.name;
        this.element  = data.element || 'None';
        this.level    = data.level   || 1;

        this.maxHp = data.final_stats.hp;
        this.hp    = data.final_stats.hp;
        this.atk   = data.final_stats.atk;

        // Stat default
        this.def        = 5;
        this.crit       = 0.2;
        this.critDamage = 2.0;

        // ── Combat State: Charge Attack ───────────────────────────────────────
        this.caBar = 0;
        this.caMax = 3;

        // ── Normalisasi Skills dari ai_behaviors ──────────────────────────────
        this.skills = (data.ai_behaviors || [])
            .filter(b => b.skill && b.skill.id)
            .map(b => ({
                id:       b.skill.id,
                name:     b.skill.name,
                type:     this._mapCategory(b.skill.category),
                power:    parseFloat(b.skill.modifier ?? 1.0),
                phase:    b.phase    || 'Normal',
                utility:  b.utility  || 1.0,
                modifiers: b.modifiers || {}
            }));

        // Fallback skill jika API tidak mengembalikan behavior
        if (this.skills.length === 0) {
            this.skills = [{ id: 'roar', name: 'Roar', type: 'damage', power: 3.5 }];
        }

        // ── Dimensi visual ────────────────────────────────────────────────────
        this._W = 150;
        this._H = 150;

        // ── Warna elemen ──────────────────────────────────────────────────────
        this._elementColor = this._getElementColor(this.element);

        // ── Buat visual elements ──────────────────────────────────────────────
        // Shadow
        const shadow = scene.add.rectangle(4, 4, this._W, this._H, 0x000000);
        shadow.setAlpha(0.5);

        // Body utama
        this._bg = scene.add.rectangle(0, 0, this._W, this._H, 0x2c1810);
        this._bg.setStrokeStyle(3, this._elementColor);

        // Elemen accent di bagian dalam (inner glow simulasi)
        const innerFrame = scene.add.rectangle(0, 0, this._W - 12, this._H - 12, 0x000000, 0);
        innerFrame.setStrokeStyle(1, this._elementColor);
        innerFrame.setAlpha(0.5);

        // Tanda silang placeholder sprite musuh
        const cross1 = scene.add.line(0, 0, -30, -30, 30, 30, this._elementColor);
        cross1.setAlpha(0.3);
        const cross2 = scene.add.line(0, 0, 30, -30, -30, 30, this._elementColor);
        cross2.setAlpha(0.3);

        // Nama musuh (tengah atas kotak)
        this._nameLabel = scene.add.text(0, -(this._H / 2) - 18, this.charName, {
            fontSize: '13px',
            color: '#ff8a80',
            fontStyle: 'bold'
        }).setOrigin(0.5, 1);

        // Label Level
        this._levelLabel = scene.add.text(0, -(this._H / 2) - 4, `Lv.${this.level}`, {
            fontSize: '10px',
            color: '#aaaaaa'
        }).setOrigin(0.5, 1);

        // HP bar background (di bawah kotak musuh)
        const hpBarY = (this._H / 2) + 10;
        this._hpBarBg = scene.add.rectangle(0, hpBarY, 140, 10, 0x2d2d2d);
        this._hpBarBg.setStrokeStyle(1, 0x555555);

        // HP bar fill
        this._hpBarFill = scene.add.rectangle(-(70) + 1, hpBarY, 138, 8, 0xe74c3c);
        this._hpBarFill.setOrigin(0, 0.5);

        // HP label
        this._hpLabel = scene.add.text(0, hpBarY + 14, `${this.hp} / ${this.maxHp}`, {
            fontSize: '10px',
            color: '#ff8a80'
        }).setOrigin(0.5, 0);

        // CA bar (Charge Attack gauge)
        this._caLabel = scene.add.text(0, hpBarY + 28, `CHARGE: ${this.caBar} / ${this.caMax}`, {
            fontSize: '10px',
            color: '#ffaa00'
        }).setOrigin(0.5, 0);

        // Gabungkan semua ke container
        this.add([
            shadow,
            this._bg,
            innerFrame,
            cross1,
            cross2,
            this._nameLabel,
            this._levelLabel,
            this._hpBarBg,
            this._hpBarFill,
            this._hpLabel,
            this._caLabel
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC METHODS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Perbarui semua visual HP dan CA gauge.
     */
    refreshVisual() {
        // HP bar
        const hpRatio  = Math.max(0, this.hp / this.maxHp);
        const barWidth = 138 * hpRatio;
        this._hpBarFill.setSize(barWidth, 8);

        // Warna HP bar
        if (hpRatio > 0.5) {
            this._hpBarFill.setFillStyle(0xe74c3c);
        } else if (hpRatio > 0.25) {
            this._hpBarFill.setFillStyle(0xe67e22);
        } else {
            this._hpBarFill.setFillStyle(0xc0392b);
            // Flash border saat HP kritis
            this._bg.setStrokeStyle(3, 0xff0000);
        }

        // HP label
        this._hpLabel.setText(`${Math.max(0, Math.floor(this.hp))} / ${this.maxHp}`);

        // CA label
        this._caLabel.setText(`CHARGE: ${this.caBar} / ${this.caMax}`);
    }

    /**
     * Animasi shake saat menerima damage.
     */
    playHitAnim() {
        const originalX = this.x;
        this.scene.tweens.add({
            targets: this,
            x: originalX + 10,
            duration: 50,
            yoyo: true,
            repeat: 2,
            ease: 'Power1',
            onComplete: () => { this.x = originalX; }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    _getElementColor(element) {
        const palette = {
            'Fire':  0xe74c3c,
            'Wind':  0x2ecc71,
            'Earth': 0xe67e22,
            'Water': 0x3498db,
            'Light': 0xf1c40f,
            'Dark':  0x9b59b6
        };
        return palette[element] || 0xff5555;
    }

    _mapCategory(category) {
        if (!category) return 'damage';
        const c = category.toLowerCase();
        if (c === 'active damage' || c === 'damage') return 'damage';
        if (c === 'active buff'   || c === 'buff')   return 'buff';
        if (c === 'active heal'   || c === 'heal')   return 'heal';
        if (c === 'special')                         return 'special';
        return 'damage';
    }
}