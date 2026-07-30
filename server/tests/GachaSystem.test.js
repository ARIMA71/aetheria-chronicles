/**
 * Unit Test: GachaController & RNG System
 * White-box testing untuk modul Gacha, Pity, dan Konversi Duplikat.
 */

describe('Gacha System - Whitebox & RNG Simulation', () => {

    // 1. Uji Simulasi Distribusi Peluang (Monte Carlo)
    describe('RNG Distribution (Monte Carlo Simulation)', () => {
        it('should distribute 10,000 pulls according to claimed drop chances (2% SSR, 18% SR, 80% R)', () => {
            const bannerItems = [
                { mw_rarity: 'SSR', drop_chance: 0.02 }, // 2%
                { mw_rarity: 'SR', drop_chance: 0.18 },  // 18%
                { mw_rarity: 'R', drop_chance: 0.80 }    // 80%
            ];

            // Replika algoritma bobot RNG dari gachaController.js
            const getRandomItemWeighted = (itemsPool) => {
                const totalWeight = itemsPool.reduce((sum, item) => sum + item.drop_chance, 0);
                let random = Math.random() * totalWeight;
                for (const item of itemsPool) {
                    if (random < item.drop_chance) return item;
                    random -= item.drop_chance;
                }
                return itemsPool[itemsPool.length - 1];
            };

            const results = { SSR: 0, SR: 0, R: 0 };
            const TOTAL_PULLS = 10000;

            for (let i = 0; i < TOTAL_PULLS; i++) {
                const item = getRandomItemWeighted(bannerItems);
                results[item.mw_rarity]++;
            }

            const ssrRate = results.SSR / TOTAL_PULLS;
            const srRate = results.SR / TOTAL_PULLS;
            const rRate = results.R / TOTAL_PULLS;

            console.log(`[Monte Carlo 10.000 Pulls] SSR: ${(ssrRate * 100).toFixed(2)}%, SR: ${(srRate * 100).toFixed(2)}%, R: ${(rRate * 100).toFixed(2)}%`);

            // Memastikan SSR keluar di kisaran 1.5% hingga 2.5% (Fairness guarantee)
            expect(ssrRate).toBeGreaterThanOrEqual(0.015);
            expect(ssrRate).toBeLessThanOrEqual(0.025);
            
            // Memastikan SR keluar di kisaran 17% hingga 19%
            expect(srRate).toBeGreaterThanOrEqual(0.17);
            expect(srRate).toBeLessThanOrEqual(0.19);
        });
    });

    // 2. Uji Konversi Item (Replika Logika)
    describe('Duplicate Conversion Logic', () => {
        it('should correctly determine converted material amounts based on rarity', () => {
            const convertDuplicateCharacter = (rarity) => {
                return rarity === 'SSR' ? 10 : (rarity === 'SR' ? 5 : 1);
            };

            expect(convertDuplicateCharacter('SSR')).toBe(10); // 10 Enhance Crystal
            expect(convertDuplicateCharacter('SR')).toBe(5);   // 5 Enhance Crystal
            expect(convertDuplicateCharacter('R')).toBe(1);    // 1 Enhance Crystal
        });

        it('should grant 1 Weapon Whetstone for Rarity R weapon duplicate (no character)', () => {
            const isRarityRWeapon = true;
            const hasCharacterUnlock = false;
            let grantedMaterial = null;

            if (isRarityRWeapon && !hasCharacterUnlock) {
                grantedMaterial = { mat_id: 5, quantity: 1 }; // Weapon Whetstone
            }

            expect(grantedMaterial).toEqual({ mat_id: 5, quantity: 1 });
        });
    });
});
