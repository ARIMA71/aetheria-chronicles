export const BGM_GROUPS = {
    'main_menu': ['bgm_mainmenu_1', 'bgm_mainmenu_2']
};

let currentIdentifier = null;
let currentBGM = null;
let playlistIndex = 0;

export function playGlobalBGM(scene, identifier) {
    const isMusicOn = localStorage.getItem('music_on') !== 'false';

    // Jika identifier (kunci/grup) yang sama sedang dimainkan, jangan restart
    if (currentIdentifier === identifier && currentBGM && currentBGM.isPlaying) {
        currentBGM.setMute(!isMusicOn);
        return; 
    }

    // Hentikan BGM sebelumnya jika ada
    if (currentBGM) {
        try {
            currentBGM.stop();
        } catch (e) {
            // Abaikan error jika objek sound sudah dihancurkan oleh Phaser
        }
        currentBGM = null;
    }

    currentIdentifier = identifier;
    
    // Cek apakah ini playlist atau lagu tunggal
    const isPlaylist = BGM_GROUPS[identifier] !== undefined;
    
    if (isPlaylist) {
        playlistIndex = 0; // Mulai dari awal grup
        _playPlaylist(scene, identifier, isMusicOn);
    } else {
        // Lagu tunggal
        if (scene.cache.audio.exists(identifier)) {
            currentBGM = scene.sound.add(identifier, { loop: true, volume: 0.4 });
            currentBGM.setMute(!isMusicOn);
            currentBGM.play();
        }
    }
}

function _playPlaylist(scene, groupName, isMusicOn) {
    const playlist = BGM_GROUPS[groupName];
    if (!playlist || playlist.length === 0) return;

    const trackKey = playlist[playlistIndex];
    if (scene.cache.audio.exists(trackKey)) {
        currentBGM = scene.sound.add(trackKey, { loop: false, volume: 0.4 });
        currentBGM.setMute(!isMusicOn);
        currentBGM.play();

        // Gunakan once untuk menghindari tumpukan listener
        currentBGM.once('complete', () => {
            // Cek apakah kita masih di grup yang sama saat lagu selesai
            if (currentIdentifier === groupName) {
                playlistIndex = (playlistIndex + 1) % playlist.length;
                _playPlaylist(scene, groupName, localStorage.getItem('music_on') !== 'false');
            }
        });
    } else {
        // Jika track di playlist tidak ada di cache, coba putar track pertama (fallback) atau lompati
        console.warn(`[AudioManager] Playlist track ${trackKey} not found in cache.`);
    }
}

export function updateMuteState(scene) {
    const isMusicOn = localStorage.getItem('music_on') !== 'false';
    if (currentBGM) {
        currentBGM.setMute(!isMusicOn);
    }
}

export function stopGlobalBGM() {
    if (currentBGM) {
        currentBGM.stop();
        currentBGM = null;
    }
    currentIdentifier = null;
}

window.AetheriaAudioManager = { playGlobalBGM, updateMuteState, stopGlobalBGM };
