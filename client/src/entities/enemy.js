export default class Enemy {
    constructor() {
        this.name = "Goblin";

        this.maxHp = 200;
        this.hp = 200;

        this.atk = 15;
        this.def = 5;
        this.crit = 0.3; // 30% crit chance
        this.critDamage = 2.0; // 200% damage on crit
        this.caBar = 0; // 0 to 3
        this.caMax = 3;

        this.skills = [
            {
                id: "roar",
                name: "Roar",
                type: "damage",
                target: "all",
                power: 3.5
            },
        ];
    }
}