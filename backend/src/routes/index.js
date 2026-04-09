const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const cameraRoutes = require('./camera');
const videoRoutes = require('./video');

router.use('/auth', authRoutes);
router.use('/cameras', cameraRoutes);
router.use('/videos', videoRoutes);

module.exports = router;