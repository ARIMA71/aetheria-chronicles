# Rangkuman Perombakan Total Mekanisme Battle (Aetheria Chronicles)

Dokumen ini merangkum seluruh transisi arsitektur, mekanisme, serta perombakan kode yang dilakukan sejak awal kita memutuskan untuk beralih ke **Mekanisme Pertarungan Berbasis Giliran (Turn-Based) Taktis**, di mana setiap karakter hanya diperbolehkan melakukan **1 aksi per giliran (Turn)**. 

Perubahan ini tidak hanya menyentuh aspek UI/UX, tetapi merombak total pondasi komunikasi antara *Client* (Frontend) dan *Server* (Backend).

---

## 1. Konsep Inti & Mekanisme Pertarungan (Dulu vs Sekarang)

### Konsep Lama (Sebelum Perombakan):
* **Sistem Aksi Bebas / Tidak Terstruktur:** Eksekusi aksi mungkin belum dibatasi secara ketat per giliran. Pemain bisa melakukan aksi secara *real-time* atau bertumpuk.
* **Client-Authoritative (Rentan Curang):** Kalkulasi *damage*, *cooldown*, dan pengurangan HP musuh seringkali ditangani oleh *Frontend* (Phaser), lalu dikirim ke *database* untuk disimpan. Ini sangat rentan diretas (*cheat*).
* **AI Musuh Statis:** Musuh mungkin hanya menyerang secara acak tanpa adanya bobot prioritas (Utility Scoring) atau fase *Enrage/Exhausted* yang dinamis.
* **UI Responsif namun Independen:** UI bertindak berdasarkan kalkulasi lokalnya sendiri, sering menyebabkan *desync* (tidak sinkron) antara data visual dengan data asli di *database*.

### Konsep Baru (Sistem Antrean 1-Aksi Per Turn):
* **Strict Turn-Based (1 Aksi / Karakter):** Pemain harus merencanakan (*queue*) 1 aksi spesifik (Attack, Skill, Special, Potion, atau Skip) untuk masing-masing karakternya. Setelah semua karakter mendapatkan perintah (atau menekan tombol *Auto/Execute*), barulah giliran dieksekusi secara berbarengan.
* **Server-Authoritative (Anti-Cheat):** *Frontend* (Phaser) kini murni bertindak sebagai **"Proyektor Visual"**. Segala bentuk kalkulasi (*damage*, *critical hit*, durasi *buff*, *cooldown*, pergerakan AI musuh) diproses 100% di *Backend* (`BattleService.js`).
* **Sistem Playback Event:** Setelah *Backend* menghitung hasil dari satu giliran penuh (aksi pemain + aksi balasan musuh), *Backend* mengirimkan array `events` (logikal kejadian). *Frontend* kemudian membaca array tersebut satu per satu dan memutar animasinya secara sinematik (`_playActionEvents`).

---

## 2. Perubahan Fundamental di Sisi Backend (`server/`)

Sisi *Backend* mengalami perombakan arsitektur paling masif, di mana `BattleService.js` kini menjadi otak utama seluruh sistem game.

**[+] Yang Ditambahkan / Dibangun:**
1. **State Management di Memori (`BattleMemoryStore`):** State pertarungan aktif kini disimpan di RAM *server* (dan di-*backup* ke JSON database secara asinkron) agar proses baca-tulis kalkulasi berjalan sangat cepat di tiap detiknya tanpa membebani MySQL.
2. **Eksekusi Fase Pertarungan (Phase Resolution):** 
   - Backend memproses aksi pemain terlebih dahulu.
   - Kemudian mengeksekusi AI Musuh.
   - Mengkalkulasi efek *Damage-over-Time* (Poison/Burn) di akhir giliran.
   - Mengurangi durasi *Buff/Debuff* dan *Cooldown* skill.
   - Memeriksa transisi gelombang (*Wave Clear*).
