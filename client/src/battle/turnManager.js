export default class TurnManager {
    constructor({ startTurn = 'player'} = {}) {
        this.currentTurn = startTurn; // player / enemy
        this.turnCount = 1;
        this.isBattleOver = false;
    }

    getCurrentTurn() {
        return this.currentTurn;
    }

    endTurn() {
        if (this.isBattleOver) return;

        this.currentTurn = this.currentTurn === 'player'
            ? 'enemy'
            : 'player';

        this.turnCount++;
    }

    setBattleOver() {
        this.isBattleOver = true;
    }

    reset(startTurn = 'player') {
        this.currentTurn = startTurn;
        this.turnCount = 1;
        this.isBattleOver = false;
    }
}