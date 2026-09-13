/**
 * config.js — Konfigurasi API Base URL Terpusat
 * Aetheria Chronicles
 *
 * Strategi:
 * - Local Dev (Vite :5173)    → backend berjalan terpisah di http://localhost:3000
 * - Ngrok + Static Serve (:3000) → client di-serve langsung dari Express, gunakan
 *                                   origin yang sama sehingga tidak perlu port eksplisit.
 *
 * Cara kerja:
 * 1. Cek apakah hostname adalah localhost / 127.0.0.1
 *    → Ya: gunakan http://localhost:3000 (mode dev normal)
 *    → Tidak: gunakan window.location.origin (mode Ngrok / deploy)
 *       Contoh: https://abcd-1234.ngrok-free.app → API ke https://abcd-1234.ngrok-free.app/api/...
 *
 * Cara penggunaan di file lain:
 *   import { API_BASE } from '../config.js';
 *   fetch(`${API_BASE}/api/battle/init`, ...)
 */

const _host = window.location.hostname;
const _isLocal = _host === 'localhost' || _host === '127.0.0.1';

/**
 * Base URL untuk semua request API.
 * Tidak menyertakan trailing slash maupun `/api`.
 * Contoh: "http://localhost:3000" atau "https://abc.ngrok-free.app"
 */
export const API_BASE = _isLocal
    ? 'http://localhost:3000'
    : window.location.origin;
