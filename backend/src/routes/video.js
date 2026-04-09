const express = require('express');
const router = express.Router();
const Video = require('../models/Video');
const Camera = require('../models/Camera');
const auth = require('../middleware/auth');

// 获取用户所有摄像头的视频列表
router.get('/', auth, async (req, res) => {
  try {
    // 先获取用户的所有摄像头
    const cameras = await Camera.findAll({
      where: { ownerId: req.user.id },
      attributes: ['id']
    });
    
    const cameraIds = cameras.map(camera => camera.id);
    
    // 获取这些摄像头的视频
    const videos = await Video.findAll({
      where: { 
        cameraId: cameraIds 
      },
      include: [{
        model: Camera,
        as: 'camera',
        attributes: ['name', 'serialNumber']
      }],
      order: [['recordedAt', 'DESC']]
    });
    
    res.json(videos);
  } catch (error) {
    console.error('获取视频列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取特定摄像头的视频列表
router.get('/camera/:cameraId', auth, async (req, res) => {
  try {
    const { cameraId } = req.params;
    
    // 验证摄像头属于当前用户
    const camera = await Camera.findOne({
      where: { 
        id: cameraId,
        ownerId: req.user.id 
      }
    });
    
    if (!camera) {
      return res.status(404).json({ message: '摄像头不存在' });
    }
    
    const videos = await Video.findAll({
      where: { cameraId },
      order: [['recordedAt', 'DESC']]
    });
    
    res.json(videos);
  } catch (error) {
    console.error('获取摄像头视频列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取特定视频信息
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const video = await Video.findOne({
      where: { id },
      include: [{
        model: Camera,
        as: 'camera',
        attributes: ['name', 'serialNumber', 'ownerId']
      }]
    });
    
    // 验证视频属于当前用户的摄像头
    if (!video || video.camera.ownerId !== req.user.id) {
      return res.status(404).json({ message: '视频不存在' });
    }
    
    res.json(video);
  } catch (error) {
    console.error('获取视频信息错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;