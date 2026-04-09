# 移动端与后端集成计划

## 概述

本文档描述了如何将iOS和Android移动应用与后端服务进行集成，以实现用户认证、摄像头绑定、实时监控和视频回放等功能。

## 集成架构

```
+------------------+        +------------------+        +------------------+
|   移动端应用      |        |   后端服务        |        |   摄像头设备      |
| (iOS/Android)    |<------>| (Node.js + MongoDB) |<------>| (ESP32/ESP8266)  |
+------------------+  HTTPS +------------------+ WebRTC +------------------+
                           |                  |
                           |  +------------+  |
                           |  | 管理后台    |  |
                           |  | (React)    |  |
                           |  +------------+  |
                           +------------------+
```

## 核心功能集成

### 1. 用户认证

#### 功能描述
用户可以通过移动应用进行注册、登录和会话管理。

#### API接口
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

#### 实现要点
- 使用JWT Token进行身份验证
- 本地存储Token，用于后续API请求
- 实现Token刷新机制
- 处理认证错误和会话过期

#### 移动端实现
- 创建认证服务模块
- 实现登录/注册界面
- 集成安全存储（Keychain/Keystore）保存Token
- 实现全局HTTP拦截器添加认证头

### 2. 摄像头管理

#### 功能描述
用户可以查看、添加和管理绑定的摄像头设备。

#### API接口
- `GET /api/cameras` - 获取用户所有摄像头
- `POST /api/cameras` - 添加新摄像头
- `PUT /api/cameras/:id` - 更新摄像头信息
- `DELETE /api/cameras/:id` - 删除摄像头

#### 实现要点
- 摄像头与用户账户绑定
- 支持摄像头状态监控（在线/离线）
- 提供摄像头配置管理

#### 移动端实现
- 创建摄像头管理服务
- 实现摄像头列表界面
- 实现添加摄像头功能（扫描二维码或手动输入序列号）
- 实现摄像头设置界面

### 3. 实时监控

#### 功能描述
用户可以实时查看绑定摄像头的视频流。

#### 技术方案
- 使用WebRTC进行实时视频传输
- 通过WebSocket进行信令交换
- 支持多路视频同时播放

#### API接口
- `GET /api/cameras/:id/stream` - 获取视频流连接信息

#### 实现要点
- 建立WebRTC连接
- 处理视频流渲染
- 实现播放控制（开始/暂停/截图）
- 处理连接错误和重连

#### 移动端实现
- 集成WebRTC库
- 创建视频播放组件
- 实现连接状态监控
- 实现截图功能

### 4. 视频回放

#### 功能描述
用户可以查看和播放历史视频记录。

#### API接口
- `GET /api/videos` - 获取视频列表
- `GET /api/videos/:id` - 获取视频详情
- `GET /api/videos/:id/stream` - 获取视频流

#### 实现要点
- 支持按日期和摄像头筛选
- 实现视频播放控制
- 支持移动侦测事件标记
- 提供下载功能

#### 移动端实现
- 创建历史记录界面
- 实现视频列表和筛选功能
- 集成视频播放器
- 实现下载管理

## 数据模型映射

### User 用户
```javascript
{
  id: String,           // 用户ID
  username: String,     // 用户名
  email: String,        // 邮箱
  password: String,     // 密码（加密存储）
  role: String,         // 角色 ('user' | 'admin')
  cameras: [String],    // 绑定的摄像头ID列表
  createdAt: Date       // 创建时间
}
```

### Camera 摄像头
```javascript
{
  id: String,                    // 摄像头ID
  name: String,                  // 摄像头名称
  serialNumber: String,          // 序列号
  owner: String,                 // 所有者ID
  status: String,                // 状态 ('online' | 'offline' | 'error')
  ipAddress: String,             // IP地址
  lastConnected: Date,           // 最后连接时间
  settings: {                    // 设置
    resolution: String,          // 分辨率 ('2k')
    storageRetention: Number,    // 存储保留天数 (30)
    motionDetection: {           // 移动侦测设置
      enabled: Boolean,          // 是否启用
      sensitivity: Number        // 灵敏度 (1-10)
    }
  },
  createdAt: Date               // 创建时间
}
```

### Video 视频
```javascript
{
  id: String,           // 视频ID
  camera: String,       // 关联的摄像头ID
  filename: String,     // 文件名
  fileUrl: String,      // 文件URL
  thumbnailUrl: String, // 缩略图URL
  startTime: Date,      // 开始时间
  endTime: Date,        // 结束时间
  duration: Number,     // 时长（秒）
  size: Number,         // 大小（字节）
  resolution: String,   // 分辨率 ('2k')
  hasMotion: Boolean,   // 是否有移动侦测事件
  createdAt: Date,      // 创建时间
  expiresAt: Date       // 过期时间
}
```

## 安全考虑

### 传输安全
- 所有API通信使用HTTPS
- WebRTC连接使用安全协议
- 敏感数据加密传输

### 身份验证
- JWT Token认证
- Token过期和刷新机制
- 请求签名验证

### 数据保护
- 用户密码加密存储
- 敏感信息访问控制
- 操作日志记录

## 性能优化

### 网络优化
- 实现请求缓存机制
- 使用分页加载大数据集
- 压缩图片和视频缩略图

### 存储优化
- 本地缓存常用数据
- 实现数据过期策略
- 支持离线模式

### 视频优化
- 自适应码率流媒体
- 预加载关键视频片段
- 支持多种视频格式

## 错误处理

### 网络错误
- 实现重试机制
- 提供友好的错误提示
- 支持离线操作和同步

### 认证错误
- 自动跳转到登录页面
- Token过期自动刷新
- 处理账户锁定情况

### 视频流错误
- 实现自动重连
- 提供备用播放方案
- 处理编解码兼容性问题

## 测试策略

### 单元测试
- 认证服务测试
- API接口测试
- 数据模型测试

### 集成测试
- 端到端功能测试
- 网络异常测试
- 性能压力测试

### 用户验收测试
- 真实设备测试
- 用户体验评估
- 兼容性测试

## 部署和维护

### 持续集成
- 自动化构建和部署
- 版本管理和发布
- 监控和日志收集

### 更新策略
- 热更新支持
- 渐进式功能发布
- 回滚机制

### 监控和分析
- 用户行为分析
- 性能监控
- 错误日志收集