const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();
const sequelize = require('./config/database');
const videoRoutes = require('./routes/videos');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// 确保视频存储目录存在
const videoStoragePath = process.env.VIDEO_STORAGE_PATH || './videos';
if (!fs.existsSync(videoStoragePath)) {
  fs.mkdirSync(videoStoragePath, { recursive: true });
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 11111;

// 创建WebSocket服务器
const wss = new WebSocket.Server({ 
  server,
  path: '/ws/stream'
});

// 存储连接的摄像头
const connectedCameras = new Map();

// WebSocket连接处理
wss.on('connection', (ws, req) => {
  console.log('新的WebSocket连接');
  
  let cameraId = null;
  
  ws.on('message', (message) => {
    try {
      // 尝试解析JSON消息（控制命令）
      const data = JSON.parse(message.toString());
      
      if (data.event === 'camera-register') {
        cameraId = data.cameraId;
        connectedCameras.set(cameraId, {
          ws,
          info: data,
          connectedAt: new Date(),
          lastFrameTime: Date.now()
        });
        
        console.log(`摄像头注册成功: ${cameraId}`, data);
        
        // 发送确认消息
        ws.send(JSON.stringify({
          type: 'register-success',
          message: '摄像头注册成功',
          cameraId
        }));
      }
    } catch (e) {
      // 如果不是JSON，可能是二进制帧数据
      if (Buffer.isBuffer(message) || message instanceof ArrayBuffer) {
        if (cameraId) {
          const camera = connectedCameras.get(cameraId);
          if (camera) {
            camera.lastFrameTime = Date.now();
            camera.lastFrame = message;
          }
        }
      }
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket连接关闭');
    if (cameraId) {
      connectedCameras.delete(cameraId);
      console.log(`摄像头断开: ${cameraId}`);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket错误:', error);
    if (cameraId) {
      connectedCameras.delete(cameraId);
    }
  });
});

// 中间件
app.use(cors());
app.use(express.json());

// 配置 multer 用于处理视频文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, videoStoragePath)
  },
  filename: function (req, file, cb) {
    // 使用时间戳命名文件
    const now = new Date();
    const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
    cb(null, `${timestamp}.mp4`)
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 2147483648 // 2GB
  }
});

// 实时视频流接口 - MJPEG格式
app.get('/api/stream', (req, res) => {
  const cameraId = req.query.cameraId || Array.from(connectedCameras.keys())[0];
  
  if (!cameraId || !connectedCameras.has(cameraId)) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('没有可用的摄像头连接');
    return;
  }
  
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Pragma': 'no-cache'
  });
  
  const camera = connectedCameras.get(cameraId);
  
  // 定期发送最新帧
  const sendFrame = () => {
    if (!res.writableEnded && camera.lastFrame) {
      const frameBuffer = Buffer.isBuffer(camera.lastFrame) 
        ? camera.lastFrame 
        : Buffer.from(camera.lastFrame);
      
      res.write('--frame\r\n');
      res.write('Content-Type: image/jpeg\r\n');
      res.write(`Content-Length: ${frameBuffer.length}\r\n`);
      res.write('\r\n');
      res.write(frameBuffer);
      res.write('\r\n');
    }
  };
  
  // 初始发送
  sendFrame();
  
  // 每秒发送一帧（可调整）
  const interval = setInterval(sendFrame, 1000 / 10); // 10 FPS
  
  req.on('close', () => {
    clearInterval(interval);
  });
});

// 获取所有连接的摄像头
app.get('/api/cameras', (req, res) => {
  const cameras = [];
  for (const [id, camera] of connectedCameras.entries()) {
    cameras.push({
      cameraId: id,
      ...camera.info,
      connectedAt: camera.connectedAt,
      lastFrameTime: camera.lastFrameTime,
      status: 'online'
    });
  }
  res.json(cameras);
});

// 路由
app.use('/api/videos', videoRoutes);

