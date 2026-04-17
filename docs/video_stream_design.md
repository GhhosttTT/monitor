# 视频流中转架构设计

## 📋 概述

本系统采用**后端中转架构**，ESP32摄像头将视频流推送到后端服务器，后端负责：
1. **实时转发** - 将视频流转发给前端客户端
2. **录像存储** - 将视频流保存为5分钟一段的MP4文件到NAS

---

## 🏗️ 系统架构

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  ESP32-CAM  │────────▶│   Backend    │────────▶│   Browser   │
│             │  MJPEG  │  (Node.js)   │  MJPEG  │   (Frontend)│
│  /stream    │  HTTP   │              │  HTTP   │             │
└─────────────┘         └──────┬───────┘         └─────────────┘
                               │
                        ┌──────┴───────┐
                        │  FFmpeg      │
                        │  录制服务     │
                        └──────┬───────┘
                               │
                        ┌──────┴───────┐
                        │  NAS Storage │
                        │  /videos/    │
                        │  CAM_001/    │
                        │  xxx.mp4     │
                        └──────────────┘
```

---

## 🔄 数据流

### **1. 实时视频流（MJPEG）**

```
ESP32 (端口80)
  ↓ HTTP GET /stream
  ↓ Content-Type: multipart/x-mixed-replace
Backend (端口5002)
  ↓ 代理转发
  ↓ pipe() 直接管道
Frontend
  ↓ <img src="http://backend:5002/api/cameras/1/stream">
  ↓ 浏览器自动解析MJPEG
用户看到实时画面
```

**特点**：
- ✅ 低延迟（<500ms）
- ✅ 无需转码，性能开销小
- ✅ 支持多客户端同时观看
- ❌ 带宽占用较高（每个客户端独立连接ESP32）

---

### **2. 录像存储流程**

```
ESP32 (持续推流)
  ↓
Backend (接收流)
  ↓ FFmpeg 进程
  ↓ 每5分钟分割一次
  ↓ H.264编码 + MP4封装
NAS/videos/CAM_001/
  ├─ 20260413_120000.mp4  (12:00-12:05)
  ├─ 20260413_120500.mp4  (12:05-12:10)
  └─ 20260413_121000.mp4  (12:10-12:15)
  ↓
Database (Video表)
  ├─ filename: 20260413_120000.mp4
  ├─ fileUrl: /videos/CAM_001/20260413_120000.mp4
  ├─ duration: 300 (秒)
  ├─ size: 52428800 (50MB)
  └─ startTime: 2026-04-13 12:00:00
```

**特点**：
- ✅ 固定5分钟一段，便于管理
- ✅ H.264压缩，节省存储空间
- ✅ 数据库记录元数据，支持快速检索
- ⚠️ 需要FFmpeg进行编码（CPU占用中等）

---

## 🔧 技术实现

### **1. ESP32端配置**

#### **动态配网（WiFiManager）**

ESP32启动时：
1. 检查EEPROM中是否有配置
2. 如果没有，创建热点 `ESP32-CAM-Config`
3. 用户通过网页配置：
   - 后端地址：`http://monitor-backend.local:5002` 或 `http://192.168.1.10:5002`
   - 设备ID：`CAM_001`
   - 使用mDNS：是/否
4. 保存到EEPROM，重启后自动连接

#### **视频流服务**

```cpp
// ESP32_Monitor_New.ino
void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  
  httpd_uri_t stream_uri = {
    .uri = "/stream",
    .method = HTTP_GET,
    .handler = stream_handler,  // MJPEG流处理函数
    .user_ctx = NULL
  };
  
  httpd_register_uri_handler(&stream_httpd, &stream_uri);
}

esp_err_t stream_handler(httpd_req_t *req) {
  // 设置MJPEG响应头
  httpd_resp_set_type(req, "multipart/x-mixed-replace;boundary=frame");
  
  while (true) {
    camera_fb_t *fb = esp_camera_fb_get();  // 获取一帧
    
    // 发送JPEG帧
    httpd_resp_send_chunk(req, "\r\n--frame\r\n", 11);
    httpd_resp_send_chunk(req, "Content-Type: image/jpeg\r\n\r\n", 29);
    httpd_resp_send_chunk(req, (const char *)fb->buf, fb->len);
    
    esp_camera_fb_return(fb);
    delay(100);  // 约10fps
  }
}
```

---

### **2. 后端实现**

#### **视频流中转代理**

文件：`app-backend/src/routes/camera.js`

