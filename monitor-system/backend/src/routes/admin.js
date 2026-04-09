const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const auth = require('../middleware/auth');
const { Op } = require('sequelize');

// 导出创建管理员的函数，供其他模块调用
async function createAdmin(req, res) {
  try {
    const { username, email, password } = req.body;
    
    // 检查管理员是否已存在
    let admin = await Admin.findOne({ 
      where: { 
        [Op.or]: [{ email }, { username }] 
      } 
    });
    
    if (admin) {
      return res.status(400).json({ message: '管理员已存在' });
    }
    
    // 创建新管理员
    admin = await Admin.create({ username, email, password });
    
    // 返回管理员信息（不包含密码）
    const adminResponse = admin.toJSON();
    delete adminResponse.password;
    
    res.status(201).json(adminResponse);
  } catch (error) {
    console.error('创建管理员错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
}

// 获取所有管理员 (需要管理员权限)
router.get('/', auth, async (req, res) => {
  try {
    // 检查是否为管理员
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: '权限不足' });
    }

    const admins = await Admin.findAll({
      attributes: { exclude: ['password'] } // 不返回密码字段
    });
    
    res.json(admins);
  } catch (error) {
    console.error('获取管理员列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 创建管理员 (允许初始注册)
router.post('/', createAdmin);

// 更新管理员 (需要管理员权限)
router.put('/:id', auth, async (req, res) => {
  try {
    // 检查是否为管理员
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: '权限不足' });
    }

    const { id } = req.params;
    const { username, email } = req.body;
    
    // 查找管理员
    const admin = await Admin.findByPk(id);
    if (!admin) {
      return res.status(404).json({ message: '管理员不存在' });
    }
    
    // 更新管理员信息
    admin.username = username;
    admin.email = email;
    
    await admin.save();
    
    // 返回更新后的管理员信息（不包含密码）
    const adminResponse = admin.toJSON();
    delete adminResponse.password;
    
    res.json(adminResponse);
  } catch (error) {
    console.error('更新管理员错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 删除管理员 (需要管理员权限)
router.delete('/:id', auth, async (req, res) => {
  try {
    // 检查是否为管理员
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: '权限不足' });
    }

    const { id } = req.params;
    
    // 不能删除自己
    if (req.user.id == id) {
      return res.status(400).json({ message: '不能删除当前管理员' });
    }
    
    // 查找管理员
    const admin = await Admin.findByPk(id);
    if (!admin) {
      return res.status(404).json({ message: '管理员不存在' });
    }
    
    // 删除管理员
    await admin.destroy();
    
    res.json({ message: '管理员删除成功' });
  } catch (error) {
    console.error('删除管理员错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 重置管理员密码 (需要管理员权限)
router.post('/:id/reset-password', auth, async (req, res) => {
  try {
    // 检查是否为管理员
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: '权限不足' });
    }

    const { id } = req.params;
    const { newPassword } = req.body;
    
    // 查找管理员
    const admin = await Admin.findByPk(id);
    if (!admin) {
      return res.status(404).json({ message: '管理员不存在' });
    }
    
    // 更新密码
    admin.password = newPassword;
    await admin.save();
    
    res.json({ message: '密码重置成功' });
  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 导出函数供其他模块使用
module.exports = router;
module.exports.createAdmin = createAdmin;