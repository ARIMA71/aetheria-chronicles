const express = require('express');
const router = express.Router();
const questController = require('../controllers/questController');

router.get('/', questController.getQuests);

module.exports = router;
