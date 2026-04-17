const RecordingPlan = require('../models/RecordingPlan');
const Camera = require('../models/Camera');

class RecordingPlanService {
  /**
   * 获取摄像头的录制计划
   * @param {number} cameraId - 摄像头ID
   */
  async getPlansByCamera(cameraId) {
    try {
      const plans = await RecordingPlan.findAll({
        where: { cameraId },
        order: [['priority', 'DESC'], ['createdAt', 'ASC']]
      });
      return plans;
    } catch (error) {
      console.error('获取录制计划失败:', error);
      throw error;
    }
  }

  /**
   * 创建录制计划
   * @param {object} planData - 计划数据
   */
  async createPlan(planData) {
    try {
      const { cameraId, name, type, schedule, motionSensitivity, enabled, priority } = planData;

      // 验证摄像头是否存在
      const camera = await Camera.findByPk(cameraId);
      if (!camera) {
        throw new Error('摄像头不存在');
      }

      // 如果是定时录制，验证schedule格式
      if (type === 'scheduled' && !schedule) {
        throw new Error('定时录制必须提供调度配置');
      }

      // 验证schedule JSON格式
      if (schedule) {
        try {
          JSON.parse(schedule);
        } catch (e) {
          throw new Error('调度配置必须是有效的JSON格式');
        }
      }

      const plan = await RecordingPlan.create({
        cameraId,
        name,
        type,
        schedule,
        motionSensitivity: motionSensitivity || 5,
        enabled: enabled !== undefined ? enabled : true,
        priority: priority || 0
      });

      return plan;
    } catch (error) {
      console.error('创建录制计划失败:', error);
      throw error;
    }
  }

  /**
   * 更新录制计划
   * @param {number} planId - 计划ID
   * @param {object} updates - 更新数据
   */
  async updatePlan(planId, updates) {
    try {
      const plan = await RecordingPlan.findByPk(planId);
      if (!plan) {
        throw new Error('录制计划不存在');
      }

      // 如果更新schedule，验证JSON格式
      if (updates.schedule) {
        try {
          JSON.parse(updates.schedule);
        } catch (e) {
          throw new Error('调度配置必须是有效的JSON格式');
        }
      }

      await plan.update(updates);
      return plan;
    } catch (error) {
      console.error('更新录制计划失败:', error);
      throw error;
    }
  }

  /**
   * 删除录制计划
   * @param {number} planId - 计划ID
   */
  async deletePlan(planId) {
    try {
      const plan = await RecordingPlan.findByPk(planId);
      if (!plan) {
        throw new Error('录制计划不存在');
      }

      await plan.destroy();
      return { success: true, message: '录制计划已删除' };
    } catch (error) {
      console.error('删除录制计划失败:', error);
      throw error;
    }
  }

  /**
   * 启用/禁用录制计划
   * @param {number} planId - 计划ID
   * @param {boolean} enabled - 是否启用
   */
  async togglePlan(planId, enabled) {
    try {
      const plan = await RecordingPlan.findByPk(planId);
      if (!plan) {
        throw new Error('录制计划不存在');
      }

      await plan.update({ enabled });
      return plan;
    } catch (error) {
      console.error('切换录制计划状态失败:', error);
      throw error;
    }
  }

  /**
   * 检查当前时间是否有活动的录制计划
   * @param {number} cameraId - 摄像头ID
   */
  async checkActivePlan(cameraId) {
    try {
      const now = new Date();
      const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // 获取所有启用的计划
      const plans = await RecordingPlan.findAll({
        where: {
          cameraId,
          enabled: true
        },
        order: [['priority', 'DESC']]
      });

      for (const plan of plans) {
        if (plan.type === 'motion') {
          // 移动侦测模式始终活动
          return {
            active: true,
            plan: plan,
            mode: 'motion',
            sensitivity: plan.motionSensitivity
          };
        } else if (plan.type === 'scheduled' && plan.schedule) {
          try {
            const schedule = JSON.parse(plan.schedule);
            if (schedule[dayOfWeek]) {
              // 检查当前时间是否在时间段内
              for (const timeRange of schedule[dayOfWeek]) {
                const [start, end] = timeRange.split('-');
                if (currentTime >= start && currentTime <= end) {
                  return {
                    active: true,
                    plan: plan,
                    mode: 'scheduled',
                    timeRange: timeRange
                  };
                }
              }
            }
          } catch (e) {
            console.error('解析调度配置失败:', e);
          }
        }
      }

      return { active: false };
    } catch (error) {
      console.error('检查活动计划失败:', error);
      throw error;
    }
  }

  /**
   * 批量删除录制计划
   * @param {Array} planIds - 计划ID数组
   */
  async bulkDeletePlans(planIds) {
    try {
      const count = await RecordingPlan.destroy({
        where: {
          id: planIds
        }
      });

      return {
        success: true,
        message: `成功删除 ${count} 个录制计划`,
        deletedCount: count
      };
    } catch (error) {
      console.error('批量删除录制计划失败:', error);
      throw error;
    }
  }
}

module.exports = new RecordingPlanService();
