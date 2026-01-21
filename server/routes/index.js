const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');

router.get('/test', testController.test);

router.get('/test', (req, res) => {
    res.json({
        status: 'success',
        message: 'route is working'
    });
});

module.exports = router;