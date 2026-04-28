# GEMINI.md — Aetheria Chronicles

Catatan penting: File ini adalah panduan utama (Context File) untuk AI Assistant (Gemini/Antigravity) dalam mengembangkan Aetheria Chronicles. Selalu baca file ini sebelum mengeksekusi instruksi dari pengguna.


## 1. Project Overview

- **Name** : Aetheria Chronicles
- **Description** : Game Turn-based RPG berbasis Web dengan sistem elemen (Fire, Wind, Earth), Gacha, dan AI Musuh yang adaptif menggunakan Behavior Tree & Utility Scoring.
- **Goal** : Membangun ekosistem fullstack (rancang bangun) sebagai produk Tugas Akhir (Skripsi) menggunakan metode Extreme Programming (XP).
- **Target Users**: Penguji Skripsi, Dosen Pembimbing, dan Pemain Web RPG.
- **Status** : Active development (Fase 1 - Core Battle Loop).

---

## 2. Tech Stack

- **Backend / API** : Node.js dengan framework Express.js
- **Frontend / Engine** : Phaser 3 (Vanilla JavaScript)
- **Database** : MySQL (Charset: utf8mb4, Collation: utf8mb4_general_ci)
- **Database Driver** : `mysql2` dengan format Promise
- **Styling UI Web** : CSS Murni (untuk web pembungkus, jika ada)
- **Package Manager** : npm

---

## 3. Project Structure

Architecture: Monorepo dengan pemisahan Frontend (Client) dan Backend (Server) berbasis pola MVC pada server.

```text
aetheria-chronicles/
  client/             # FRONTEND (Phaser 3)
    assets/           # Gambar, audio, sprites
    src/              # File logika Phaser (Scenes, GameObjects)
    index.html        # Entry point browser
  server/             # BACKEND (Node.js/Express)
    config/           # Koneksi DB (db.js)
    controllers/      # Logika bisnis dan Query SQL (battleController.js, dll)
    routes/           # Definisi endpoint API (index.js, battleRoutes.js)
    app.js            # Pintu masuk utama API
  Tables db_aetheria.sql # Skema Database Suci


## 4. Naming Conventions

Database (Tabel & Kolom) : snake_case (contoh: master_characters, mc_base_hp). HARUS sesuai dengan Tables db_aetheria.sql.

Backend Controllers/Routes: camelCase (contoh: battleController.js, initBattle).

Phaser Scenes : PascalCase (contoh: BattleScene.js, BootScene.js).

Variabel & Fungsi : camelCase (contoh: fetchBattleData, playerParty).

## 5. Code & Architecture Conventions

Backend (Node.js/Express)
Strict MVC: Pintu masuk utama selalu server/app.js yang meneruskan ke server/routes/index.js. Jangan menumpuk rute di app.js.

Async/Await: Selalu gunakan async/await dengan blok try-catch untuk setiap fungsi controller.

Parallel Execution: Gunakan Promise.all() jika melakukan multiple query ke database yang tidak saling bergantung.

Frontend (Phaser 3)
Gunakan struktur standar Phaser Scene (preload, create, update).

Jangan buat animasi visual (VFX/Sprite) sebelum logika "Kotak dan Teks" (Vertical Slice/Walking Skeleton) berjalan sempurna.

## 6. API & Data Fetching Rules

Format Response Wajib: Seluruh balasan API (Response) HARUS dikembalikan menggunakan standar JSON ini:

JSON
{
  "status": "success" | "error",
  "message": "Pesan deskriptif di sini",
  "data": { ... } // Payload data utama
}
Status Code: Gunakan status code HTTP yang tepat (200 untuk OK, 400 untuk Bad Request, 404 untuk Not Found, 500 untuk Server Error).

## 7. Features Roadmap (Extreme Programming)

[x] Fase 0: Setup Environment & Database Schema.

[x] Fase 1.1: Backend API initBattle (Party & Enemy Data Fetching).

[ ] Fase 1.2: Frontend Phaser Integration (Menampilkan kotak & teks data di layar).

[ ] Fase 1.3: Core Battle Loop (Tombol Attack berfungsi, HP musuh berkurang).

[ ] Fase 2: AI Musuh (Implementasi Behavior Tree & Utility Score).

[ ] Fase 3: Persistensi Data (Login, Save Battle Result).

[ ] Fase 4: Gacha System & Polishing UI/UX.

## 8. 🚨 DO NOT (ATURAN MUTLAK) 🚨

Jika instruksi ambigu, TANYA DULU. Jangan berasumsi.

Database Strictness: JANGAN PERNAH berasumsi atau mengarang nama tabel dan kolom SQL. Selalu merujuk dan baca file @Tables db_aetheria.sql.

No Hallucination: Jika tabel tidak memiliki kolom tertentu (misal: UI visual), beri tahu developer untuk melakukan ALTER TABLE, jangan diam-diam membuat query dengan kolom fiktif.

No Frontend Over-engineering: Jangan berikan kode Phaser yang menggunakan load.image atau Sprite jika developer tidak memintanya. Gunakan Phaser.GameObjects.Rectangle dan Text sebagai placeholder awal.

JANGAN merubah struktur routes dan controllers yang sudah mapan tanpa konfirmasi.