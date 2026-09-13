const express = require('express');
const router = express.Router();
const telemetryController = require('../controllers/telemetryController');

router.post('/benchmark', telemetryController.logBenchmark);
router.get('/benchmark', telemetryController.getBenchmarkLogs);

module.exports = router;
