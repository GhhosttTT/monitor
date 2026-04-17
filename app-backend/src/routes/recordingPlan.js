const express = require('express');
const router = express.Router();
const recordingPlanService = require('../services/recordingPlan');

// 获取摄像头的所有录制计划
router.get('/camera/:cameraId', async (req, res) => {
  try {
    const plans = await recordingPlanService.getPlansByCamera(req.params.cameraId);
    res.json(plans);
  } catch (error) {
    console.error('获取录制计划错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 创建录制计划
router.post('/', async (req, res) => {
  try {
    const plan = await recordingPlanService.createPlan(req.body);
    res.status(201).json(plan);
  } catch (error) {
    console.error('创建录制计划错误:', error);
    res.status(400).json({ message: error.message });
  }
});

// 更新录制计划
router.put('/:id', async (req, res) => {
  try {
    const plan = await recordingPlanService.updatePlan(req.params.id, req.body);
    res.json(plan);
  } catch (error) {
    console.error('更新录制计划错误:', error);
    res.status(400).json({ message: error.message });
  }
});

// 删除录制计划
router.delete('/:id', async (req, res) => {
  try {
    const result = await recordingPlanService.deletePlan(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('删除录制计划错误:', error);
    res.status(400).json({ message: error.message });
  }
});

// 启用/禁用录制计划
router.patch('/:id/toggle', async (req, res) => {
  try {
    const { enabled } = req.body;
    const plan = await recordingPlanService.togglePlan(req.params.id, enabled);
    res.json(plan);
  } catch (error) {
    console.error('切换录制计划状态错误:', error);
    res.status(400).json({ message: error.message });
  }
});

// 检查当前活动的录制计划
router.get('/camera/:cameraId/active', async (req, res) => {
  try {
    const activePlan = await recordingPlanService.checkActivePlan(req.params.cameraId);
    res.json(activePlan);
  } catch (error) {
    console.error('检查活动计划错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 批量删除录制计划
router.post('/bulk-delete', async (req, res) => {
  try {
    const { planIds } = req.body;
    
    if (!Array.isArray(planIds) || planIds.length === 0) {
      return res.status(400).json({ message: '请提供有效的计划ID数组' });
    }
    
    const result = await recordingPlanService.bulkDeletePlans(planIds);
    res.json(result);
  } catch (error) {
    console.error('批量删除录制计划错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;
