require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { exec } = require('child_process');
const routes = require('./routes');
const { CameraWebRTCService, ClientWebRTCService } = require('./services/webrtc');
const sequelize = require('./config/database');
const Camera = require('./models/Camera');
const Video = require('./models/Video');
const RecordingPlan = require('./models/RecordingPlan');
const Alert = require('./models/Alert');
const heartbeatService = require('./services/heartbeat');
const recordingService = require('./services/recording');
const streamManager = require('./services/streamManager');

// 初始化mDNS服务（使用bonjour-service替代mdns，无需编译）
let mdnsAdvertisement = null;
try {
  const { Bonjour } = require('bonjour-service');
  const bonjour = new Bonjour();
  mdnsAdvertisement = bonjour.publish({
    name: 'Monitor Backend',
    type: 'monitor-backend',
    protocol: 'tcp',
    port: process.env.PORT || 5002,
    txt: {
      version: '1.0.0',
      description: 'ESP32 Monitor System Backend'
    }
  });
  console.log('✅ mDNS服务已注册: monitor-backend._tcp.local:' + (process.env.PORT || 5002));
} catch (error) {
  console.log('⚠️ mDNS服务初始化失败（可选功能）:', error.message);
}

// 初始化WebRTC服务
const cameraWebRTCService = new CameraWebRTCService();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 中间件
app.set('etag', false); // 禁用ETag缓存，避免304响应
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 - 视频文件
const videoPath = path.join(__dirname, '../../NAS/videos');
app.use('/videos', express.static(videoPath));
console.log('视频文件路径:', videoPath);

// 路由
app.use('/api', routes);

// 健康检查
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// WebRTC和WebSocket设置
// 设置WebSocket连接事件
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);
  
  // 处理摄像头连接
  socket.on('camera-join', async (data) => {
    try {
      const { cameraId, userId } = data;
      const connectionId = await cameraWebRTCService.initializeConnection(cameraId, userId);
      socket.connectionId = connectionId;
      
      // 通知客户端连接已建立
      socket.emit('connection-established', { connectionId });
    } catch (error) {
      console.error('摄像头连接失败:', error);
      socket.emit('connection-error', { message: '连接失败' });
    }
  });
  
  // 处理offer
  socket.on('offer', async (data) => {
    try {
      const { connectionId, offer } = data;
      await cameraWebRTCService.handleAnswer(connectionId, offer);
    } catch (error) {
      console.error('处理offer失败:', error);
    }
  });
  
  // 处理ICE候选
  socket.on('ice-candidate', async (data) => {
    try {
      const { connectionId, candidate } = data;
      await cameraWebRTCService.handleIceCandidate(connectionId, candidate);
    } catch (error) {
      console.error('处理ICE候选失败:', error);
    }
  });
  
  // 处理断开连接
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
    if (socket.connectionId) {
      cameraWebRTCService.closeConnection(socket.connectionId);
    }
  });
});

// 数据库连接
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL数据库连接成功');
    
    // 同步模型到数据库(仅在没有表时创建)
    await sequelize.sync({ force: false });
    console.log('数据库模型同步完成');
    
    // 恢复在线摄像头的录制
    await resumeRecordings();
    
    // 启动心跳检测定时任务（每60秒检查一次）
    startHeartbeatCheck();
  } catch (error) {
    console.error('MySQL数据库连接失败:', error.message);
    console.error('错误详情:', error);
    // 不要退出进程,允许API继续工作
    // process.exit(1);
  }
};

// 恢复在线摄像头的录制
const resumeRecordings = async () => {
  try {
    const onlineCameras = await Camera.findAll({
      where: { status: 'online' }
    });
    
    console.log(`🔄 恢复 ${onlineCameras.length} 个在线摄像头的录制`);
    
    for (const camera of onlineCameras) {
      if (camera.ipAddress) {
        recordingService.startRecording(camera.id, camera.ipAddress)
          .catch(err => {
            console.error(`⚠️ 恢复录制失败 [${camera.name}]: ${err.message}`);
          });
      }
    }
  } catch (error) {
    console.error('恢复录制失败:', error.message);
  }
};

