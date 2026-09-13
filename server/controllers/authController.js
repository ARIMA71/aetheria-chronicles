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
    const { username, gender } = req.body;

    if (!username || !gender) {
        return res.status(400).json({
            status: 'error',
            message: 'Username dan gender wajib diisi.'
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
        // Langkah A: Insert ke tabel players (Guest Account)
        // --------------------------------------------------
        const [playerResult] = await conn.query(
            `INSERT INTO players (username, password_hash, gender, player_level, player_exp, stamina, gold, diamond, is_guest)
             VALUES (?, NULL, ?, 1, 0, 100, 0, 0, 1)`,
            [username, gender]
        );
        const newPlayerId = playerResult.insertId;

        // --------------------------------------------------
        // Langkah B: Inventory Awal (MC + Ember Blade mw_id: 22) — Parameterized Query
        // --------------------------------------------------
        const inventoryItems = [
            [newPlayerId, 1, 'Character', 1, 0, 0], // Main Character (mc_id: 1)
            [newPlayerId, 22, 'Weapon', 1, 0, 0],   // Ember Blade (mw_id: 22)
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

        const [mcInvId, emberBladeInvId] = invIds;

        // --------------------------------------------------
        // Langkah C: Party Preset Slot 1 — Parameterized Query (Party Kosong, Main Weapon: Ember Blade)
        // --------------------------------------------------
        const [presetResult] = await conn.query(
            `INSERT INTO player_party_presets
                (player_id, preset_slot, main_char_inv_id, char_slot_1_inv_id, weap_grid_1_inv_id)
             VALUES (?, 1, ?, NULL, ?)`,
            [newPlayerId, mcInvId, emberBladeInvId]
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

        // Buat JWT token
        const token = jwt.sign(
            { player_id: newPlayerId, username },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        return res.status(201).json({
            status: 'success',
            message: `Akun berhasil dibuat! Selamat datang, ${username}!`,
            token,
            data: {
                player_id: newPlayerId,
                username,
                player_level: 1,
                stamina: 100,
                gold: 0,
                diamond: 0,
                is_guest: 1
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
            `SELECT player_id, username, password_hash, gender, player_level, player_exp, stamina, gold, diamond, is_guest
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
        let isPasswordValid = false;
        try {
            isPasswordValid = await bcrypt.compare(password, player.password_hash);
        } catch (err) {
            // Jika hash tidak valid (karena plain-text dari SQL dump), biarkan false dan masuk ke fallback
            isPasswordValid = false;
        }

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
                gender: player.gender,
                player_level: player.player_level,
                player_exp: player.player_exp,
                stamina: player.stamina,
                max_stamina: Math.min(200, 50 + ((player.player_level - 1) * 5)),
                gold: player.gold,
                diamond: player.diamond,
                is_guest: player.is_guest
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

// ============================================================
// GET /api/auth/verify
// Headers: { Authorization: Bearer <token> }
// ============================================================
exports.verifyToken = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            status: 'error',
            message: 'Token tidak disediakan atau format salah.'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return res.status(200).json({
            status: 'success',
            message: 'Token valid.',
            data: decoded
        });
    } catch (error) {
        return res.status(401).json({
            status: 'error',
            message: 'Token tidak valid atau telah kedaluwarsa.',
            error_detail: error.message
        });
    }
};

// ============================================================
// POST /api/auth/bind-account
// Body: { password }
// Headers: { Authorization: Bearer <token> }
// ============================================================
exports.bindAccount = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            status: 'error',
            message: 'Token tidak disediakan atau format salah.'
        });
    }

    const token = authHeader.split(' ')[1];
    let playerId;

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        playerId = decoded.player_id;
    } catch (error) {
        return res.status(401).json({
            status: 'error',
            message: 'Token tidak valid atau telah kedaluwarsa.',
            error_detail: error.message
        });
    }

    const { password } = req.body;

    if (!playerId || !password) {
        return res.status(400).json({
            status: 'error',
            message: 'Password wajib diisi.'
        });
    }
    
    if (password.length < 6) {
        return res.status(400).json({
            status: 'error',
            message: 'Password minimal 6 karakter.'
        });
    }

    try {
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        
        const [result] = await db.query(
            'UPDATE players SET password_hash = ?, is_guest = 0 WHERE player_id = ?',
            [passwordHash, playerId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Pemain tidak ditemukan.'
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Akun berhasil dikaitkan secara permanen.'
        });
    } catch (error) {
        console.error('[authController.bindAccount] Error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan saat mengaitkan akun.',
            error_detail: error.message
        });
    }
};