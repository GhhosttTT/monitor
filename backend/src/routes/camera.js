const express = require('express');
const router = express.Router();
const Camera = require('../models/Camera');
const auth = require('../middleware/auth');

// 获取用户的所有摄像头
router.get('/', auth, async (req, res) => {
  try {
    const cameras = await Camera.findAll({
      where: { ownerId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    
    res.json(cameras);
  } catch (error) {
    console.error('获取摄像头列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取特定摄像头信息
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const camera = await Camera.findOne({
      where: { 
        id,
        ownerId: req.user.id 
      }
    });
    
    if (!camera) {
      return res.status(404).json({ message: '摄像头不存在' });
    }
    
    res.json(camera);
  } catch (error) {
    console.error('获取摄像头信息错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 添加新摄像头
router.post('/', auth, async (req, res) => {
  try {
    const { name, serialNumber } = req.body;
    
    // 检查序列号是否已存在
    const existingCamera = await Camera.findOne({ 
      where: { serialNumber } 
    });
    
    if (existingCamera) {
      return res.status(400).json({ message: '该序列号的摄像头已存在' });
    }
    
    // 创建新摄像头
    const camera = await Camera.create({
      name,
      serialNumber,
      ownerId: req.user.id,
      status: 'offline'
    });
    
    res.status(201).json(camera);
  } catch (error) {
    console.error('创建摄像头错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新摄像头信息
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, resolution, storageRetention, motionDetectionEnabled, motionDetectionSensitivity } = req.body;
    
    const camera = await Camera.findOne({
      where: { 
        id,
        ownerId: req.user.id 
      }
    });
    
    if (!camera) {
      return res.status(404).json({ message: '摄像头不存在' });
    }
    
    // 更新摄像头信息
    camera.name = name || camera.name;
    camera.resolution = resolution || camera.resolution;
    camera.storageRetention = storageRetention !== undefined ? storageRetention : camera.storageRetention;
    camera.motionDetectionEnabled = motionDetectionEnabled !== undefined ? motionDetectionEnabled : camera.motionDetectionEnabled;
    camera.motionDetectionSensitivity = motionDetectionSensitivity !== undefined ? motionDetectionSensitivity : camera.motionDetectionSensitivity;
    
    await camera.save();
    
    res.json(camera);
  } catch (error) {
    console.error('更新摄像头错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 删除摄像头
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const camera = await Camera.findOne({
      where: { 
        id,
        ownerId: req.user.id 
      }
    });
    
    if (!camera) {
      return res.status(404).json({ message: '摄像头不存在' });
    }
    
    await camera.destroy();
    
    res.json({ message: '摄像头删除成功' });
  } catch (error) {
    console.error('删除摄像头错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;