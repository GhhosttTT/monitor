require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const routes = require('./routes');
const sequelize = require('./config/database');
const User = require('./models/User');
const Camera = require('./models/Camera');
const Video = require('./models/Video');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api', routes);

// 健康检查
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// WebRTC和WebSocket设置
// 设置WebSocket连接事件
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);
  
  // 处理摄像头连接
  socket.on('camera-join', async (data) => {
    try {
      const { cameraId, userId } = data;
      
      // 验证摄像头属于用户
      const camera = await Camera.findOne({
        where: { id: cameraId, ownerId: userId }
      });
      
      if (!camera) {
        socket.emit('connection-error', { message: '摄像头不存在或不属于该用户' });
        return;
      }
      
      // 在实际项目中，这里应该建立真正的WebRTC连接
      socket.cameraId = cameraId;
      socket.userId = userId;
      
      // 通知客户端连接已建立
      socket.emit('connection-established', { cameraId, userId });
    } catch (error) {
      console.error('摄像头连接失败:', error);
      socket.emit('connection-error', { message: '连接失败' });
    }
  });
  
  // 处理offer
  socket.on('offer', async (data) => {
    try {
      // 在实际项目中，这里应该处理WebRTC offer
      console.log('收到offer:', data);
    } catch (error) {
      console.error('处理offer失败:', error);
    }
  });
  
  // 处理ICE候选
  socket.on('ice-candidate', async (data) => {
    try {
      // 在实际项目中，这里应该处理ICE候选
      console.log('收到ICE候选:', data);
    } catch (error) {
      console.error('处理ICE候选失败:', error);
    }
  });
  
  // 处理断开连接
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
  });
});

// 数据库连接
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL数据库连接成功');
    
    // 同步模型到数据库
    await sequelize.sync({ alter: true });
    console.log('数据库模型同步完成');
  } catch (error) {
    console.error('MySQL数据库连接失败:', error.message);
    process.exit(1);
  }
};

// 启动服务器
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`App后端服务运行在端口 ${PORT}`);
});

connectDB();

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('未处理的Promise拒绝:', err);
});

module.exports = { app, server };