// 视频上传接口
app.post('/api/videos/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    
    // 保存视频信息到数据库
    const Video = require('./models/Video');
    const video = await Video.create({
      filename: req.file.filename,
      filepath: req.file.path,
      size: req.file.size,
      cameraId: req.headers['camera-id'] || 'unknown',
      timestamp: new Date()
    });
    
    res.json({ 
      message: '视频上传成功', 
      videoId: video.id,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('视频上传失败:', error);
    res.status(500).json({ error: '视频上传失败' });
  }
});

// 实时视频流接口（旧版，保留兼容）
app.get('/api/stream/legacy', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // 这里应该实现从摄像头获取实时流的逻辑
  // 由于我们是通过ESP32传输视频，这里可以作为一个代理
  res.write('--frame\r\n');
  res.write('Content-Type: image/jpeg\r\n\r\n');
  // 实际实现需要连接到ESP32摄像头获取实时流
});

// 静态文件服务 - 提供视频文件访问
app.use('/videos', express.static(videoStoragePath));

// 主页 - 改进的视频查看界面
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>NAS监控系统</title>
        <meta charset="UTF-8">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Segoe UI', Arial, sans-serif; 
                background: #1a1a1a;
                color: #fff;
                padding: 20px;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 10px;
            }
            .header h1 {
                font-size: 2.5em;
                margin-bottom: 10px;
            }
            .status-bar {
                display: flex;
                justify-content: space-around;
                margin-bottom: 20px;
                padding: 15px;
                background: #2a2a2a;
                border-radius: 8px;
            }
            .status-item {
                text-align: center;
            }
            .status-value {
                font-size: 1.5em;
                font-weight: bold;
                color: #667eea;
            }
            .video-container { 
                margin: 20px 0; 
                background: #2a2a2a;
                padding: 20px;
                border-radius: 10px;
            }
            .video-player { 
                width: 100%;
                max-width: 1280px;
                height: auto;
                border-radius: 8px;
                background: #000;
            }
            .camera-selector {
                margin-bottom: 15px;
            }
            select {
                padding: 10px 15px;
                font-size: 16px;
                border-radius: 5px;
                border: none;
                background: #667eea;
                color: white;
                cursor: pointer;
            }
            .video-item { 
                margin: 15px 0; 
                padding: 15px; 
                background: #333;
                border-radius: 8px;
            }
            .controls {
                margin-top: 15px;
                display: flex;
                gap: 10px;
            }
            button {
                padding: 10px 20px;
                font-size: 14px;
                border: none;
                border-radius: 5px;
                background: #667eea;
                color: white;
                cursor: pointer;
                transition: background 0.3s;
            }
            button:hover {
                background: #764ba2;
            }
            .offline-message {
                text-align: center;
                padding: 50px;
                color: #999;
                font-size: 1.2em;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🎥 NAS监控系统</h1>
            <p>实时监控与历史回放</p>
        </div>
        
        <div class="status-bar">
            <div class="status-item">
                <div>在线摄像头</div>
                <div class="status-value" id="cameraCount">0</div>
            </div>
            <div class="status-item">
                <div>当前FPS</div>
                <div class="status-value" id="fpsCounter">0</div>
            </div>
            <div class="status-item">
                <div>运行时间</div>
                <div class="status-value" id="uptime">00:00:00</div>
            </div>
        </div>
        
        <div class="video-container">
            <h2>📹 实时监控</h2>
            <div class="camera-selector">
                <select id="cameraSelect" onchange="changeCamera()">
                    <option value="">选择摄像头</option>
                </select>
            </div>
            <img id="liveStream" src="" alt="实时监控画面" class="video-player" style="display:none;">
            <div id="offlineMessage" class="offline-message">
                暂无摄像头连接，请等待ESP32摄像头上线
            </div>
            <div class="controls">
                <button onclick="refreshCameras()">刷新摄像头列表</button>
                <button onclick="toggleFullscreen()">全屏</button>
            </div>
        </div>
        
        <div class="video-container">
            <h2>📁 历史记录</h2>
            <div id="videoList"></div>
        </div>

        <script>
            let currentCameraId = '';
            let startTime = Date.now();
            
            // 更新运行时间
            function updateUptime() {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const hours = Math.floor(elapsed / 3600).toString().padStart(2, '0');
                const minutes = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
                const seconds = (elapsed % 60).toString().padStart(2, '0');
                document.getElementById('uptime').textContent = hours + ':' + minutes + ':' + seconds;
            }
            setInterval(updateUptime, 1000);
            
            // 刷新摄像头列表
            function refreshCameras() {
                fetch('/api/cameras')
                    .then(response => response.json())
                    .then(cameras => {
                        const select = document.getElementById('cameraSelect');
                        const countElement = document.getElementById('cameraCount');
                        
                        countElement.textContent = cameras.length;
                        
                        // 保留第一个选项
                        select.innerHTML = '<option value="">选择摄像头</option>';
                        
                        cameras.forEach(camera => {
                            const option = document.createElement('option');
                            option.value = camera.cameraId;
                            option.textContent = camera.cameraId + ' (' + camera.resolution + ')';
                            select.appendChild(option);
                        });
                        
                        if (cameras.length > 0 && !currentCameraId) {
                            select.value = cameras[0].cameraId;
                            changeCamera();
                        }
                    })
                    .catch(error => {
                        console.error('获取摄像头列表失败:', error);
                    });
            }
            
            // 切换摄像头
            function changeCamera() {
                const select = document.getElementById('cameraSelect');
                const streamImg = document.getElementById('liveStream');
                const offlineMsg = document.getElementById('offlineMessage');
                
                currentCameraId = select.value;
                
                if (currentCameraId) {
                    streamImg.src = '/api/stream?cameraId=' + currentCameraId + '&t=' + Date.now();
                    streamImg.style.display = 'block';
                    offlineMsg.style.display = 'none';
                    
                    // 计算FPS
                    let frameCount = 0;
                    streamImg.onload = () => {
                        frameCount++;
                    };
                    
                    setInterval(() => {
                        document.getElementById('fpsCounter').textContent = frameCount;
                        frameCount = 0;
                    }, 1000);
                } else {
                    streamImg.style.display = 'none';
                    offlineMsg.style.display = 'block';
                }
            }
            
            // 全屏
            function toggleFullscreen() {
                const img = document.getElementById('liveStream');
                if (img.requestFullscreen) {
                    img.requestFullscreen();
                } else if (img.webkitRequestFullscreen) {
                    img.webkitRequestFullscreen();
                }
            }
            
            // 获取历史视频列表
            function loadHistoryVideos() {
                fetch('/api/videos')
                    .then(response => response.json())
                    .then(videos => {
                        const container = document.getElementById('videoList');
                        if (videos.length === 0) {
                            container.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">暂无历史视频</p>';
                            return;
                        }
                        
                        videos.forEach(video => {
                            const videoElement = document.createElement('div');
                            videoElement.className = 'video-item';
                            videoElement.innerHTML = '
                                <h3>' + video.filename + '</h3>
                                <p>大小: ' + (video.size / 1024 / 1024).toFixed(2) + ' MB</p>
                                <p>时间: ' + new Date(video.timestamp).toLocaleString('zh-CN') + '</p>
                                <video controls width="100%" style="max-width:800px;border-radius:5px;">
                                    <source src="/videos/' + video.filename + '" type="video/mp4">
                                    您的浏览器不支持视频播放。
                                </video>
                            ';
                            container.appendChild(videoElement);
                        });
                    })
                    .catch(error => {
                        console.error('获取视频列表失败:', error);
                        document.getElementById('videoList').innerHTML = '<p style="color:#ff6b6b;">获取历史视频失败</p>';
                    });
            }
            
            // 初始化
            refreshCameras();
            loadHistoryVideos();
            
            // 每10秒刷新一次摄像头列表
            setInterval(refreshCameras, 10000);
        </script>
    </body>
    </html>
  `);
});

// 同步数据库并启动服务
sequelize.sync().then(() => {
  server.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`NAS监控系统服务已启动`);
    console.log(`端口: ${PORT}`);
    console.log(`访问地址: http://localhost:${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}/ws/stream`);
    console.log(`========================================`);
  });
}).catch(err => {
  console.error('数据库连接失败:', err);
});