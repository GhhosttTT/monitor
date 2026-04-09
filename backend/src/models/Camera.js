const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

class Camera extends Model {}

Camera.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  serialNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  status: {
    type: DataTypes.ENUM('online', 'offline', 'error'),
    defaultValue: 'offline'
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lastConnected: {
    type: DataTypes.DATE,
    allowNull: true
  },
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id'
    }
  },
  resolution: {
    type: DataTypes.ENUM('720p', '1080p', '2k', '4k'),
    defaultValue: '2k',
    field: 'settings_resolution'
  },
  storageRetention: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
    validate: {
      min: 1,
      max: 90
    },
    field: 'settings_storage_retention'
  },
  motionDetectionEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'settings_motion_detection_enabled'
  },
  motionDetectionSensitivity: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    validate: {
      min: 1,
      max: 10
    },
    field: 'settings_motion_detection_sensitivity'
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
  modelName: 'Camera',
  tableName: 'cameras',
  timestamps: true
});

// 定义关联关系
Camera.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });
User.hasMany(Camera, { foreignKey: 'ownerId', as: 'cameras' });

module.exports = Camera;