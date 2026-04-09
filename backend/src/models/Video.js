const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Camera = require('./Camera');

class Video extends Model {}

Video.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  duration: {
    type: DataTypes.INTEGER, // 视频时长（秒）
    allowNull: true
  },
  size: {
    type: DataTypes.BIGINT, // 文件大小（字节）
    allowNull: true
  },
  recordedAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  cameraId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Camera,
      key: 'id'
    }
  },
  url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  thumbnailUrl: {
    type: DataTypes.STRING,
    allowNull: true
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
  modelName: 'Video',
  tableName: 'videos',
  timestamps: true
});

// 定义关联关系
Video.belongsTo(Camera, { foreignKey: 'cameraId', as: 'camera' });
Camera.hasMany(Video, { foreignKey: 'cameraId', as: 'videos' });

module.exports = Video;