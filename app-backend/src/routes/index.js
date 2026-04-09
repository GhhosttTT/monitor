const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const cameraRoutes = require('./camera');
const videoRoutes = require('./video');
const userRoutes = require('./user');
const adminRoutes = require('./admin');

router.use('/auth', authRoutes);
router.use('/cameras', cameraRoutes);
router.use('/videos', videoRoutes);
router.use('/users', userRoutes);
router.use('/admins', adminRoutes);

module.exports = router;