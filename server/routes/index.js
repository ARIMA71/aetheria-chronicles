const express = require('express');
const router = express.Router();

const testController = require('../controllers/testController');
const authRoutes = require('./authRoutes')
const playerRoutes = require('./playerRoutes')
const battleRoutes = require('./battleRoutes')
const questRoutes = require('./questRoutes')
const partyRoutes = require('./partyRoutes')
const gachaRoutes = require('./gachaRoutes')
const telemetryRoutes = require('./telemetryRoutes')

router.use('/auth', authRoutes)
router.use('/player', playerRoutes)
router.use('/battle', battleRoutes)
router.use('/quests', questRoutes)
router.use('/party', partyRoutes)
router.use('/gacha', gachaRoutes)
router.use('/telemetry', telemetryRoutes)

router.get('/test', testController.test);

router.get('/test', (req, res) => {
    res.json({
        status: 'success',
        message: 'route is working'
    });
});

module.exports = router;