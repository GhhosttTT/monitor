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
const { spawn } = require('child_process');

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

// ESP32摄像头IP配置(初始为null，会从WebSocket注册时自动获取)
const ESP32_CAMERAS = {
  'CAM_001': null  // IP会自动从ESP32的WebSocket注册获取
};

// 更新ESP32的IP地址
function updateESP32IP(cameraId, ip) {
  if (ESP32_CAMERAS[cameraId] !== ip) {
    ESP32_CAMERAS[cameraId] = ip;
    console.log(`🔄 更新 ${cameraId} IP: ${ip}`);
    
    // 如果IP更新了且之前在录制，重启录制
    if (recordingSessions.has(cameraId)) {
      console.log(`🔄 ${cameraId} IP已更新，重启录制...`);
      stopRecordingSession(cameraId);
      setTimeout(() => startRecordingSession(cameraId), 1000);
    }
  }
}

// 视频录制管理器
const recordingSessions = new Map();
const pendingSegments = new Map(); // 保存即将关闭的session数据（ffmpeg close时使用）

// 帧推送服务管理器
const framePushers = new Map();

// 启动视频录制会话 - 每5分钟一个文件
function startRecordingSession(cameraId) {
  if (recordingSessions.has(cameraId)) {
    return; // 已经在录制
  }
  
  const esp32Ip = ESP32_CAMERAS[cameraId];
  if (!esp32Ip) {
    console.log(`⚠️ 摄像头 ${cameraId} 未配置IP`);
    return;
  }
  
  const now = new Date();
  const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
  const filename = `${timestamp}.mp4`;
  
  // 为每个摄像头创建独立文件夹
  const cameraFolder = path.join(videoStoragePath, cameraId);
  if (!fs.existsSync(cameraFolder)) {
    fs.mkdirSync(cameraFolder, { recursive: true });
    console.log(`📁 创建摄像头文件夹: ${cameraFolder}`);
  }
  
  const filepath = path.join(cameraFolder, filename);
  
  console.log(`🎥 [${cameraId}] 开始录制: ${filename} (5分钟后自动分割)`);
  
  // 启动流缓存（如果还没启动）
  startStreamCache(cameraId, esp32Ip);
  
  // 使用ffmpeg从stdin接收JPEG帧
  const ffmpegArgs = [
    '-y',
    '-f', 'image2pipe',     // 从管道读取图像
    '-vcodec', 'mjpeg',     // 输入格式为MJPEG
    '-i', '-',              // 从stdin读取
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '23',
    '-r', '10',             // 输出帧率10fps
    '-pix_fmt', 'yuv420p',
    // 移除 -t 参数，由代码控制录制时长
    filepath
  ];
  
  console.log('🔧 FFmpeg参数:', ffmpegArgs.join(' '));
  
  const ffmpeg = spawn('ffmpeg', ffmpegArgs);
  
  ffmpeg.stderr.on('data', (data) => {
    console.log('FFmpeg:', data.toString().trim());
  });
  
  ffmpeg.on('close', (code) => {
    console.log(`📹 [${cameraId}] 录制结束: ${filename}, 退出码: ${code}`);
    
    // 优先从 pendingSegments 读取，否则从 recordingSessions 读取
    const sessionData = pendingSegments.get(cameraId) || recordingSessions.get(cameraId);
    
    if (code === 0 && fs.existsSync(filepath)) {
      const stats = fs.statSync(filepath);
      
      // 检查是片段录制（1分钟）还是最终录制（5分钟）
      if (sessionData && sessionData.segmentStartTime) {
        const segmentDuration = (Date.now() - sessionData.segmentStartTime.getTime()) / 1000;
        
        if (segmentDuration < 120) {
          // 这是一个1分钟片段，保存并继续
          console.log(`📦 [${cameraId}] 片段录制完成: ${filename} (${segmentDuration.toFixed(1)}秒)`);
          
          if (!sessionData.segments) sessionData.segments = [];
          sessionData.segments.push(filepath);
          
          // 检查是否已经积累了5分钟（至少4个片段，说明已经到了第5个）
          const totalDuration = (Date.now() - sessionData.startTime.getTime()) / 1000;
          
          if (totalDuration >= 295 && sessionData.segments.length >= 4) {
            // 达到5分钟，开始拼接
            console.log(`🔗 [${cameraId}] 5分钟已到，开始拼接 ${sessionData.segments.length} 个片段...`);
            
            // 清理 pendingSegments
            pendingSegments.delete(cameraId);
            
            // 执行拼接
            mergeSegments(cameraId, sessionData);
            return;
          }
          
          // 清理 pendingSegments
          pendingSegments.delete(cameraId);
          
          // 继续下一分钟录制
          setTimeout(() => {
            recordingSessions.delete(cameraId);
            startRecordingSession(cameraId);
          }, 1000);
        } else {
          // 这是最终拼接后的5分钟视频
          console.log(`✅ [${cameraId}] 5分钟视频拼接完成: ${filename}`);
          
          // 保存到数据库
          const Video = require('./models/Video');
          Video.create({
            filename: filename,
            filepath: filepath,
            size: stats.size,
            cameraId: cameraId,
            timestamp: sessionData.startTime
          }).then(() => {
            console.log(`✅ [${cameraId}] 视频已保存到数据库: ${filename}`);
          }).catch(err => {
            console.error('❌ 保存视频记录失败:', err);
          });
          
          // 清理片段文件
          if (sessionData.segments) {
            sessionData.segments.forEach(segPath => {
              try {
                if (fs.existsSync(segPath)) {
                  fs.unlinkSync(segPath);
                  console.log(`🗑️ 删除临时片段: ${segPath}`);
                }
              } catch (e) {
                console.error('删除片段失败:', e.message);
              }
            });
          }
          
          // 清理 pendingSegments
          pendingSegments.delete(cameraId);
          
          // 开始下一个5分钟周期
          setTimeout(() => {
            recordingSessions.delete(cameraId);
            startRecordingSession(cameraId);
          }, 2000);
        }
      } else {
        // 旧逻辑兼容
        pendingSegments.delete(cameraId);
        setTimeout(() => {
          recordingSessions.delete(cameraId);
          startRecordingSession(cameraId);
        }, 2000);
      }
    } else {
      // 录制失败，重试
      pendingSegments.delete(cameraId);
      setTimeout(() => {
        recordingSessions.delete(cameraId);
        startRecordingSession(cameraId);
      }, 2000);
    }
  });
  
  recordingSessions.set(cameraId, {
    ffmpeg,
    filename,
    filepath,
    startTime: now,
    frameCount: 0,
    lastFrameTimestamp: 0,
    segmentStartTime: now, // 记录当前片段的开始时间
    segments: [] // 保存已完成的片段路径
  });
  
  // 启动帧推送服务
  startFramePusher(cameraId);
}

// 停止视频录制会话
function stopRecordingSession(cameraId) {
  const session = recordingSessions.get(cameraId);
  if (session) {
    console.log(`⏹️ 停止录制: ${session.filename}`);
    
    // 保存session数据到pendingSegments，供ffmpeg close时使用
    pendingSegments.set(cameraId, {
      startTime: session.startTime,
      segments: session.segments || [],
      segmentStartTime: session.segmentStartTime,
      filename: session.filename,
      filepath: session.filepath
    });
    
    session.ffmpeg.stdin.end(); // 关闭stdin，ffmpeg会自动结束
    recordingSessions.delete(cameraId);
  }
  
  // 停止帧推送服务
  const pusher = framePushers.get(cameraId);
  if (pusher) {
    clearInterval(pusher);
    framePushers.delete(cameraId);
    console.log(`🛑 [${cameraId}] 帧推送服务已停止`);
  }
}

