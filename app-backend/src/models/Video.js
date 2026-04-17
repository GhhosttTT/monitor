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
  cameraId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Camera,
      key: 'id'
    }
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  fileUrl: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  thumbnailUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  duration: {
    type: DataTypes.INTEGER, // 秒
    allowNull: false
  },
  size: {
    type: DataTypes.BIGINT, // 字节
    allowNull: false
  },
  resolution: {
    type: DataTypes.ENUM('vga', 'svga', 'hd', 'uxga'),
    defaultValue: 'svga'
  },
  hasMotion: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
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
  timestamps: true,
  indexes: [
    {
      fields: ['cameraId', 'startTime'],
      order: 'DESC'
    },
    {
      fields: ['expiresAt'],
      using: 'BTREE'
    }
  ]
});

// 定义关联关系
Video.belongsTo(Camera, { foreignKey: 'cameraId', as: 'camera' });
Camera.hasMany(Video, { foreignKey: 'cameraId', as: 'videos' });

module.exports = Video;