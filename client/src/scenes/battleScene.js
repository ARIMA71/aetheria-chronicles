export default class BattleScene extends Phaser.Scene {
    constructor() {
        super('BattleScene');
    }

    create() {
        this.player = {
            hp: 120,
            atk: 20,
            def: 10
        }
        this.enemy = {
            hp: 200,
            atk: 15,
            def: 5
        }

        this.playerHpText = this.add.text(50, 450, '', {
            fontSize: '20px',
            color: '#ffffff'
        });

        this.enemyHpText = this.add.text(50, 50, '', {
            fontSize: '20px',
            color: '#ff5555'
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
            this.playerAttack();
        });
    }

    playerAttack() {
        const rawDamage = this.player.atk - this.enemy.def;
        const damage = Math.max(rawDamage, 1);

        this.enemy.hp -= damage;
        console.log(`Player deals ${damage} damage`);

        if(this.enemy.hp < 0) this.enemy.hp = 0;
        this.updateHpText();
    }

    updateHpText() {
        this.playerHpText.setText(`Player HP: ${this.player.hp}`);
        this.enemyHpText.setText(`Enemy HP: ${this.enemy.hp}`);
    }
}