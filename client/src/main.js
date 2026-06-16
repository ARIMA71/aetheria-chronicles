import Phaser from 'phaser';
import BattleScene from './scenes/battleScene.js';
import VictoryScene from './scenes/victoryScene.js';
import DefeatScene from './scenes/defeatScene.js';

const config = {
    type: Phaser.AUTO,
    parent: 'game-wrapper',
    width: 450,
    height: 800,
    backgroundColor: '#1a1a2e',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.NONE,
        width: 450,
        height: 800
    },
    scene: [BattleScene, VictoryScene, DefeatScene]
};

new Phaser.Game(config);