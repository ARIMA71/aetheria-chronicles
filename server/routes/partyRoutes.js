const express = require('express');
const router = express.Router();
const partyController = require('../controllers/partyController');

// Mendaftarkan rute-rute untuk Party Settings
router.get('/:playerId', partyController.getPartyPresets);
router.put('/:playerId/:presetSlot', partyController.savePartyPreset);
router.get('/:playerId/inventory/all', partyController.getPlayerInventory);
router.get('/:playerId/mc-skills/all', partyController.getMcSkills);
router.get('/:playerId/lb-cost/:mcId/:targetLb', partyController.getLimitBreakCost);
router.post('/:playerId/limit-break', partyController.limitBreak);
router.post('/:playerId/upgrade', partyController.upgradeItem);

module.exports = router;
