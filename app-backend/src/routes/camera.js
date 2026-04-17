const express = require('express');
const router = express.Router();
const http = require('http');
const Camera = require('../models/Camera');
const heartbeatService = require('../services/heartbeat');
const recordingService = require('../services/recording');
const streamManager = require('../services/streamManager');

// 获取用户所有摄像头
router.get('/', async (req, res) => {
  try {
    const cameras = await Camera.findAll();
    res.json(cameras);
  } catch (error) {
    console.error('获取摄像头列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 添加新摄像头
router.post('/', async (req, res) => {
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
      serialNumber
    });
    
    res.status(201).json(camera);
  } catch (error) {
    console.error('添加摄像头错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 设备注册接口（用于ESP32设备启动时自动注册IP）
router.post('/register', async (req, res) => {
  try {
    // 兼容两种字段名：cameraId 或 serialNumber
    const serialNumber = req.body.serialNumber || req.body.cameraId;
    const ipAddress = req.body.ip || req.body.ipAddress;
    
    if (!serialNumber) {
      return res.status(400).json({ message: '缺少设备序列号' });
    }
    
    // 检查设备是否已存在
    let camera = await Camera.findOne({ where: { serialNumber } });
    
    if (camera) {
      // 设备已存在，更新IP地址和状态
      const oldIpAddress = camera.ipAddress;
      await camera.update({
        ipAddress: ipAddress || camera.ipAddress,
        status: 'online',
        lastHeartbeat: new Date()
      });
      
      // 如果IP地址变化或之前未录制，启动录制
      const newIpAddress = ipAddress || camera.ipAddress;
      if (newIpAddress && (!recordingService.getRecordingStatus(camera.id).isRecording || oldIpAddress !== newIpAddress)) {
        console.log(`🔄 重新启动录制: ${camera.id}`);
        recordingService.stopRecording(camera.id);
        setTimeout(() => {
          recordingService.startRecording(camera.id, newIpAddress)
            .catch(err => {
              console.error(`⚠️ 启动录制失败: ${err.message}`);
            });
        }, 1000);
      }
      
      return res.status(200).json({ 
        message: '设备信息已更新', 
        cameraId: camera.id,
        registered: true,
        ipAddress: camera.ipAddress
      });
    }
    
    // 创建新设备记录
    camera = await Camera.create({
      name: `设备-${serialNumber.substring(0, 6)}`,
      serialNumber,
      ipAddress: ipAddress,
      status: 'online',
      lastHeartbeat: new Date()
    });
    
    console.log(`✅ 新设备注册: ${serialNumber}, IP: ${ipAddress}`);
    
    // 自动启动录制
    if (ipAddress) {
      recordingService.startRecording(camera.id, ipAddress)
        .catch(err => {
          console.error(`⚠️ 启动录制失败: ${err.message}`);
        });
    }
    
    res.status(201).json({
      message: '设备注册成功',
      cameraId: camera.id,
      registered: false,
      ipAddress: camera.ipAddress
    });
  } catch (error) {
    console.error('设备注册错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 绑定设备到用户
router.post('/bind', async (req, res) => {
  try {
    const { cameraId, name } = req.body;
    
    // 查找设备
    let camera = await Camera.findByPk(cameraId);
    if (!camera) {
      return res.status(404).json({ message: '设备不存在' });
    }
    
    // 更新设备信息
    camera.name = name || camera.name;
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
router.put('/:id', async (req, res) => {
  try {
    const { name } = req.body;
    
    // 查找摄像头
    const camera = await Camera.findByPk(req.params.id);
    
    if (!camera) {
      return res.status(404).json({ message: '摄像头不存在' });
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
router.delete('/:id', async (req, res) => {
  try {
    // 查找摄像头
    const camera = await Camera.findByPk(req.params.id);
    
    if (!camera) {
      return res.status(404).json({ message: '摄像头不存在' });
    }
    
    console.log(`🗑️ 删除摄像头: ${camera.name} (${camera.serialNumber})`);
    
    // 1. 停止录制
    recordingService.stopRecording(camera.id);
    console.log(`⏹️ 已停止录制`);
    
    // 2. 关闭视频流连接
    streamManager.closeStream(camera.id);
    console.log(`🔌 已关闭视频流`);
    
    // 3. 尝试通知ESP32清除配网信息（如果设备在线）
    if (camera.ipAddress && camera.status === 'online') {
      try {
        const http = require('http');
        const resetUrl = `http://${camera.ipAddress}/reset-config`;
        console.log(`📡 发送重置指令到: ${resetUrl}`);
        
        http.get(resetUrl, (resp) => {
          let data = '';
          resp.on('data', (chunk) => { data += chunk; });
          resp.on('end', () => {
            console.log(`✅ ESP32已收到重置指令`);
          });
        }).on('error', (err) => {
          console.warn(`⚠️ 无法通知ESP32重置: ${err.message}`);
        });
      } catch (err) {
        console.warn(`⚠️ 发送重置指令失败: ${err.message}`);
      }
    }
    
    // 4. 删除关联的告警记录
    const Alert = require('../models/Alert');
    await Alert.destroy({ where: { cameraId: camera.id } });
    console.log(`🗑️ 已删除关联的告警记录`);
    
    // 5. 删除数据库记录
    await camera.destroy();
    console.log(`✅ 摄像头已从数据库删除`);
    
    res.json({ 
      message: '摄像头删除成功，设备将进入配网模式',
      needReRegister: true
    });
  } catch (error) {
    console.error('删除摄像头错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 设备心跳接口（从请求体获取serialNumber）
router.post('/heartbeat', async (req, res) => {
  try {
    const { serialNumber, ipAddress, storageUsed } = req.body;
    
    if (!serialNumber) {
      return res.status(400).json({ message: '缺少序列号' });
    }
    
    const result = await heartbeatService.handleHeartbeat(serialNumber, {
      ipAddress,
      storageUsed
    });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('处理心跳错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 设备心跳接口（从URL参数获取serialNumber，兼容ESP32旧版本）
router.post('/:serialNumber/heartbeat', async (req, res) => {
  try {
    const { serialNumber } = req.params;
    const { ip, ipAddress, storageUsed } = req.body;
    
    if (!serialNumber) {
      return res.status(400).json({ message: '缺少序列号' });
    }
    
    const result = await heartbeatService.handleHeartbeat(serialNumber, {
      ipAddress: ip || ipAddress,
      storageUsed
    });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('处理心跳错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取设备状态统计（暂时去掉认证，开发用）
router.get('/status/stats', async (req, res) => {
  try {
    const stats = await heartbeatService.getDeviceStatusStats();
    res.json(stats);
  } catch (error) {
    console.error('获取设备状态统计错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 手动检查设备在线状态
router.post('/status/check', async (req, res) => {
  try {
    const result = await heartbeatService.checkAllDevicesStatus();
    res.json(result);
  } catch (error) {
    console.error('检查设备状态错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取摄像头实时视频流（通过StreamManager复用ESP32连接）
router.get('/:id/stream', async (req, res) => {
  try {
    // 查找摄像头
    const camera = await Camera.findByPk(req.params.id);
    
    if (!camera) {
      return res.status(404).json({ message: '摄像头不存在' });
    }
    
    if (!camera.ipAddress) {
      return res.status(400).json({ message: '摄像头IP地址未知' });
    }
    
    if (camera.status !== 'online') {
      return res.status(400).json({ message: '摄像头离线' });
    }
    
    console.log(`📹 前端请求视频流 [${camera.id}]`);
    
    // 检查当前订阅者数量，防止过多堆积
    const streamStatus = streamManager.getStreamStatus(camera.id);
    if (streamStatus.active && streamStatus.subscribers >= 3) {
      console.warn(`⚠️  摄像头 ${camera.id} 已有 ${streamStatus.subscribers} 个订阅者，拒绝新连接`);
      return res.status(503).json({ 
        message: '视频流连接数过多，请稍后重试',
        subscribers: streamStatus.subscribers 
      });
    }
    
    // 设置响应头
    res.setHeader('Content-Type', 'multipart/x-mixed-replace;boundary=frame');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // 从 StreamManager 获取流（会自动复用现有ESP32连接）
    const stream = streamManager.getStream(camera.id, camera.ipAddress);
    
    console.log(`✅ 开始转发视频流到前端 [${camera.id}]`);
    
    // 将流数据pipe到响应
    stream.pipe(res);
    
    // 处理流错误
    stream.on('error', (err) => {
      console.error(`❌ 视频流错误 [${camera.id}]: ${err.message}`);
      if (!res.writableEnded) {
        res.end();
      }
    });
    
    // 处理客户端断开连接
    const cleanupTimeout = setTimeout(() => {
      console.log(`⏰ 视频流超时，自动断开 [${camera.id}]`);
      stream.unpipe(res);
      streamManager.removeSubscriber(camera.id, stream);
      if (!res.writableEnded) {
        res.end();
      }
    }, 5 * 60 * 1000); // 5分钟
    
    req.on('close', () => {
      console.log(`📤 前端断开视频流 [${camera.id}]`);
      clearTimeout(cleanupTimeout);
      stream.unpipe(res);
      streamManager.removeSubscriber(camera.id, stream);
      if (!res.writableEnded) {
        res.end();
      }
    });
    
    // 处理客户端完成请求
    req.on('end', () => {
      console.log(`📤 前端完成视频流请求 [${camera.id}]`);
      clearTimeout(cleanupTimeout);
      stream.unpipe(res);
      streamManager.removeSubscriber(camera.id, stream);
      if (!res.writableEnded) {
        res.end();
      }
    });
    
  } catch (error) {
    console.error('获取视频流错误:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: '服务器错误' });
    }
  }
});

// 获取录制状态
router.get('/:id/recording-status', async (req, res) => {
  try {
    const camera = await Camera.findByPk(req.params.id);
    
    if (!camera) {
      return res.status(404).json({ message: '摄像头不存在' });
    }
    
    const status = recordingService.getRecordingStatus(camera.id);
    res.json(status);
  } catch (error) {
    console.error('获取录制状态错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 手动启动/停止录制
router.post('/:id/recording/:action', async (req, res) => {
  try {
    const { action } = req.params;
    const camera = await Camera.findByPk(req.params.id);
    
    if (!camera) {
      return res.status(404).json({ message: '摄像头不存在' });
    }
    
    if (!camera.ipAddress) {
      return res.status(400).json({ message: '摄像头IP地址未知' });
    }
    
    if (action === 'start') {
      recordingService.startRecording(camera.id, camera.ipAddress);
      res.json({ message: '录制已启动' });
    } else if (action === 'stop') {
      recordingService.stopRecording(camera.id);
      res.json({ message: '录制已停止' });
    } else {
      res.status(400).json({ message: '无效的操作，请使用 start 或 stop' });
    }
  } catch (error) {
    console.error('控制录制错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;