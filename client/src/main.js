import Phaser from 'phaser';
import BattleScene from './scenes/battleScene.js';

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#222',
    scene: [BattleScene]
};

new Phaser.Game(config);