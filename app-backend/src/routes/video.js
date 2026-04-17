const express = require('express');
const router = express.Router();
const videoService = require('../services/video');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// 获取视频列表（支持筛选）
router.get('/', async (req, res) => {
  try {
    const { cameraId, startDate, endDate, page, limit, filename } = req.query;
    
    const result = await videoService.getVideos({
      cameraId: cameraId ? parseInt(cameraId) : undefined,
      startDate,
      endDate,
      filename, // 添加文件名模糊搜索
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20
    });
    
    res.json(result);
  } catch (error) {
    console.error('获取视频列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 导出指定时间段的视频
router.post('/export', async (req, res) => {
  try {
    const { cameraId, startTime, endTime } = req.body;
    
    if (!cameraId || !startTime || !endTime) {
      return res.status(400).json({ message: '缺少必要参数' });
    }
    
    // 生成临时导出目录
    const exportDir = path.join(__dirname, '../../exports', `export_${Date.now()}`);
    
    const result = await videoService.exportVideos(cameraId, startTime, endTime, exportDir);
    
    res.json({
      message: '导出成功',
      downloadUrl: `/api/videos/download-export/${path.basename(result.zipPath)}`,
      fileCount: result.fileCount,
      totalSize: result.totalSize
    });
  } catch (error) {
    console.error('导出视频错误:', error);
    res.status(400).json({ message: error.message });
  }
});

// 下载导出的文件
router.get('/download-export/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../../exports', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: '文件不存在' });
    }
    
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('文件下载错误:', err);
      }
    });
  } catch (error) {
    console.error('下载文件错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 截取视频截图
router.post('/:id/screenshot', async (req, res) => {
  try {
    const { timestamp } = req.body;
    const videoId = parseInt(req.params.id);
    
    const result = await videoService.captureScreenshot(videoId, timestamp);
    
    res.json({
      message: '截图成功',
      screenshotPath: result.screenshotPath,
      timestamp: result.timestamp
    });
  } catch (error) {
    console.error('截取截图错误:', error);
    res.status(400).json({ message: error.message });
  }
});

// 批量截图
router.post('/bulk-screenshot', async (req, res) => {
  try {
    const { videoIds, timestamp } = req.body;
    
    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ message: '请提供有效的视频ID数组' });
    }
    
    const result = await videoService.bulkCaptureScreenshots(videoIds, timestamp);
    
    res.json(result);
  } catch (error) {
    console.error('批量截图错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 下载视频文件
router.get('/:id/download', async (req, res) => {
  try {
    const videoId = parseInt(req.params.id);
    const result = await videoService.getVideoForDownload(videoId);
    
    res.download(result.filePath, result.fileName, (err) => {
      if (err) {
        console.error('视频下载错误:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: '下载失败' });
        }
      }
    });
  } catch (error) {
    console.error('下载视频错误:', error);
    res.status(400).json({ message: error.message });
  }
});

// 删除视频
router.delete('/:id', async (req, res) => {
  try {
    const videoId = parseInt(req.params.id);
    const result = await videoService.deleteVideo(videoId);
    
    res.json(result);
  } catch (error) {
    console.error('删除视频错误:', error);
    res.status(400).json({ message: error.message });
  }
});

// 批量删除视频
router.post('/bulk-delete', async (req, res) => {
  try {
    const { videoIds } = req.body;
    
    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ message: '请提供有效的视频ID数组' });
    }
    
    const result = await videoService.bulkDeleteVideos(videoIds);
    
    res.json(result);
  } catch (error) {
    console.error('批量删除视频错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取视频统计信息
router.get('/stats/summary', async (req, res) => {
  try {
    const { cameraId } = req.query;
    const stats = await videoService.getVideoStats(cameraId ? parseInt(cameraId) : undefined);
    
    res.json(stats);
  } catch (error) {
    console.error('获取视频统计错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 在文件管理器中打开视频所在文件夹
router.post('/:id/open-folder', async (req, res) => {
  try {
    const videoId = parseInt(req.params.id);
    const video = await videoService.getVideoById(videoId);
    
    if (!video) {
      return res.status(404).json({ message: '视频不存在' });
    }
    
    // 根据 fileUrl 构建完整文件路径
    // fileUrl 格式: /videos/CAM_001/20260413_235239.mp4
    const videoStoragePath = process.env.VIDEO_STORAGE_PATH || path.join(__dirname, '../../NAS/videos');
    const relativePath = video.fileUrl.replace(/^\/videos\//, '');
    const filePath = path.join(videoStoragePath, relativePath);
    const folderPath = path.dirname(filePath);
    
    console.log(`打开文件夹: ${folderPath}`);
    
    // 检查文件夹是否存在
    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ message: '文件夹不存在', folderPath });
    }
    
    // 根据操作系统执行不同的命令
    const platform = process.platform;
    let command;
    
    if (platform === 'win32') {
      // Windows - 使用start命令更可靠
      command = `start "" "${folderPath}"`;
    } else if (platform === 'darwin') {
      // macOS
      command = `open "${folderPath}"`;
    } else {
      // Linux
      command = `xdg-open "${folderPath}"`;
    }
    
    console.log(`执行命令: ${command}`);
    
    exec(command, { windowsHide: false }, (error) => {
      if (error) {
        console.error('打开文件夹失败:', error);
        return res.status(500).json({ message: '打开文件夹失败', error: error.message });
      }
      res.json({ success: true, message: '已打开文件夹', folderPath });
    });
  } catch (error) {
    console.error('打开文件夹错误:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

module.exports = router;
