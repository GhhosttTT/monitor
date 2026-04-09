const fs = require('fs');
const path = require('path');
const Video = require('../models/Video');
const Camera = require('../models/Camera');

// 确保存储目录存在
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, '../../storage');
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// 视频存储策略配置
const STORAGE_STRATEGY = process.env.STORAGE_STRATEGY || 'local'; // local 或 cloud
const MIN_DISK_SPACE = process.env.MIN_DISK_SPACE || 1073741824; // 1GB minimum free space
const CLEANUP_INTERVAL = process.env.CLEANUP_INTERVAL || 3600000; // 1小时执行一次清理

// 检查磁盘空间
const checkDiskSpace = () => {
  try {
    const stats = fs.statSync(STORAGE_DIR);
    // 注意：在生产环境中，您可能需要使用专门的库来检查实际磁盘空间
    return { available: MIN_DISK_SPACE, total: MIN_DISK_SPACE * 10 };
  } catch (error) {
    console.error('检查磁盘空间失败:', error);
    return { available: 0, total: 0 };
  }
};

/**
 * 保存视频文件
 * @param {Object} camera - 摄像头对象
 * @param {String} filename - 文件名
 * @param {Buffer} fileBuffer - 文件缓冲区
 * @returns {Object} 文件信息
 */
const saveVideoFile = async (camera, filename, fileBuffer) => {
  try {
    // 创建用户目录
    const userDir = path.join(STORAGE_DIR, camera.owner.toString());
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    // 创建摄像头目录
    const cameraDir = path.join(userDir, camera._id.toString());
    if (!fs.existsSync(cameraDir)) {
      fs.mkdirSync(cameraDir, { recursive: true });
    }
    
    // 生成文件路径
    const filePath = path.join(cameraDir, filename);
    
    // 保存文件
    fs.writeFileSync(filePath, fileBuffer);
    
    // 获取文件信息
    const stats = fs.statSync(filePath);
    
    return {
      filePath,
      fileSize: stats.size
    };
  } catch (error) {
    throw new Error(`保存视频文件失败: ${error.message}`);
  }
};

/**
 * 删除过期视频文件
 * @param {Object} video - 视频对象
 */
const deleteVideoFile = async (video) => {
  try {
    // 删除视频文件
    if (fs.existsSync(video.fileUrl)) {
      fs.unlinkSync(video.fileUrl);
    }
    
    // 删除缩略图文件（如果存在）
    if (video.thumbnailUrl && fs.existsSync(video.thumbnailUrl)) {
      fs.unlinkSync(video.thumbnailUrl);
    }
  } catch (error) {
    console.error('删除视频文件失败:', error);
  }
};

/**
 * 清理过期视频
 */
const cleanupExpiredVideos = async () => {
  try {
    // 查找过期的视频记录（MongoDB的TTL索引会自动删除记录，
    // 但我们需要手动删除实际的文件）
    const now = new Date();
    const expiredVideos = await Video.find({ expiresAt: { $lt: now } });
    
    for (const video of expiredVideos) {
      await deleteVideoFile(video);
    }
    
    console.log(`清理了 ${expiredVideos.length} 个过期视频文件`);
    
    // 返回清理结果
    return {
      cleanedCount: expiredVideos.length,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('清理过期视频失败:', error);
    throw error;
  }
};

/**
 * 智能清理视频（基于存储空间）
 */
const smartCleanupVideos = async () => {
  try {
    const { available } = checkDiskSpace();
    
    // 如果可用空间低于阈值，清理最旧的视频
    if (available < MIN_DISK_SPACE) {
      const videos = await Video.find({})
        .sort({ createdAt: 1 }) // 按创建时间升序排列
        .limit(10); // 一次最多清理10个视频
      
      for (const video of videos) {
        await deleteVideoFile(video);
        await video.remove();
      }
      
      console.log(`智能清理了 ${videos.length} 个视频文件以释放空间`);
      
      return {
        cleanedCount: videos.length,
        spaceFreed: videos.reduce((total, video) => total + video.size, 0),
        timestamp: new Date()
      };
    }
    
    return {
      cleanedCount: 0,
      spaceFreed: 0,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('智能清理视频失败:', error);
    throw error;
  }
};

/**
 * 计算过期时间
 * @param {Date} startTime - 视频开始时间
 * @param {Number} retentionDays - 保留天数
 * @returns {Date} 过期时间
 */
const calculateExpirationDate = (startTime, retentionDays) => {
  const expirationDate = new Date(startTime);
  expirationDate.setDate(expirationDate.getDate() + retentionDays);
  return expirationDate;
};

/**
 * 创建视频记录
 * @param {Object} camera - 摄像头对象
 * @param {String} filename - 文件名
 * @param {String} fileUrl - 文件URL
 * @param {String} thumbnailUrl - 缩略图URL
 * @param {Date} startTime - 开始时间
 * @param {Date} endTime - 结束时间
 * @param {Number} size - 文件大小（字节）
 * @returns {Object} 视频对象
 */
const createVideoRecord = async (camera, filename, fileUrl, thumbnailUrl, startTime, endTime, size) => {
  try {
    // 计算视频时长（秒）
    const duration = Math.floor((endTime - startTime) / 1000);
    
    // 计算过期时间
    const expiresAt = calculateExpirationDate(startTime, camera.settings.storageRetention);
    
    // 创建视频记录
    const video = new Video({
      camera: camera._id,
      filename,
      fileUrl,
      thumbnailUrl,
      startTime,
      endTime,
      duration,
      size,
      resolution: camera.settings.resolution,
      expiresAt
    });
    
    await video.save();
    
    return video;
  } catch (error) {
    throw new Error(`创建视频记录失败: ${error.message}`);
  }
};

module.exports = {
  saveVideoFile,
  deleteVideoFile,
  cleanupExpiredVideos,
  smartCleanupVideos,
  calculateExpirationDate,
  createVideoRecord,
  checkDiskSpace
};