// 向录制会话添加帧（从流缓存）
function addFrameToRecording(cameraId, frameBuffer) {
  const session = recordingSessions.get(cameraId);
  if (!session || !session.ffmpeg.stdin.writable) {
    return;
  }
  
  // 写入JPEG帧到ffmpeg stdin
  session.ffmpeg.stdin.write(frameBuffer);
  session.frameCount++;
  
  // 每100帧打印一次日志
  if (session.frameCount % 100 === 0) {
    const elapsedSeconds = (Date.now() - session.startTime.getTime()) / 1000;
    console.log(`✍️ [${cameraId}] 已写入 ${session.frameCount} 帧到ffmpeg，耗时: ${elapsedSeconds.toFixed(1)}秒`);
  }
  
  // 检查是否达到1分钟（60秒）- 自动分割片段
  const elapsedSeconds = (Date.now() - session.startTime.getTime()) / 1000;
  const segmentElapsedSeconds = (Date.now() - session.segmentStartTime.getTime()) / 1000;
  
  if (segmentElapsedSeconds >= 60 && elapsedSeconds < 300) {
    console.log(`⏱️ [${cameraId}] 片段已满60秒，准备切换...`);
    // 停止当前ffmpeg进程，让on('close')处理片段保存和下一段启动
    stopRecordingSession(cameraId);
  } else if (elapsedSeconds >= 300) {
    console.log(`⏱️ [${cameraId}] 已达到5分钟 (${elapsedSeconds.toFixed(1)}秒)，停止当前录制`);
    stopRecordingSession(cameraId);
    setTimeout(() => startRecordingSession(cameraId), 2000);
  }
}

// 启动帧推送服务（将缓存帧推送到ffmpeg）
function startFramePusher(cameraId) {
  if (framePushers.has(cameraId)) {
    return; // 已存在
  }
  
  console.log(`📤 [${cameraId}] 启动帧推送服务...`);
  
  const pusher = setInterval(() => {
    const cache = streamCache.get(cameraId);
    const session = recordingSessions.get(cameraId);
    
    if (!session || !cache || !cache.latestFrame || !session.ffmpeg.stdin.writable) {
      return;
    }
    
    // 检查是否需要发送新帧（避免重复发送同一帧）
    if (cache.timestamp > session.lastFrameTimestamp) {
      session.lastFrameTimestamp = cache.timestamp;
      addFrameToRecording(cameraId, cache.latestFrame);
    }
  }, 100); // 每100ms检查一次（10fps）
  
  framePushers.set(cameraId, pusher);
}

// 合并多个视频片段为一个完整的5分钟视频
function mergeSegments(cameraId, sessionData) {
  const segments = sessionData.segments;
  
  if (!segments || segments.length === 0) {
    console.log(`❌ [${cameraId}] 没有片段可以拼接`);
    return;
  }
  
  console.log(`🔧 [${cameraId}] 开始拼接 ${segments.length} 个片段:`);
  segments.forEach((seg, i) => {
    console.log(`   片段${i + 1}: ${seg}`);
  });
  
  const now = sessionData.startTime;
  const finalTimestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
  const finalFilename = `${finalTimestamp}_merged.mp4`;
  const cameraFolder = path.join(videoStoragePath, cameraId);
  const finalFilepath = path.join(cameraFolder, finalFilename);
  
  // 生成FFmpeg concat所需的file列表
  const listFilePath = path.join(cameraFolder, 'concat_list.txt');
  const fileListContent = segments.map(seg => `file '${seg}'`).join('\n');
  fs.writeFileSync(listFilePath, fileListContent);
  console.log(`📝 已创建拼接列表: ${listFilePath}`);
  
  // 使用concat demuxer拼接视频
  const mergeArgs = [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listFilePath,
    '-c', 'copy', // 直接复制流，不重新编码（快速）
    finalFilepath
  ];
  
  console.log(`🔧 [${cameraId}] FFmpeg拼接参数: ${mergeArgs.join(' ')}`);
  
  const ffmpegMerge = spawn('ffmpeg', mergeArgs);
  
  ffmpegMerge.stderr.on('data', (data) => {
    console.log('FFmpeg(merge):', data.toString().trim());
  });
  
  ffmpegMerge.on('close', (code) => {
    // 清理临时列表文件
    try {
      if (fs.existsSync(listFilePath)) {
        fs.unlinkSync(listFilePath);
      }
    } catch (e) {
      console.error('删除列表文件失败:', e.message);
    }
    
    if (code === 0 && fs.existsSync(finalFilepath)) {
      console.log(`✅ [${cameraId}] 拼接成功: ${finalFilename}`);
      
      // 将最终文件保存到数据库
      const stats = fs.statSync(finalFilepath);
      const Video = require('./models/Video');
      Video.create({
        filename: finalFilename,
        filepath: finalFilepath,
        size: stats.size,
        cameraId: cameraId,
        timestamp: now
      }).then(() => {
        console.log(`✅ [${cameraId}] 拼接视频已保存到数据库: ${finalFilename}`);
      }).catch(err => {
        console.error('❌ 保存视频记录失败:', err);
      });
      
      // 删除临时片段文件
      segments.forEach(segPath => {
        try {
          if (fs.existsSync(segPath)) {
            fs.unlinkSync(segPath);
            console.log(`🗑️ 删除临时片段: ${segPath}`);
          }
        } catch (e) {
          console.error('删除片段失败:', e.message);
        }
      });
      
      // 开始下一个5分钟周期
      setTimeout(() => {
        recordingSessions.delete(cameraId);
        startRecordingSession(cameraId);
      }, 2000);
    } else {
      console.error(`❌ [${cameraId}] 拼接失败，退出码: ${code}`);
      // 如果拼接失败，开始下一个5分钟周期
      setTimeout(() => {
        recordingSessions.delete(cameraId);
        startRecordingSession(cameraId);
      }, 5000);
    }
  });
}

