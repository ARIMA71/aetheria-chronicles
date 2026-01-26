export default class EnemyActionResolver {
    static resolve(enemy) {
        enemy.gainCA(1); // Enemies gain 1 bar each turn

        // HP Trigger Charge Attack
        if (enemy.hp <= enemy.maxhp * 0.3 && enemy.isAlive) {
            return {
                type: 'skill',
                skill: enemy.skills[0] // Charge Attack no AI
            };
        }

        // Full Charge Attack Bar
        if (enemy.isCAfull()) {
            enemy.resetCA();

            return {
                type: 'skill',
                skill: enemy.skills[0] // Charge Attack no AI
            };
        }

        // Basic Attack
        return {
            type: 'attack'
        }
    }
}