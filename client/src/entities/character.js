export default class Character {
  constructor({
    id,
    name,
    maxHp,
    atk,
    def,
    specialAttack = null,
    skills = []
  }) {
    this.id = id;
    this.name = name;

    this.maxHp = maxHp;
    this.hp = maxHp;

    this.atk = atk;
    this.def = def;

    this.skills = skills;
    this.specialAttack = specialAttack;

    this.statusEffects = [];
    this.isAlive = true;
  }

  takeDamage(amount) {
    const damage = Math.max(amount - this.def, 0);
    this.hp -= damage;

    if (this.hp <= 0) {
      this.hp = 0;
      this.isAlive = false;
    }

    return damage;
  }

  heal(amount) {
    if (!this.isAlive) return 0;

    this.hp = Math.min(this.hp + amount, this.maxHp);
    return amount;
  }

  addStatusEffect(effect) {
    this.statusEffects.push(effect);
  }

  removeExpiredStatus() {
    this.statusEffects = this.statusEffects.filter(effect => !effect.isExpired());
  }

  isReadyToAct() {
    return this.isAlive;
  }
}
