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
        this.def      = 5;
        this.crit     = 0.2;
        this.critDamage = 2.0;

        // ── Charge Attack State ───────────────────────────────────────────────
        this.caBar = 0;
        this.caMax = 3;

        // ── Mode State: 'normal' | 'enraged' | 'exhausted' ─────
        this.modeState = 'normal';
        this.modeBar = 0;
        this.modeMax = this.maxHp * 0.2; // 20% threshold to trigger Enraged

        // ── Skills (dari ai_behaviors) ────────────────────────────────────────
        this.skills = (data.ai_behaviors || [])
            .filter(b => b.skill && b.skill.id)
            .map(b => ({
                id:       b.skill.id,
                name:     b.skill.name,
                type:     'damage',
                power:    parseFloat(b.skill.modifier ?? 1.0),
                phase:    b.phase    || 'Normal',
                utility:  b.utility  || 1.0
            }));

        if (this.skills.length === 0) {
            this.skills = [{ id: 'roar', name: 'Roar', type: 'damage', power: 3.5 }];
        }

        // ── Visual: Sprite Placeholder di Arena ───────────────────────────────
        const elemColor = this._getElementColor(this.element);

        const shadow = scene.add.rectangle(5, 5, 130, 130, 0x000000).setAlpha(0.4);

        this._body = scene.add.rectangle(0, 0, 130, 130, 0x1c0a0a);
        this._body.setStrokeStyle(3, elemColor);

        // Inner frame accent
        const inner = scene.add.rectangle(0, 0, 110, 110, 0x000000, 0);
        inner.setStrokeStyle(1, elemColor).setAlpha(0.4);

        // Crosshair placeholder
        const h = scene.add.line(0, 0, -40, 0, 40, 0, elemColor).setAlpha(0.25);
        const v = scene.add.line(0, 0, 0, -40, 0, 40, elemColor).setAlpha(0.25);

        this.add([shadow, this._body, inner, h, v]);
    }

    // ── Shake saat kena damage ────────────────────────────────────────────────
    playHitAnim() {
        const ox = this.x;
        this.scene.tweens.add({
            targets: this, x: ox + 10,
            duration: 50, yoyo: true, repeat: 2,
            ease: 'Power1',
            onComplete: () => { this.x = ox; }
        });
    }

    // ── Update warna border body sesuai mode state ──────────────────────────
    updateEnrageVisual() {
        const colors = { normal: null, enraged: 0xe74c3c, exhausted: 0x3498db };
        const col    = colors[this.modeState];
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