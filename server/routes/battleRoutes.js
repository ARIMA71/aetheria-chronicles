const express = require('express');
const router = express.Router();
const battleController = require('../controllers/battleController');

router.post('/init', battleController.initBattle);
router.post('/result', battleController.saveBattleResult);
router.post('/ai-decision', battleController.getBossAction);

module.exports = router;