const Video = require('../models/Video');
const Camera = require('../models/Camera');
const { Op } = require('sequelize');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');
const fs = require('fs').promises;
const archiver = require('archiver');

// 设置ffmpeg路径
ffmpeg.setFfmpegPath(ffmpegStatic);

class VideoService {
  /**
   * 获取视频列表（支持筛选）
   * @param {object} filters - 筛选条件
   */
  async getVideos(filters = {}) {
    try {
      const { cameraId, startDate, endDate, page = 1, limit = 20 } = filters;
      
      const where = {};
      if (cameraId) {
        where.cameraId = cameraId;
      }
      if (startDate || endDate) {
        where.startTime = {};
        if (startDate) {
          where.startTime[Op.gte] = new Date(startDate);
        }
        if (endDate) {
          where.startTime[Op.lte] = new Date(endDate);
        }
      }

      console.log('视频筛选条件:', JSON.stringify(where, null, 2));

      const offset = (page - 1) * limit;
      const { count, rows } = await Video.findAndCountAll({
        where,
        include: [{ model: Camera, as: 'camera', attributes: ['id', 'name', 'serialNumber'] }],
        order: [['startTime', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      console.log(`查询结果: 共${count}条，返回${rows.length}条`);

      return {
        videos: rows,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      };
    } catch (error) {
      console.error('获取视频列表失败:', error);
      throw error;
    }
  }

  /**
   * 导出指定时间段的视频
   * @param {number} cameraId - 摄像头ID
   * @param {string} startTime - 开始时间
   * @param {string} endTime - 结束时间
   * @param {string} outputPath - 输出路径
   */
  async exportVideos(cameraId, startTime, endTime, outputPath) {
    try {
      // 查找时间段内的所有视频
      const videos = await Video.findAll({
        where: {
          cameraId,
          createdAt: {
            $gte: new Date(startTime),
            $lte: new Date(endTime)
          }
        },
        order: [['createdAt', 'ASC']]
      });

      if (videos.length === 0) {
        throw new Error('在指定时间段内没有找到视频');
      }

      // 创建输出目录
      await fs.mkdir(outputPath, { recursive: true });

      const exportedFiles = [];

      // 复制视频文件到导出目录
      for (const video of videos) {
        const sourcePath = video.filePath;
        const fileName = path.basename(sourcePath);
        const destPath = path.join(outputPath, fileName);

        await fs.copyFile(sourcePath, destPath);
        exportedFiles.push({
          originalName: video.fileName,
          exportedPath: destPath,
          duration: video.duration,
          size: video.fileSize,
          recordedAt: video.createdAt
        });
      }

      // 创建ZIP压缩包
      const zipPath = path.join(outputPath, `export_${cameraId}_${Date.now()}.zip`);
      await this.createZipArchive(outputPath, zipPath, exportedFiles.map(f => f.exportedPath));

      // 清理临时文件
      for (const file of exportedFiles) {
        await fs.unlink(file.exportedPath).catch(err => console.error('删除临时文件失败:', err));
      }

      return {
        success: true,
        zipPath,
        fileCount: exportedFiles.length,
        totalSize: exportedFiles.reduce((sum, f) => sum + f.size, 0)
      };
    } catch (error) {
      console.error('导出视频失败:', error);
      throw error;
    }
  }

  /**
   * 从视频中提取截图
   * @param {number} videoId - 视频ID
   * @param {number} timestamp - 时间戳（秒），默认为视频中间
   */
  async captureScreenshot(videoId, timestamp = null) {
    try {
      const video = await Video.findByPk(videoId);
      if (!video) {
        throw new Error('视频不存在');
      }

      // 如果未指定时间戳，使用视频中间位置
      if (timestamp === null) {
        timestamp = video.duration / 2;
      }

      // 确保时间戳在有效范围内
      timestamp = Math.max(0, Math.min(timestamp, video.duration));

      // 生成截图文件名
      const screenshotDir = path.join(path.dirname(video.filePath), 'screenshots');
      await fs.mkdir(screenshotDir, { recursive: true });
      
      const screenshotName = `${path.basename(video.filePath, '.mp4')}_${Math.floor(timestamp)}s.jpg`;
      const screenshotPath = path.join(screenshotDir, screenshotName);

      // 使用ffmpeg提取帧
      await new Promise((resolve, reject) => {
        ffmpeg(video.filePath)
          .screenshots({
            timestamps: [timestamp],
            filename: screenshotName,
            folder: screenshotDir,
            size: '1280x720'
          })
          .on('end', resolve)
          .on('error', reject);
      });

      return {
        success: true,
        screenshotPath,
        timestamp,
        videoId
      };
    } catch (error) {
      console.error('截取屏幕失败:', error);
      throw error;
    }
  }

  /**
   * 批量截图
   * @param {Array} videoIds - 视频ID数组
   * @param {number} timestamp - 时间戳（秒）
   */
  async bulkCaptureScreenshots(videoIds, timestamp = null) {
    try {
      const results = [];
      const errors = [];

      for (const videoId of videoIds) {
        try {
          const result = await this.captureScreenshot(videoId, timestamp);
          results.push(result);
        } catch (error) {
          errors.push({ videoId, error: error.message });
        }
      }

      return {
        success: results.length > 0,
        results,
        errors,
        totalSuccess: results.length,
        totalFailed: errors.length
      };
    } catch (error) {
      console.error('批量截图失败:', error);
      throw error;
    }
  }

  /**
   * 下载视频文件
   * @param {number} videoId - 视频ID
   */
  async getVideoForDownload(videoId) {
    try {
      const video = await Video.findByPk(videoId);
      if (!video) {
        throw new Error('视频不存在');
      }

      // 检查文件是否存在
      try {
        await fs.access(video.filePath);
      } catch (err) {
        throw new Error('视频文件不存在');
      }

      return {
        video,
        filePath: video.filePath,
        fileName: video.fileName,
        fileSize: video.fileSize,
        mimeType: 'video/mp4'
      };
    } catch (error) {
      console.error('获取视频文件失败:', error);
      throw error;
    }
  }

  /**
   * 删除视频
   * @param {number} videoId - 视频ID
   */
  async deleteVideo(videoId) {
    try {
      const video = await Video.findByPk(videoId);
      if (!video) {
        throw new Error('视频不存在');
      }

      // 删除物理文件
      try {
        await fs.unlink(video.filePath);
        
        // 删除相关的截图
        const screenshotDir = path.join(path.dirname(video.filePath), 'screenshots');
        const screenshotPattern = path.basename(video.filePath, '.mp4');
        try {
          const files = await fs.readdir(screenshotDir);
          for (const file of files) {
            if (file.startsWith(screenshotPattern)) {
              await fs.unlink(path.join(screenshotDir, file));
            }
          }
        } catch (err) {
          // 截图目录不存在或为空，忽略
        }
      } catch (err) {
        console.error('删除视频文件失败:', err);
      }

      // 删除数据库记录
      await video.destroy();

      // 更新摄像头的存储使用情况
      const camera = await Camera.findByPk(video.cameraId);
      if (camera) {
        const newStorageUsed = Math.max(0, (camera.storageUsed || 0) - video.fileSize);
        await camera.update({ storageUsed: newStorageUsed });
      }

      return {
        success: true,
        message: '视频已删除',
        freedSpace: video.fileSize
      };
    } catch (error) {
      console.error('删除视频失败:', error);
      throw error;
    }
  }

  /**
   * 批量删除视频
   * @param {Array} videoIds - 视频ID数组
   */
  async bulkDeleteVideos(videoIds) {
    try {
      let totalFreedSpace = 0;
      let deletedCount = 0;
      const errors = [];

      for (const videoId of videoIds) {
        try {
          const result = await this.deleteVideo(videoId);
          totalFreedSpace += result.freedSpace;
          deletedCount++;
        } catch (error) {
          errors.push({ videoId, error: error.message });
        }
      }

      return {
        success: deletedCount > 0,
        deletedCount,
        totalFreedSpace,
        errors
      };
    } catch (error) {
      console.error('批量删除视频失败:', error);
      throw error;
    }
  }

  /**
   * 创建ZIP压缩包
   * @param {string} sourceDir - 源目录
   * @param {string} zipPath - ZIP文件路径
   * @param {Array} files - 要压缩的文件列表
   */
  async createZipArchive(sourceDir, zipPath, files) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // 最高压缩级别
      });

      output.on('close', () => {
        console.log(`ZIP压缩包创建完成: ${archive.pointer()} bytes`);
        resolve(zipPath);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // 添加文件到压缩包
      for (const file of files) {
        archive.file(file, { name: path.basename(file) });
      }

      archive.finalize();
    });
  }

  /**
   * 获取视频统计信息
   * @param {number} cameraId - 摄像头ID
   */
  async getVideoStats(cameraId) {
    try {
      const where = cameraId ? { cameraId } : {};
      
      const stats = await Video.findAll({
        where,
        attributes: [
          [Video.sequelize.fn('COUNT', Video.sequelize.col('id')), 'totalVideos'],
          [Video.sequelize.fn('SUM', Video.sequelize.col('size')), 'totalSize'],
          [Video.sequelize.fn('SUM', Video.sequelize.col('duration')), 'totalDuration']
        ],
        raw: true
      });

      return stats[0] || { totalVideos: 0, totalSize: 0, totalDuration: 0 };
    } catch (error) {
      console.error('获取视频统计失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取视频
   * @param {number} videoId - 视频ID
   */
  async getVideoById(videoId) {
    try {
      const video = await Video.findByPk(videoId, {
        include: [{ model: Camera, as: 'camera', attributes: ['id', 'name', 'serialNumber'] }]
      });
      return video;
    } catch (error) {
      console.error('获取视频失败:', error);
      throw error;
    }
  }
}

module.exports = new VideoService();