3. **Smart Enemy AI (Behavior & Utility Scoring):** Musuh kini memiliki kecerdasan buatan berbasis *Utility Score*. Mereka bisa menargetkan karakter pemain dengan HP terendah, menargetkan *tank*, bertransisi otomatis ke mode *Enraged* jika HP menurun, atau menjadi *Exhausted* setelah mengeluarkan jurus pamungkas.
4. **Validasi Anti-Cheat Ketat:** Backend menolak perintah jika karakter mencoba menggunakan jurus saat sedang *Stun*, menggunakan *Skill* yang masih *Cooldown*, atau menyerang target yang sudah mati.
5. **Penanganan Wave Dinamis:** Struktur `quest_enemies` diekstrak berdasarkan kolom `wave_num`. Musuh dikelompokkan ke dalam array multi-dimensi `waves` untuk dipanggil secara sekuensial.

**[-] Yang Dikurangi / Dihapus:**
1. Endpoint API lama yang sifatnya memperbarui status HP/Damage secara eceran (*piecemeal*) dihapus, diganti dengan satu endpoint raksasa tunggal: `/battle/execute`.

---

## 3. Perubahan Fundamental di Sisi Frontend (`client/`)

Sisi *Frontend* (Phaser 3) dirombak dari mesin kalkulator menjadi mesin rendering sinematik yang reaktif.

**[+] Yang Ditambahkan / Dibangun:**
1. **Sistem Antrean Aksi (Action Queue UI):** Pemain kini menekan karakter, memilih aksi dari `BattleMenu.js`, dan aksi tersebut dimasukkan ke dalam keranjang antrean (dengan indikator visual ikon aksi melayang di sebelah pemain).
2. **Cinematic Event Player (`_playActionEvents`):** Ini adalah fungsi paling revolusioner. *Frontend* tidak lagi langsung memotong HP bar. Ia membaca *array of events* dari server (contoh: `{type: 'damage', value: 500, targetId: 'enemy_0'}`), lalu secara perlahan (delay + animasi *tween*) menggerakkan karakter, memunculkan angka *damage* (Floating Text), menggetarkan layar (*camera shake*), lalu baru memperbarui HP bar.
3. **Sinkronisasi State Murni (`_syncState`):** Di akhir putaran animasi, *Frontend* me-reset (*overwrite*) seluruh status, *cooldown*, *buff*, dan HP karakter agar 100% cocok dengan `stateSnapshot` dari server untuk mencegah *desync*.
4. **Enemy Status Modal & Smart Wave Counter:** Menyempurnakan UI agar Bar HP musuh dapat diklik untuk melihat detail *buff/debuff* (Status Modal). Ikon efek dipindahkan dengan rapi ke atas Bar HP, dan *Wave Counter* merender dirinya secara cerdas berdasarkan total gelombang yang dikirim *Backend*.
5. **Mode Otomatis (Auto Battle):** Tombol *Auto* yang mengisi perintah secara mandiri untuk karakter (menggunakan *Basic Attack* atau AI ringan di sisi *client* sebelum dikirim ke server).

**[-] Yang Dikurangi / Dihapus:**
1. **Kalkulator Lokal:** Semua fungsi seperti `calculateDamage()`, `checkCrit()`, dan pengurangan HP secara hardcode (contoh: `enemy.hp -= 100`) di dalam *file* Phaser telah dibabat habis.
2. **Efek Status yang Melayang Acak:** Tanggung jawab rendering efek status dicabut dari entitas individu (kelas `Enemy`) dan dipindahkan ke dalam *HUD Manager* (`battleScene.js`) agar UI statis dan rapi.

---

### Kesimpulan

Transisi ke **Strict Turn-Based System** dengan **Server-Authoritative Architecture** ini sukses mengubah *Aetheria Chronicles* dari sekadar *game* purwarupa menjadi sebuah ekosistem *RPG* standar industri yang aman dari manipulasi pemain, mudah diukur (*scalable*), dan memungkinkan integrasi mekanik yang sangat kompleks di masa depan (seperti gacha, leaderboard, atau PvP).