// WebSocket连接处理
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`新的WebSocket连接来自: ${clientIp}`);
  
  let cameraId = null;
  
  ws.on('message', (message, isBinary) => {
    try {
      // 如果是二进制数据，直接处理帧
      if (isBinary) {
        if (cameraId) {
          const camera = connectedCameras.get(cameraId);
          if (camera) {
            camera.lastFrameTime = Date.now();
            camera.lastFrame = message;
            console.log(`📷 收到摄像头 ${cameraId} 的帧, 大小: ${message.length} bytes`);
          }
        }
        return;
      }
      
      // 尝试解析JSON消息（控制命令）
      const data = JSON.parse(message.toString());
      console.log('收到JSON消息:', data);
      
      if (data.event === 'camera-register') {
        cameraId = data.cameraId;
        
        // 自动更新 ESP32_CAMERAS 中的 IP（实现 IP 自动适配）
        updateESP32IP(cameraId, clientIp);
        
        connectedCameras.set(cameraId, {
          ws,
          info: data,
          connectedAt: new Date(),
          lastFrameTime: Date.now(),
          lastHeartbeat: Date.now(), // 初始化心跳时间
          status: 'online',
          ip: clientIp
        });
        
        console.log(`✅ 摄像头注册成功: ${cameraId}, IP: ${clientIp}`);
        
        // 发送确认消息
        ws.send(JSON.stringify({
          type: 'register-success',
          message: '摄像头注册成功',
          cameraId,
          ip: clientIp
        }));
        
        // 如果之前没有录制，自动启动
        if (!recordingSessions.has(cameraId)) {
          console.log(`🎬 自动启动 ${cameraId} 录制...`);
          setTimeout(() => startRecordingSession(cameraId), 1000);
        }
      }
      
      // 处理心跳消息
      if (data.event === 'heartbeat') {
        const camera = connectedCameras.get(data.cameraId);
        if (camera) {
          camera.lastHeartbeat = Date.now();
          camera.status = 'online';
          
          // 回复心跳确认
          ws.send(JSON.stringify({
            type: 'heartbeat-ack',
            timestamp: Date.now()
          }));
        }
      }
    } catch (e) {
      console.log('消息解析错误:', e.message);
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`WebSocket连接关闭 (code: ${code}), 摄像头: ${cameraId || '未注册'}`);
    if (cameraId) {
      const camera = connectedCameras.get(cameraId);
      if (camera) {
        camera.status = 'offline';
        camera.disconnectedAt = new Date();
        console.log(`⚠️ 摄像头 ${cameraId} 已离线`);
      }
      
      // 停止该摄像头的录制
      if (recordingSessions.has(cameraId)) {
        console.log(`⏹️ 摄像头断开，停止 ${cameraId} 录制`);
        stopRecordingSession(cameraId);
      }
      
      // 不立即删除，保留状态信息
      setTimeout(() => {
        if (connectedCameras.get(cameraId)?.status === 'offline') {
          connectedCameras.delete(cameraId);
          console.log(`🗑️ 清理离线摄像头 ${cameraId}`);
        }
      }, 60000); // 1分钟后清理
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket错误:', error.message);
    if (cameraId) {
      const camera = connectedCameras.get(cameraId);
      if (camera) {
        camera.status = 'error';
        console.log(`❌ 摄像头 ${cameraId} 连接错误`);
      }
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

// 视频流缓存管理器（单例模式）
const streamCache = new Map(); // cameraId -> { latestFrame, timestamp, clients }

// 启动流缓存服务
function startStreamCache(cameraId, esp32Ip) {
  if (streamCache.has(cameraId)) {
    return; // 已存在，不重复启动
  }
  
  console.log(`🔄 [${cameraId}] 启动流缓存服务...`);
  
  const cache = {
    latestFrame: null,
    timestamp: 0,
    clients: [],
    sourceConnection: null,
    reconnectTimer: null
  };
  
  streamCache.set(cameraId, cache);
  connectToESP32Stream(cameraId, esp32Ip, cache);
}

// 连接到ESP32视频流
function connectToESP32Stream(cameraId, esp32Ip, cache) {
  const http = require('http');
  
  function connect() {
    if (cache.sourceConnection) {
      cache.sourceConnection.destroy();
    }
    
    console.log(`🔌 [${cameraId}] 连接到 ESP32: ${esp32Ip}/stream`);
    
    const req = http.request({
      hostname: esp32Ip,
      port: 80,
      path: '/stream',
      method: 'GET',
      timeout: 0
    }, (res) => {
      console.log(`✅ [${cameraId}] ESP32流连接成功`);
      
      let buffer = Buffer.alloc(0);
      let frameCount = 0;
      
      res.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        
        // 解析MJPEG帧边界
        const boundary = '\r\n--frame\r\n';
        const boundaryBuffer = Buffer.from(boundary);
        
        let startPos = 0;
        while (true) {
          const frameStart = buffer.indexOf(boundaryBuffer, startPos);
          if (frameStart === -1) break;
          
          const nextFrameStart = buffer.indexOf(boundaryBuffer, frameStart + boundaryBuffer.length);
          if (nextFrameStart === -1) break; // 等待完整帧
          
          // 提取JPEG数据（跳过头部信息）
          const headerEnd = buffer.indexOf('\r\n\r\n', frameStart);
          if (headerEnd !== -1 && headerEnd < nextFrameStart) {
            const jpegData = buffer.slice(headerEnd + 4, nextFrameStart);
            
            // 更新缓存
            cache.latestFrame = jpegData;
            cache.timestamp = Date.now();
            frameCount++;
            
            if (frameCount % 10 === 0) {
              console.log(`📸 [${cameraId}] 已缓存 ${frameCount} 帧, 最新帧大小: ${jpegData.length} bytes`);
            }
            
            // 分发给所有客户端
            cache.clients.forEach(client => {
              if (!client.res.writableEnded) {
                try {
                  client.res.write('--frame\r\n');
                  client.res.write('Content-Type: image/jpeg\r\n');
                  client.res.write('\r\n');
                  client.res.write(jpegData);
                  client.res.write('\r\n');
                } catch (e) {
                  // 客户端已断开，忽略
                }
              }
            });
          }
          
          startPos = nextFrameStart;
        }
        
        // 清理缓冲区（保留最后50KB防止大帧被截断）
        if (buffer.length > 51200) {
          buffer = buffer.slice(-51200);
        }
      });
      
      res.on('end', () => {
        console.log(`⚠️ [${cameraId}] ESP32流断开，3秒后重连...`);
        cache.reconnectTimer = setTimeout(connect, 3000);
      });
      
      res.on('error', (err) => {
        console.error(`❌ [${cameraId}] ESP32流错误:`, err.message);
        cache.reconnectTimer = setTimeout(connect, 3000);
      });
    });
    
    req.on('error', (err) => {
      console.error(`❌ [${cameraId}] 连接ESP32失败:`, err.message);
      cache.reconnectTimer = setTimeout(connect, 3000);
    });
    
    req.end();
    cache.sourceConnection = req;
  }
  
  connect();
}

// 实时视频流接口 - NAS作为中转站，复用单个ESP32连接
app.get('/api/stream', (req, res) => {
  const cameraId = req.query.cameraId || 'CAM_001';
  
  const esp32Ip = ESP32_CAMERAS[cameraId];
  if (!esp32Ip) {
    // ESP32尚未注册，返回等待状态并自动重试
    console.log(`⚠️ [${cameraId}] ESP32未注册，等待连接...`);
    
    // 设置响应头
    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    // 发送一个黑色占位帧（1x1 像素 JPEG）
    // 避免绿色块显示问题
    const placeholder = Buffer.from(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AVBZ//9k=',
      'base64'
    );
    
    res.write('--frame\r\n');
    res.write('Content-Type: image/jpeg\r\n');
    res.write('\r\n');
    res.write(placeholder);
    res.write('\r\n');
    
    // 每2秒检查一次ESP32是否已注册
    const checkInterval = setInterval(() => {
      const newIp = ESP32_CAMERAS[cameraId];
      if (newIp && !res.writableEnded) {
        console.log(`✅ [${cameraId}] ESP32已注册 (${newIp})，重新启动流...`);
        clearInterval(checkInterval);
        clearInterval(placeholderInterval);
        
        // 关闭当前连接，让浏览器重新请求
        res.end();
        
        // 启动流缓存
        startStreamCache(cameraId, newIp);
      }
    }, 2000);
    
    // 客户端断开时清理定时器
    req.on('close', () => {
      clearInterval(checkInterval);
      clearInterval(placeholderInterval);
      console.log(`👋 [${cameraId}] 客户端断开（等待注册状态）`);
    });
    
    return;
  }
  
  console.log(`📡 前端请求视频流 [${cameraId}]`);
  
  // 启动流缓存（如果还没启动）
  startStreamCache(cameraId, esp32Ip);
  
  const cache = streamCache.get(cameraId);
  
  // 设置响应头
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Pragma': 'no-cache'
  });
  
  // 黑色占位帧（1x1 像素 JPEG）
  const placeholder = Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AVBZ//9k=',
    'base64'
  );
  
  // 持续发送占位帧，保持连接活跃，直到ESP32推送真实帧
  const heartbeatInterval = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(heartbeatInterval);
      return;
    }
    // 如果还没有真实帧，继续发送占位帧
    if (!cache.latestFrame || cache.latestFrame.length <= 100) {
      res.write('--frame\r\n');
      res.write('Content-Type: image/jpeg\r\n');
      res.write('\r\n');
      res.write(placeholder);
      res.write('\r\n');
    }
  }, 500);
  
  // 如果有缓存帧，立即发送
  if (cache.latestFrame && cache.latestFrame.length > 100) {
    res.write('--frame\r\n');
    res.write('Content-Type: image/jpeg\r\n');
    res.write('\r\n');
    res.write(cache.latestFrame);
    res.write('\r\n');
  }
  
  // 添加到客户端列表
  const client = { res, addedAt: Date.now(), heartbeatInterval };
  cache.clients.push(client);
  
  // 客户端断开时移除
  req.on('close', () => {
    const index = cache.clients.indexOf(client);
    if (index !== -1) {
      clearInterval(client.heartbeatInterval);
      cache.clients.splice(index, 1);
    }
    console.log(`👋 [${cameraId}] 客户端断开，剩余${cache.clients.length}个客户端`);
  });
});

