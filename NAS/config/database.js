const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

// 尝试使用 MySQL，如果环境变量中没有配置则使用 SQLite
if (process.env.DB_HOST) {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'monitor_system',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      dialect: 'mysql',
      logging: false
    }
  );
} else {
  // 使用 SQLite 作为轻量级替代方案，无需安装 MySQL 服务器
  console.log('未检测到 MySQL 配置，正在使用 SQLite 数据库...');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './monitor.db',
    logging: false
  });
}

module.exports = sequelize;