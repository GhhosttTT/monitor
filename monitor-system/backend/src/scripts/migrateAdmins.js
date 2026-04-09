const sequelize = require('../config/database');
const User = require('../models/User');
const Admin = require('../models/Admin');
const { Op } = require('sequelize'); // 引入Op操作符

async function migrateAdmins() {
  try {
    // 同步数据库，确保admin表已创建
    await sequelize.sync();
    
    // 查找所有role为admin的用户
    const adminUsers = await User.findAll({
      where: {
        role: 'admin'
      }
    });
    
    console.log(`找到 ${adminUsers.length} 个管理员用户需要迁移`);
    
    // 迁移每个管理员用户到admin表
    for (const user of adminUsers) {
      try {
        // 检查admin表中是否已存在该用户（通过email或username）
        const existingAdmin = await Admin.findOne({
          where: {
            [Op.or]: [
              { email: user.email },
              { username: user.username }
            ]
          }
        });
        
        if (!existingAdmin) {
          // 创建新的管理员记录
          await Admin.create({
            username: user.username,
            email: user.email,
            password: user.password, // 保持加密的密码
            role: 'admin',
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          });
          
          console.log(`成功迁移管理员: ${user.username}`);
        } else {
          console.log(`管理员 ${user.username} 已存在于admin表中，跳过迁移`);
        }
      } catch (error) {
        console.error(`迁移管理员 ${user.username} 时出错:`, error);
      }
    }
    
    console.log('管理员迁移完成');
    
    // 可选：删除user表中已迁移的管理员记录
    // 注意：这一步需要谨慎操作，建议在确认迁移成功后再执行
    const deletedCount = await User.destroy({
      where: {
        role: 'admin'
      }
    });
    
    console.log(`从user表中删除了 ${deletedCount} 个管理员记录`);
    
  } catch (error) {
    console.error('迁移过程中出错:', error);
  } finally {
    await sequelize.close();
  }
}

// 执行迁移
if (require.main === module) {
  migrateAdmins();
}

module.exports = migrateAdmins;