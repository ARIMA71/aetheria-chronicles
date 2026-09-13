/**
 * TelemetryApi.js
 * Sends client performance benchmark telemetry (FPS, Latency, Device Info) to backend server.
 */

import { API_BASE as _ROOT } from '../config.js';
const getApiBase = () => `${_ROOT}/api/telemetry`;

const detectDeviceInfo = () => {
    const ua = navigator.userAgent || '';
    let os = 'Unknown OS';
    if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone/i.test(ua)) os = 'iOS (iPhone)';
    else if (/iPad/i.test(ua)) os = 'iOS (iPad)';
    else if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    let browser = 'Browser';
    if (/Edg/i.test(ua)) browser = 'Edge';
    else if (/Chrome/i.test(ua)) browser = 'Chrome';
    else if (/Safari/i.test(ua)) browser = 'Safari';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';
    else if (/OPR|Opera/i.test(ua)) browser = 'Opera';

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const formFactor = isMobile ? 'Mobile' : 'Desktop';

    return `${os} ${formFactor} (${browser})`;
};

export default class TelemetryApi {
    /**
     * Sends benchmark summary to server log and benchmark.json
     * @param {object} data
     */
    static async sendBenchmark(data) {
        try {
            const apiBase = getApiBase();
            const res = await fetch(`${apiBase}/benchmark`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return await res.json();
        } catch (error) {
            console.warn("[TelemetryApi] Could not send telemetry to server:", error.message);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Aggregates FPS and latency data and sends telemetry report
     * @param {number} questId
     * @param {string} battleStatus - 'VICTORY' | 'DEFEAT' | 'RETREAT'
     * @param {number} totalTurns
     */
    static async reportBattleBenchmark(questId, battleStatus, totalTurns = 1) {
        try {
            const rawPlayer = localStorage.getItem('aetheria_player');
            const playerObj = rawPlayer ? JSON.parse(rawPlayer) : {};

            const samples = window.__fpsSamples && window.__fpsSamples.length > 0 ? window.__fpsSamples : [window.__currentFps || 60];
            const rawLatencies = window.__latencySamples && window.__latencySamples.length > 0 ? window.__latencySamples : [];

            const numericFps = samples.map(s => parseFloat(s)).filter(n => !isNaN(n));
            const numericLatencies = rawLatencies.map(l => parseFloat(l)).filter(n => !isNaN(n));

            const avgFps = numericFps.length > 0 ? numericFps.reduce((a, b) => a + b, 0) / numericFps.length : 60;
            const minFps = numericFps.length > 0 ? Math.min(...numericFps) : 60;
            const maxFps = numericFps.length > 0 ? Math.max(...numericFps) : 60;
            const avgLatency = numericLatencies.length > 0 ? numericLatencies.reduce((a, b) => a + b, 0) / numericLatencies.length : 15;

            const deviceInfo = detectDeviceInfo();

            const payload = {
                playerId: playerObj.player_id || 1,
                username: playerObj.username || 'Player',
                questId: questId || 1,
                avgFps: avgFps,
                minFps: minFps,
                maxFps: maxFps,
                avgLatencyMs: avgLatency,
                totalTurns: totalTurns,
                battleStatus: battleStatus,
                deviceInfo: deviceInfo
            };

            // Reset samples for next battle
            window.__fpsSamples = [];
            window.__latencySamples = [];

            return await this.sendBenchmark(payload);
        } catch (e) {
            console.warn('[TelemetryApi] Failed to report benchmark:', e.message);
        }
    }
}
