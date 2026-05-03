export default class Enemy extends Phaser.GameObjects.Container {
    /**
     * @param {Phaser.Scene} scene - Scene Phaser yang aktif.
     * @param {number} x - Posisi X container.
     * @param {number} y - Posisi Y container.
     * @param {object} data - Data musuh dari API (response.data.enemies[0]).
     *   Struktur yang diharapkan:
     *   {
     *     id: number,
     *     name: string,
     *     element: string,
     *     level: number,
     *     final_stats: { hp: number, atk: number },
     *     ai_behaviors: [{ phase, utility, modifiers, skill: { id, name, category, modifier, vfx_path } }]
     *   }
     */
    constructor(scene, x, y, data) {
        super(scene, x, y);
        scene.add.existing(this);

        // ── Data Mapping dari API ──────────────────────────────────────────────
        this.id      = data.id;
        this.name    = data.name;
        this.element = data.element || 'None';
        this.level   = data.level   || 1;

        this.maxHp = data.final_stats.hp;
        this.hp    = data.final_stats.hp;
        this.atk   = data.final_stats.atk;

        // Stat default yang belum ada di API (akan di-extend di Fase 2+ via AI/DB)
        this.def        = 5;
        this.crit       = 0.2;   // 20% crit chance
        this.critDamage = 2.0;   // 200% damage on crit

        // ── Combat State: Charge Attack ───────────────────────────────────────
        this.caBar = 0;
        this.caMax = 3;

        // ── Normalisasi Skills dari ai_behaviors ──────────────────────────────
        // API mengirim skill musuh dalam bentuk ai_behaviors[].skill
        // Battle logic (enemyChargeAttack) menggunakan: this.enemy.skills.find(s => s.id)
        // Kita normalisasi ke format yang sama agar logic tidak perlu diubah.
        this.skills = (data.ai_behaviors || [])
            .filter(b => b.skill && b.skill.id) // Pastikan behavior memiliki skill valid
            .map(b => ({
                id:       b.skill.id,
                name:     b.skill.name,
                type:     this._mapCategory(b.skill.category),
                power:    parseFloat(b.skill.modifier ?? 1.0),
                // Simpan metadata AI untuk keperluan Fase 2
                phase:    b.phase    || 'Normal',
                utility:  b.utility  || 1.0,
                modifiers: b.modifiers || {}
            }));

        // Fallback: Jika tidak ada skill dari API, gunakan 'roar' hardcode
        // agar enemyChargeAttack() tidak error pada Fase 1.2 ini.
        if (this.skills.length === 0) {
            this.skills = [{
                id:    'roar',
                name:  'Roar',
                type:  'damage',
                power: 3.5
            }];
        }

        // ── Visual Placeholder (Phaser.GameObjects di dalam Container) ────────
        // Warna Merah (#c0392b) untuk Enemy
        const body = scene.add.rectangle(0, 0, 100, 150, 0xc0392b);
        body.setStrokeStyle(2, 0xff7979);

        const nameLabel = scene.add.text(0, -90, this.name, {
            fontSize: '12px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        this.hpLabel = scene.add.text(0, 65, `HP: ${this.hp}`, {
            fontSize: '11px',
            color: '#fab1a0'
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
        return 'damage'; // fallback
    }

    // ── Update visual HP label (dipanggil dari BattleScene.updateHpText) ─────
    refreshVisual() {
        if (this.hpLabel) {
            this.hpLabel.setText(`HP: ${this.hp}`);
        }
    }
}