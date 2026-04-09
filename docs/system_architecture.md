# 系统架构设计

## 整体架构

本系统采用微服务架构，分为以下几个主要部分：

1. **摄像头固件层** - 负责视频采集和本地存储
2. **后端服务层** - 提供RESTful API和实时通信服务
3. **管理后台** - 为管理员提供系统管理界面
4. **移动端应用层** - 为用户提供监控访问接口

```
                    +------------------+
                    |   移动端应用      |
                    | (iOS/Android)    |
                    +---------+--------+
                              |
                    +---------v--------+
                    |   后端服务        |
                    | (Node.js + MongoDB)|
                    +----+--------+----+
                         |        |
               +---------v--+  +--v---------+
               | 摄像头固件   |  | 管理后台     |
               | (C/C++)    |  | (React/Vue) |
               +------------+  +-------------+
```

## 后端服务架构

后端服务基于Node.js + Express构建，使用以下技术栈：

- Web框架: Express.js
- 数据库: MongoDB (Mongoose ODM)
- 实时通信: Socket.IO + WebRTC
- 身份验证: JWT
- 文件存储: AWS S3 或 自建存储服务
- 缓存: Redis

### 数据库模型

#### User 模型
```javascript
{
  username: String,           // 用户名
  email: String,              // 邮箱
  password: String,           // 密码（加密存储）
  role: String,               // 角色 ('user' 或 'admin')
  cameras: [ObjectId],        // 关联的摄像头
  createdAt: Date             // 创建时间
}
```

#### Camera 模型
```javascript
{
  name: String,               // 摄像头名称
  serialNumber: String,       // 序列号
  owner: ObjectId,            // 所有者 (关联User)
  status: String,             // 状态 ('online', 'offline', 'error')
  ipAddress: String,          // IP地址
  lastConnected: Date,        // 最后连接时间
  settings: {                 // 设置
    resolution: String,       // 分辨率 ('720p', '1080p', '2k', '4k')
    storageRetention: Number, // 存储保留天数 (默认30天)
    motionDetection: {        // 移动侦测设置
      enabled: Boolean,       // 是否启用
      sensitivity: Number     // 灵敏度 (1-10)
    }
  },
  createdAt: Date             // 创建时间
}
```

#### Video 模型
```javascript
{
  camera: ObjectId,           // 关联的摄像头
  filename: String,           // 文件名
  fileUrl: String,            // 文件URL
  thumbnailUrl: String,       // 缩略图URL
  startTime: Date,            // 开始时间
  endTime: Date,              // 结束时间
  duration: Number,           // 时长（秒）
  size: Number,               // 大小（字节）
  resolution: String,         // 分辨率
  hasMotion: Boolean,         // 是否有移动侦测事件
  createdAt: Date,            // 创建时间
  expiresAt: Date             // 过期时间（用于TTL索引）
}
```

## API 接口设计

### 认证相关接口

#### POST /api/auth/register
用户注册

请求参数：
```json
{
  "username": "用户名",
  "email": "邮箱",
  "password": "密码"
}
```

响应：
```json
{
  "token": "JWT令牌",
  "user": {
    "id": "用户ID",
    "username": "用户名",
    "email": "邮箱",
    "role": "角色"
  }
}
```

#### POST /api/auth/login
用户登录

请求参数：
```json
{
  "email": "邮箱",
  "password": "密码"
}
```

响应：
```json
{
  "token": "JWT令牌",
  "user": {
    "id": "用户ID",
    "username": "用户名",
    "email": "邮箱",
    "role": "角色"
  }
}
```

#### GET /api/auth/me
获取当前用户信息

响应：
```json
{
  "_id": "用户ID",
  "username": "用户名",
  "email": "邮箱",
  "role": "角色",
  "cameras": ["摄像头ID数组"],
  "createdAt": "创建时间"
}
```

### 摄像头管理接口

#### GET /api/cameras
获取用户所有摄像头

响应：
```json
[
  {
    "_id": "摄像头ID",
    "name": "摄像头名称",
    "serialNumber": "序列号",
    "status": "状态",
    "lastConnected": "最后连接时间",
    "settings": {
      "resolution": "分辨率",
      "storageRetention": "存储保留天数"
    }
  }
]
```

#### POST /api/cameras
添加新摄像头

请求参数：
```json
{
  "name": "摄像头名称",
  "serialNumber": "序列号"
}
```

#### PUT /api/cameras/:id
更新摄像头信息

请求参数：
```json
{
  "name": "摄像头名称"
}
```

#### DELETE /api/cameras/:id
删除摄像头

#### GET /api/cameras/:id/stream
获取摄像头实时视频流（WebSocket/WebRTC）

### 视频管理接口

#### GET /api/videos
获取视频列表

查询参数：
- cameraId: 摄像头ID（可选）
- page: 页码（默认1）
- limit: 每页数量（默认20）

响应：
```json
{
  "videos": [
    {
      "_id": "视频ID",
      "filename": "文件名",
      "fileUrl": "文件URL",
      "thumbnailUrl": "缩略图URL",
      "startTime": "开始时间",
      "endTime": "结束时间",
      "duration": "时长",
      "size": "大小",
      "resolution": "分辨率",
      "hasMotion": "是否有移动侦测事件"
    }
  ],
  "pagination": {
    "currentPage": "当前页",
    "totalPages": "总页数",
    "totalVideos": "视频总数"
  }
}
```

#### GET /api/videos/:id
获取单个视频详情

#### DELETE /api/videos/:id
删除视频

## 管理后台功能

管理后台使用现代前端框架（如React或Vue）构建，提供以下功能：

1. **用户管理**
   - 查看所有用户
   - 添加/编辑/删除用户
   - 重置用户密码
   - 分配用户角色

2. **摄像头管理**
   - 查看所有摄像头
   - 添加/编辑/删除摄像头
   - 查看摄像头状态
   - 配置摄像头参数

3. **视频管理**
   - 查看所有视频记录
   - 按摄像头、时间等条件筛选
   - 删除视频记录

4. **系统监控**
   - 服务器状态监控
   - 存储空间使用情况
   - 实时连接数统计

## 移动端功能

移动端应用提供以下核心功能：

1. **实时监控**
   - 查看绑定摄像头的实时视频流
   - 支持横竖屏切换
   - 支持截图和录像

2. **历史回放**
   - 查看历史视频记录
   - 按日期筛选视频
   - 视频播放控制

3. **摄像头管理**
   - 绑定/解绑摄像头
   - 配置摄像头参数

4. **个人设置**
   - 修改个人信息
   - 修改密码
   - 接收通知设置