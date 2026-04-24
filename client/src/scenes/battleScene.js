import Player from "../entities/player";
import Enemy from "../entities/enemy";
export default class BattleScene extends Phaser.Scene {
    constructor() {
        super('BattleScene');
    }
    
    create() {
        this.turn = "player";
        this.currentTurn = 1;

        this.player = new Player();
        this.enemy = new Enemy();

        this.turnText = this.add.text(350, 20, '', {
            fontSize: '20px',
            color: '#ffffff'
        });

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
        
        this.updateHpText();

        const attackButton = this.add
            .text(600, 500, '[ ATTACK ]', {
                fontSize: '24px',
                color: '#ffc918ff',
                backgroundColor: '#000',
                padding: { x: 10, y: 5 }
            })
            .setInteractive();

        attackButton.on('pointerdown', () => {
            if (this.turn !== "player") return;
            this.playerAttack();
        });

        this.createSkillButtons();

        // this.player.skills.forEach((skill, index) => {
        //     const x = 50 + (index * 110); // Geser ke kanan untuk tiap skill
        //     const y = 410;               // Di atas HP Player

        //     const btn = this.add.text(x, y, `[ ${index} ]`, {
        //         fontSize: '14px',
        //         color: '#ffffff',
        //         backgroundColor: '#333',
        //         padding: { x: 10, y: 5 }
        //     })
        //     .setInteractive()
        //     .on('pointerdown', () => {
        //         if (this.turn === "player") {
        //             this.useSkill(index);
        //         }
        //     });
        // });
        // const skillButton = this.add
        //     .text(600, 450, '[ SKILL ]', {
        //         fontSize: '24px',
        //         color: '#00e1ff',
        //         backgroundColor: '#000',
        //         padding: { x: 10, y: 5 }
        //     })
        //     .setInteractive();

        // skillButton.on('pointerdown', () => {
        //     this.useSkill(0);
        // });

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

        this.battleLog = this.add.text(50, 300, '', {
            fontSize: '20px',
            color: '#ffffff',
            backgroundColor: '#000',
            padding: { x: 10, y: 5}
        }).setOrigin(0, 5);
    }

    createSkillButtons() {
        // Hapus tombol lama jika ada (agar tidak tumpang tindih saat refresh)
        if (this.skillGroup) this.skillGroup.destroy(true);
        this.skillGroup = this.add.group();

        this.player.skills.forEach((skill, index) => {
            const cd = this.player.cooldowns[skill.id] || 0;
            const isAvailable = cd === 0;

            const btn = this.add.text(50 + (index * 100), 410, `[ ${index}${cd > 0 ? ' ('+cd+')' : ''} ]`, {
                fontSize: '14px',
                color: isAvailable ? '#ffffff' : '#666666', // Redup jika CD
                backgroundColor: isAvailable ? '#333' : '#111',
                padding: { x: 5, y: 5 }
            });

            if (isAvailable) {
                btn.setInteractive().on('pointerdown', () => this.useSkill(index));
            }
            this.skillGroup.add(btn);
        });
    }