// 获取所有连接的摄像头
app.get('/api/cameras', (req, res) => {
  const camerasMap = new Map();
  
  // 添加WebSocket连接的摄像头（包含状态信息）
  for (const [id, camera] of connectedCameras.entries()) {
    const timeSinceHeartbeat = Date.now() - (camera.lastHeartbeat || 0);
    const isOnline = camera.status === 'online' && timeSinceHeartbeat < 30000;
    
    camerasMap.set(id, {
      cameraId: id,
      ...camera.info,
      connectedAt: camera.connectedAt,
      lastFrameTime: camera.lastFrameTime,
      lastHeartbeat: camera.lastHeartbeat,
      status: isOnline ? 'online' : 'offline',
      type: 'websocket',
      ip: camera.ip
    });
  }
  
  // 添加配置的ESP32摄像头(HTTP流)
  for (const [cameraId, ip] of Object.entries(ESP32_CAMERAS)) {
    if (!camerasMap.has(cameraId)) {
      camerasMap.set(cameraId, {
        cameraId: cameraId,
        resolution: '800x600',
        fps: 10,
        ip: ip,
        streamUrl: ip ? `http://${ip}/stream` : null,
        status: ip ? 'configured' : 'waiting',
        type: 'http_stream'
      });
    }
  }
  
  res.json(Array.from(camerasMap.values()));
});

// ESP32摄像头IP注册接口
app.post('/api/camera/register', (req, res) => {
  const { cameraId, ip } = req.body;
  
  if (!cameraId || !ip) {
    return res.status(400).json({ error: '缺少cameraId或ip' });
  }
  
  console.log(`📡 收到ESP32注册: ${cameraId} -> ${ip}`);
  
  // 更新IP
  const oldIP = ESP32_CAMERAS[cameraId];
  updateESP32IP(cameraId, ip);
  
  // 如果是首次注册或IP变化，自动开始录制
  if (!oldIP || oldIP !== ip) {
    console.log(`🎬 ${cameraId} 已上线，自动启动录制...`);
    startRecordingSession(cameraId);
  }
  
  res.json({ 
    message: '注册成功', 
    cameraId, 
    ip,
    recording: recordingSessions.has(cameraId) ? 'active' : 'inactive'
  });
});

// 主动开始录制接口
app.get('/api/record/start', (req, res) => {
  const cameraId = req.query.cameraId || 'CAM_001';
  startRecordingSession(cameraId);
  res.json({ message: '录制已开始', cameraId });
});

// 停止录制接口
app.get('/api/record/stop', (req, res) => {
  const cameraId = req.query.cameraId || 'CAM_001';
  stopRecordingSession(cameraId);
  res.json({ message: '录制已停止', cameraId });
});

// 从ESP32直接抓取帧并录制
app.get('/api/record/capture', async (req, res) => {
  const cameraId = req.query.cameraId || 'CAM_001';
  const esp32Ip = ESP32_CAMERAS[cameraId];
  
  if (!esp32Ip) {
    return res.status(404).json({ error: '摄像头未配置' });
  }
  
  try {
    const http = require('http');
    
    // 启动录制
    startRecordingSession(cameraId);
    
    // 从ESP32获取视频流
    const options = {
      hostname: esp32Ip,
      port: 80,
      path: '/stream',
      method: 'GET',
      timeout: 60000 // 1分钟超时
    };
    
    const request = http.request(options, (response) => {
      let frameCount = 0;
      let buffer = '';
      
      response.on('data', (chunk) => {
        buffer += chunk.toString();
        
        // 解析MJPEG帧
        const boundary = '--frame';
        let pos = 0;
        
        while ((pos = buffer.indexOf(boundary, pos)) !== -1) {
          const nextPos = buffer.indexOf(boundary, pos + boundary.length);
          if (nextPos === -1) break; // 等待更多数据
          
          const frameStart = buffer.indexOf('\r\n\r\n', pos) + 4;
          const frameEnd = nextPos;
          
          if (frameStart > 3 && frameEnd > frameStart) {
            const frameData = buffer.substring(frameStart, frameEnd);
            const frameBuffer = Buffer.from(frameData, 'binary');
            
            // 添加到录制
            addFrameToRecording(cameraId, frameBuffer);
            frameCount++;
            
            // 每60秒停止
            if (frameCount >= 600) {
              stopRecordingSession(cameraId);
              request.destroy();
              break;
            }
          }
          
          pos = nextPos;
        }
        
        // 清理已处理的缓冲区
        if (pos > 1000) {
          buffer = buffer.substring(pos);
        }
      });
      
      response.on('end', () => {
        stopRecordingSession(cameraId);
        console.log(`✅ 录制完成，共${frameCount}帧`);
      });
    });
    
    request.on('error', (error) => {
      console.error('❌ 抓取失败:', error);
      stopRecordingSession(cameraId);
      res.status(500).json({ error: error.message });
    });
    
    request.on('timeout', () => {
      request.destroy();
      stopRecordingSession(cameraId);
      console.log('⏱️ 录制超时');
    });
    
    request.end();
    
    res.json({ 
      message: '开始从ESP32录制', 
      cameraId,
      esp32Ip,
      duration: '60秒'
    });
    
  } catch (error) {
    console.error('录制错误:', error);
    res.status(500).json({ error: error.message });
  }
});

// 静态文件服务 - 提供视频文件访问（支持子目录）
app.use('/videos', express.static(path.join(__dirname, 'videos')));

// 视频流接口 - 支持子目录
app.get('/api/videos/stream/:cameraId/:filename', (req, res) => {
  const { cameraId, filename } = req.params;
  const videoPath = path.join(videoStoragePath, cameraId, filename);
  
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: '视频文件未找到' });
  }
  
  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;
  
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, {start, end});
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

