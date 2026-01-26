export default class DamageCalculator {
    static basicAttack(attacker, defender) {
        const rawDamage = attacker.atk - defender.def;
        const damage = Math.max(rawDamage, 1);

        defender.takeDamage(damage);

        return {
            type: 'basic',
            damage
        };
    }

    static skillAttack(attacker, defender, skill) {
        const rawDamage = (attacker.atk * skill.power) - defender.def;
        const damage = Math.max(rawDamage, 1);

        defender.takeDamage(damage);
        skill.triggerCooldown();

        return {
            type: 'skill',
            skillName: skill.name,
            damage
        };
    }

    // static specialAttack(attacker, defender, ultimate) {
    //     const rawDamage = (attacker.atk * ult.power) - defender.def;
    //     const damage = Math.max(rawDamage, 1);

    //     defender.takeDamage(damage);
    //     skill.triggerCooldown();

    //     return {
    //         type: 'ultimate',
    //         ultimateName: ultimate.name,
    //         damage
    //     };
    // }

    static heal(target, skill) {
        const healAmount = skill.power;
        target.heal(healAmount);
        skill.triggerCooldown();

        return {
            type: 'heal',
            amount
        }
    }
}