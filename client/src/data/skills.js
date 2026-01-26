import Skill from '../entities/skill.js';

export const fireball = new Skill({
  id: 'fireball',
  name: 'Fireball',
  type: 'damage',
  power: 30,
  cooldown: 2,
  target: 'all',
  utilityTags: ['aoe', 'aggressive']
});

export const heal = new Skill({
  id: 'heal',
  name: 'Heal',
  type: 'heal',
  power: 25,
  cooldown: 3,
  target: 'single',
  utilityTags: ['heal', 'defensive']
});
