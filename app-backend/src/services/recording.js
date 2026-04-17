const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');
const fs = require('fs').promises;
const Video = require('../models/Video');
const Camera = require('../models/Camera');
const streamManager = require('./streamManager');

// 设置ffmpeg路径
ffmpeg.setFfmpegPath(ffmpegStatic);

class RecordingService {
  constructor() {
    this.recordingProcesses = new Map(); // 存储正在录制的进程
    this.RECORDING_DURATION = 300; // 5分钟（秒）
  }

  /**
   * 开始录制摄像头的视频流
   * @param {number} cameraId - 摄像头ID
   * @param {string} cameraIp - 摄像头IP地址
   */
  async startRecording(cameraId, cameraIp) {
    try {
      // 检查是否已经在录制
      if (this.recordingProcesses.has(cameraId)) {
        console.log(`⚠️ 摄像头 ${cameraId} 已在录制中`);
        return;
      }

      const camera = await Camera.findByPk(cameraId);
      if (!camera) {
        throw new Error(`摄像头 ${cameraId} 不存在`);
      }

      console.log(`🎥 开始录制摄像头 ${cameraId} (${cameraIp})`);

      // 开始第一段录制
      this.recordSegment(cameraId, cameraIp, camera.serialNumber);

    } catch (error) {
      console.error(`❌ 启动录制失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 录制一个片段（5分钟）
   */
  async recordSegment(cameraId, cameraIp, serialNumber) {
    try {
      const outputDir = path.join(__dirname, '../../../NAS/videos', serialNumber);

      // 确保目录存在
      await fs.mkdir(outputDir, { recursive: true });

      // 生成文件名
      const filename = this.generateFilename();
      const outputPath = path.join(outputDir, filename);

      console.log(`📹 录制片段: ${filename}`);

      // 从 StreamManager 获取流
      const stream = streamManager.getStream(cameraId, cameraIp);

      // 创建FFmpeg进程，从stream读取数据
      const ffmpegProcess = ffmpeg()
        .input(stream)
        .inputOptions([
          '-f', 'mjpeg',              // 输入格式：MJPEG
          '-framerate', '10',         // 帧率
          '-re'                       // 按实时速度读取
        ])
        .outputOptions([
          '-c:v', 'libx264',          // H.264编码
          '-preset', 'ultrafast',     // 快速编码
          '-tune', 'zerolatency',     // 低延迟优化
          '-crf', '23',               // 质量参数（0-51，越小质量越高）
          '-t', String(this.RECORDING_DURATION), // 录制时长（秒）
          '-movflags', '+faststart',  // 优化在线播放
          '-pix_fmt', 'yuv420p',      // 像素格式（兼容性）
          '-f', 'mp4'                 // 输出格式
        ])
        .on('start', (commandLine) => {
          console.log(`🎬 FFmpeg启动: ${commandLine}`);
        })
        .on('progress', (progress) => {
          if (progress.percent && Math.floor(progress.percent) % 20 === 0) {
            console.log(`📊 录制进度: ${Math.floor(progress.percent)}%`);
          }
        })
        .on('end', async () => {
          console.log(`✅ 录制完成: ${filename}`);

          try {
            // 保存视频记录到数据库
            await this.saveVideoRecord(cameraId, filename, outputPath, serialNumber);

            // 检查摄像头是否仍然在线
            const camera = await Camera.findByPk(cameraId);
            if (camera && camera.status === 'online') {
              // 继续下一段录制
              setTimeout(() => {
                this.recordSegment(cameraId, cameraIp, serialNumber);
              }, 1000);
            } else {
              console.log(`⚠️ 摄像头 ${cameraId} 已离线，停止录制`);
              this.recordingProcesses.delete(cameraId);
            }
          } catch (error) {
            console.error(`❌ 保存视频记录失败: ${error.message}`);
            // 即使保存失败也继续录制
            setTimeout(() => {
              this.recordSegment(cameraId, cameraIp, serialNumber);
            }, 5000);
          }
        })
        .on('error', (err) => {
          console.error(`❌ 录制错误: ${err.message}`);

          // 清理失败的进程
          this.recordingProcesses.delete(cameraId);

          // 10秒后重试(给ESP32足够时间重启)
          setTimeout(() => {
            console.log(`🔄 重试录制摄像头 ${cameraId}`);
            this.recordSegment(cameraId, cameraIp, serialNumber);
          }, 10000);
        })
        .save(outputPath);

      // 存储进程引用
      this.recordingProcesses.set(cameraId, ffmpegProcess);

    } catch (error) {
      console.error(`❌ 录制片段失败: ${error.message}`);
      this.recordingProcesses.delete(cameraId);

      // 重试(10秒后)
      setTimeout(() => {
        this.recordSegment(cameraId, cameraIp, serialNumber);
      }, 10000);
    }
  }

  /**
   * 停止录制
   */
  stopRecording(cameraId) {
    const process = this.recordingProcesses.get(cameraId);
    if (process) {
      console.log(`⏹️ 停止录制摄像头 ${cameraId}`);
      process.kill('SIGINT');
      this.recordingProcesses.delete(cameraId);
    }
  }

  /**
   * 停止所有录制
   */
  stopAllRecordings() {
    console.log('⏹️ 停止所有录制进程');
    for (const [cameraId, process] of this.recordingProcesses) {
      try {
        process.kill('SIGINT');
      } catch (error) {
        console.error(`停止录制 ${cameraId} 失败:`, error.message);
      }
    }
    this.recordingProcesses.clear();
  }

  /**
   * 生成文件名
   * 格式: YYYYMMDD_HHMMSS.mp4
   */
  generateFilename() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}_${hours}${minutes}${seconds}.mp4`;
  }

  /**
   * 获取视频真实分辨率
   */
  async getVideoResolution(filePath) {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      
      // 使用ffprobe获取视频信息，设置5秒超时
      const command = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of json "${filePath}"`;
      
      // 添加超时控制（5秒）
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('ffprobe超时 (5秒)')), 5000);
      });
      
      const { stdout } = await Promise.race([
        execPromise(command),
        timeoutPromise
      ]);
      
      const info = JSON.parse(stdout);
      if (info.streams && info.streams.length > 0) {
        const width = info.streams[0].width;
        const height = info.streams[0].height;
        
        console.log(`📊 视频实际分辨率: ${width}x${height}`);
        
        // 根据分辨率分类（匹配数据库ENUM）
        if (height >= 2160) return '4k';
        if (height >= 1440) return '2k';
        if (height >= 1080) return '1080p';
        if (height >= 720) return '720p';
        
        // 如果都不匹配，返回最接近的标准分辨率
        if (height >= 480) return '720p'; // 降级到720p
        return '720p'; // 默认720p
      }
      
      return '720p'; // 默认值
    } catch (error) {
      console.error('获取视频分辨率失败:', error.message);
      return '720p'; // 出错时返回默认值
    }
  }

  /**
   * 保存视频记录到数据库
   */
  async saveVideoRecord(cameraId, filename, filePath, serialNumber) {
    try {
      const stats = await fs.stat(filePath);
      const now = new Date();
      
      // 获取摄像头配置中的分辨率(避免使用ffprobe占用ESP32连接)
      const camera = await Camera.findByPk(cameraId);
      const resolution = camera?.resolution || '720p';
      
      console.log(`📊 使用摄像头配置的分辨率: ${resolution}`);

      await Video.create({
        cameraId,
        filename,
        fileUrl: `/videos/${serialNumber}/${filename}`,
        duration: this.RECORDING_DURATION,
        size: stats.size,
        resolution: resolution,
        hasMotion: false,
        startTime: new Date(now.getTime() - this.RECORDING_DURATION * 1000),
        endTime: now,
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30天后过期
      });

      console.log(`💾 视频记录已保存: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${resolution})`);
    } catch (error) {
      console.error(`❌ 保存视频记录失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取录制状态
   */
  getRecordingStatus(cameraId) {
    return {
      isRecording: this.recordingProcesses.has(cameraId),
      cameraId
    };
  }

  /**
   * 获取所有录制状态
   */
  getAllRecordingStatus() {
    const status = [];
    for (const cameraId of this.recordingProcesses.keys()) {
      status.push({
        cameraId,
        isRecording: true
      });
    }
    return status;
  }
}

module.exports = new RecordingService();
