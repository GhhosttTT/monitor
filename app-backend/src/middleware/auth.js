const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

const auth = async (req, res, next) => {
  // 对于创建管理员的路由，跳过认证检查
  if (req.originalUrl === '/api/admins' && req.method === 'POST') {
    return next();
  }
  
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: '访问被拒绝，没有提供token' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    // 根据角色查找对应的用户
    let user;
    if (decoded.isAdmin) {
      user = await Admin.findByPk(decoded.userId);
    } else {
      user = await User.findByPk(decoded.userId);
    }
    
    if (!user) {
      return res.status(401).json({ message: 'token无效' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'token无效' });
  }
};

module.exports = auth;