    processTurnEnd() {
        // 1. Kurangi Cooldown Skill
        for (let id in this.player.cooldowns) {
            if (this.player.cooldowns[id] > 0) {
                this.player.cooldowns[id]--;
            }
        }

        // 2. Proses Buff
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

    playerAttack() {
        const rawDamage = this.player.atk - this.enemy.def;
        let damage = Math.max(rawDamage, 1);
        const isCrit = Math.random() < this.player.crit;
        const multiplier = isCrit ? this.player.critDamage : 1; // misal default 2.0
        damage *= multiplier;

        this.enemy.hp -= damage;
        
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

        // jika enemy mati
        if (this.enemy.hp <= 0) {
            this.turn = "none";
            this.showBattleLog(`VICTORY!`);
            console.log("Enemy defeated!");
            console.log("Victory!");
            return;
        }

        this.turn = "enemy";
        
        // enemy attack setelah 1 detik
        this.time.delayedCall(1500, () => {
            // this.showBattleLog("Enemy's turn!");
            this.enemyAttack();
        });
    }

    playerSpecialAttack() {
        if (this.player.specialBar < this.player.specialMax) {
            this.showBattleLog("Special Attack not ready!");
            return;
        }
        const sa = this.player.specialAttack;
        const rawDamage = (this.player.atk * sa.power) - this.enemy.def;
        const damage = Math.max(rawDamage, 1);

        this.enemy.hp -= damage;

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
            if (skill.target === "single") {
                const rawDamage = (this.player.atk * skill.power) - this.enemy.def;
                const damage = Math.max(rawDamage, 1);

                this.enemy.hp -= damage;

                this.showBattleLog(`${this.player.name} used ${skill.name}! ${damage} damage`);
                console.log(`${this.player.name} used ${skill.name}! ${damage} damage`);
            }
            else if (skill.target === "all") {
                const rawDamage = (this.player.atk * skill.power) - this.enemy.def;
                const damage = Math.max(rawDamage, 1);

                this.enemy.hp -= damage;

                this.showBattleLog(`${this.player.name} used ${skill.name}! ${damage} damage`);
                console.log(`${this.player.name} used ${skill.name}! ${damage} damage`);
            }
        }
        else if (skill.type === "buff") {
            // this.player[skill.stat] += skill.value;
            this.player.activeBuffs.push({
                stat: skill.stat,
                value: skill.value,
                duration: skill.duration
            });

            this.player[skill.stat] += skill.value;
            this.showBattleLog(`${this.player.name} used ${skill.name}! ${skill.stat} up!`);
            // Catatan: Idealnya buat sistem turn-counter untuk menghapus buff setelah 'duration' habis
        }
        else if (skill.type === "heal") {
            this.player.hp = Math.min(this.player.hp + skill.value, this.player.maxHp);
            this.showBattleLog(`${this.player.name} healed ${skill.value} HP!`);
        }

        // set cooldown skill
        if (skill.cooldown) {
            this.player.cooldowns[skill.id] = skill.cooldown;
        }

        if (this.enemy.hp < 0) this.enemy.hp = 0;

        this.updateHpText();
        this.createSkillButtons(); // Refresh tombol skill untuk update cooldown

        if (this.enemy.hp <= 0) {
            this.showBattleLog(`VICTORY!`);
            console.log("Enemy defeated!");
            console.log("Victory!");
            this.turn = "none"
            return;
        }

    }

    enemyAttack() {
        if (this.enemy.caBar >= this.enemy.caMax) {
            this.enemyChargeAttack();
            return;
        }
        const rawDamage = this.enemy.atk - this.player.def;
        let damage = Math.max(rawDamage, 1);
        const isCrit = Math.random() < this.enemy.crit;
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

        this.enemy.caBar += 1;

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
            this.processTurnEnd(); // <--- BARU DI SINI cooldown & buff diproses
            // this.showBattleLog("Player's Turn");
        });
    }

    enemyChargeAttack() {
        const ca = this.enemy.skills.find(s => s.id === "roar");
        const rawDamage = (this.enemy.atk * ca.power) - this.player.def;
        const damage = Math.max(rawDamage, 1);

        this.player.hp -= damage;

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

    updateHpText() {
        this.turnText.setText(`Turn: ${this.currentTurn}`);
        this.playerHpText.setText(`Player HP: ${this.player.hp}`);
        this.enemyHpText.setText(`Enemy HP: ${this.enemy.hp}`);
        
        this.playerSaText.setText(`SA: ${this.player.specialBar}/${this.player.specialMax}`);
        this.enemyCaText.setText(`CA: ${this.enemy.caBar}/${this.enemy.caMax}`);
    }

    showBattleLog(message) {
        this.battleLog.setText(message);
        this.battleLog.setVisible(true);
        this.time.delayedCall(1000, () => {
            this.battleLog.setText('');
        })
    }
}