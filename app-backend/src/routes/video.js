const express = require('express');
const router = express.Router();
const Video = require('../models/Video');
const Camera = require('../models/Camera');
const auth = require('../middleware/auth');

// 获取视频列表
router.get('/', auth, async (req, res) => {
  try {
    const { cameraId, page = 1, limit = 20 } = req.query;
    
    // 构建查询条件
    let where = {};
    
    // 如果指定了摄像头ID，验证该摄像头属于当前用户
    if (cameraId) {
      const camera = await Camera.findOne({
        where: {
          id: cameraId,
          ownerId: req.user.userId
        }
      });
      
      if (!camera) {
        return res.status(404).json({ message: '摄像头不存在或无权限访问' });
      }
      
      where.cameraId = cameraId;
    } else {
      // 如果没有指定摄像头ID，则查找用户所有的摄像头录制的视频
      const cameras = await Camera.findAll({ 
        where: { ownerId: req.user.userId },
        attributes: ['id']
      });
      
      const cameraIds = cameras.map(camera => camera.id);
      where.cameraId = { [Video.sequelize.Op.in]: cameraIds };
    }
    
    // 分页参数
    const offset = (page - 1) * limit;
    
    // 查询视频并按开始时间倒序排列
    const { count, rows: videos } = await Video.findAndCountAll({
      where,
      order: [['startTime', 'DESC']],
      offset: parseInt(offset),
      limit: parseInt(limit)
    });
    
    // 计算总页数
    const totalPages = Math.ceil(count / limit);
    
    res.json({
      videos,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalVideos: count
      }
    });
  } catch (error) {
    console.error('获取视频列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取单个视频详情
router.get('/:id', auth, async (req, res) => {
  try {
    // 查找视频并验证权限
    const video = await Video.findOne({
      where: {
        id: req.params.id,
        '$camera.ownerId$': req.user.userId
      },
      include: [{
        model: Camera,
        as: 'camera',
        attributes: ['name']
      }]
    });
    
    if (!video) {
      return res.status(404).json({ message: '视频不存在或无权限访问' });
    }
    
    res.json(video);
  } catch (error) {
    console.error('获取视频详情错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 删除视频
router.delete('/:id', auth, async (req, res) => {
  try {
    // 查找视频并验证权限
    const video = await Video.findOne({
      where: {
        id: req.params.id,
        '$camera.ownerId$': req.user.userId
      },
      include: [{
        model: Camera,
        as: 'camera',
        attributes: ['id']
      }]
    });
    
    if (!video) {
      return res.status(404).json({ message: '视频不存在或无权限访问' });
    }
    
    // 删除视频记录
    await video.destroy();
    
    res.json({ message: '视频删除成功' });
  } catch (error) {
    console.error('删除视频错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;