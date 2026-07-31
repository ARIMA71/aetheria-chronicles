import Phaser from 'phaser';
import { THEME } from '../main.js';
import { checkSession, saveCurrentScene, clearSession } from '../utils/auth.js';

import fireRaw from '../../assets/icons/elements/fire.svg?raw';
import windRaw from '../../assets/icons/elements/wind.svg?raw';
import earthRaw from '../../assets/icons/elements/rock.svg?raw';

const W = 480, H = 800, CX = 240;

export default class GachaScene extends Phaser.Scene {
    constructor() {
        super('GachaScene');
    }

    preload() {
        const fireUrl = URL.createObjectURL(new Blob([fireRaw], { type: 'image/svg+xml' }));
        const windUrl = URL.createObjectURL(new Blob([windRaw], { type: 'image/svg+xml' }));
        const earthUrl = URL.createObjectURL(new Blob([earthRaw], { type: 'image/svg+xml' }));

        this.load.svg('element_fire', fireUrl, { width: 16, height: 16 });
        this.load.svg('element_wind', windUrl, { width: 16, height: 16 });
        this.load.svg('element_earth', earthUrl, { width: 16, height: 16 });
    }

    create() {
        if (!checkSession(this)) return;
        saveCurrentScene(this.scene.key);

        const raw = localStorage.getItem('aetheria_player');
        this.playerData = raw ? JSON.parse(raw) : null;
        if (!this.playerData) {
            this.scene.start('AuthScene');
            return;
        }

        // --- Data State ---
        this.diamond = this.playerData.diamond || 0;
        this.pityCounter = 0;
        this.pityGuarantee = 40; // Default fallback
        this.costSingle = 100;
        this.costMulties = 1000;
        this.isPulling = false;

        // --- Background ---
        this.add.rectangle(CX, H / 2, W, H, THEME.BG);

        // --- Build UI ---
        this._buildTopBar();
        this._buildMenuModal();
        this._buildBannerArea();
        this._buildActionButtons();
        this._buildDropRateModal();
        this._buildResultModal();
        this._buildNewCharacterModal();

        // --- Fetch Data ---
        this.fetchGachaInfo();
    }

