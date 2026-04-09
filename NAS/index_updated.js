const express = require('express');
const cors = require('cors');
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
const PORT = process.env.PORT || 11111;

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

// 实时视频流接口
app.get('/api/stream', (req, res) => {
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

// 主页 - 提供视频查看界面
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>监控系统</title>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .video-container { margin: 20px 0; }
            .video-item { margin: 10px 0; padding: 10px; border: 1px solid #ccc; }
            .video-player { width: 640px; height: 480px; }
        </style>
    </head>
    <body>
        <h1>监控系统</h1>
        
        <div class="video-container">
            <h2>实时监控</h2>
            <img src="/api/stream" alt="实时监控画面" class="video-player" onerror="this.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'">
        </div>
        
        <div class="video-container">
            <h2>历史记录</h2>
            <div id="videoList"></div>
        </div>

        <script>
            // 获取历史视频列表
            fetch('/api/videos')
                .then(response => response.json())
                .then(videos => {
                    const container = document.getElementById('videoList');
                    if (videos.length === 0) {
                        container.innerHTML = '<p>暂无历史视频</p>';
                        return;
                    }
                    
                    videos.forEach(video => {
                        const videoElement = document.createElement('div');
                        videoElement.className = 'video-item';
                        videoElement.innerHTML = \`
                            <h3>\${video.filename}</h3>
                            <p>大小: \${(video.size / 1024 / 1024).toFixed(2)} MB</p>
                            <p>时间: \${new Date(video.timestamp).toLocaleString()}</p>
                            <video controls width="640" height="480">
                                <source src="/videos/\${video.filename}" type="video/mp4">
                                您的浏览器不支持视频播放。
                            </video>
                        \`;
                        container.appendChild(videoElement);
                    });
                })
                .catch(error => {
                    console.error('获取视频列表失败:', error);
                    document.getElementById('videoList').innerHTML = '<p>获取历史视频失败</p>';
                });
        </script>
    </body>
    </html>
  `);
});

// 同步数据库并启动服务
sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(\`监控系统服务运行在端口 \${PORT}\`);
    console.log(\`访问 http://localhost:\${PORT} 查看监控画面\`);
  });
}).catch(err => {
  console.error('数据库连接失败:', err);
});