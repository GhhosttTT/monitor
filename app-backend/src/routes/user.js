const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Camera = require('../models/Camera');
const auth = require('../middleware/auth');
const { Op } = require('sequelize');

// 获取所有用户 (管理员权限)
router.get('/', auth, async (req, res) => {
  try {
    // 检查是否为管理员
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: '权限不足' });
    }

    const users = await User.findAll({
      attributes: { exclude: ['password'] }, // 不返回密码字段
      include: [{
        model: Camera,
        as: 'cameras',
        attributes: ['id', 'name', 'serialNumber', 'status']
      }]
    });
    
    res.json(users);
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 创建用户 (管理员权限)
router.post('/', auth, async (req, res) => {
  try {
    // 检查是否为管理员
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: '权限不足' });
    }

    const { username, email, password } = req.body;
    
    // 检查用户是否已存在
    let user = await User.findOne({ 
      where: { 
        [Op.or]: [{ email }, { username }] 
      } 
    });
    
    if (user) {
      return res.status(400).json({ message: '用户已存在' });
    }
    
    // 创建新用户（只能创建普通用户）
    user = await User.create({ username, email, password, role: 'user' });
    
    // 返回用户信息（不包含密码）
    const userResponse = user.toJSON();
    delete userResponse.password;
    
    res.status(201).json(userResponse);
  } catch (error) {
    console.error('创建用户错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新用户 (管理员权限)
router.put('/:id', auth, async (req, res) => {
  try {
    // 检查是否为管理员
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: '权限不足' });
    }

    const { id } = req.params;
    const { username, email } = req.body;
    
    // 查找用户
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    // 更新用户信息
    user.username = username;
    user.email = email;
    // 用户只能是普通用户，不允许更改角色
    
    await user.save();
    
    // 返回更新后的用户信息（不包含密码）
    const userResponse = user.toJSON();
    delete userResponse.password;
    
    res.json(userResponse);
  } catch (error) {
    console.error('更新用户错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 删除用户 (管理员权限)
router.delete('/:id', auth, async (req, res) => {
  try {
    // 检查是否为管理员
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: '权限不足' });
    }

    const { id } = req.params;
    
    // 查找用户
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    // 删除用户
    await user.destroy();
    
    res.json({ message: '用户删除成功' });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 重置用户密码 (管理员权限)
router.post('/:id/reset-password', auth, async (req, res) => {
  try {
    // 检查是否为管理员
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: '权限不足' });
    }

    const { id } = req.params;
    const { newPassword } = req.body;
    
    // 查找用户
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    // 更新密码
    user.password = newPassword;
    await user.save();
    
    res.json({ message: '密码重置成功' });
  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;