    async fetchGachaInfo() {
        const token = localStorage.getItem('aetheria_token');
        try {
            const res = await fetch(`http://localhost:3000/api/gacha/info/${this.playerData.player_id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            if (json.status === 'success') {
                this.diamond = json.data.diamond;
                this.pityCounter = json.data.pity_counter;
                this.pityGuarantee = json.data.pity_guarantee;
                this.costSingle = json.data.cost_single;
                this.costMulties = json.data.cost_multies;
                this.bannerItems = json.data.banner_items || [];

                // Update local storage
                this.playerData.diamond = this.diamond;
                localStorage.setItem('aetheria_player', JSON.stringify(this.playerData));

                this.updateUIData();
                this.populateDropRateList();
            }
        } catch (e) {
            console.error('Failed to fetch gacha info:', e);
        }
    }

    updateUIData() {
        if (this.diamondText) this.diamondText.setText(`💎 ${this.diamond}`);

        const drawsLeft = Math.max(0, this.pityGuarantee - this.pityCounter);
        if (this.pityText) {
            this.pityText.setText(`Guaranteed SSR in: ${drawsLeft} Draws`);
            if (drawsLeft <= 10) {
                this.pityText.setColor('#fbbf24'); // highlight near pity
            } else {
                this.pityText.setColor(THEME.TEXT_SECONDARY);
            }
        }

        if (this.singleCostText) this.singleCostText.setText(`Diamond: ${this.costSingle}`);
        if (this.multiCostText) this.multiCostText.setText(`Diamond: ${this.costMulties}`);
    }

    _buildTopBar() {
        const topBar = this.add.rectangle(CX, 30, W, 60, THEME.PANEL, THEME.PANEL_ALPHA);
        topBar.setStrokeStyle(1, THEME.BORDER);

        // Header Title
        this.add.text(CX, 30, 'GRAND SUMMON', {
            fontSize: '15px',
            fontStyle: 'bold',
            color: THEME.TEXT_PRIMARY,
            fontFamily: 'Outfit',
            letterSpacing: 2
        }).setOrigin(0.5);

        // HOME (Kiri)
        const homeBtn = this.add.circle(40, 30, 18, THEME.PANEL, THEME.PANEL_ALPHA);
        homeBtn.setStrokeStyle(1, THEME.BORDER);
        homeBtn.setInteractive({ useHandCursor: true });
        const homeTxt = this.add.text(40, 30, 'HOME', { fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);

        homeBtn.on('pointerover', () => homeBtn.setFillStyle(0x334155));
        homeBtn.on('pointerout', () => homeBtn.setFillStyle(THEME.PANEL));
        homeBtn.on('pointerdown', () => this.scene.start('LoadingScene', { targetScene: 'MainMenuScene' }));

        // MENU (Kanan)
        const menuBtn = this.add.circle(W - 40, 30, 18, THEME.PANEL, THEME.PANEL_ALPHA);
        menuBtn.setStrokeStyle(1, THEME.BORDER);
        menuBtn.setInteractive({ useHandCursor: true });
        const menuTxt = this.add.text(W - 40, 30, 'MENU', { fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);

        menuBtn.on('pointerover', () => menuBtn.setFillStyle(0x334155));
        menuBtn.on('pointerout', () => menuBtn.setFillStyle(THEME.PANEL));
        menuBtn.on('pointerdown', () => {
            this.toggleMenuModal(true);
        });
    }

    _buildBannerArea() {
        const bannerY = 280;

        // Kotak presentasi utama - Clean flat vector design, no ornate frames
        const bannerRect = this.add.rectangle(CX, bannerY, W - 40, 320, 0x0f172a);
        bannerRect.setStrokeStyle(2, 0x334155);

        // Placeholder artwork
        this.add.text(CX, bannerY - 30, 'AETHERIA ARSENAL', {
            fontSize: '20px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: '#f8fafc',
            letterSpacing: 4
        }).setOrigin(0.5);

        this.add.text(CX, bannerY + 10, '[ ARTWORK PLACEHOLDER ]', {
            fontSize: '12px',
            fontFamily: 'Outfit',
            color: THEME.TEXT_MUTED
        }).setOrigin(0.5);

        // Pity Container
        const pityBg = this.add.rectangle(CX, bannerY + 130, 260, 28, 0x1e293b);
        pityBg.setStrokeStyle(1, THEME.BORDER);

        this.pityText = this.add.text(CX, bannerY + 130, 'Guaranteed SSR in: -- Draws', {
            fontSize: '11px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: THEME.TEXT_SECONDARY
        }).setOrigin(0.5);
    }

    _buildActionButtons() {
        const btnY = 540;

        // Draw 1x (Kiri)
        const btn1x = this.add.rectangle(CX - 100, btnY, 160, 50, THEME.PANEL);
        btn1x.setStrokeStyle(1, THEME.BORDER);
        btn1x.setInteractive({ useHandCursor: true });

        this.add.text(CX - 100, btnY - 8, 'DRAW 1x', {
            fontSize: '14px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY
        }).setOrigin(0.5);
        this.singleCostText = this.add.text(CX - 100, btnY + 12, 'Diamond: 100', {
            fontSize: '10px', fontFamily: 'Outfit', color: '#00FFFF'
        }).setOrigin(0.5);

        btn1x.on('pointerover', () => btn1x.setFillStyle(0x334155));
        btn1x.on('pointerout', () => btn1x.setFillStyle(THEME.PANEL));
        btn1x.on('pointerdown', () => this.doPull('1x'));

        // Draw 10x+1 (Kanan - Highlighted)
        const btn10x = this.add.rectangle(CX + 100, btnY, 160, 50, 0x1e3a8a); // Blue highlight
        btn10x.setStrokeStyle(2, 0x3b82f6);
        btn10x.setInteractive({ useHandCursor: true });

        this.add.text(CX + 100, btnY - 8, 'DRAW 10x + 1', {
            fontSize: '14px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#ffffff'
        }).setOrigin(0.5);
        this.multiCostText = this.add.text(CX + 100, btnY + 12, 'Diamond: 1000', {
            fontSize: '10px', fontFamily: 'Outfit', color: '#00FFFF'
        }).setOrigin(0.5);

        btn10x.on('pointerdown', () => this.doPull('10x+1'));

        // Drop Rate Button (Digeser naik)
        const dropRateBtn = this.add.rectangle(CX, btnY + 65, 140, 32, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        const dropRateTxt = this.add.text(CX, btnY + 65, 'DROP RATE INFO', {
            fontSize: '11px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_SECONDARY
        }).setOrigin(0.5);

        dropRateBtn.on('pointerover', () => { dropRateBtn.setFillStyle(0x334155); dropRateTxt.setColor('#ffffff'); });
        dropRateBtn.on('pointerout', () => { dropRateBtn.setFillStyle(THEME.PANEL); dropRateTxt.setColor(THEME.TEXT_SECONDARY); });
        dropRateBtn.on('pointerdown', () => {
            this.dropRateModal.setVisible(true);
        });

        // Diamond Display (Dipindah ke paling bawah, desain teks transparan)
        const diamondBg = this.add.rectangle(CX, btnY + 115, 100, 20, 0x000000, 0.4); // No stroke
        this.diamondText = this.add.text(CX, btnY + 115, `💎 ${this.diamond}`, {
            fontSize: '12px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#00FFFF'
        }).setOrigin(0.5);
    }

    async doPull(drawType) {
        if (this.isPulling) return;

        const cost = drawType === '1x' ? this.costSingle : this.costMulties;
        if (this.diamond < cost) {
            this.showToast('Not enough Diamonds!');
            return;
        }

        this.isPulling = true;
        const token = localStorage.getItem('aetheria_token');

        try {
            const res = await fetch('http://localhost:3000/api/gacha/pull', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    playerId: this.playerData.player_id,
                    drawType: drawType,
                    elementPool: 'All'
                })
            });

            const json = await res.json();
            if (json.status === 'success') {
                this.diamond = json.data.new_diamond_balance;
                this.pityCounter = json.data.pity_counter;

                // Update LocalStorage Cache
                this.playerData.diamond = this.diamond;
                localStorage.setItem('aetheria_player', JSON.stringify(this.playerData));

                this.showResultModal(json.data.pulled_items);
            } else {
                this.showToast(json.message);
            }
        } catch (e) {
            console.error('Gacha error:', e);
            this.showToast('Server Error');
        } finally {
            this.isPulling = false;
        }
    }

    _buildDropRateModal() {
        this.dropRateModal = this.add.container(0, 0).setDepth(150).setVisible(false);

        const backdrop = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.9).setInteractive();

        const titleBg = this.add.rectangle(CX, 80, W, 60, 0x0f172a).setStrokeStyle(1, THEME.BORDER);
        const title = this.add.text(CX, 80, 'DROP RATES', {
            fontSize: '18px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#ffffff', letterSpacing: 2
        }).setOrigin(0.5);

        const closeBtn = this.add.circle(W - 40, 80, 15, THEME.PANEL).setStrokeStyle(1, THEME.BORDER).setInteractive({ useHandCursor: true });
        const closeTxt = this.add.text(W - 40, 80, 'X', { fontSize: '12px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
        closeBtn.on('pointerdown', () => this.dropRateModal.setVisible(false));

        // Scrollable Area Setup
        const listY = 120;
        const listH = H - 140; // Spacing for bottom

        // Buat mask untuk membatasi tampilan list
        const shape = this.make.graphics();
        shape.fillRect(0, listY, W, listH);
        const mask = shape.createGeometryMask();

        this.scrollContainer = this.add.container(0, listY);
        this.scrollContainer.setMask(mask);

        // Backdrop tak terlihat sebagai interaktif drag area (di dalam panel)
        const dragZone = this.add.rectangle(CX, listY + listH / 2, W, listH, 0x000000, 0).setInteractive();

        // Simple drag scroll logic
        this.input.setDraggable(dragZone);

        let startY = 0;
        dragZone.on('pointerdown', (pointer) => {
            startY = this.scrollContainer.y - pointer.y;
        });

        dragZone.on('pointermove', (pointer) => {
            if (pointer.isDown) {
                let newY = pointer.y + startY;
                // Clamp Y
                const contentHeight = this.scrollContentHeight || listH;
                const minY = listY - Math.max(0, contentHeight - listH + 20); // allow slight padding at bottom
                const maxY = listY;

                if (newY > maxY) newY = maxY;
                if (newY < minY) newY = minY;

                this.scrollContainer.y = newY;
            }
        });

        // Mouse wheel scroll support
        dragZone.on('wheel', (pointer, dx, dy) => {
            let newY = this.scrollContainer.y - dy;
            const contentHeight = this.scrollContentHeight || listH;
            const minY = listY - Math.max(0, contentHeight - listH + 20);
            const maxY = listY;

            if (newY > maxY) newY = maxY;
            if (newY < minY) newY = minY;

            this.scrollContainer.y = newY;
        });

        this.dropRateModal.add([backdrop, titleBg, title, closeBtn, closeTxt, dragZone, this.scrollContainer]);
    }

    populateDropRateList() {
        if (!this.bannerItems) return;

        // Bersihkan list sebelumnya
        this.scrollContainer.removeAll(true);
        let currY = 20;

        this.bannerItems.forEach((item) => {
            // Container per item
            const itemBox = this.add.container(40, currY);

            // Base frame (sama dengan di draw result)
            let frameColor = 0x334155;
            let strokeColor = 0x475569;

            if (item.mw_rarity === 'SSR') {
                frameColor = 0x7c2d12; strokeColor = 0xf59e0b;
            } else if (item.mw_rarity === 'SR') {
                frameColor = 0x4c1d95; strokeColor = 0xa78bfa;
            }

            // Image Container (Scale diperkecil sedikit agar muat di list)
            const rect = this.add.rectangle(0, 0, 60, 60, frameColor).setStrokeStyle(2, strokeColor).setOrigin(0);
            const placeholderImg = this.add.rectangle(5, 5, 50, 50, 0x1e293b).setOrigin(0);

            // Rarity
            const rarityBg = this.add.rectangle(30, 60, 60, 12, 0x0f172a).setOrigin(0.5, 1);
            const rarityColor = item.mw_rarity === 'SSR' ? '#fbbf24' : (item.mw_rarity === 'SR' ? '#403fffff' : '#53ff81ff');
            const rarityText = this.add.text(30, 54, item.mw_rarity, {
                fontSize: '9px', fontStyle: 'bold', fontFamily: 'Outfit', color: rarityColor
            }).setOrigin(0.5);

            // Nama Senjata Sejajar Horizontal
            const nameTxt = this.add.text(75, 15, item.mw_name, {
                fontSize: '14px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#ffffff'
            }).setOrigin(0, 0.5);

            // Drop Rate text
            const rateTxt = this.add.text(75, 35, `Drop Rate: ${item.drop_chance}%`, {
                fontSize: '11px', fontFamily: 'Outfit', color: THEME.TEXT_MUTED
            }).setOrigin(0, 0.5);

            // Divider line
            const divider = this.add.rectangle(-20, 75, W - 40, 1, THEME.BORDER).setOrigin(0);
            itemBox.add([rect, placeholderImg, rarityBg, rarityText, nameTxt, rateTxt, divider]);

            // Element Icon (Disesuaikan ukurannya agar pas di dalam lingkaran tanpa mask)
            const elKey = item.mw_element ? `element_${item.mw_element.toLowerCase()}` : null;

            if (elKey && this.textures.exists(elKey)) {
                const bgCircle = this.add.circle(60, 0, 7, 0x1e293b);
                const elementIcon = this.add.image(60, 0, elKey).setDisplaySize(11, 11);
                const strokeCircle = this.add.circle(60, 0, 7).setStrokeStyle(1.5, 0xffffff);
                itemBox.add([bgCircle, elementIcon, strokeCircle]);
            } else {
                const elColors = { 'Fire': 0xef4444, 'Wind': 0x22c55e, 'Earth': 0xd97706 };
                const elColor = elColors[item.mw_element] || 0x94a3b8;
                const elementIcon = this.add.circle(60, 0, 7, elColor).setStrokeStyle(1.5, 0xffffff);
                itemBox.add(elementIcon);
            }

            this.scrollContainer.add(itemBox);

            currY += 90; // Spacing vertikal
        });

        this.scrollContentHeight = currY;
    }

    _buildResultModal() {
        this.resultContainer = this.add.container(0, 0).setDepth(100).setVisible(false);

        // Dim backdrop
        const backdrop = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.9).setInteractive();

        // Grid Container logic
        this.resultItemsGroup = this.add.group();

        // Title
        const title = this.add.text(CX, 100, 'SUMMON RESULT', {
            fontSize: '24px',
            fontStyle: 'bold',
            fontFamily: 'Outfit',
            color: '#fbbf24',
            letterSpacing: 4
        }).setOrigin(0.5);

        // Confirm Button
        const confirmBtn = this.add.rectangle(CX, H - 80, 200, 45, 0x2563eb).setInteractive({ useHandCursor: true });
        confirmBtn.setStrokeStyle(1, 0x3b82f6);
        const confirmTxt = this.add.text(CX, H - 80, 'CONFIRM', {
            fontSize: '14px', fontStyle: 'bold', fontFamily: 'Outfit'
        }).setOrigin(0.5);

        confirmBtn.on('pointerdown', () => {
            this.resultContainer.setVisible(false);
            this.updateUIData();
            // Start checking for new characters to show the secondary modal
            this.processNextNewCharacter();
        });

        this.resultContainer.add([backdrop, title, confirmBtn, confirmTxt]);
    }

    showResultModal(items) {
        // Clear previous grid items
        this.resultItemsGroup.clear(true, true);

        const isMulti = items.length > 1;

        let startX = isMulti ? CX - 130 : CX;
        let startY = isMulti ? 200 : H / 2 - 50;
        let spacingX = 90;
        let spacingY = 110;

        items.forEach((item, index) => {
            let row = isMulti ? Math.floor(index / 4) : 0;
            let col = isMulti ? index % 4 : 0;

            // If it's the last row of a 10x+1 (the 11th item), center it
            if (isMulti && index === 10) {
                row = 2;
                col = 1.5; // shift to center roughly
            }

            let x = startX + (col * spacingX);
            let y = startY + (row * spacingY);

            this.createResultItem(x, y, item);
        });

        this.resultContainer.setVisible(true);
        this.newCharactersQueue = items.filter(i => i.is_character_unlocked);
    }

    createResultItem(x, y, itemData) {
        const itemBox = this.add.container(x, y);

        // Base frame - Solid rounded color
        let frameColor = 0x334155;
        let strokeColor = 0x475569;

        if (itemData.rarity === 'SSR') {
            frameColor = 0x7c2d12;
            strokeColor = 0xf59e0b; // Gold
        } else if (itemData.rarity === 'SR') {
            frameColor = 0x4c1d95;
            strokeColor = 0xa78bfa; // Purple
        }

        const rect = this.add.rectangle(0, 0, 75, 75, frameColor).setStrokeStyle(2, strokeColor);

        // Placeholder item shape
        const placeholderImg = this.add.rectangle(0, 0, 50, 50, 0x1e293b);

        // Rarity text (Bottom Center)
        const rarityBg = this.add.rectangle(0, 37, 75, 14, 0x0f172a);
        const rarityColor = itemData.rarity === 'SSR' ? '#fbbf24' : (itemData.rarity === 'SR' ? '#c084fc' : '#94a3b8');
        const rarityText = this.add.text(0, 37, itemData.rarity, {
            fontSize: '10px', fontStyle: 'bold', fontFamily: 'Outfit', color: rarityColor
        }).setOrigin(0.5);

        itemBox.add([rect, placeholderImg, rarityBg, rarityText]);

        // Element Icon (Disesuaikan ukurannya agar pas di dalam lingkaran tanpa mask)
        const elKey = itemData.element ? `element_${itemData.element.toLowerCase()}` : null;

        if (elKey && this.textures.exists(elKey)) {
            const bgCircle = this.add.circle(37, -37, 9, 0x1e293b);
            const iconImg = this.add.image(37, -37, elKey).setDisplaySize(14, 14);
            const strokeCircle = this.add.circle(37, -37, 9).setStrokeStyle(1.5, 0xffffff);
            itemBox.add([bgCircle, iconImg, strokeCircle]);
        } else {
            const elColors = { 'Fire': 0xef4444, 'Wind': 0x22c55e, 'Earth': 0xd97706 };
            const elColor = elColors[itemData.element] || 0x94a3b8;
            const elementCircle = this.add.circle(37, -37, 9, elColor).setStrokeStyle(1.5, 0xffffff);
            itemBox.add(elementCircle);
        }

        // Gold Badge for New Character
        if (itemData.is_character_unlocked) {
            const badgeBg = this.add.rectangle(0, -37, 50, 14, 0xf59e0b).setStrokeStyle(1, 0xffffff);
            const badgeTxt = this.add.text(0, -37, 'NEW', {
                fontSize: '9px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#000000'
            }).setOrigin(0.5);
            itemBox.add([badgeBg, badgeTxt]);
        }

        // Convert Duplicates text? Optional, could clutter. Keeping clean.

        this.resultContainer.add(itemBox);
        this.resultItemsGroup.add(itemBox);
    }

    _buildNewCharacterModal() {
        this.newCharContainer = this.add.container(0, 0).setDepth(110).setVisible(false);

        const backdrop = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.95).setInteractive();

        const lightFx = this.add.circle(CX, H / 2 - 50, 150, 0xfbbf24, 0.2);

        const title = this.add.text(CX, H / 2 - 180, 'NEW CHARACTER UNLOCKED!', {
            fontSize: '18px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#fcd34d', letterSpacing: 2
        }).setOrigin(0.5);

        const charPlaceholder = this.add.rectangle(CX, H / 2 - 50, 120, 120, 0x1e293b).setStrokeStyle(2, 0xf59e0b);

        this.newCharName = this.add.text(CX, H / 2 + 30, 'Character Name', {
            fontSize: '16px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#ffffff'
        }).setOrigin(0.5);

        const okBtn = this.add.rectangle(CX, H / 2 + 100, 150, 40, 0xf59e0b).setInteractive({ useHandCursor: true });
        const okTxt = this.add.text(CX, H / 2 + 100, 'AWESOME', {
            fontSize: '12px', fontStyle: 'bold', fontFamily: 'Outfit', color: '#000000'
        }).setOrigin(0.5);

        okBtn.on('pointerdown', () => {
            this.newCharContainer.setVisible(false);
            this.processNextNewCharacter();
        });

        this.newCharContainer.add([backdrop, lightFx, title, charPlaceholder, this.newCharName, okBtn, okTxt]);
    }

    processNextNewCharacter() {
        if (!this.newCharactersQueue || this.newCharactersQueue.length === 0) return;

        const nextChar = this.newCharactersQueue.shift();

        // Tampilkan modal karakter baru
        this.newCharName.setText(nextChar.name);
        this.newCharContainer.setVisible(true);
    }

    showToast(msg) {
        const toast = this.add.text(CX, H - 150, msg, {
            fontSize: '12px',
            fontFamily: 'Outfit',
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setDepth(200);

        this.time.delayedCall(2000, () => {
            this.tweens.add({
                targets: toast, alpha: 0, duration: 500,
                onComplete: () => toast.destroy()
            });
        });
    }

    // --- Header Menu Modal Implementation ---
    _buildMenuModal() {
        this.menuContainer = this.add.container(0, 0).setDepth(195).setVisible(false);

        const sysW = this.scale.width;
        const sysH = this.scale.height;
        const backdrop = this.add.rectangle(sysW / 2, sysH / 2, sysW, sysH, 0x000000, 0.75).setInteractive();
        backdrop.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
            if (pointer.y > 420) {
                this.toggleMenuModal(false);
            }
        });

        const panel = this.add.rectangle(CX, 210, W, 420, 0x0a0f1d).setInteractive();
        panel.setStrokeStyle(1, THEME.BORDER);
        panel.on('pointerdown', (pointer, localX, localY, event) => { event.stopPropagation(); });

        const header = this.add.text(CX, 30, 'MENU & SETTINGS', {
            fontSize: '14px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY, letterSpacing: 2
        }).setOrigin(0.5);

        const divider = this.add.rectangle(CX, 60, W, 1, THEME.BORDER);

        const s1Label = this.add.text(CX, 85, 'QUICK NAVIGATION', {
            fontSize: '9px', fontFamily: 'Outfit', color: THEME.TEXT_SECONDARY, letterSpacing: 1
        }).setOrigin(0.5);

        const btnParty = this._createModalRoundBtn(CX - 100, 125, 'PARTY', () => {
            this.toggleMenuModal(false);
            this.scene.start('LoadingScene', { targetScene: 'PartyScene' });
        });
        const btnQuest = this._createModalRoundBtn(CX, 125, 'QUEST', () => {
            this.toggleMenuModal(false);
            this.scene.start('LoadingScene', { targetScene: 'QuestScene' });
        });
        const btnGacha = this._createModalRoundBtn(CX + 100, 125, 'GACHA', () => {
            this.toggleMenuModal(false);
        });

        const s2Label = this.add.text(CX, 185, 'ITEMS & MARKET', {
            fontSize: '9px', fontFamily: 'Outfit', color: THEME.TEXT_SECONDARY, letterSpacing: 1
        }).setOrigin(0.5);

        const btnInventory = this._createModalRectBtn(CX - 90, 215, 160, 30, 'INVENTORY', () => {
            this.toggleMenuModal(false);
            this.scene.start('LoadingScene', { targetScene: 'InventoryScene' });
        });
        const btnShop = this._createModalRectBtn(CX + 90, 215, 160, 30, 'SHOP', () => { });

        const s3Label = this.add.text(CX, 270, 'AUDIO SETTINGS', {
            fontSize: '9px', fontFamily: 'Outfit', color: THEME.TEXT_SECONDARY, letterSpacing: 1
        }).setOrigin(0.5);

        this.musicBtn = this._createModalRectBtn(CX - 90, 300, 160, 30, '', () => this.toggleMusic());
        this.musicTxt = this.add.text(CX - 90, 300, '', { fontSize: '10px', fontStyle: 'bold', fontFamily: 'Outfit' }).setOrigin(0.5);

        this.sfxBtn = this._createModalRectBtn(CX + 90, 300, 160, 30, '', () => this.toggleSfx());
        this.sfxTxt = this.add.text(CX + 90, 300, '', { fontSize: '10px', fontStyle: 'bold', fontFamily: 'Outfit' }).setOrigin(0.5);

        // Load Audio prefs
        this.musicOn = localStorage.getItem('music_on') !== 'false';
        this.sfxOn = localStorage.getItem('sfx_on') !== 'false';
        this.updateAudioButtonVisuals();

        const btnLogout = this._createModalRectBtn(CX, 360, 340, 32, 'LOGOUT', () => {
            this.showLogoutConfirmation();
        }, 0x7f1d1d, 0xef4444);

        const closeBtnCircle = this.add.circle(W - 40, 30, 18, THEME.PANEL, THEME.PANEL_ALPHA);
        closeBtnCircle.setStrokeStyle(1, THEME.BORDER);
        closeBtnCircle.setInteractive({ useHandCursor: true });
        const closeBtnText = this.add.text(W - 40, 30, 'CLOSE', {
            fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY
        }).setOrigin(0.5);

        closeBtnCircle.on('pointerover', () => { closeBtnCircle.setFillStyle(0x334155); closeBtnText.setColor('#ffffff'); });
        closeBtnCircle.on('pointerout', () => { closeBtnCircle.setFillStyle(THEME.PANEL); closeBtnText.setColor(THEME.TEXT_PRIMARY); });
        closeBtnCircle.on('pointerdown', () => { this.toggleMenuModal(false); });

        this.menuContainer.add([
            backdrop, panel, header, divider,
            s1Label, btnParty.circle, btnParty.text, btnQuest.circle, btnQuest.text, btnGacha.circle, btnGacha.text,
            s2Label, btnInventory.rect, btnInventory.text, btnShop.rect, btnShop.text,
            s3Label, this.musicBtn.rect, this.musicTxt, this.sfxBtn.rect, this.sfxTxt,
            btnLogout.rect, btnLogout.text, closeBtnCircle, closeBtnText
        ]);

        // Confirmation Dialog
        this.confirmContainer = this.add.container(0, 0).setDepth(200).setVisible(false);

        const cBackdrop = this.add.rectangle(sysW / 2, sysH / 2, sysW, sysH, 0x000000, 0.8).setInteractive();
        cBackdrop.on('pointerdown', (pointer, localX, localY, event) => event.stopPropagation());

        const cPanel = this.add.rectangle(CX, H / 2, 300, 150, 0x0d1425).setInteractive();
        cPanel.setStrokeStyle(2, 0xe74c3c);
        cPanel.on('pointerdown', (pointer, localX, localY, event) => event.stopPropagation());

        const cText = this.add.text(CX, H / 2 - 25, 'Apakah Anda yakin ingin logout?', {
            fontSize: '12px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY, align: 'center', wordWrap: { width: 260 }
        }).setOrigin(0.5);

        const btnYesObj = this._createModalRectBtn(CX - 65, H / 2 + 30, 100, 32, 'LOGOUT', () => {
            clearSession(this);
        }, 0x7f1d1d, 0xef4444);

        const btnNoObj = this._createModalRectBtn(CX + 65, H / 2 + 30, 100, 32, 'BATAL', () => {
            this.confirmContainer.setVisible(false);
        }, THEME.PANEL, THEME.BORDER);

        this.confirmContainer.add([cBackdrop, cPanel, cText, btnYesObj.rect, btnYesObj.text, btnNoObj.rect, btnNoObj.text]);
    }

    _createModalRoundBtn(x, y, label, onClick) {
        const circle = this.add.circle(x, y, 22, THEME.PANEL);
        circle.setStrokeStyle(1, THEME.BORDER);
        circle.setInteractive({ useHandCursor: true });
        const text = this.add.text(x, y, label, { fontSize: '8px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        circle.on('pointerover', () => circle.setFillStyle(0x334155));
        circle.on('pointerout', () => circle.setFillStyle(THEME.PANEL));
        circle.on('pointerdown', onClick);
        return { circle, text };
    }

    _createModalRectBtn(x, y, w, h, label, onClick, bgColor = THEME.PANEL, borderColor = THEME.BORDER) {
        const rect = this.add.rectangle(x, y, w, h, bgColor);
        rect.setStrokeStyle(1, borderColor);
        rect.setInteractive({ useHandCursor: true });
        const text = this.add.text(x, y, label, { fontSize: '10px', fontStyle: 'bold', fontFamily: 'Outfit', color: THEME.TEXT_PRIMARY }).setOrigin(0.5);
        rect.on('pointerover', () => rect.setFillStyle(0x334155));
        rect.on('pointerout', () => rect.setFillStyle(bgColor));
        rect.on('pointerdown', onClick);
        return { rect, text };
    }

    toggleMenuModal(show) {
        this.menuContainer.setVisible(show);
        if (show) this.updateAudioButtonVisuals();
    }

    toggleMusic() {
        this.musicOn = !this.musicOn;
        localStorage.setItem('music_on', this.musicOn);
        this.updateAudioButtonVisuals();
        this.sound.mute = !this.musicOn && !this.sfxOn;
    }

    toggleSfx() {
        this.sfxOn = !this.sfxOn;
        localStorage.setItem('sfx_on', this.sfxOn);
        this.updateAudioButtonVisuals();
        this.sound.mute = !this.musicOn && !this.sfxOn;
    }

    updateAudioButtonVisuals() {
        if (!this.musicBtn || !this.sfxBtn) return;
        this.musicBtn.rect.setFillStyle(this.musicOn ? 0x0d2a1a : 0x2a0d0d);
        this.musicBtn.rect.setStrokeStyle(1, this.musicOn ? 0x2ecc71 : 0xe74c3c);
        this.musicTxt.setText(`MUSIC: ${this.musicOn ? 'ON' : 'OFF'}`).setColor(this.musicOn ? '#a8e6cf' : '#ff8a80');

        this.sfxBtn.rect.setFillStyle(this.sfxOn ? 0x0d2a1a : 0x2a0d0d);
        this.sfxBtn.rect.setStrokeStyle(1, this.sfxOn ? 0x2ecc71 : 0xe74c3c);
        this.sfxTxt.setText(`SFX: ${this.sfxOn ? 'ON' : 'OFF'}`).setColor(this.sfxOn ? '#a8e6cf' : '#ff8a80');
    }

    showLogoutConfirmation() {
        this.confirmContainer.setVisible(true);
    }
}