// 获取所有视频文件（扫描文件系统，支持分页和筛选）
app.get('/api/videos/all', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const cameraId = req.query.cameraId; // 按设备筛选
    const startDate = req.query.startDate; // 开始日期
    const endDate = req.query.endDate; // 结束日期
    
    const videos = [];
    
    // 获取当前正在录制的文件名列表
    const recordingFiles = new Set();
    for (const [camId, session] of recordingSessions.entries()) {
      if (session.filename) {
        recordingFiles.add(session.filename);
      }
    }
    
    // 自动扫描所有摄像头目录
    if (fs.existsSync(videoStoragePath)) {
      const cameraDirs = fs.readdirSync(videoStoragePath).filter(d => {
        return fs.statSync(path.join(videoStoragePath, d)).isDirectory();
      });
      
      for (const dirCameraId of cameraDirs) {
        // 如果指定了 cameraId，只扫描该设备
        if (cameraId && dirCameraId !== cameraId) {
          continue;
        }
        
        const cameraDir = path.join(videoStoragePath, dirCameraId);
        const files = fs.readdirSync(cameraDir).filter(f => f.endsWith('.mp4'));
        
        for (const file of files) {
          // 跳过正在录制的文件
          if (recordingFiles.has(file)) {
            continue;
          }
          
          const filePath = path.join(cameraDir, file);
          const stat = fs.statSync(filePath);
          
          // 排除最近 2 分钟内修改的文件（防止正在录制的文件被列出）
          const twoMinutesAgo = Date.now() - 120000;
          if (stat.mtimeMs > twoMinutesAgo) {
            continue;
          }
          
          // 只返回大小超过 1MB 的视频
          const minSize = 1 * 1024 * 1024; // 1MB
          if (stat.size < minSize) {
            continue;
          }
          
          // 使用 ffprobe 验证视频完整性和时长
          try {
            const { spawnSync } = require('child_process');
            const result = spawnSync('ffprobe', [
              '-v', 'error',
              '-show_entries', 'format=duration',
              '-of', 'default=noprint_wrappers=1:nokey=1',
              filePath
            ], { timeout: 5000 });
            
            if (result.error || result.status !== 0) {
              continue;
            }
            
            const duration = parseFloat(result.stdout.toString().trim());
            if (isNaN(duration) || duration <= 0) {
              continue;
            }
            
            // 只保留时长在 30秒 到 10分钟 之间的视频（正常录制片段）
            if (duration < 30 || duration > 600) {
              continue;
            }
            
            // 日期筛选
            const fileDate = stat.mtime;
            if (startDate && fileDate < new Date(startDate)) {
              continue;
            }
            if (endDate && fileDate > new Date(endDate)) {
              continue;
            }
            
            videos.push({
              id: dirCameraId + '_' + file,
              filename: file,
              filepath: filePath,
              cameraId: dirCameraId,
              size: stat.size,
              timestamp: stat.mtime,
              duration: duration
            });
          } catch (err) {
            continue;
          }
        }
      }
    }
    
    // 按时间倒序排列
    videos.sort((a, b) => b.timestamp - a.timestamp);
    
    // 计算分页
    const total = videos.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedVideos = videos.slice(start, end);
    
    console.log(`✅ 返回第 ${page}/${totalPages} 页，共 ${total} 个视频`);
    
    res.json({
      success: true,
      data: paginatedVideos,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('获取视频列表失败:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// 路由
app.use('/api/videos', videoRoutes);

// 实时流截图接口
app.get('/api/snapshot/:cameraId', (req, res) => {
  const { cameraId } = req.params;
  const cache = streamCache.get(cameraId);
  
  if (!cache || !cache.latestFrame) {
    return res.status(404).json({ 
      success: false,
      error: '暂无可用帧' 
    });
  }
  
  // 返回最新的 JPEG 帧
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(cache.latestFrame);
});

// 保存截图到文件
app.post('/api/snapshot/save/:cameraId', (req, res) => {
  const { cameraId } = req.params;
  const cache = streamCache.get(cameraId);
  
  if (!cache || !cache.latestFrame) {
    return res.status(404).json({ 
      success: false,
      error: '暂无可用帧' 
    });
  }
  
  // 生成截图文件名
  const now = new Date();
  const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
  const filename = `snapshot_${timestamp}.jpg`;
  
  const cameraDir = path.join(videoStoragePath, cameraId, 'snapshots');
  if (!fs.existsSync(cameraDir)) {
    fs.mkdirSync(cameraDir, { recursive: true });
  }
  
  const filepath = path.join(cameraDir, filename);
  
  try {
    fs.writeFileSync(filepath, cache.latestFrame);
    console.log(`📸 截图保存成功: ${filepath}`);
    
    res.json({
      success: true,
      message: '截图保存成功',
      filename,
      url: `/videos/${cameraId}/snapshots/${filename}`
    });
  } catch (error) {
    console.error('保存截图失败:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// 生成视频缩略图
app.post('/api/videos/thumbnail/:cameraId/:filename', (req, res) => {
  try {
    const { cameraId, filename } = req.params;
    const videoPath = path.join(videoStoragePath, cameraId, filename);
    
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ 
        success: false,
        error: '视频文件不存在' 
      });
    }
    
    const thumbnailFilename = filename.replace('.mp4', '_thumb.jpg');
    const thumbnailPath = path.join(videoStoragePath, cameraId, thumbnailFilename);
    
    // 如果缩略图已存在，直接返回
    if (fs.existsSync(thumbnailPath)) {
      return res.json({
        success: true,
        url: `/videos/${cameraId}/${thumbnailFilename}`
      });
    }
    
    // 使用 ffmpeg 提取第一帧
    const { spawn } = require('child_process');
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-ss', '00:00:01', // 从第1秒开始
      '-vframes', '1',
      '-q:v', '2', // 高质量
      thumbnailPath
    ]);
    
    ffmpeg.on('close', (code) => {
      if (code === 0 && fs.existsSync(thumbnailPath)) {
        console.log(`🖼️ 缩略图生成成功: ${thumbnailFilename}`);
        
        res.json({
          success: true,
          message: '缩略图生成成功',
          url: `/videos/${cameraId}/${thumbnailFilename}`
        });
      } else {
        console.error(`❌ 缩略图生成失败，退出码: ${code}`);
        res.status(500).json({ 
          success: false,
          error: '缩略图生成失败' 
        });
      }
    });
    
  } catch (error) {
    console.error('生成缩略图失败:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// 视频下载接口
app.get('/api/videos/download/:cameraId/:filename', (req, res) => {
  const { cameraId, filename } = req.params;
  const videoPath = path.join(videoStoragePath, cameraId, filename);
  
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ 
      success: false,
      error: '视频文件不存在' 
    });
  }
  
  // 设置下载响应头
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'video/mp4');
  
  const fileStream = fs.createReadStream(videoPath);
  fileStream.pipe(res);
});

// 删除单个视频
app.delete('/api/videos/:cameraId/:filename', (req, res) => {
  try {
    const { cameraId, filename } = req.params;
    const videoPath = path.join(videoStoragePath, cameraId, filename);
    
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ 
        success: false,
        error: '视频文件不存在' 
      });
    }
    
    fs.unlinkSync(videoPath);
    console.log(`🗑️ 删除视频: ${videoPath}`);
    
    res.json({
      success: true,
      message: '视频删除成功'
    });
  } catch (error) {
    console.error('删除视频失败:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// 批量删除视频
app.post('/api/videos/batch-delete', (req, res) => {
  try {
    const { videos } = req.body; // [{cameraId, filename}, ...]
    
    if (!videos || !Array.isArray(videos)) {
      return res.status(400).json({ 
        success: false,
        error: '请提供视频列表' 
      });
    }
    
    const deleted = [];
    const failed = [];
    
    videos.forEach(({ cameraId, filename }) => {
      try {
        const videoPath = path.join(videoStoragePath, cameraId, filename);
        if (fs.existsSync(videoPath)) {
          fs.unlinkSync(videoPath);
          deleted.push({ cameraId, filename });
        } else {
          failed.push({ cameraId, filename, reason: '文件不存在' });
        }
      } catch (err) {
        failed.push({ cameraId, filename, reason: err.message });
      }
    });
    
    console.log(`🗑️ 批量删除: 成功${deleted.length}个, 失败${failed.length}个`);
    
    res.json({
      success: true,
      message: `成功删除 ${deleted.length} 个视频`,
      deleted,
      failed
    });
  } catch (error) {
    console.error('批量删除失败:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// 导出指定时间段的视频（合并多个片段）
app.post('/api/videos/export', async (req, res) => {
  try {
    const { cameraId, startTime, endTime } = req.body;
    
    if (!cameraId || !startTime || !endTime) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必要参数' 
      });
    }
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // 查找时间段内的所有视频文件
    const cameraDir = path.join(videoStoragePath, cameraId);
    if (!fs.existsSync(cameraDir)) {
      return res.status(404).json({ 
        success: false,
        error: '摄像头目录不存在' 
      });
    }
    
    const files = fs.readdirSync(cameraDir).filter(f => f.endsWith('.mp4'));
    const matchedVideos = [];
    
    for (const file of files) {
      const filePath = path.join(cameraDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.mtime >= start && stat.mtime <= end) {
        matchedVideos.push(filePath);
      }
    }
    
    if (matchedVideos.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: '该时间段内没有视频' 
      });
    }
    
    // 生成输出文件名
    const outputFilename = `${cameraId}_${start.getTime()}_${end.getTime()}_export.mp4`;
    const outputPath = path.join(cameraDir, outputFilename);
    
    // 创建文件列表
    const listFilePath = path.join(cameraDir, 'export_list.txt');
    const fileListContent = matchedVideos.map(f => `file '${f}'`).join('\n');
    fs.writeFileSync(listFilePath, fileListContent);
    
    console.log(`🔧 开始导出视频: ${matchedVideos.length} 个片段`);
    
    // 使用 ffmpeg 合并
    const { spawn } = require('child_process');
    const ffmpegArgs = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listFilePath,
      '-c', 'copy',
      outputPath
    ];
    
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    
    ffmpeg.on('close', (code) => {
      // 清理临时文件
      try {
        if (fs.existsSync(listFilePath)) {
          fs.unlinkSync(listFilePath);
        }
      } catch (e) {}
      
      if (code === 0 && fs.existsSync(outputPath)) {
        console.log(`✅ 视频导出成功: ${outputFilename}`);
        
        res.json({
          success: true,
          message: '视频导出成功',
          filename: outputFilename,
          downloadUrl: `/api/videos/download/${cameraId}/${outputFilename}`,
          segmentCount: matchedVideos.length
        });
      } else {
        console.error(`❌ 视频导出失败，退出码: ${code}`);
        res.status(500).json({ 
          success: false,
          error: '视频合并失败' 
        });
      }
    });
    
    ffmpeg.stderr.on('data', (data) => {
      console.log('FFmpeg:', data.toString().trim());
    });
    
  } catch (error) {
    console.error('导出视频失败:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

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

// 从 ESP32 持续抓取帧并录制
function captureFramesFromESP32(cameraId) {
  const esp32Ip = ESP32_CAMERAS[cameraId];
  if (!esp32Ip) {
    console.log(`⚠️ 摄像头 ${cameraId} 未配置IP`);
    return;
  }
  
  console.log(`🔄 开始从 ${esp32Ip} 持续抓取帧...`);
  
  const http = require('http');
  let reconnectTimer = null;
  let frameCount = 0;
  
  function connect() {
    const options = {
      hostname: esp32Ip,
      port: 80,
      path: '/stream',
      method: 'GET',
      timeout: 0
    };
    
    console.log(`📡 连接ESP32: http://${esp32Ip}/stream`);
    
    const request = http.request(options, (response) => {
      console.log(`✅ ESP32连接成功，状态码: ${response.statusCode}`);
      
      let buffer = Buffer.alloc(0);
      
      response.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        
        // 尝试两种解析方式：MJPEG边界或JPEG标记
        let framesExtracted = 0;
        
        // 方法1: 查找MJPEG边界 --frame
        const boundaryStr = '--frame';
        const boundaryBuf = Buffer.from(boundaryStr);
        let searchPos = 0;
        
        while (searchPos < buffer.length - boundaryBuf.length) {
          // 查找边界
          let boundaryFound = false;
          for (let i = 0; i <= buffer.length - boundaryBuf.length; i++) {
            if (buffer.slice(i, i + boundaryBuf.length).equals(boundaryBuf)) {
              // 找到下一个边界
              const nextBoundaryStart = i;
              
              // 查找 Content-Length 头
              const headerEnd = buffer.indexOf('\r\n\r\n', i);
              if (headerEnd > i) {
                // 提取JPEG数据
                const jpegStart = headerEnd + 4;
                
                // 查找下一个边界作为结束
                let jpegEnd = buffer.length;
                for (let j = jpegStart; j <= buffer.length - boundaryBuf.length; j++) {
                  if (buffer.slice(j, j + boundaryBuf.length).equals(boundaryBuf)) {
                    jpegEnd = j;
                    break;
                  }
                }
                
                if (jpegEnd > jpegStart) {
                  const frameBuffer = buffer.slice(jpegStart, jpegEnd);
                  addFrameToRecording(cameraId, frameBuffer);
                  frameCount++;
                  framesExtracted++;
                  
                  if (frameCount % 100 === 0) {
                    console.log(`📸 已处理 ${frameCount} 帧`);
                  }
                  
                  // 移动缓冲区
                  buffer = buffer.slice(jpegEnd);
                  searchPos = 0;
                  boundaryFound = true;
                  break;
                }
              }
              
              if (!boundaryFound) {
                searchPos = i + boundaryBuf.length;
              }
              break;
            }
          }
          
          if (!boundaryFound || searchPos >= buffer.length - boundaryBuf.length) {
            break;
          }
        }
        
        // 方法2: 如果没找到MJPEG边界，尝试直接查找JPEG标记
        if (framesExtracted === 0 && buffer.length > 1000) {
          let pos = 0;
          while (pos < buffer.length - 1) {
            if (buffer[pos] === 0xFF && buffer[pos + 1] === 0xD8) {
              let endPos = pos + 2;
              while (endPos < buffer.length - 1) {
                if (buffer[endPos] === 0xFF && buffer[endPos + 1] === 0xD9) {
                  const frameBuffer = buffer.slice(pos, endPos + 2);
                  addFrameToRecording(cameraId, frameBuffer);
                  frameCount++;
                  framesExtracted++;
                  
                  if (frameCount % 100 === 0) {
                    console.log(`📸 已处理 ${frameCount} 帧 (JPEG标记)`);
                  }
                  
                  buffer = buffer.slice(endPos + 2);
                  pos = 0;
                  break;
                }
                endPos++;
              }
              
              if (endPos >= buffer.length - 1) {
                break;
              }
            } else {
              pos++;
            }
          }
        }
        
        // 防止缓冲区过大
        if (buffer.length > 5 * 1024 * 1024) {
          console.log('⚠️ 缓冲区过大，清理...');
          buffer = Buffer.alloc(0);
        }
      });
      
      response.on('end', () => {
        console.log('⚠️ ESP32连接断开，5秒后重连...');
        reconnectTimer = setTimeout(connect, 5000);
      });
      
      response.on('error', (error) => {
        console.error('❌ ESP32流错误:', error.message);
        reconnectTimer = setTimeout(connect, 5000);
      });
    });
    
    request.on('error', (error) => {
      console.error('❌ 连接ESP32失败:', error.message);
      reconnectTimer = setTimeout(connect, 5000);
    });
    
    request.end();
  }
  
  connect();
}

// 主页 - 改进的视频查看界面
app.get('/', (req, res) => {
  // 自动开始录制所有配置的摄像头
  Object.keys(ESP32_CAMERAS).forEach(cameraId => {
    if (!recordingSessions.has(cameraId)) {
      startRecordingSession(cameraId);
    }
  });
  
  res.send(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NAS 智能监控系统</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            :root {
                --primary: #6366f1;
                --primary-dark: #4f46e5;
                --bg-dark: #0f172a;
                --bg-card: #1e293b;
                --text-primary: #f1f5f9;
                --text-secondary: #94a3b8;
                --border: #334155;
                --success: #10b981;
                --warning: #f59e0b;
            }
            
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background: var(--bg-dark);
                color: var(--text-primary);
                line-height: 1.6;
            }
            
            /* 头部 */
            .header {
                background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
                padding: 2rem;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            }
            
            .header-content {
                max-width: 1400px;
                margin: 0 auto;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .header h1 {
                font-size: 2rem;
                font-weight: 700;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .header-stats {
                display: flex;
                gap: 2rem;
            }
            
            .stat-item {
                text-align: center;
            }
            
            .stat-value {
                font-size: 1.5rem;
                font-weight: bold;
            }
            
            .stat-label {
                font-size: 0.875rem;
                opacity: 0.9;
            }
            
            /* 主容器 */
            .container {
                max-width: 1400px;
                margin: 2rem auto;
                padding: 0 2rem;
                display: grid;
                grid-template-columns: 1fr;
                gap: 2rem;
            }
            
            /* 卡片 */
            .card {
                background: var(--bg-card);
                border-radius: 12px;
                padding: 1.5rem;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
                border: 1px solid var(--border);
            }
            
            .card-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1.5rem;
                padding-bottom: 1rem;
                border-bottom: 2px solid var(--border);
            }
            
            .card-title {
                font-size: 1.5rem;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            /* 视频播放器 */
            .video-wrapper {
                position: relative;
                width: 100%;
                background: #000;
                border-radius: 8px;
                overflow: hidden;
                aspect-ratio: 16/9;
            }
            
            .video-player { 
                width: 100%;
                height: 100%;
                object-fit: contain;
            }
            
            .offline-message {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                color: var(--text-secondary);
            }
            
            .offline-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
            }
            
            /* 控制栏 */
            .controls {
                display: flex;
                gap: 1rem;
                margin-top: 1rem;
                flex-wrap: wrap;
            }
            
            select, button {
                padding: 0.75rem 1.5rem;
                font-size: 1rem;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                font-weight: 500;
            }
            
            select {
                background: var(--bg-card);
                color: var(--text-primary);
                border: 2px solid var(--border);
                min-width: 250px;
            }
            
            select:hover {
                border-color: var(--primary);
            }
            
            button {
                background: var(--primary);
                color: white;
            }
            
            button:hover {
                background: var(--primary-dark);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
            }
            
            button:active {
                transform: translateY(0);
            }
            
            /* 历史记录网格 */
            .video-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
                gap: 1.5rem;
            }
            
            .video-item { 
                background: var(--bg-card);
                border-radius: 12px;
                overflow: hidden;
                border: 1px solid var(--border);
                transition: all 0.3s;
            }
            
            .video-item:hover {
                transform: translateY(-4px);
                box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
                border-color: var(--primary);
            }
            
            .video-info {
                padding: 1rem;
                background: rgba(30, 41, 59, 0.95);
            }
            
            .video-title {
                font-weight: 600;
                margin-bottom: 0.5rem;
                color: var(--text-primary);
            }
            
            .video-meta {
                display: flex;
                gap: 1rem;
                font-size: 0.875rem;
                color: var(--text-secondary);
            }
            
            .empty-state {
                text-align: center;
                padding: 4rem 2rem;
                color: var(--text-secondary);
            }
            
            .empty-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
                opacity: 0.5;
            }
            
            /* 响应式 */
            @media (max-width: 768px) {
                .header-content {
                    flex-direction: column;
                    gap: 1rem;
                }
                
                .header-stats {
                    gap: 1rem;
                }
                
                .container {
                    padding: 0 1rem;
                }
                
                .video-grid {
                    grid-template-columns: 1fr;
                }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="header-content">
                <h1>🎥 NAS 智能监控系统</h1>
                <div class="header-stats">
                    <div class="stat-item">
                        <div class="stat-value" id="cameraCount">0</div>
                        <div class="stat-label">在线摄像头</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" id="uptime">00:00:00</div>
                        <div class="stat-label">运行时间</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="container">
            <!-- 实时监控 -->
            <div class="card">
                <div class="card-header">
                    <div class="card-title">📹 实时监控</div>
                </div>
                
                <div class="controls">
                    <select id="cameraSelect" onchange="changeCamera()">
                        <option value="">加载中...</option>
                    </select>
                    <button onclick="refreshCameras()">🔄 刷新列表</button>
                    <button onclick="toggleFullscreen()">⛶ 全屏</button>
                </div>
                
                <div class="video-wrapper" style="margin-top: 1rem;">
                    <img id="liveStream" src="" alt="实时监控画面" class="video-player" style="display:none;">
                    <div id="offlineMessage" class="offline-message">
                        <div class="offline-icon">📷</div>
                        <div>暂无摄像头连接</div>
                        <div style="font-size: 0.875rem; margin-top: 0.5rem;">请等待 ESP32 摄像头上线</div>
                    </div>
                </div>
            </div>
            
            <!-- 历史记录 -->
            <div class="card">
                <div class="card-header">
                    <div class="card-title">📁 历史记录</div>
                </div>
                <div id="videoList" class="video-grid"></div>
            </div>
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
                        
                        // 保存当前选中的值
                        const currentValue = select.value;
                        
                        // 清空旧数据
                        select.innerHTML = '';
                        
                        if (cameras.length === 0) {
                            select.innerHTML = '<option value="">暂无摄像头</option>';
                            return;
                        }
                        
                        cameras.forEach(camera => {
                            const option = document.createElement('option');
                            option.value = camera.cameraId;
                            
                            // 显示摄像头信息
                            let displayText = camera.cameraId;
                            if (camera.ip) {
                                displayText += ' (' + camera.ip + ')';
                            }
                            if (camera.resolution) {
                                displayText += ' - ' + camera.resolution;
                            }
                            if (camera.type === 'http_stream') {
                                displayText += ' [HTTP直连]';
                            } else if (camera.status === 'online') {
                                displayText += ' [在线]';
                            }
                            
                            option.textContent = displayText;
                            
                            // 检查是否已存在相同value的选项，避免重复
                            var existingOption = select.querySelector('option[value="' + camera.cameraId + '"]');
                            if (!existingOption) {
                                select.appendChild(option);
                            }
                        });
                        
                        // 恢复之前的选择，或者自动选择第一个
                        if (currentValue && cameras.find(c => c.cameraId === currentValue)) {
                            select.value = currentValue;
                            // 如果之前有画面，保持画面
                            if (currentCameraId === currentValue) {
                                // 不需要重新加载，保持当前画面
                            } else {
                                changeCamera();
                            }
                        } else if (!currentCameraId && cameras.length > 0) {
                            select.value = cameras[0].cameraId;
                            currentCameraId = cameras[0].cameraId;
                            changeCamera();
                        }
                    })
                    .catch(error => {
                        console.error('获取摄像头列表失败:', error);
                        document.getElementById('cameraSelect').innerHTML = '<option value="">加载失败</option>';
                    });
            }
            
            // 切换摄像头
            function changeCamera() {
                const select = document.getElementById('cameraSelect');
                const streamImg = document.getElementById('liveStream');
                const offlineMsg = document.getElementById('offlineMessage');
                
                currentCameraId = select.value;
                
                if (currentCameraId) {
                    // 所有摄像头都通过NAS后端代理转发
                    const streamUrl = '/api/stream?cameraId=' + currentCameraId + '&t=' + Date.now();
                    
                    console.log('🔄 请求视频流:', streamUrl);
                    
                    // 设置视频源
                    streamImg.src = streamUrl;
                    streamImg.style.display = 'block';
                    offlineMsg.style.display = 'none';
                    
                    // 添加错误处理，自动重连
                    let reconnectAttempts = 0;
                    const maxReconnectAttempts = 30; // 增加到30次
                    
                    streamImg.onerror = () => {
                        reconnectAttempts++;
                        if (reconnectAttempts <= maxReconnectAttempts) {
                            const delay = Math.min(reconnectAttempts * 1000, 5000); // 最多5秒
                            console.log('⚠️ 视频流断开，' + (delay/1000) + '秒后重连... (' + reconnectAttempts + '/' + maxReconnectAttempts + ')');
                            setTimeout(() => {
                                if (currentCameraId) {
                                    streamImg.src = '/api/stream?cameraId=' + currentCameraId + '&t=' + Date.now();
                                }
                            }, delay);
                        } else {
                            console.error('❌ 重连失败，请刷新页面');
                            offlineMsg.innerHTML = '<div class="offline-icon">⚠️</div><div>视频流连接失败</div><div style="font-size: 0.875rem; margin-top: 0.5rem;">请检查ESP32是否在线</div>';
                            offlineMsg.style.display = 'block';
                            streamImg.style.display = 'none';
                        }
                    };
                    
                    // 监听加载成功
                    streamImg.onload = () => {
                        console.log('✅ 视频流加载成功');
                        reconnectAttempts = 0; // 重置重连计数
                    };
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
                const container = document.getElementById('videoList');
                container.innerHTML = '<div class="empty-state"><div style="font-size:2rem;margin-bottom:1rem;">⏳</div><div>加载中...</div></div>';
                
                fetch('/api/videos/all')
                    .then(response => response.json())
                    .then(videos => {
                        container.innerHTML = '';
                        if (videos.length === 0) {
                            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📹</div><div>暂无历史视频</div></div>';
                            return;
                        }
                        
                        videos.forEach(video => {
                            const videoElement = document.createElement('div');
                            videoElement.className = 'video-item';
                            const videoUrl = '/videos/' + video.cameraId + '/' + video.filename;
                            const sizeMB = (video.size / 1024 / 1024).toFixed(2);
                            const timeStr = new Date(video.timestamp).toLocaleString('zh-CN');
                            const durationStr = video.duration ? Math.floor(video.duration / 60) + '分' + Math.floor(video.duration % 60) + '秒' : '未知';
                            
                            videoElement.innerHTML = 
                                '<video controls preload="metadata" style="width:100%;aspect-ratio:16/9;background:#000;display:block;">' +
                                    '<source src="' + videoUrl + '" type="video/mp4">' +
                                    '您的浏览器不支持视频播放。' +
                                '</video>' +
                                '<div class="video-info">' +
                                    '<div class="video-title">' + video.filename + '</div>' +
                                    '<div class="video-meta">' +
                                        '<span>💾 ' + sizeMB + ' MB</span>' +
                                        '<span>⏱️ ' + durationStr + '</span>' +
                                        '<span>📅 ' + timeStr + '</span>' +
                                    '</div>' +
                                '</div>';
                            container.appendChild(videoElement);
                        });
                    })
                    .catch(error => {
                        console.error('获取视频列表失败:', error);
                        container.innerHTML = '<div class="empty-state" style="color:#ef4444;">获取历史视频失败</div>';
                    });
            }
            
            // 初始化
            refreshCameras();
            loadHistoryVideos();
            
            // 每10秒刷新一次摄像头列表
            setInterval(refreshCameras, 10000);
            
            // 每30秒刷新一次历史视频列表
            setInterval(loadHistoryVideos, 30000);
            console.log('⏰ 已设置自动刷新：摄像头列表(10秒)，历史视频(30秒)');
        </script>
    </body>
    </html>
  `);
});

// 设备心跳检测定时器（每 10 秒检查一次）
const heartbeatCheckInterval = setInterval(() => {
  const now = Date.now();
  const timeout = 30000; // 30秒超时
  
  for (const [cameraId, camera] of connectedCameras.entries()) {
    if (now - camera.lastHeartbeat > timeout) {
      console.log(`⚠️ 摄像头 ${cameraId} 心跳超时，标记为离线`);
      camera.status = 'offline';
      
      // 停止录制
      if (recordingSessions.has(cameraId)) {
        console.log(`⏹️ 停止离线摄像头 ${cameraId} 的录制`);
        stopRecordingSession(cameraId);
      }
    }
  }
}, 10000);

// 获取磁盘空间信息
app.get('/api/storage/info', (req, res) => {
  try {
    const { execSync } = require('child_process');
    
    // Windows 系统使用 wmic 或 powershell
    let totalSpace, freeSpace;
    
    if (process.platform === 'win32') {
      // Windows: 使用 PowerShell 获取磁盘信息
      const output = execSync('powershell -Command "Get-PSDrive C | Select-Object Used,Free"', { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      const parts = lines[lines.length - 1].trim().split(/\s+/);
      freeSpace = parseFloat(parts[parts.length - 1]) * 1024 * 1024; // 转换为字节
      totalSpace = parseFloat(parts[parts.length - 2]) * 1024 * 1024 + freeSpace;
    } else {
      // Linux/Mac: 使用 df 命令
      const output = execSync('df -k /', { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      const parts = lines[1].trim().split(/\s+/);
      totalSpace = parseInt(parts[1]) * 1024; // KB 转字节
      freeSpace = parseInt(parts[3]) * 1024;
    }
    
    const usedSpace = totalSpace - freeSpace;
    const usagePercent = ((usedSpace / totalSpace) * 100).toFixed(2);
    
    // 计算视频存储空间
    let videoSpace = 0;
    if (fs.existsSync(videoStoragePath)) {
      function getDirSize(dir) {
        let size = 0;
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filepath = path.join(dir, file);
          const stat = fs.statSync(filepath);
          if (stat.isDirectory()) {
            size += getDirSize(filepath);
          } else {
            size += stat.size;
          }
        }
        return size;
      }
      videoSpace = getDirSize(videoStoragePath);
    }
    
    res.json({
      success: true,
      data: {
        total: totalSpace,
        used: usedSpace,
        free: freeSpace,
        usagePercent: parseFloat(usagePercent),
        videoSpace,
        warning: usagePercent > 80 // 超过 80% 告警
      }
    });
  } catch (error) {
    console.error('获取磁盘信息失败:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// 自动清理旧视频
app.post('/api/storage/cleanup', (req, res) => {
  try {
    const { daysToKeep } = req.body;
    const keepDays = daysToKeep || 7; // 默认保留7天
    
    console.log(`🧹 开始清理 ${keepDays} 天前的视频...`);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);
    
    let deletedCount = 0;
    let freedSpace = 0;
    
    if (fs.existsSync(videoStoragePath)) {
      const cameraDirs = fs.readdirSync(videoStoragePath).filter(d => {
        return fs.statSync(path.join(videoStoragePath, d)).isDirectory();
      });
      
      for (const cameraId of cameraDirs) {
        const cameraDir = path.join(videoStoragePath, cameraId);
        const files = fs.readdirSync(cameraDir);
        
        for (const file of files) {
          if (!file.endsWith('.mp4')) continue;
          
          const filePath = path.join(cameraDir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.mtime < cutoffDate) {
            const fileSize = stat.size;
            fs.unlinkSync(filePath);
            deletedCount++;
            freedSpace += fileSize;
            console.log(`🗑️ 删除过期视频: ${file}`);
          }
        }
      }
    }
    
    const freedMB = (freedSpace / 1024 / 1024).toFixed(2);
    console.log(`✅ 清理完成: 删除 ${deletedCount} 个文件，释放 ${freedMB} MB`);
    
    res.json({
      success: true,
      message: `清理完成，删除 ${deletedCount} 个视频，释放 ${freedMB} MB`,
      deletedCount,
      freedSpace
    });
  } catch (error) {
    console.error('清理失败:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// 定时清理任务（每天凌晨2点执行）
try {
  const cron = require('node-cron');
  cron.schedule('0 2 * * *', () => {
    console.log('⏰ 执行定时清理任务...');
    
    // 检查磁盘空间
    const { execSync } = require('child_process');
    let freeSpace;
    
    if (process.platform === 'win32') {
      const output = execSync('powershell -Command "Get-PSDrive C | Select-Object Free"', { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      const parts = lines[lines.length - 1].trim().split(/\s+/);
      freeSpace = parseFloat(parts[parts.length - 1]) * 1024 * 1024;
    } else {
      const output = execSync('df -k /', { encoding: 'utf8' });
      const parts = output.trim().split('\n')[1].trim().split(/\s+/);
      freeSpace = parseInt(parts[3]) * 1024;
    }
    
    const totalSpace = 500 * 1024 * 1024 * 1024; // 假设 500GB
    const usagePercent = ((totalSpace - freeSpace) / totalSpace) * 100;
    
    // 如果使用率超过 85%，自动清理 14 天前的视频
    if (usagePercent > 85) {
      console.log(`⚠️ 磁盘使用率 ${usagePercent.toFixed(2)}%，触发自动清理`);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 14);
      
      let deletedCount = 0;
      
      if (fs.existsSync(videoStoragePath)) {
        const cameraDirs = fs.readdirSync(videoStoragePath).filter(d => {
          return fs.statSync(path.join(videoStoragePath, d)).isDirectory();
        });
        
        for (const cameraId of cameraDirs) {
          const cameraDir = path.join(videoStoragePath, cameraId);
          const files = fs.readdirSync(cameraDir).filter(f => f.endsWith('.mp4'));
          
          for (const file of files) {
            const filePath = path.join(cameraDir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.mtime < cutoffDate) {
              fs.unlinkSync(filePath);
              deletedCount++;
            }
          }
        }
      }
      
      console.log(`✅ 自动清理完成: 删除 ${deletedCount} 个文件`);
    }
  });
} catch (err) {
  console.log('⚠️ node-cron 未安装，跳过定时清理任务');
}

// 同步数据库并启动服务
sequelize.sync().then(() => {
  server.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`NAS监控系统服务已启动`);
    console.log(`端口: ${PORT}`);
    console.log(`访问地址: http://localhost:${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}/ws/stream`);
    console.log(`========================================`);
    
    // 服务启动后自动开始录制所有配置的摄像头
    console.log('\n 自动启动所有摄像头录制...');
    Object.keys(ESP32_CAMERAS).forEach(cameraId => {
      setTimeout(() => {
        startRecordingSession(cameraId);
      }, 3000); // 延迟3秒确保服务完全启动
    });
  });
}).catch(err => {
  console.error('数据库连接失败:', err);
});