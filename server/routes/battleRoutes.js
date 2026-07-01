const express = require('express');
const router = express.Router();
const battleController = require('../controllers/battleController');

router.post('/init', battleController.initBattle);
router.post('/result', battleController.saveBattleResult);
router.post('/ai-decision', battleController.getBossAction);
router.get('/active/:playerId', battleController.getActiveBattle);
router.post('/sync', battleController.syncBattleState);
router.post('/surrender', battleController.surrenderBattle);

module.exports = router;