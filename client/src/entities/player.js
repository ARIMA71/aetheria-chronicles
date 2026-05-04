/**
 * Player — Phaser.GameObjects.Container
 *
 * Visual berupa portrait card (70x100) dengan border warna yang berubah
 * saat karakter aktif (setHighlight).
 * Data berasal dari API: response.data.player_party.characters[i]
 */
export default class Player extends Phaser.GameObjects.Container {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     * @param {object} data - Satu objek karakter dari API.
     */
    constructor(scene, x, y, data) {
        super(scene, x, y);
        scene.add.existing(this);

        // ── Data Mapping dari API ──────────────────────────────────────────────
        this.charName = data.name;
        this.element  = data.element || 'None';
        this.level    = data.level   || 1;

        this.maxHp = data.final_stats.hp;
        this.hp    = data.final_stats.hp;
        this.atk   = data.final_stats.atk;

        // Stat default yang belum ada di API
        this.def        = 10;
        this.crit       = 0.1;
        this.critDamage = 2.0;

        // ── Combat State ──────────────────────────────────────────────────────
        this.specialBar  = 0;
        this.specialMax  = 100;
        this.activeBuffs = [];   // { stat, value, duration }
        this.cooldowns   = {};   // { skillId: sisaTurn }

        // ── Normalisasi Skills dari API ───────────────────────────────────────
        this.skills = (data.skills || []).map(s => ({
            id:       s.ms_id,
            name:     s.ms_name      || s.name,
            type:     this._mapCategory(s.ms_category || s.category),
            target:   this._mapTarget(s.ms_target_type || s.target_type || 'single'),
            power:    parseFloat(s.ms_modifier_value ?? s.modifier ?? 1.0),
            cooldown: s.ms_cooldown  || s.cooldown || 0,
            stat:     s.stat     || null,
            value:    s.value    || 0,
            duration: s.duration || 0
        }));

        // Special Attack: cari skill 'special', fallback hardcode Limit Break
        const specialSkill = this.skills.find(s => s.type === 'special');
        this.specialAttack = specialSkill
            ? { id: specialSkill.id, name: specialSkill.name, power: specialSkill.power }
            : { id: 'limit_break', name: 'Limit Break', power: 3.5 };

        // ── Dimensi visual card ───────────────────────────────────────────────
        this._W = 70;
        this._H = 100;

        // ── Warna tema elemen ─────────────────────────────────────────────────
        this._elementColor = this._getElementColor(this.element);
        this._normalBorder  = this._elementColor;
        this._activeBorder  = 0xffffff;

        // ── Buat visual elements ──────────────────────────────────────────────
        // Background card
        this._bg = scene.add.rectangle(0, 0, this._W, this._H, 0x16213e);
        this._bg.setStrokeStyle(2, this._normalBorder);

        // Elemen color accent (strip atas)
        this._accent = scene.add.rectangle(0, -(this._H / 2) + 6, this._W, 12, this._elementColor);

        // Nama karakter
        this._nameLabel = scene.add.text(0, -(this._H / 2) + 16, this._shortName(this.charName), {
            fontSize: '9px',
            color: '#e0e0e0',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        // Label HP
        this._hpLabel = scene.add.text(0, 22, `${this.hp}`, {
            fontSize: '10px',
            color: '#a8e6cf'
        }).setOrigin(0.5, 0.5);

        // HP bar background
        this._hpBarBg = scene.add.rectangle(0, 36, 54, 6, 0x2d2d2d);

        // HP bar fill
        this._hpBarFill = scene.add.rectangle(0, 36, 54, 6, 0x27ae60);
        this._hpBarFill.setOrigin(0.5, 0.5);

        // SA bar (tebal tipis di bagian paling bawah card)
        this._saBarBg   = scene.add.rectangle(0, (this._H / 2) - 5, 54, 4, 0x1a1a1a);
        this._saBarFill = scene.add.rectangle(
            -(27), (this._H / 2) - 5, 0, 4, 0xf1c40f
        ).setOrigin(0, 0.5);

        // Indikator "DEAD"
        this._deadOverlay = scene.add.rectangle(0, 0, this._W, this._H, 0x000000);
        this._deadOverlay.setAlpha(0);

        this._deadText = scene.add.text(0, 0, 'KO', {
            fontSize: '16px',
            color: '#ff5555',
            fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0);

        // Gabungkan semua ke container
        this.add([
            this._bg,
            this._accent,
            this._nameLabel,
            this._hpLabel,
            this._hpBarBg,
            this._hpBarFill,
            this._saBarBg,
            this._saBarFill,
            this._deadOverlay,
            this._deadText
        ]);

        // State highlight
        this._isHighlighted = false;
        this._baseX = x; // simpan posisi asal untuk animasi geser
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC METHODS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Ubah tampilan border untuk menandai karakter aktif/tidak.
     * @param {boolean} isActive
     */
    setHighlight(isActive) {
        this._isHighlighted = isActive;

        if (isActive) {
            // Glow border putih + geser ke kiri sedikit
            this._bg.setStrokeStyle(3, this._activeBorder);
            this._accent.setFillStyle(0xffffff);
            this.scene.tweens.add({
                targets: this,
                x: this._baseX - 8,
                duration: 150,
                ease: 'Power2'
            });
        } else {
            // Kembalikan ke warna elemen + geser balik ke posisi asal
            this._bg.setStrokeStyle(2, this._normalBorder);
            this._accent.setFillStyle(this._elementColor);
            this.scene.tweens.add({
                targets: this,
                x: this._baseX,
                duration: 150,
                ease: 'Power2'
            });
        }
    }

    /**
     * Perbarui semua visual berdasarkan state HP & SA terkini.
     * Dipanggil oleh BattleScene setiap kali ada perubahan stat.
     */
    refreshVisual() {
        // HP label
        this._hpLabel.setText(`${Math.max(0, Math.floor(this.hp))}`);

        // HP bar
        const hpRatio  = Math.max(0, this.hp / this.maxHp);
        const barWidth = 54 * hpRatio;
        this._hpBarFill.setSize(barWidth, 6);
        this._hpBarFill.setX(-(27) + barWidth / 2);

        // Ubah warna HP bar berdasarkan persentase
        if (hpRatio > 0.5) {
            this._hpBarFill.setFillStyle(0x27ae60); // Hijau
        } else if (hpRatio > 0.25) {
            this._hpBarFill.setFillStyle(0xe67e22); // Oranye
        } else {
            this._hpBarFill.setFillStyle(0xe74c3c); // Merah
        }

        // SA bar
        const saRatio   = Math.max(0, this.specialBar / this.specialMax);
        const saWidth   = 54 * saRatio;
        this._saBarFill.setSize(saWidth, 4);

        // KO overlay
        if (this.hp <= 0) {
            this._deadOverlay.setAlpha(0.6);
            this._deadText.setAlpha(1);
            this._bg.setStrokeStyle(2, 0x555555);
            this._accent.setFillStyle(0x555555);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    _shortName(name) {
        // Potong nama agar muat di card 70px
        return name && name.length > 7 ? name.substring(0, 7) + '.' : (name || '???');
    }

    _getElementColor(element) {
        const palette = {
            'Fire':  0xe74c3c,
            'Wind':  0x2ecc71,
            'Earth': 0xe67e22,
            'Water': 0x3498db,
            'Light': 0xf1c40f,
            'Dark':  0x9b59b6
        };
        return palette[element] || 0x7f8c8d;
    }

    _mapCategory(category) {
        if (!category) return 'damage';
        const c = category.toLowerCase();
        if (c === 'active damage' || c === 'damage') return 'damage';
        if (c === 'active buff'   || c === 'buff')   return 'buff';
        if (c === 'active heal'   || c === 'heal')   return 'heal';
        if (c === 'special')                         return 'special';
        if (c === 'passive')                         return 'passive';
        return 'damage';
    }

    _mapTarget(targetType) {
        if (!targetType) return 'single';
        const t = targetType.toLowerCase();
        if (t === 'all_enemies' || t === 'all') return 'all';
        if (t === 'self')                       return 'self';
        return 'single';
    }
}