```javascript
router.get('/:id/stream', async (req, res) => {
  const camera = await Camera.findByPk(req.params.id);
  
  // 设置MJPEG响应头
  res.setHeader('Content-Type', 'multipart/x-mixed-replace;boundary=frame');
  res.setHeader('Cache-Control', 'no-cache');
  
  // 从ESP32获取流
  const esp32Url = `http://${camera.ipAddress}/stream`;
  const esp32Request = http.get(esp32Url, (esp32Response) => {
    // 直接管道到客户端（零拷贝转发）
    esp32Response.pipe(res);
  });
  
  // 处理断开连接
  req.on('close', () => {
    esp32Request.destroy();
  });
});
```

**优势**：
- 使用 `pipe()` 直接转发，内存占用极低
- 不需要解码/重新编码，CPU占用小
- 支持多个客户端同时观看

---

#### **录像服务（待实现）**

文件：`app-backend/src/services/recording.js`（需要创建）

```javascript
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

class RecordingService {
  /**
   * 开始录制摄像头的视频流
   */
  async startRecording(cameraId, cameraIp) {
    const outputDir = path.join(__dirname, '../../../NAS/videos', cameraId);
    
    // 确保目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 生成文件名（5分钟一段）
    const now = new Date();
    const filename = this.generateFilename(now);
    const outputPath = path.join(outputDir, filename);
    
    console.log(`🎥 开始录制: ${filename}`);
    
    // 使用FFmpeg从ESP32拉流并录制
    const esp32StreamUrl = `http://${cameraIp}/stream`;
    
    const ffmpegProcess = ffmpeg(esp32StreamUrl)
      .inputOptions([
        '-f', 'mjpeg',           // 输入格式
        '-framerate', '10',      // 帧率
        '-re'                    // 按实时速度读取
      ])
      .outputOptions([
        '-c:v', 'libx264',       // H.264编码
        '-preset', 'ultrafast',  // 快速编码
        '-tune', 'zerolatency',  // 低延迟
        '-crf', '23',            // 质量参数
        '-t', '300',             // 录制300秒（5分钟）
        '-movflags', '+faststart', // 优化在线播放
        '-f', 'mp4'
      ])
      .on('end', () => {
        console.log(`✅ 录制完成: ${filename}`);
        
        // 保存视频记录到数据库
        this.saveVideoRecord(cameraId, filename, outputPath);
        
        // 自动开始下一段录制
        setTimeout(() => {
          this.startRecording(cameraId, cameraIp);
        }, 1000);
      })
      .on('error', (err) => {
        console.error(`❌ 录制失败: ${err.message}`);
        
        // 5秒后重试
        setTimeout(() => {
          this.startRecording(cameraId, cameraIp);
        }, 5000);
      })
      .save(outputPath);
    
    return ffmpegProcess;
  }
  
  /**
   * 生成文件名
   */
  generateFilename(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}_${hours}${minutes}${seconds}.mp4`;
  }
  
  /**
   * 保存视频记录到数据库
   */
  async saveVideoRecord(cameraId, filename, filePath) {
    const Video = require('../models/Video');
    const fs = require('fs').promises;
    
    const stats = await fs.stat(filePath);
    
    await Video.create({
      cameraId,
      filename,
      fileUrl: `/videos/${cameraId}/${filename}`,
      duration: 300,  // 5分钟
      size: stats.size,
      resolution: '2k',
      hasMotion: false,
      startTime: new Date(),
      endTime: new Date(Date.now() + 300000),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  // 30天后过期
    });
  }
}

module.exports = new RecordingService();
```

---

### **3. 前端访问**

文件：`frontend/src/pages/CameraManagement.jsx`

```jsx
<img 
  src={`http://192.168.1.10:5002/api/cameras/${currentCamera.id}/stream`}
  alt="实时视频流"
/>
```

**工作流程**：
1. 前端请求后端API
2. 后端从数据库获取摄像头IP
3. 后端建立到ESP32的HTTP连接
4. 后端将ESP32的MJPEG流直接转发给前端
5. 浏览器自动解析并显示视频

---

## 📊 性能分析

### **带宽消耗**

假设：
- ESP32输出：MJPEG，10fps，每帧50KB
- 单路流带宽：50KB × 10fps = 500KB/s ≈ 4Mbps

| 场景 | 上行（ESP32→后端） | 下行（后端→前端） | 说明 |
|------|-------------------|-------------------|------|
| 1个客户端观看 | 4 Mbps | 4 Mbps | 后端透传 |
| 5个客户端观看 | 4 Mbps | 20 Mbps | 后端复制5份 |
| 10个客户端观看 | 4 Mbps | 40 Mbps | 后端复制10份 |

**优化建议**：
- 如果客户端很多，考虑使用WebRTC（P2P）
- 或者降低ESP32输出质量（降低分辨率/帧率）

---

### **存储消耗**

假设：
- 5分钟一段
- H.264编码，CRF=23
- 平均码率：2Mbps

| 时长 | 文件大小 | 每天 | 每月（30天） |
|------|---------|------|-------------|
| 5分钟 | ~75 MB | 21.6 GB | 648 GB |
| 1小时 | ~900 MB | - | - |

**优化建议**：
- 启用移动侦测，只在有运动时录制
- 定期清理过期视频（当前设置30天）
- 使用硬盘阵列（RAID）提高可靠性

---

### **CPU占用**

| 任务 | CPU占用 | 说明 |
|------|---------|------|
| 视频流转发 | <5% | 仅pipe，无编解码 |
| FFmpeg录制 | 30-50% | H.264编码（单核） |
| 数据库操作 | <1% | 每5分钟一次写入 |

**优化建议**：
- 使用硬件加速（Intel Quick Sync / NVIDIA NVENC）
- 多摄像头时分散到不同CPU核心

---

## 🔐 安全性

### **当前状态**
- ❌ 无认证（开发阶段）
- ❌ 无加密（HTTP明文传输）
- ✅ CORS已配置

### **生产环境建议**
1. **添加API认证**
   ```javascript
   // JWT Token验证
   const auth = require('../middleware/auth');
   router.get('/:id/stream', auth, async (req, res) => { ... });
   ```

2. **启用HTTPS**
   ```javascript
   const https = require('https');
   const server = https.createServer(sslOptions, app);
   ```

3. **限制访问频率**
   ```javascript
   const rateLimit = require('express-rate-limit');
   const streamLimiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 100
   });
   router.use('/:id/stream', streamLimiter);
   ```

---

## 🚀 部署指南

### **1. 后端部署**

```bash
cd app-backend
npm install
npm install mdns  # mDNS支持

