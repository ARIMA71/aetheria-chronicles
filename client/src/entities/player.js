export default class Player {
    constructor() {
        this.name = "Hero";

        this.maxHp = 120;
        this.hp = 120;

        this.atk = 20;
        this.def = 10;
        this.crit = 0.1; // 30% crit chance
        this.critDamage = 2.0; // 200% damage on crit
        this.specialBar = 0; // 0 to 100
        this.specialMax = 100;

        this.activeBuffs = []; // Menampung { stat: 'atk', value: 5, duration: 3 }
        this.cooldowns = {};   // Menampung { skillId: sisaTurn }

        this.skills = [
            {
                id: "power_slash",
                name: "Power Slash",
                type: "damage",
                target: "single",
                power: 1.8,
                cooldown: 2
            },
            {
                id: "whirlwind",
                name: "Whirlwind",
                type: "damage",
                target: "all",
                power: 1.2,
                cooldown: 2
            },
            {
                id: "def_buff",
                name: "War Cry",
                type: "buff",
                target: "self",
                stat: "def",
                value: 5,
                duration: 3,
                cooldown: 2
            },
            {
                id: "heal_light",
                name: "Heal Light",
                type: "heal",
                target: "self",
                value: 40,
                cooldown: 2
            }

        ];

        this.specialAttack = {
            id: "limit_break",
            name: "Limit Break",
            power: 3.5
        };
    }
}