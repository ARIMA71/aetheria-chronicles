import TurnManager from "./turnManager";
import EnemyActionResolver from "./enemyActionResolver";
import DamageCalculator from "../systems/damageCalculator";

export default class BattleManager {
    constructor({ players = [], enemies = [], startTurn = 'player'}) {
        this.players = players;
        this.enemies = enemies;

        this.turnManager = new TurnManager({ startTurn});
        this.battleEnded = false;
    }

    executeAction(char, action, target, id) {
        if (action.type === 'basic') {
            return DamageCalculator.basicAttack(char, target);
        } else
        if (action.type === 'skill') {
            return DamageCalculator.skillAttack(char, target, id);
        } else
        if (action.type === 'heal') {
            return DamageCalculator.heal(target, name);
        }
    }

    resolveEnemyTurn() {
        const actions = [];

        this.getAliveEnemies().forEach(enemy => {
            const action = EnemyActionResolver.resolve(enemy);
            actions.push({enemy, action});
        })

        return actions;
    }

    getAlivePlayers() {
        return this.players.filter(p => p.isAlive);
    }

    getAliveEnemies() {
        return this.enemies.filter(e => e.isAlive);
    }

    isBattleOver() {
        if (this.getAlivePlayers().length === 0) {
            return 'You Lost';
        }

        if (this.getAliveEnemies().length === 0) {
            return 'You Win';
        }
    }

    startBattle() {
        this.battleEnded = false;
    }

    endTurn() {
        const result = this.isBattleOver();

        if (result) {
            this.battleEnded = true;
            this.turnManager.setBattleOver();
            return result;
        }

        this.turnManager.endTurn();
        return null;
    }

    getCurrentTurn() {
        return this.turnManager.getCurrentTurn();
    }
}