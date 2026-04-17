const Camera = require('../models/Camera');
const Alert = require('../models/Alert');
const { Op } = require('sequelize');

class HeartbeatService {
  constructor() {
    this.heartbeatTimeout = 90; // 心跳超时时间（秒），默认是心跳间隔的3倍
  }

  /**
   * 处理设备心跳
   * @param {string} serialNumber - 设备序列号
   * @param {object} data - 心跳数据
   */
  async handleHeartbeat(serialNumber, data = {}) {
    try {
      const camera = await Camera.findOne({ where: { serialNumber } });
      
      if (!camera) {
        console.warn(`未找到设备: ${serialNumber}`);
        return { success: false, message: '设备不存在' };
      }

      // 更新心跳时间和状态
      const updates = {
        lastHeartbeat: new Date(),
        status: 'online'
      };

      // 如果提供了IP地址，也更新
      if (data.ipAddress) {
        updates.ipAddress = data.ipAddress;
      }

      // 如果提供了存储使用情况，也更新
      if (data.storageUsed !== undefined) {
        updates.storageUsed = data.storageUsed;
      }

      await camera.update(updates);

      // 检查是否有活跃的离线告警，如果有则解决它
      await this.resolveOfflineAlert(camera.id);

      // 检查磁盘空间
      await this.checkDiskSpace(camera);

      return { success: true, message: '心跳更新成功' };
    } catch (error) {
      console.error('处理心跳失败:', error);
      return { success: false, message: '服务器错误' };
    }
  }

  /**
   * 检查所有设备的在线状态
   */
  async checkAllDevicesStatus() {
    try {
      const now = new Date();
      const timeoutDate = new Date(now.getTime() - this.heartbeatTimeout * 1000);

      // 查找所有应该在线但心跳超时的设备
      const offlineCameras = await Camera.findAll({
        where: {
          status: 'online',
          lastHeartbeat: {
            [Op.lt]: timeoutDate
          }
        }
      });

      for (const camera of offlineCameras) {
        await this.markCameraOffline(camera);
      }

      return {
        checked: offlineCameras.length,
        offlineDevices: offlineCameras.map(c => ({
          id: c.id,
          name: c.name,
          serialNumber: c.serialNumber,
          lastHeartbeat: c.lastHeartbeat
        }))
      };
    } catch (error) {
      console.error('检查设备状态失败:', error);
      throw error;
    }
  }

  /**
   * 标记设备为离线并创建告警
   * @param {object} camera - 摄像头对象
   */
  async markCameraOffline(camera) {
    try {
      // 更新设备状态
      await camera.update({ status: 'offline' });

      // 检查是否已有活跃的离线告警
      const existingAlert = await Alert.findOne({
        where: {
          cameraId: camera.id,
          type: 'offline',
          status: 'active'
        }
      });

      // 如果没有活跃告警，创建新的
      if (!existingAlert) {
        await Alert.create({
          cameraId: camera.id,
          type: 'offline',
          severity: 'high',
          title: `设备离线: ${camera.name}`,
          message: `设备 ${camera.name} (${camera.serialNumber}) 已离线，最后心跳时间: ${camera.lastHeartbeat}`,
          status: 'active',
          metadata: JSON.stringify({
            lastHeartbeat: camera.lastHeartbeat,
            ipAddress: camera.ipAddress
          })
        });

        console.log(`创建设备离线告警: ${camera.name}`);
      }
    } catch (error) {
      console.error('标记设备离线失败:', error);
      throw error;
    }
  }

  /**
   * 解决离线告警
   * @param {number} cameraId - 摄像头ID
   */
  async resolveOfflineAlert(cameraId) {
    try {
      const activeAlerts = await Alert.findAll({
        where: {
          cameraId: cameraId,
          type: 'offline',
          status: 'active'
        }
      });

      for (const alert of activeAlerts) {
        await alert.update({
          status: 'resolved',
          resolvedAt: new Date()
        });
      }
    } catch (error) {
      console.error('解决离线告警失败:', error);
    }
  }

  /**
   * 检查磁盘空间
   * @param {object} camera - 摄像头对象
   */
  async checkDiskSpace(camera) {
    try {
      if (!camera.storageUsed || !camera.storageLimit) {
        return;
      }

      const usagePercent = (camera.storageUsed / camera.storageLimit) * 100;
      const threshold = camera.diskSpaceWarningThreshold || 80;

      if (usagePercent >= threshold) {
        // 检查是否已有活跃的磁盘空间告警
        const existingAlert = await Alert.findOne({
          where: {
            cameraId: camera.id,
            type: 'disk_space',
            status: 'active'
          }
        });

        if (!existingAlert) {
          await Alert.create({
            cameraId: camera.id,
            type: 'disk_space',
            severity: usagePercent >= 95 ? 'critical' : 'high',
            title: `磁盘空间不足: ${camera.name}`,
            message: `设备 ${camera.name} 磁盘使用率已达 ${usagePercent.toFixed(2)}%，超过告警阈值 ${threshold}%`,
            status: 'active',
            metadata: JSON.stringify({
              storageUsed: camera.storageUsed,
              storageLimit: camera.storageLimit,
              usagePercent: usagePercent,
              threshold: threshold
            })
          });

          console.log(`创建磁盘空间告警: ${camera.name}, 使用率: ${usagePercent.toFixed(2)}%`);
        }
      }
    } catch (error) {
      console.error('检查磁盘空间失败:', error);
    }
  }

  /**
   * 获取设备状态统计
   */
  async getDeviceStatusStats() {
    try {
      const total = await Camera.count();
      const online = await Camera.count({ where: { status: 'online' } });
      const offline = await Camera.count({ where: { status: 'offline' } });
      const error = await Camera.count({ where: { status: 'error' } });

      return {
        total,
        online,
        offline,
        error
      };
    } catch (error) {
      console.error('获取设备状态统计失败:', error);
      throw error;
    }
  }
}

module.exports = new HeartbeatService();
