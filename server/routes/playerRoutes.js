const express = require('express');
const router = express.Router();
const playerController = require('../controllers/playerController');
const battleController = require('../controllers/battleController');

router.post('/use-stamina-potion', playerController.useStaminaPotion);
router.get('/:playerId/party-presets', playerController.getPartyPresets);
router.get('/:playerId', playerController.getPlayerProfile);
router.get('/:playerId/party', playerController.getPlayerParty);

module.exports = router;
