import Phaser from 'phaser';
import GameScene from './scenes/gameScene.js';

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#1e1e1e',
    scene: [GameScene]
};

new Phaser.Game(config);