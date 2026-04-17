const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Camera = require('./Camera');

class RecordingPlan extends Model {}

RecordingPlan.init({
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
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '计划名称'
  },
  type: {
    type: DataTypes.ENUM('scheduled', 'motion'),
    allowNull: false,
    comment: '计划类型：scheduled-定时录制，motion-移动侦测录制'
  },
  schedule: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '调度配置(JSON格式)，例如：{"mon":["08:00-18:00"],"tue":["09:00-17:00"]}'
  },
  motionSensitivity: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    validate: {
      min: 1,
      max: 10
    },
    comment: '移动侦测灵敏度(1-10)'
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否启用'
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '优先级，数字越大优先级越高'
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
  modelName: 'RecordingPlan',
  tableName: 'recording_plans',
  timestamps: true
});

// 定义关联关系
RecordingPlan.belongsTo(Camera, { foreignKey: 'cameraId', as: 'camera' });
Camera.hasMany(RecordingPlan, { foreignKey: 'cameraId', as: 'recordingPlans' });

module.exports = RecordingPlan;
