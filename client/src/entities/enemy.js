import Character from './character.js';

export default class Enemy extends Character {
    constructor({
        id,
        name,
        maxHp,
        atk,
        def,
        skills = [],
        behaviorType = 'static', 
        caBar = 2,
        phase = 'normal'
    }) {
        super({
            id,
            name,
            maxHp,
            atk,
            def,
            skills
        });
        this.phase = phase;
        this.behaviorType = behaviorType;

        this.caBar = caBar;
        this.caCurrent = 0;
    }

    gainCA(amount = 1) {
        this.caCurrent = Math.min(this.caCurrent + amount, this.caBar);
    }

    isCAfull() {
        return this.caCurrent >= this.caBar;
    }

    resetCA() {
        this.caCurrent = 0;
    }

    setPhase(phase) {
        this.phase = phase;
    }

    isEnraged() {
        return this.phase === 'enraged';
    }
}