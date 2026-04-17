const express = require('express');
const router = express.Router();

const cameraRoutes = require('./camera');
const videoRoutes = require('./video');
const recordingPlanRoutes = require('./recordingPlan');
const systemRoutes = require('./system');

router.use('/cameras', cameraRoutes);
router.use('/videos', videoRoutes);
router.use('/recording-plans', recordingPlanRoutes);
router.use('/system', systemRoutes);

module.exports = router;