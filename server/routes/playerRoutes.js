// const express = require('express');
// const router = express.Router();
// const playerController = require('../controllers/playerController');

// router.get('/:id', playerController.getPlayer);

// module.exports = router;

const express = require('express')
const router = express.Router()

const playerController = require('../controllers/playerController')

router.get('/:playerId/party', playerController.getPlayerParty)

module.exports = router