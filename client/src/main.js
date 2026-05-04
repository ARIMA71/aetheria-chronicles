import Phaser from 'phaser';
import BattleScene from './scenes/battleScene.js';

const config = {
    type: Phaser.AUTO,
    width: 450,
    height: 800,
    backgroundColor: '#1a1a2e',
    scene: [BattleScene]
};

new Phaser.Game(config);