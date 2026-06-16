const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'aetheria_chronicles_secret_2025';
const JWT_EXPIRES = '7d'; // Token berlaku 7 hari

// ============================================================
// POST /api/auth/register
// Body: { username, password, gender? }
// ============================================================
exports.register = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            status: 'error',
            message: 'Username dan password wajib diisi.'
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            status: 'error',
            message: 'Password minimal 6 karakter.'
        });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // --------------------------------------------------
        // Cek duplikat username — Parameterized Query
        // --------------------------------------------------
        const [existing] = await conn.query(
            'SELECT player_id FROM players WHERE username = ?',
            [username]
        );
        if (existing.length > 0) {
            await conn.rollback();
            conn.release();
            return res.status(409).json({
                status: 'error',
                message: 'Username sudah digunakan. Silakan pilih yang lain.'
            });
        }

        // --------------------------------------------------
        // [KEAMANAN 1] Hash password dengan bcrypt
        // --------------------------------------------------
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // --------------------------------------------------
        // Langkah A: Insert ke tabel players — Parameterized Query
        // --------------------------------------------------
        const [playerResult] = await conn.query(
            `INSERT INTO players (username, password_hash, player_level, player_exp, stamina, currency)
             VALUES (?, ?, 1, 0, 100, 0)`,
            [username, passwordHash]
        );
        const newPlayerId = playerResult.insertId;

        // --------------------------------------------------
        // Langkah B: Inventory Awal (MC + Agris + Ember Blade) — Parameterized Query
        // --------------------------------------------------
        const inventoryItems = [
            [newPlayerId, 1, 'Character', 1, 0, 0], // Main Character (mc_id: 1)
            [newPlayerId, 8, 'Character', 1, 0, 0], // Agris (mc_id: 8)
            [newPlayerId, 22, 'Weapon', 1, 0, 0], // Ember Blade (mw_id: 22)
        ];

        const invIds = [];
        for (const item of inventoryItems) {
            const [invResult] = await conn.query(
                `INSERT INTO player_inventories
                    (player_id, master_item_id, item_type, item_level, limit_break_level, item_exp)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                item
            );
            invIds.push(invResult.insertId);
        }

        const [mcInvId, agrisInvId, emberBladeInvId] = invIds;

        // --------------------------------------------------
        // Langkah C: Party Preset Slot 1 — Parameterized Query
        // --------------------------------------------------
        const [presetResult] = await conn.query(
            `INSERT INTO player_party_presets
                (player_id, preset_slot, main_char_inv_id, char_slot_1_inv_id, weap_grid_1_inv_id)
             VALUES (?, 1, ?, ?, ?)`,
            [newPlayerId, mcInvId, agrisInvId, emberBladeInvId]
        );
        const newPppId = presetResult.insertId;

        // --------------------------------------------------
        // Langkah D: MC Default Skills (ms_id 1–4) — Parameterized Query
        // --------------------------------------------------
        const defaultSkills = [
            [newPppId, 1, 1], // Slot 1 → ms_id 1 (Inspire)
            [newPppId, 2, 2], // Slot 2 → ms_id 2
            [newPppId, 3, 3], // Slot 3 → ms_id 3
            [newPppId, 4, 4], // Slot 4 → ms_id 4
        ];
        for (const skill of defaultSkills) {
            await conn.query(
                'INSERT INTO player_mc_skills (ppp_id, slot_number, ms_id) VALUES (?, ?, ?)',
                skill
            );
        }

        // --------------------------------------------------
        // Langkah E: Starter Material — 3x Green Potion (mat_id: 6)
        // --------------------------------------------------
        await conn.query(
            `INSERT INTO player_materials (player_id, mat_id, quantity)
             VALUES (?, 6, 3)
             ON DUPLICATE KEY UPDATE quantity = quantity + 3`,
            [newPlayerId]
        );

        await conn.commit();
        conn.release();

        return res.status(201).json({
            status: 'success',
            message: `Akun berhasil dibuat! Selamat datang, ${username}!`,
            data: {
                player_id: newPlayerId,
                username,
                player_level: 1,
                stamina: 100,
                gold: 0,
                diamond: 0,
                currency: 0
            }
        });

    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error('[authController.register] Error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan pada server saat membuat akun.',
            error_detail: error.message
        });
    }
};

// ============================================================
// POST /api/auth/login
// Body: { username, password }
// ============================================================
exports.login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            status: 'error',
            message: 'Username dan password wajib diisi.'
        });
    }

    try {
        // [KEAMANAN 2] Parameterized Query — tidak ada interpolasi string
        const [rows] = await db.query(
            `SELECT player_id, username, password_hash, player_level, player_exp, stamina, gold, diamond, currency
             FROM players
             WHERE username = ?`,
            [username]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Username tidak ditemukan.'
            });
        }

        const player = rows[0];

        // [KEAMANAN 1] Verifikasi password dengan bcrypt.compare
        let isPasswordValid = await bcrypt.compare(password, player.password_hash);
        if (!isPasswordValid) {
            // Fallback untuk password plain-text dari SQL dump (misal: 'hash123', 'pass123')
            isPasswordValid = (password === player.password_hash);
        }
        
        if (!isPasswordValid) {
            return res.status(401).json({
                status: 'error',
                message: 'Password salah.'
            });
        }

        // [KEAMANAN 3] Buat JWT token
        const token = jwt.sign(
            { player_id: player.player_id, username: player.username },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        return res.status(200).json({
            status: 'success',
            message: `Selamat datang kembali, ${player.username}!`,
            token,
            data: {
                player_id: player.player_id,
                username: player.username,
                player_level: player.player_level,
                stamina: player.stamina,
                gold: player.gold,
                diamond: player.diamond,
                currency: player.currency
            }
        });

    } catch (error) {
        console.error('[authController.login] Error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan pada server saat login.',
            error_detail: error.message
        });
    }
};