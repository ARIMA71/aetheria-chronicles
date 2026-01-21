const express = require('express');
const router = express.Router();
const battleController = require('../controllers/battleController');

router.post('/result', battleController.saveBattleResult);

module.exports = router;