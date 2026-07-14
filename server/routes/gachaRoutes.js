const express = require('express');
const router = express.Router();
const gachaController = require('../controllers/gachaController');

router.get('/info/:playerId', gachaController.info);
router.post('/pull', gachaController.pull);

module.exports = router;