// 启动心跳检测定时任务
const startHeartbeatCheck = () => {
  console.log('启动设备状态监控定时任务...');
  
  // 每60秒检查一次设备在线状态
  setInterval(async () => {
    try {
      const result = await heartbeatService.checkAllDevicesStatus();
      if (result.checked > 0) {
        console.log(`检测到 ${result.checked} 个设备离线`);
        // 通过WebSocket通知前端
        io.emit('device-status-update', {
          type: 'offline_detected',
          offlineDevices: result.offlineDevices
        });
      }
    } catch (error) {
      console.error('定时检查设备状态失败:', error);
    }
  }, 60000); // 60秒
  
  console.log('设备状态监控定时任务已启动');
};

// 启动资源监控（防止僵尸进程堆积）
const startResourceMonitor = () => {
  console.log('🔍 启动资源监控定时任务...');
  
  // 每30秒检查一次系统资源
  setInterval(async () => {
    try {
      // 检查ffprobe进程数量
      if (process.platform === 'win32') {
        exec('tasklist /FI "IMAGENAME eq ffprobe.exe" /FO CSV', (error, stdout) => {
          if (!error && stdout) {
            const lines = stdout.trim().split('\n');
            const ffprobeCount = lines.length - 1; // 减去标题行
            
            if (ffprobeCount > 5) {
              console.warn(`⚠️  警告: 发现 ${ffprobeCount} 个ffprobe进程，可能超出正常范围`);
              console.warn('💡 建议检查录制服务是否正常');
              
              // 如果超过10个，自动清理
              if (ffprobeCount > 10) {
                console.error('🛑 ffprobe进程过多，执行自动清理...');
                exec('taskkill /F /IM ffprobe.exe', (killError) => {
                  if (killError) {
                    console.error('清理ffprobe进程失败:', killError.message);
                  } else {
                    console.log('✅ 已清理所有ffprobe进程');
                  }
                });
              }
            }
          }
        });
        
        // 检查Node.js进程数量（防止重复启动）
        exec('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', (error, stdout) => {
          if (!error && stdout) {
            const lines = stdout.trim().split('\n');
            const nodeCount = lines.length - 1;
            
            // npm运行会spawn子进程，正常情况会有4-6个node进程
            // 如果超过8个才报警
            if (nodeCount > 8) {
              console.warn(`⚠️  警告: 发现 ${nodeCount} 个Node.js进程，可能有重复启动`);
              console.warn('💡 建议检查: Get-Process node | Select-Object Id,StartTime');
            }
          }
        });
      }
      
      // 检查ESP32连接数
      const connectionStats = streamManager.getConnectionStats();
      for (const [cameraId, stats] of Object.entries(connectionStats)) {
        if (stats.subscribers > 10) {
          console.warn(`⚠️  摄像头 ${cameraId} 有 ${stats.subscribers} 个订阅者，可能异常`);
        }
      }
      
      // 内存监控
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      if (heapUsedMB > 500) {
        console.warn(`⚠️  内存使用较高: ${heapUsedMB}MB`);
      }
      
    } catch (error) {
      console.error('资源监控失败:', error.message);
    }
  }, 30000); // 30秒
  
  console.log('✅ 资源监控定时任务已启动');
};

// 启动服务器（仅在非测试环境下）
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5002;
  
  // 检查端口是否已被占用
  const checkPortInUse = () => {
    return new Promise((resolve) => {
      const tester = http.createServer()
        .once('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            resolve(true); // 端口被占用
          } else {
            resolve(false);
          }
        })
        .once('listening', () => {
          tester.close();
          resolve(false); // 端口可用
        })
        .listen(PORT);
    });
  };
  
  checkPortInUse().then((inUse) => {
    if (inUse) {
      console.error(`❌ 端口 ${PORT} 已被占用，可能是重复启动了后端服务`);
      console.error('💡 请检查是否有其他Node.js进程在运行: Get-Process node');
      console.error('💡 或者使用: netstat -ano | findstr ":' + PORT + '"');
      process.exit(1);
    }
    
    server.listen(PORT, () => {
      console.log(`✅ 服务器运行在端口 ${PORT}`);
      console.log(`📊 当前进程ID: ${process.pid}`);
      
      // 启动资源监控
      startResourceMonitor();
    });
  });
}

connectDB();

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('未处理的Promise拒绝:', err);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n⏹️  正在关闭服务...');
  recordingService.stopAllRecordings();
  streamManager.closeAll();
  setTimeout(() => {
    process.exit(0);
  }, 2000);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  收到终止信号...');
  recordingService.stopAllRecordings();
  streamManager.closeAll();
  setTimeout(() => {
    process.exit(0);
  }, 2000);
});

module.exports = { app, server };