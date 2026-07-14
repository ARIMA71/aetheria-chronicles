async function testGacha() {
    try {
        console.log('--- Testing 1x Pull ---');
        const res1 = await fetch('http://localhost:3000/api/gacha/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerId: 1, // Asumsi playerId 1 ada dan punya diamond
                drawType: '1x',
                elementPool: 'All'
            })
        });
        const data1 = await res1.json();
        console.log('1x Pull Result:', JSON.stringify(data1, null, 2));

        if (data1.status === 'success') {
            console.log('1x Pull successful. Pity counter:', data1.data.pity_counter);
        }

        console.log('\n--- Testing 10x+1 Pull ---');
        const res10 = await fetch('http://localhost:3000/api/gacha/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerId: 1,
                drawType: '10x+1',
                elementPool: 'Fire'
            })
        });
        const data10 = await res10.json();
        console.log('10x+1 Pull Result (Snippet):', data10.status === 'success' ? 
            `Success! Items pulled: ${data10.data.pulled_items.length}. New Diamond Balance: ${data10.data.new_diamond_balance}, Pity Counter: ${data10.data.pity_counter}` : 
            data10);

        if (data10.status === 'success') {
            const ssrCount = data10.data.pulled_items.filter(i => i.rarity === 'SSR').length;
            const duplicateChars = data10.data.pulled_items.filter(i => i.is_character_duplicate).length;
            console.log(`- SSR Items obtained: ${ssrCount}`);
            console.log(`- Character Duplicate Conversions: ${duplicateChars}`);
        }
    } catch (e) {
        console.error('Error during test:', e);
    }
}

testGacha();
