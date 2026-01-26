export default class Skill {
  constructor({
    id,
    name,
    type, // 'damage' | 'heal' | 'buff' | 'debuff'
    power = 0,
    cooldown = 0,
    target = 'single', // 'single' | 'all' | 'self'
    effect = null,
    utilityTags = []
  }) {
    this.id = id;
    this.name = name;
    this.type = type;

    this.power = power;

    this.cooldown = cooldown;
    this.currentCooldown = 0;

    this.target = target;
    this.effect = effect;

    this.utilityTags = utilityTags;
  }

  isReady() {
    return this.currentCooldown === 0;
  }

  triggerCooldown() {
    this.currentCooldown = this.cooldown;
  }

  reduceCooldown() {
    if (this.currentCooldown > 0) {
      this.currentCooldown--;
    }
  }
}
