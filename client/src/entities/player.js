export default class Player extends Phaser.GameObjects.Container {
    /**
     * @param {Phaser.Scene} scene - Scene Phaser yang aktif.
     * @param {number} x - Posisi X container.
     * @param {number} y - Posisi Y container.
     * @param {object} data - Data karakter dari API (response.data.player_party.characters[0]).
     *   Struktur yang diharapkan:
     *   {
     *     name: string,
     *     element: string,
     *     level: number,
     *     final_stats: { hp: number, atk: number },
     *     skills: [{ ms_id, ms_name, ms_category, ms_modifier_value, ms_cooldown, ms_target_type, ... }]
     *   }
     */
    constructor(scene, x, y, data) {
        super(scene, x, y);
        scene.add.existing(this);

        // ── Data Mapping dari API ──────────────────────────────────────────────
        this.name    = data.name;
        this.element = data.element || 'None';
        this.level   = data.level   || 1;

        this.maxHp = data.final_stats.hp;
        this.hp    = data.final_stats.hp;
        this.atk   = data.final_stats.atk;

        // Stat default yang belum ada di API (akan di-extend di Fase 2+)
        this.def         = 10;
        this.crit        = 0.1;   // 10% crit chance
        this.critDamage  = 2.0;   // 200% damage on crit

        // ── Combat State ──────────────────────────────────────────────────────
        this.specialBar  = 0;
        this.specialMax  = 100;
        this.activeBuffs = [];   // { stat, value, duration }
        this.cooldowns   = {};   // { skillId: sisaTurn }

        // ── Normalisasi Skills dari API ───────────────────────────────────────
        // API mengirim: ms_category, ms_modifier_value, ms_target_type, ms_cooldown, ms_id
        // Battle logic menggunakan: type, power, target, cooldown, id
        // Konversi dilakukan di sini agar battle logic tidak perlu diubah.
        this.skills = (data.skills || []).map(s => ({
            id:       s.ms_id,
            name:     s.ms_name      || s.name,
            type:     this._mapCategory(s.ms_category || s.category),
            target:   this._mapTarget(s.ms_target_type || s.target_type || 'single'),
            power:    parseFloat(s.ms_modifier_value ?? s.modifier ?? 1.0),
            cooldown: s.ms_cooldown  || s.cooldown || 0,
            // Field buff/heal — diisi jika kategori relevan
            stat:     s.stat     || null,
            value:    s.value    || 0,
            duration: s.duration || 0
        }));

        // Special Attack — diambil dari skill berkategori 'Special' jika ada,
        // fallback ke definisi hardcode agar Limit Break tetap bisa dipakai.
        const specialSkill = this.skills.find(s => s.type === 'special');
        this.specialAttack = specialSkill
            ? { id: specialSkill.id, name: specialSkill.name, power: specialSkill.power }
            : { id: 'limit_break', name: 'Limit Break', power: 3.5 };

        // ── Visual Placeholder (Phaser.GameObjects di dalam Container) ────────
        // Warna Biru (#3a7bd5) untuk Player
        const body = scene.add.rectangle(0, 0, 100, 150, 0x3a7bd5);
        body.setStrokeStyle(2, 0x7eb8f7);

        const nameLabel = scene.add.text(0, -90, this.name, {
            fontSize: '12px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        this.hpLabel = scene.add.text(0, 65, `HP: ${this.hp}`, {
            fontSize: '11px',
            color: '#a8e6cf'
        }).setOrigin(0.5, 0);

        this.add([body, nameLabel, this.hpLabel]);
    }

    // ── Helper: Normalisasi Category → type ───────────────────────────────────
    _mapCategory(category) {
        if (!category) return 'damage';
        const c = category.toLowerCase();
        if (c === 'active damage' || c === 'damage') return 'damage';
        if (c === 'active buff'   || c === 'buff')   return 'buff';
        if (c === 'active heal'   || c === 'heal')   return 'heal';
        if (c === 'special')                         return 'special';
        if (c === 'passive')                         return 'passive';
        return 'damage'; // fallback
    }

    // ── Helper: Normalisasi target_type → target ──────────────────────────────
    _mapTarget(targetType) {
        if (!targetType) return 'single';
        const t = targetType.toLowerCase();
        if (t === 'all_enemies' || t === 'all') return 'all';
        if (t === 'self')                       return 'self';
        return 'single'; // fallback
    }

    // ── Update visual HP label (dipanggil dari BattleScene.updateHpText) ─────
    refreshVisual() {
        if (this.hpLabel) {
            this.hpLabel.setText(`HP: ${this.hp}`);
        }
    }
}