# 配置环境变量
cp .env.example .env
# 编辑 .env，设置数据库密码等

# 启动
npm start
```

### **2. ESP32烧录**

1. 安装Arduino库：
   - WiFiManager by tzapu
   - ESPAsyncWebServer（可选）

2. 烧录 `ESP32_Monitor_New.ino`

3. 首次配网：
   - 连接热点 `ESP32-CAM-Config`
   - 访问 `http://192.168.4.1`
   - 填写后端地址和设备ID

### **3. 前端部署**

```bash
cd monitor-system/frontend
npm install
npm run build

# 部署dist目录到Nginx
```

---

## 📝 API接口

### **1. 获取视频流**

```
GET /api/cameras/:id/stream
```

**响应**：
- Content-Type: `multipart/x-mixed-replace;boundary=frame`
- Body: MJPEG流

**示例**：
```html
<img src="http://192.168.1.10:5002/api/cameras/1/stream" />
```

---

### **2. 设备注册**

```
POST /api/cameras/register
Content-Type: application/json

{
  "serialNumber": "CAM_001",
  "ip": "192.168.1.109"
}
```

**响应**：
```json
{
  "message": "设备注册成功",
  "cameraId": 1,
  "ipAddress": "192.168.1.109"
}
```

---

### **3. 心跳上报**

```
POST /api/cameras/heartbeat
Content-Type: application/json

{
  "serialNumber": "CAM_001",
  "ipAddress": "192.168.1.109",
  "storageUsed": 1024000
}
```

---

## 🐛 故障排查

### **问题1：视频流无法显示**

**检查步骤**：
1. ESP32是否在线？
   ```bash
   ping 192.168.1.109
   ```

2. ESP32的/stream接口是否正常？
   ```bash
   curl http://192.168.1.109/stream
   ```

3. 后端日志是否有错误？
   ```bash
   tail -f backend.log
   ```

4. 浏览器控制台是否有CORS错误？

---

### **问题2：录像没有生成**

**检查步骤**：
1. FFmpeg是否安装？
   ```bash
   ffmpeg -version
   ```

2. NAS/videos目录是否有写权限？
   ```bash
   ls -la NAS/videos/
   chmod 755 NAS/videos/
   ```

3. 后端日志是否有FFmpeg错误？

---

### **问题3：多客户端卡顿**

**原因**：ESP32性能有限，无法同时处理多个HTTP连接

**解决方案**：
1. 后端缓存视频流（需要实现）
2. 降低ESP32输出质量
3. 使用WebRTC替代MJPEG

---

## 📈 未来优化方向

### **短期（1-2周）**
- [ ] 实现FFmpeg录像服务
- [ ] 添加移动侦测触发录制
- [ ] 优化视频流缓存机制

### **中期（1-2月）**
- [ ] 支持WebRTC低延迟传输
- [ ] 添加视频回放功能
- [ ] 实现告警推送（邮件/微信）

### **长期（3-6月）**
- [ ] AI物体检测（TensorFlow.js）
- [ ] 多节点集群支持
- [ ] 云端备份集成

---

## 📚 参考资料

- [MJPEG协议规范](https://en.wikipedia.org/wiki/Motion_JPEG)
- [FFmpeg官方文档](https://ffmpeg.org/documentation.html)
- [ESP32-CAM教程](https://randomnerdtutorials.com/esp32-cam-video-streaming-web-server-camera-home-assistant/)
- [Node.js Stream API](https://nodejs.org/api/stream.html)

---

**文档版本**: v1.0  
**最后更新**: 2026-04-13  
**维护者**: 开发团队
