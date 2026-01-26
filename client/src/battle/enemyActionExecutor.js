import damageCalculator from "../systems/damageCalculator";

export default class EnemyActionExecutor {
    static execute(attacker, action, target, id) {
        switch (action.type) {
            case 'basic':
                return DamageCalculator.basicAttack(attacker, target);

            case 'skill': {
                const skill = attacker.skills.find(s => s.id === id);
                if (!skill) throw new Error('Skill not found');
                return DamageCalculator.skillAttack(attacker, target, skill);
            }

            case 'heal': {
                const skill = attacker.skills.find(s => s.id === id);
                if (!skill) throw new Error('Heal skill not found');
                return DamageCalculator.heal(attacker, target, skill);
            }

            default:
                throw new Error('Unknown action type');
        }
    }
}