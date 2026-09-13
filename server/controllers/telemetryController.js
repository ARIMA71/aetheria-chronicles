const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../logs');
const logFile = path.join(logDir, 'benchmark.json');

const logBenchmark = async (req, res) => {
    try {
        const {
            playerId = 0,
            username = 'Guest',
            questId = 0,
            avgFps = 0,
            minFps = 0,
            maxFps = 0,
            avgLatencyMs = 0,
            totalTurns = 0,
            battleStatus = 'UNKNOWN',
            deviceInfo = 'Browser'
        } = req.body;

        const timestamp = new Date().toISOString();
        const entry = {
            timestamp,
            playerId,
            username,
            questId,
            avgFps: Number(avgFps.toFixed(1)),
            minFps: Number(minFps.toFixed(1)),
            maxFps: Number(maxFps.toFixed(1)),
            avgLatencyMs: Number(avgLatencyMs.toFixed(1)),
            totalTurns,
            battleStatus,
            deviceInfo
        };

        // 1. Print formatted console log in Node.js server terminal
        console.log('\n========================================');
        console.log('📊 [BENCHMARK TELEMETRY LOG]');
        console.log(`👤 Player   : ${username} (ID: ${playerId})`);
        console.log(`🗺️  Quest    : Quest ID ${questId} [${battleStatus}]`);
        console.log(`⚡ FPS      : Avg ${entry.avgFps} | Min ${entry.minFps} | Max ${entry.maxFps}`);
        console.log(`📡 Latency  : ${entry.avgLatencyMs} ms`);
        console.log(`🔄 Turns    : ${totalTurns} turns`);
        console.log(`📱 Device   : ${deviceInfo}`);
        console.log(`🕒 Time     : ${new Date().toLocaleTimeString('id-ID')}`);
        console.log('========================================\n');

        // 2. Append entry to server/logs/benchmark.json
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        let logs = [];
        if (fs.existsSync(logFile)) {
            try {
                const content = fs.readFileSync(logFile, 'utf8');
                logs = JSON.parse(content);
                if (!Array.isArray(logs)) logs = [];
            } catch (err) {
                logs = [];
            }
        }

        logs.push(entry);

        // Keep last 500 logs to prevent file bloat
        if (logs.length > 500) {
            logs = logs.slice(-500);
        }

        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf8');

        return res.status(200).json({
            status: 'success',
            message: 'Benchmark telemetry recorded.',
            data: entry
        });
    } catch (error) {
        console.error('Error logging benchmark telemetry:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to record benchmark telemetry.'
        });
    }
};

const getBenchmarkLogs = async (req, res) => {
    try {
        if (!fs.existsSync(logFile)) {
            return res.status(200).json({ status: 'success', data: [] });
        }
        const content = fs.readFileSync(logFile, 'utf8');
        const logs = JSON.parse(content);
        return res.status(200).json({ status: 'success', data: logs });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Failed to read benchmark logs.' });
    }
};

module.exports = {
    logBenchmark,
    getBenchmarkLogs
};
