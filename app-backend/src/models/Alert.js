const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Camera = require('./Camera');

class Alert extends Model {}

Alert.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  cameraId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Camera,
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('offline', 'disk_space', 'motion_detected', 'error'),
    allowNull: false,
    comment: '告警类型：offline-离线，disk_space-磁盘空间，motion_detected-移动侦测，error-错误'
  },
  severity: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'medium',
    comment: '严重程度'
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '告警标题'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '告警详细信息'
  },
  status: {
    type: DataTypes.ENUM('active', 'acknowledged', 'resolved'),
    defaultValue: 'active',
    comment: '告警状态：active-活跃，acknowledged-已确认，resolved-已解决'
  },
  metadata: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '附加元数据(JSON格式)'
  },
  acknowledgedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '确认时间'
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '解决时间'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'Alert',
  tableName: 'alerts',
  timestamps: true
});

// 定义关联关系
Alert.belongsTo(Camera, { foreignKey: 'cameraId', as: 'camera' });
Camera.hasMany(Alert, { foreignKey: 'cameraId', as: 'alerts' });

module.exports = Alert;
