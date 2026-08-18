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
        const shadow = scene.add.rectangle(5, 5, 130, 130, 0x000000).setAlpha(0.4);
        this._glow = scene.add.rectangle(0, 0, 138, 138, 0xffffff).setAlpha(0); // Glow Background
        this._effectIndicators = scene.add.container(0, -80);
        
        if (!this._spritePath) {
            this._body = scene.add.rectangle(0, 0, 130, 130, 0x1c0a0a);
            this._body.setStrokeStyle(3, elemColor);

            const inner = scene.add.rectangle(0, 0, 110, 110, 0x000000, 0);
            inner.setStrokeStyle(1, elemColor).setAlpha(0.4);

            const h = scene.add.line(0, 0, -40, 0, 40, 0, elemColor).setAlpha(0.25);
            const v = scene.add.line(0, 0, 0, -40, 0, 40, elemColor).setAlpha(0.25);
            
            this.add([shadow, this._glow, this._body, inner, h, v, this._effectIndicators]);
        } else {
            this.add([shadow, this._glow, this._effectIndicators]);
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
        this._effectIndicators.removeAll(true);
        const visibleEffects = this.activeEffects.filter(e =>
            ['ATK', 'DEF', 'CRIT', 'STUN', 'POISON'].includes(e.target_stat)
        );

        const sups = { 0: '', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
        visibleEffects.forEach((e, idx) => {
            const isBuff = (e.effect_type || '').toLowerCase() === 'buff';
            const color = isBuff ? '#f1c40f' : '#7ec8e3'; // Kuning untuk Buff, Biru Muda untuk Debuff

            let emoji = '❓';
            if (e.target_stat === 'ATK') emoji = '⚔️';
            else if (e.target_stat === 'DEF') emoji = '🛡️';
            else if (e.target_stat === 'CRIT') emoji = '✨';
            else if (e.target_stat === 'STUN') emoji = '💫';
            else if (e.target_stat === 'POISON') emoji = '🤢';

            const durSup = sups[e.duration] || e.duration || '';
            const label = `${emoji}${durSup}`;

            const txt = this.scene.add.text(
                (idx - Math.floor(visibleEffects.length / 2)) * 32,
                0,
                label,
                { fontSize: '10px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }
            ).setOrigin(0.5, 0.5);

            this._effectIndicators.add(txt);
        });
    }

    /**
     * Evaluasi dan pilih AI behavior terbaik menggunakan Utility Score.
     *
     * Alur:
     *   1. Filter behaviors berdasarkan fase saat ini (Normal/Enraged/Exhausted)
     *   2. Untuk setiap behavior, hitung totalScore = base_utility + bonus dari modifiers
     *   3. Cek kondisi khusus (One_Time_Use, Trigger_HP_Threshold)
     *   4. Kembalikan behavior dengan totalScore tertinggi, atau null jika tidak ada
     *
     * @param {object} knowledge - Knowledge Base dari BattleScene._buildKnowledge()
     * @returns {object|null} - Satu entry behavior terpilih, atau null
     */
    /**
     * Mengevaluasi skill khusus HP Trigger (base_utility = 0 dengan Trigger_HP_Threshold).
     * Dapat dilepaskan kapan saja saat HP bos berkurang melewati threshold,
     * mengabaikan status exhausted maupun kondisi CA bar.
     * @returns {object|null}
     */
    evaluateHpTriggerAction() {
        const hpTriggerBehaviors = this.aiBehaviors.filter(b => {
            const mods = b.modifiers || {};
            if (mods.Trigger_HP_Threshold === undefined) return false;

            // Cek One_Time_Use
            if (mods.One_Time_Use === true) {
                if (this._usedOneTimeSkills && this._usedOneTimeSkills.has(b.skill.id)) {
                    return false;
                }
            }

            const threshold = Number(mods.Trigger_HP_Threshold);
            const enemyHpRatio = this.hp / this.maxHp;
            return enemyHpRatio <= threshold;
        });

        if (hpTriggerBehaviors.length === 0) return null;

        // Cari dengan utility score tertinggi (jika ada modifiers tambahan) atau ambil yang pertama
        let maxScore = -Infinity;
        let candidates = [];
        for (const b of hpTriggerBehaviors) {
            let score = b.base_utility;
            candidates.push({ behavior: b, score });
            if (score > maxScore) maxScore = score;
        }

        const bestBehaviors = candidates.filter(c => c.score === maxScore).map(c => c.behavior);
        const chosen = bestBehaviors[Math.floor(Math.random() * bestBehaviors.length)];

        // Tandai One_Time_Use jika terpilih
        if (chosen && chosen.modifiers && chosen.modifiers.One_Time_Use === true) {
            if (!this._usedOneTimeSkills) this._usedOneTimeSkills = new Set();
            this._usedOneTimeSkills.add(chosen.skill.id);
        }

        return chosen;
    }

    /**
     * Evaluasi dan pilih AI behavior terbaik menggunakan Utility Score.
     * Hanya mengevaluasi skill biasa (base_utility > 0) untuk Charge Attack normal.
     *
     * @param {object} knowledge - Knowledge Base dari BattleScene._buildKnowledge()
     * @returns {object|null} - Satu entry behavior terpilih, atau null
     */
    evaluateAction(knowledge) {
        if (!knowledge) return null;

        // Tentukan fase berdasarkan modeState saat ini
        const currentPhase = this.modeState === 'enraged'
            ? 'Enraged'
            : this.modeState === 'exhausted'
                ? 'Exhausted'
                : 'Normal';

        // Filter: hanya behaviors yang cocok dengan fase sekarang DAN base_utility > 0 (skill biasa, bukan HP Trigger)
        const candidates = this.aiBehaviors.filter(b =>
            b.phase === currentPhase &&
            b.base_utility > 0 &&
            b.modifiers.Trigger_HP_Threshold === undefined
        );
        const pool = candidates.length > 0 ? candidates : this.aiBehaviors.filter(b => b.base_utility > 0 && b.modifiers.Trigger_HP_Threshold === undefined);
        if (!pool.length) return null;

        let candidatesWithScore = [];
        let maxScore = -Infinity;

        for (const behavior of pool) {
            let totalScore = behavior.base_utility;
            const mods = behavior.modifiers || {};

            // One_Time_Use: skill ini hanya boleh dipakai sekali sepanjang battle
            if (mods.One_Time_Use === true) {
                if (this._usedOneTimeSkills && this._usedOneTimeSkills.has(behavior.skill.id)) {
                    continue; // sudah dipakai, skip
                }
            }

            // ── Evaluasi Modifier Score ──────────────────────────────────────

            // Party_Healthy: true jika rata-rata HP party di atas 70%
            if (mods.Party_Healthy !== undefined && knowledge.partyHealthy === true) {
                totalScore += Number(mods.Party_Healthy);
            }

            // Party_Low_HP_Count_gt_2: true jika ≥3 karakter HP di bawah 30%
            if (mods.Party_Low_HP_Count_gt_2 !== undefined && knowledge.partyLowHpCount >= 3) {
                totalScore += Number(mods.Party_Low_HP_Count_gt_2);
            }

            // P_Buff_gt_2: true jika total buff aktif party > 2
            if (mods.P_Buff_gt_2 !== undefined && knowledge.playerBuffCount > 2) {
                totalScore += Number(mods.P_Buff_gt_2);
            }

            // Target_Lowest_HP: bonus jika ada target dengan HP sangat rendah
            if (mods.Target_Lowest_HP !== undefined && knowledge.partyLowHpCount > 0) {
                totalScore += Number(mods.Target_Lowest_HP);
            }

            // Target_Healer_Alive: bonus jika ada healer/reviver masih hidup di party
            if (mods.Target_Healer_Alive !== undefined && knowledge.healerAlive === true) {
                totalScore += Number(mods.Target_Healer_Alive);
            }

            candidatesWithScore.push({ behavior, score: totalScore });
            if (totalScore > maxScore) {
                maxScore = totalScore;
            }
        }

        if (candidatesWithScore.length === 0) return null;

        // Ambil semua behavior yang memiliki skor sama dengan skor tertinggi
        const bestBehaviors = candidatesWithScore.filter(c => c.score === maxScore).map(c => c.behavior);
        const bestBehavior = bestBehaviors[Math.floor(Math.random() * bestBehaviors.length)];

        // Tandai One_Time_Use jika behavior terpilih
        if (bestBehavior && bestBehavior.modifiers && bestBehavior.modifiers.One_Time_Use === true) {
            if (!this._usedOneTimeSkills) this._usedOneTimeSkills = new Set();
            this._usedOneTimeSkills.add(bestBehavior.skill.id);
        }

        return bestBehavior;
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
            this._body.setStrokeStyle(3, this._getElementColor(this.element));
            if (this._glow) this._glow.setAlpha(0);
            return;
        }

        const ratio = this.modeBar / this.modeMax;

        if (this.modeState === 'enraged') {
            this._body.setStrokeStyle(3, 0xe74c3c);
            if (this._glow) this._glow.setFillStyle(0xe74c3c).setAlpha(0.6);
        } else if (this.modeState === 'exhausted') {
            this._body.setStrokeStyle(3, 0x3498db);
            if (this._glow) this._glow.setFillStyle(0x3498db).setAlpha(0.6);
        } else {
            this._body.setStrokeStyle(3, this._getElementColor(this.element));
            if (this._glow) this._glow.setAlpha(0);
        }
    }

    _getElementColor(el) {
        return { Fire: 0xe74c3c, Wind: 0x2ecc71, Earth: 0xe67e22, Water: 0x3498db, Light: 0xf1c40f, Dark: 0x9b59b6 }[el] || 0xff5555;
    }
}