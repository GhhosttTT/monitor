'use strict';
const {
  Model
} = require('sequelize');
const bcrypt = require('bcrypt');

module.exports = (sequelize, DataTypes) => {
  class Admin extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    
    // 验证密码
    async comparePassword(candidatePassword) {
      return bcrypt.compare(candidatePassword, this.password);
    }
    
    static associate(models) {
      // define association here
    }
  }
  Admin.init({
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('admin'),
      defaultValue: 'admin',
      validate: {
        isIn: [['admin']]
      }
    }
  }, {
    sequelize,
    modelName: 'Admin',
    timestamps: true
  });
  
  // 密码哈希
  Admin.beforeCreate(async (admin) => {
    if (admin.password) {
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash(admin.password, salt);
    }
  });

  Admin.beforeUpdate(async (admin) => {
    if (admin.changed('password')) {
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash(admin.password, salt);
    }
  });
  
  return Admin;
};