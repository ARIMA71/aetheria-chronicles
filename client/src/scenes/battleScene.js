import Player from "../entities/player";
import Enemy  from "../entities/enemy";

export default class BattleScene extends Phaser.Scene {
    constructor() {
        super('BattleScene');
    }

    // ── Phaser Lifecycle: create ───────────────────────────────────────────────
    create() {
        this.turn        = "player";
        this.currentTurn = 1;

        // Tampilkan teks loading di tengah layar
        this.loadingText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            'Loading Battle Data...',
            { fontSize: '24px', color: '#ffffff' }
        ).setOrigin(0.5);

        // Ambil data battle dari API
        this.fetchBattleData();
    }

    // ── API Fetching ───────────────────────────────────────────────────────────
    async fetchBattleData() {
        try {
            const response = await fetch('http://localhost:3000/api/battle/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId:   1,
                    presetSlot: 1,
                    questId:    1
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const json = await response.json();

            if (json.status !== 'success') {
                throw new Error(json.message || 'API mengembalikan status error.');
            }

            // Hapus teks loading setelah data berhasil diambil
            this.loadingText.destroy();

            // ── Inisialisasi Entity dari Data API ──────────────────────────────
            // 1v1: Karakter pertama party vs. Musuh pertama quest
            this.player = new Player(this, 200, 300, json.data.player_party.characters[0]);
            this.enemy  = new Enemy(this, 600, 300, json.data.enemies[0]);

            // ── Setup semua UI setelah entity berhasil diinisialisasi ──────────
            this._setupBattleUI();

        } catch (error) {
            console.error('[BattleScene] fetchBattleData gagal:', error);
            if (this.loadingText) {
                this.loadingText.setText(`Error: ${error.message}\nPeriksa console dan pastikan server berjalan.`);
                this.loadingText.setColor('#ff5555');
            }
        }
    }

    // ── Setup UI — dipanggil HANYA setelah player & enemy siap ───────────────
    _setupBattleUI() {
        // Teks Turn & Status
        this.turnText = this.add.text(350, 20, '', {
            fontSize: '20px',
            color: '#ffffff'
        });

        // HP & Resource Texts
        this.playerHpText = this.add.text(50, 450, '', {
            fontSize: '20px',
            color: '#ffffff'
        });

        this.enemyHpText = this.add.text(50, 50, '', {
            fontSize: '20px',
            color: '#ff5555'
        });

        this.playerSaText = this.add.text(50, 480, '', {
            fontSize: '18px',
            color: '#ffff00'
        });

        this.enemyCaText = this.add.text(50, 80, '', {
            fontSize: '18px',
            color: '#ffaa00'
        });

        // Update teks HP awal
        this.updateHpText();

        // Tombol ATTACK
        const attackButton = this.add
            .text(600, 500, '[ ATTACK ]', {
                fontSize: '24px',
                color: '#ffc918',
                backgroundColor: '#000',
                padding: { x: 10, y: 5 }
            })
            .setInteractive();

        attackButton.on('pointerdown', () => {
            if (this.turn !== "player") return;
            this.playerAttack();
        });

        // Tombol Skill
        this.createSkillButtons();

        // Tombol SPECIAL
        const specialButton = this.add
            .text(600, 400, '[ SPECIAL ]', {
                fontSize: '24px',
                color: '#ff66ff',
                backgroundColor: '#000',
                padding: { x: 10, y: 5 }
            })
            .setInteractive();

        specialButton.on('pointerdown', () => {
            if (this.turn !== "player") return;
            this.playerSpecialAttack();
        });

        // Battle Log
        this.battleLog = this.add.text(50, 300, '', {
            fontSize: '20px',
            color: '#ffffff',
            backgroundColor: '#000',
            padding: { x: 10, y: 5 }
        }).setOrigin(0, 5);
    }

    // ── Skill Buttons ─────────────────────────────────────────────────────────
    createSkillButtons() {
        // Hapus tombol lama jika ada (agar tidak tumpang tindih saat refresh)
        if (this.skillGroup) this.skillGroup.destroy(true);
        this.skillGroup = this.add.group();

        this.player.skills.forEach((skill, index) => {
            const cd          = this.player.cooldowns[skill.id] || 0;
            const isAvailable = cd === 0;

            const btn = this.add.text(
                50 + (index * 100), 410,
                `[ ${index}${cd > 0 ? ' (' + cd + ')' : ''} ]`,
                {
                    fontSize: '14px',
                    color:           isAvailable ? '#ffffff' : '#666666',
                    backgroundColor: isAvailable ? '#333'    : '#111',
                    padding: { x: 5, y: 5 }
                }
            );

            if (isAvailable) {
                btn.setInteractive().on('pointerdown', () => this.useSkill(index));
            }
            this.skillGroup.add(btn);
        });
    }

    // ── Turn Management ───────────────────────────────────────────────────────
    processTurnEnd() {
        // 1. Kurangi Cooldown Skill
        for (let id in this.player.cooldowns) {
            if (this.player.cooldowns[id] > 0) {
                this.player.cooldowns[id]--;
            }
        }

        // 2. Proses Buff aktif
        this.player.activeBuffs = this.player.activeBuffs.filter(buff => {
            buff.duration--;
            if (buff.duration <= 0) {
                this.player[buff.stat] -= buff.value; // Kembalikan stat ke normal
                this.showBattleLog(`Effect ${buff.stat} expired!`);
                return false;
            }
            return true;
        });

        this.currentTurn++;
        this.turnText.setText(`Turn: ${this.currentTurn}`);
        this.createSkillButtons(); // Gambar ulang tombol dengan CD terbaru
    }

    // ── Player Actions ────────────────────────────────────────────────────────
    playerAttack() {
        const rawDamage = this.player.atk - this.enemy.def;
        let damage      = Math.max(rawDamage, 1);
        const isCrit    = Math.random() < this.player.crit;
        const multiplier = isCrit ? this.player.critDamage : 1;
        damage *= multiplier;

        this.enemy.hp -= damage;

        // Isi special bar
        this.player.specialBar += 20;
        if (this.player.specialBar > this.player.specialMax) {
            this.player.specialBar = this.player.specialMax;
        }

        if (isCrit) {
            this.showBattleLog(`CRITICAL HIT! 💥 ${damage} damage`);
            console.log(`Player deals CRITICAL HIT! 💥 ${damage} damage`);
        } else {
            this.showBattleLog(`Player attacks! ${damage} damage`);
            console.log(`Player deals ${damage} damage`);
        }

        if (this.enemy.hp < 0) this.enemy.hp = 0;
        this.updateHpText();

        if (this.enemy.hp <= 0) {
            this.turn = "none";
            this.showBattleLog(`VICTORY!`);
            console.log("Enemy defeated! Victory!");
            return;
        }

        this.turn = "enemy";
        this.time.delayedCall(1500, () => {
            this.enemyAttack();
        });
    }

    playerSpecialAttack() {
        if (this.player.specialBar < this.player.specialMax) {
            this.showBattleLog("Special Attack not ready!");
            return;
        }
        const sa       = this.player.specialAttack;
        const rawDamage = (this.player.atk * sa.power) - this.enemy.def;
        const damage   = Math.max(rawDamage, 1);

        this.enemy.hp         -= damage;
        this.player.specialBar = 0;

        this.showBattleLog(`LIMIT BREAK! 💥 ${damage} damage`);

        if (this.enemy.hp < 0) this.enemy.hp = 0;
        this.updateHpText();

        if (this.enemy.hp <= 0) {
            this.showBattleLog("VICTORY!");
            return;
        }

        this.turn = "enemy";
        this.time.delayedCall(1500, () => {
            this.enemyAttack();
        });
    }

    useSkill(index) {
        const skill = this.player.skills[index];
        if (!skill || this.turn !== "player") return;

        if (this.player.cooldowns[skill.id] > 0) {
            this.showBattleLog(`${skill.name} is on cooldown!`);
            return;
        }

        if (skill.type === "damage") {
            const rawDamage = (this.player.atk * skill.power) - this.enemy.def;
            const damage    = Math.max(rawDamage, 1);
            this.enemy.hp  -= damage;
            this.showBattleLog(`${this.player.name} used ${skill.name}! ${damage} damage`);
            console.log(`${this.player.name} used ${skill.name}! ${damage} damage`);
        }
        else if (skill.type === "buff") {
            this.player.activeBuffs.push({
                stat:     skill.stat,
                value:    skill.value,
                duration: skill.duration
            });
            this.player[skill.stat] += skill.value;
            this.showBattleLog(`${this.player.name} used ${skill.name}! ${skill.stat} up!`);
        }
        else if (skill.type === "heal") {
            this.player.hp = Math.min(this.player.hp + skill.value, this.player.maxHp);
            this.showBattleLog(`${this.player.name} healed ${skill.value} HP!`);
        }

        // Set cooldown
        if (skill.cooldown) {
            this.player.cooldowns[skill.id] = skill.cooldown;
        }

        if (this.enemy.hp < 0) this.enemy.hp = 0;
        this.updateHpText();
        this.createSkillButtons(); // Refresh tombol dengan CD terbaru

        if (this.enemy.hp <= 0) {
            this.turn = "none";
            this.showBattleLog(`VICTORY!`);
            console.log("Enemy defeated! Victory!");
            return;
        }

        // Lanjut ke giliran musuh
        this.turn = "enemy";
        this.time.delayedCall(1500, () => {
            this.enemyAttack();
        });
    }

    // ── Enemy Actions ─────────────────────────────────────────────────────────
    enemyAttack() {
        if (this.enemy.caBar >= this.enemy.caMax) {
            this.enemyChargeAttack();
            return;
        }

        const rawDamage = this.enemy.atk - this.player.def;
        let damage      = Math.max(rawDamage, 1);
        const isCrit    = Math.random() < this.enemy.crit;
        const multiplier = isCrit ? this.enemy.critDamage : 1;
        damage *= multiplier;

        this.player.hp -= damage;

        if (isCrit) {
            this.showBattleLog(`ENEMY CRITICAL HIT! 💥 ${damage} damage`);
            console.log(`Enemy deals CRITICAL HIT! 💥 ${damage} damage`);
        } else {
            this.showBattleLog(`Enemy attacks! ${damage} damage`);
            console.log(`Enemy deals ${damage} damage`);
        }

        this.enemy.caBar++;
        if (this.enemy.caBar > this.enemy.caMax) {
            this.enemy.caBar = this.enemy.caMax;
        }

        if (this.player.hp < 0) this.player.hp = 0;
        this.updateHpText();

        if (this.player.hp <= 0) {
            this.turn = "none";
            this.showBattleLog(`Defeated`);
            console.log("Player defeated!");
            return;
        }

        this.turn = "player";
        this.time.delayedCall(1500, () => {
            this.processTurnEnd(); // Proses cooldown & buff setelah giliran selesai
        });
    }

    enemyChargeAttack() {
        // Cari skill charge attack dari skills musuh
        // Setelah normalisasi di Enemy class, skills[0] adalah skill pertama dari ai_behaviors,
        // atau fallback 'roar' jika API tidak mengembalikan skill.
        const ca = this.enemy.skills[0];
        if (!ca) {
            // Fallback darurat jika tidak ada skill sama sekali
            console.warn('[BattleScene] Enemy tidak memiliki skill charge attack!');
            this.turn = "player";
            return;
        }

        const rawDamage = (this.enemy.atk * ca.power) - this.player.def;
        const damage    = Math.max(rawDamage, 1);

        this.player.hp  -= damage;
        this.enemy.caBar = 0;

        this.showBattleLog(`ENEMY CHARGE ATTACK! 💥 ${damage} damage`);
        console.log(`Enemy uses ${ca.name} CHARGE ATTACK! 💥 ${damage} damage`);

        if (this.player.hp < 0) this.player.hp = 0;
        this.updateHpText();

        if (this.player.hp <= 0) {
            this.turn = "none";
            this.showBattleLog(`Defeated`);
            console.log("Player defeated!");
            return;
        }

        this.turn = "player";
    }

    // ── UI Update ─────────────────────────────────────────────────────────────
    updateHpText() {
        this.turnText.setText(`Turn: ${this.currentTurn}`);
        this.playerHpText.setText(`${this.player.name} HP: ${this.player.hp}`);
        this.enemyHpText.setText(`${this.enemy.name} HP: ${this.enemy.hp}`);
        this.playerSaText.setText(`SA: ${this.player.specialBar}/${this.player.specialMax}`);
        this.enemyCaText.setText(`CA: ${this.enemy.caBar}/${this.enemy.caMax}`);

        // Sync visual label di dalam Container
        this.player.refreshVisual();
        this.enemy.refreshVisual();
    }

    showBattleLog(message) {
        this.battleLog.setText(message);
        this.battleLog.setVisible(true);
        this.time.delayedCall(1000, () => {
            this.battleLog.setText('');
        });
    }
}