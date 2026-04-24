const express = require('express');
const router = express.Router();

const testController = require('../controllers/testController');
const authRoutes = require('./authRoutes')
const playerRoutes = require('./playerRoutes')
const battleRoutes = require('./battleRoutes')

router.use('/auth', authRoutes)
router.use('/player', playerRoutes)
router.use('/battle', battleRoutes)

router.get('/test', testController.test);

router.get('/test', (req, res) => {
    res.json({
        status: 'success',
        message: 'route is working'
    });
});

module.exports = router;