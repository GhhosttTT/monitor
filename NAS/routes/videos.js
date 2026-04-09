const express = require('express');
const router = express.Router();
const Video = require('../models/Video');
const fs = require('fs');
const path = require('path');

// 获取所有视频记录
router.get('/', async (req, res) => {
  try {
    const videos = await Video.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取视频文件
router.get('/stream/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const videoPath = path.join(process.env.VIDEO_STORAGE_PATH || './videos', filename);
    
    // 检查文件是否存在
    if (fs.existsSync(videoPath)) {
      // 设置视频流响应头
      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;
      
      if (range) {
        // 处理视频流范围请求
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
        // 完整视频文件
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
        };
        
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
      }
    } else {
      res.status(404).json({ error: '视频文件未找到' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 根据ID获取视频记录
router.get('/:id', async (req, res) => {
  try {
    const video = await Video.findByPk(req.params.id);
    if (video) {
      res.json(video);
    } else {
      res.status(404).json({ error: '视频未找到' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取视频文件
router.get('/file/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const videoPath = path.join(process.env.VIDEO_STORAGE_PATH || './videos', filename);
    
    if (fs.existsSync(videoPath)) {
      res.sendFile(videoPath);
    } else {
      res.status(404).json({ error: '视频文件未找到' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取视频文件路径
router.get('/storage-path', (req, res) => {
  try {
    const storagePath = process.env.VIDEO_STORAGE_PATH || './videos';
    res.json({ path: storagePath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;