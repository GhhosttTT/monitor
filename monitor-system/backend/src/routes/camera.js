const express = require('express');
const router = express.Router();
const Camera = require('../models/Camera');
const User = require('../models/User');
const auth = require('../middleware/auth');

// 获取用户所有摄像头
router.get('/', auth, async (req, res) => {
  try {
    const cameras = await Camera.findAll({ 
      where: { ownerId: req.user.userId } 
    });
    res.json(cameras);
  } catch (error) {
    console.error('获取摄像头列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 添加新摄像头
router.post('/', auth, async (req, res) => {
  try {
    const { name, serialNumber } = req.body;
    
    // 检查序列号是否已存在
    let camera = await Camera.findOne({ where: { serialNumber } });
    if (camera) {
      return res.status(400).json({ message: '该序列号的摄像头已存在' });
    }
    
    // 创建新摄像头
    camera = await Camera.create({
      name,
      serialNumber,
      ownerId: req.user.userId
    });
    
    res.status(201).json(camera);
  } catch (error) {
    console.error('添加摄像头错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 设备注册接口（用于SmartConfig配网后设备自动注册）
router.post('/register', async (req, res) => {
  try {
    const { serialNumber, wifiSSID, wifiPassword } = req.body;
    
    // 检查序列号是否已存在
    let camera = await Camera.findOne({ where: { serialNumber } });
    if (camera) {
      // 如果设备已存在，返回设备信息
      return res.status(200).json({ 
        message: '设备已注册', 
        cameraId: camera.id,
        registered: true
      });
    }
    
    // 临时创建一个未绑定的设备记录
    camera = await Camera.create({
      name: `未命名设备-${serialNumber.substring(0, 6)}`,
      serialNumber,
      status: 'offline'
    });
    
    res.status(201).json({
      message: '设备注册成功',
      cameraId: camera.id,
      registered: false
    });
  } catch (error) {
    console.error('设备注册错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 绑定设备到用户
router.post('/bind', auth, async (req, res) => {
  try {
    const { cameraId, name } = req.body;
    
    // 查找设备
    let camera = await Camera.findByPk(cameraId);
    if (!camera) {
      return res.status(404).json({ message: '设备不存在' });
    }
    
    // 检查设备是否已绑定
    if (camera.ownerId) {
      return res.status(400).json({ message: '设备已被绑定' });
    }
    
    // 更新设备信息
    camera.name = name || camera.name;
    camera.ownerId = req.user.userId;
    camera.status = 'online';
    
    await camera.save();
    
    res.status(200).json({
      message: '设备绑定成功',
      camera
    });
  } catch (error) {
    console.error('设备绑定错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新摄像头信息
router.put('/:id', auth, async (req, res) => {
  try {
    const { name } = req.body;
    
    // 检查摄像头是否存在且属于当前用户
    const camera = await Camera.findOne({
      where: {
        id: req.params.id,
        ownerId: req.user.userId
      }
    });
    
    if (!camera) {
      return res.status(404).json({ message: '摄像头不存在或无权限访问' });
    }
    
    // 更新摄像头名称
    if (name) {
      camera.name = name;
    }
    
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
    // 检查摄像头是否存在且属于当前用户
    const camera = await Camera.findOne({
      where: {
        id: req.params.id,
        ownerId: req.user.userId
      }
    });
    
    if (!camera) {
      return res.status(404).json({ message: '摄像头不存在或无权限访问' });
    }
    
    // 删除摄像头
    await camera.destroy();
    
    res.json({ message: '摄像头删除成功' });
  } catch (error) {
    console.error('删除摄像头错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取摄像头实时视频流 (WebSocket/WebRTC)
router.get('/:id/stream', auth, async (req, res) => {
  try {
    // 检查摄像头是否存在且属于当前用户
    const camera = await Camera.findOne({
      where: {
        id: req.params.id,
        ownerId: req.user.userId
      }
    });
    
    if (!camera) {
      return res.status(404).json({ message: '摄像头不存在或无权限访问' });
    }
    
    // 这里应该返回建立实时连接所需的信息
    // 实际的视频流通过WebSocket/WebRTC传输
    res.json({
      cameraId: camera.id,
      streamUrl: `/stream/${camera.id}`,
      message: '请使用WebSocket/WebRTC连接获取实时视频流'
    });
  } catch (error) {
    console.error('获取视频流错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;