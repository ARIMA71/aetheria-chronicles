import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    create() {
        this.add.text(200, 200, 'Welcome to the Aetheria Chronicles\nPress to Start the Game', {
            font: '28px',
            color: '#ffffff'
        });
    }
}