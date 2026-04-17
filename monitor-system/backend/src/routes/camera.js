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
    const { cameraId, serialNumber, ip, wifiSSID, wifiPassword } = req.body;
    
    // 优先使用cameraId查找，如果没有则使用serialNumber
    let camera = null;
    
    if (cameraId) {
      // ESP32使用cameraId（设备名称）作为标识
      camera = await Camera.findOne({ 
        where: { serialNumber: cameraId } 
      });
    } else if (serialNumber) {
      camera = await Camera.findOne({ 
        where: { serialNumber } 
      });
    }
    
    if (camera) {
      // 如果设备已存在，更新IP地址和状态
      camera.ipAddress = ip;
      camera.status = 'online';
      await camera.save();
      
      console.log(`✅ 设备已更新: ${camera.serialNumber} -> IP: ${ip}`);
      
      return res.status(200).json({ 
        message: '设备信息已更新', 
        cameraId: camera.id,
        registered: true,
        ipAddress: ip
      });
    }
    
    // 临时创建一个未绑定的设备记录
    const deviceId = cameraId || serialNumber || `DEVICE_${Date.now()}`;
    camera = await Camera.create({
      name: `未命名设备-${deviceId.substring(0, 6)}`,
      serialNumber: deviceId,
      status: 'online',
      ipAddress: ip
    });
    
    console.log(`✅ 新设备注册: ${camera.serialNumber} -> IP: ${ip}`);
    
    res.status(201).json({
      message: '设备注册成功',
      cameraId: camera.id,
      registered: false,
      ipAddress: ip
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

// 获取摄像头视频流（实时中转+自动录制）
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

    // 检查摄像头是否在线
    if (camera.status !== 'online' || !camera.ipAddress) {
      return res.status(503).json({ 
        message: '摄像头离线或IP地址未知',
        status: camera.status,
        ipAddress: camera.ipAddress
      });
    }

    const streamRelay = require('../services/streamRelay');

    // 启动或获取现有的流中转
    const relay = streamRelay.startRelay(camera.id, camera.ipAddress);

    console.log(`📹 客户端请求流: Camera ${camera.id}`);

    // 设置响应头（MJPEG流）
    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Connection': 'close',
      'Access-Control-Allow-Origin': '*',
      'X-Stream-Mode': 'relay',
      'X-Recording': 'enabled'
    });

    // 添加客户端到中转服务
    streamRelay.addClient(camera.id, res);

  } catch (error) {
    console.error('获取视频流错误:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: '服务器错误', error: error.message });
    }
  }
});

// 设备心跳接口（ESP32定期发送心跳保持在线状态）
router.post('/:cameraId/heartbeat', async (req, res) => {
  try {
    const { cameraId } = req.params;
    const { ip, status } = req.body;
    
    // 查找设备（使用serialNumber字段存储cameraId）
    let camera = await Camera.findOne({ 
      where: { serialNumber: cameraId } 
    });
    
    if (!camera) {
      return res.status(404).json({ 
        message: '设备不存在，请先注册',
        cameraId
      });
    }
    
    // 更新设备状态和IP
    camera.ipAddress = ip || camera.ipAddress;
    camera.status = status || 'online';
    camera.lastHeartbeat = new Date();
    await camera.save();
    
    console.log(`💓 心跳更新: ${cameraId} -> IP: ${ip}, Status: ${camera.status}`);
    
    res.status(200).json({ 
      message: '心跳接收成功',
      cameraId: camera.id,
      status: camera.status
    });
  } catch (error) {
    console.error('心跳处理错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取流中转状态
router.get('/:id/relay-status', auth, async (req, res) => {
  try {
    const camera = await Camera.findOne({
      where: {
        id: req.params.id,
        ownerId: req.user.userId
      }
    });

    if (!camera) {
      return res.status(404).json({ message: '摄像头不存在或无权限访问' });
    }

    const streamRelay = require('../services/streamRelay');
    const status = streamRelay.getRelayStatus(camera.id);

    if (!status) {
      return res.json({
        cameraId: camera.id,
        status: 'idle',
        message: '流中转未启动'
      });
    }

    res.json(status);
  } catch (error) {
    console.error('获取中转状态错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 停止流中转
router.post('/:id/stop-relay', auth, async (req, res) => {
  try {
    const camera = await Camera.findOne({
      where: {
        id: req.params.id,
        ownerId: req.user.userId
      }
    });

    if (!camera) {
      return res.status(404).json({ message: '摄像头不存在或无权限访问' });
    }

    const streamRelay = require('../services/streamRelay');
    const success = streamRelay.stopRelay(camera.id);

    if (success) {
      res.json({ message: '流中转已停止' });
    } else {
      res.status(404).json({ message: '流中转未运行' });
    }
  } catch (error) {
    console.error('停止中转错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;