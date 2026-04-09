# 移动端与后端集成实现

## 概述

本文档详细描述了如何实现移动端（iOS/Android）与后端服务的集成，包括认证、摄像头管理和视频播放等功能。

## 1. 认证系统集成

### 1.1 用户注册

移动端需要实现用户注册功能，通过调用后端API完成：

**API端点：** `POST /api/auth/register`

**请求参数：**
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**响应：**
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

**移动端实现要点：**
- 实现注册表单验证
- 密码强度检查
- 使用HTTPS发送请求
- 安全存储JWT令牌

### 1.2 用户登录

**API端点：** `POST /api/auth/login`

**请求参数：**
```json
{
  "email": "string",
  "password": "string"
}
```

**响应：**
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

**移动端实现要点：**
- 实现登录表单
- 记住登录状态功能
- 自动处理Token过期和刷新
- 实现注销功能

### 1.3 获取用户信息

**API端点：** `GET /api/auth/me`

**响应：**
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

## 2. 摄像头管理集成

### 2.1 获取用户所有摄像头

**API端点：** `GET /api/cameras`

**响应：**
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

### 2.2 添加摄像头

**API端点：** `POST /api/cameras`

**请求参数：**
```json
{
  "name": "摄像头名称",
  "serialNumber": "序列号"
}
```

### 2.3 更新摄像头信息

**API端点：** `PUT /api/cameras/:id`

**请求参数：**
```json
{
  "name": "摄像头名称"
}
```

### 2.4 删除摄像头

**API端点：** `DELETE /api/cameras/:id`

## 3. 实时视频监控集成

### 3.1 获取视频流连接信息

**API端点：** `GET /api/cameras/:id/stream`

**响应：**
```json
{
  "cameraId": "摄像头ID",
  "streamUrl": "/stream/:cameraId",
  "message": "请使用WebSocket/WebRTC连接获取实时视频流"
}
```

### 3.2 WebRTC连接流程

1. 客户端向服务器请求建立连接
2. 服务器创建RTCPeerConnection并生成offer
3. 客户端接收offer并生成answer
4. 双方交换ICE候选
5. 建立视频流传输

### 3.3 移动端WebRTC实现

#### iOS端实现（Swift）：
- 使用WebRTC框架
- 实现RTCPeerConnection管理
- 处理信令交换
- 渲染视频流

#### Android端实现（Kotlin）：
- 使用Google WebRTC库
- 实现PeerConnection管理
- 处理信令交换
- 渲染视频流

## 4. 视频回放集成

### 4.1 获取视频列表

**API端点：** `GET /api/videos`

**查询参数：**
- cameraId: 摄像头ID（可选）
- page: 页码（默认1）
- limit: 每页数量（默认20）

**响应：**
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

### 4.2 获取单个视频详情

**API端点：** `GET /api/videos/:id`

### 4.3 删除视频

**API端点：** `DELETE /api/videos/:id`

## 5. 网络和安全考虑

### 5.1 网络安全
- 所有通信使用HTTPS加密
- JWT令牌通过Authorization头传输
- 敏感操作需要重新验证身份

### 5.2 数据安全
- 用户密码使用bcrypt加密存储
- 视频文件访问需要身份验证
- 实现适当的访问控制

### 5.3 性能优化
- 实现请求缓存
- 使用分页加载大数据集
- 压缩图片和视频缩略图
- 实现断点续传功能

## 6. 错误处理和用户体验

### 6.1 常见错误类型
- 网络连接错误
- 认证失败
- 资源不存在
- 服务器内部错误

### 6.2 错误处理策略
- 提供友好的错误提示
- 实现自动重试机制
- 支持离线模式
- 记录错误日志用于调试

## 7. 测试和调试

### 7.1 单元测试
- 认证服务测试
- API接口测试
- WebRTC连接测试

### 7.2 集成测试
- 端到端功能测试
- 网络异常测试
- 性能压力测试

### 7.3 用户验收测试
- 真实设备测试
- 用户体验评估
- 兼容性测试

## 8. 部署和维护

### 8.1 持续集成
- 自动化构建和部署
- 版本管理和发布
- 监控和日志收集

### 8.2 更新策略
- 热更新支持
- 渐进式功能发布
- 回滚机制

### 8.3 监控和分析
- 用户行为分析
- 性能监控
- 错误日志收集