export class CameraScrollManager {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} contentHeight - Total height of the scrollable content
     */
    static enable(scene, contentHeight) {
        const W = scene.cameras.main.width;
        const H = scene.cameras.main.height; // 800
        
        // Atur batas kamera sesuai konten
        // Lebar tetap statis (W), tinggi menyesuaikan konten dengan minimum tinggi layar.
        const maxH = Math.max(H, contentHeight);
        scene.cameras.main.setBounds(0, 0, W, maxH);
        
        let isDragging = false;
        let startY = 0;
        let startScrollY = 0;
        
        scene.input.on('pointerdown', (pointer) => {
            isDragging = true;
            startY = pointer.y;
            startScrollY = scene.cameras.main.scrollY;
        });
        
        scene.input.on('pointermove', (pointer) => {
            if (!isDragging) return;
            
            const dy = pointer.y - startY;
            scene.cameras.main.scrollY = startScrollY - dy;
            
            // Jika pointer bergerak jauh, beri tanda hasMoved untuk membatalkan event click
            if (Math.abs(dy) > 10) {
                pointer.hasMoved = true;
            }
        });
        
        const endDrag = (pointer) => {
            isDragging = false;
        };
        
        scene.input.on('pointerup', endDrag);
        scene.input.on('pointerupoutside', endDrag);
        
        // Native mouse wheel support
        scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            scene.cameras.main.scrollY += deltaY;
        });

        // HACK: Cegah event click / tap pada UI Phaser (GameObjects) jika pengguna sebenarnya sedang nge-drag/scroll
        // Kita manfaatkan sistem event native manager dari Phaser
        if (!scene.input._isScrollPatched) {
            const originalProcess = scene.input.processUpEvents;
            scene.input.processUpEvents = function(pointer) {
                if (pointer.hasMoved) {
                    // Batalkan interaksi dengan cara tidak meneruskan event click ke target
                    pointer.hasMoved = false; 
                    return; // Mencegah pointer up memicu on('pointerdown/up') pada GameObject
                }
                return originalProcess.call(this, pointer);
            };
            scene.input._isScrollPatched = true;
        }
    }
}
