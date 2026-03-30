const express = require('express');
const router = express.Router();
const miscController = require('../controllers/miscController');

router.get('/profile', miscController.getProfile);
router.put('/profile', miscController.updateProfile);

router.get('/search', miscController.search);

router.post('/subscribe', miscController.subscribe);

module.exports = router;