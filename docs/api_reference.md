# API 参考文档

## 基础信息

- Base URL: `/api`
- 认证方式: JWT Token (放在 Authorization header 中)
- Content-Type: `application/json`

## 状态码说明

| 状态码 | 说明 |
|-------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 禁止访问 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 认证相关

### 用户注册

**POST** `/auth/register`

请求示例：
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

请求参数：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名 |
| email | string | 是 | 邮箱地址 |
| password | string | 是 | 密码 |

响应示例：
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "5f8d0d5f5ce3f40b8c8a1b2a",
    "username": "testuser",
    "email": "test@example.com",
    "role": "user"
  }
}
```

### 用户登录

**POST** `/auth/login`

请求示例：
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

请求参数：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 邮箱地址 |
| password | string | 是 | 密码 |

响应示例：
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "5f8d0d5f5ce3f40b8c8a1b2a",
    "username": "testuser",
    "email": "test@example.com",
    "role": "user"
  }
}
```

### 获取当前用户信息

**GET** `/auth/me`

请求示例：
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

响应示例：
```json
{
  "_id": "5f8d0d5f5ce3f40b8c8a1b2a",
  "username": "testuser",
  "email": "test@example.com",
  "role": "user",
  "cameras": [],
  "createdAt": "2020-10-19T07:22:07.787Z"
}
```

## 摄像头管理

### 获取用户所有摄像头

**GET** `/cameras`

请求示例：
```bash
curl -X GET http://localhost:5000/api/cameras \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

响应示例：
```json
[
  {
    "_id": "5f8d0d5f5ce3f40b8c8a1b2b",
    "name": "客厅摄像头",
    "serialNumber": "SN000001",
    "status": "online",
    "lastConnected": "2020-10-19T07:25:00.000Z",
    "settings": {
      "resolution": "2k",
      "storageRetention": 30,
      "motionDetection": {
        "enabled": true,
        "sensitivity": 5
      }
    },
    "createdAt": "2020-10-19T07:22:07.787Z"
  }
]
```

### 添加摄像头

**POST** `/cameras`

请求示例：
```bash
curl -X POST http://localhost:5000/api/cameras \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "卧室摄像头",
    "serialNumber": "SN000002"
  }'
```

请求参数：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 摄像头名称 |
| serialNumber | string | 是 | 摄像头序列号 |

响应示例：
```json
{
  "_id": "5f8d0d5f5ce3f40b8c8a1b2c",
  "name": "卧室摄像头",
  "serialNumber": "SN000002",
  "status": "offline",
  "owner": "5f8d0d5f5ce3f40b8c8a1b2a",
  "settings": {
    "resolution": "2k",
    "storageRetention": 30,
    "motionDetection": {
      "enabled": true,
      "sensitivity": 5
    }
  },
  "createdAt": "2020-10-19T07:22:07.787Z"
}
```

### 更新摄像头信息

**PUT** `/cameras/:id`

请求示例：
```bash
curl -X PUT http://localhost:5000/api/cameras/5f8d0d5f5ce3f40b8c8a1b2c \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "厨房摄像头"
  }'
```

请求参数：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 否 | 摄像头名称 |

响应示例：
```json
{
  "_id": "5f8d0d5f5ce3f40b8c8a1b2c",
  "name": "厨房摄像头",
  "serialNumber": "SN000002",
  "status": "offline",
  "owner": "5f8d0d5f5ce3f40b8c8a1b2a",
  "settings": {
    "resolution": "2k",
    "storageRetention": 30,
    "motionDetection": {
      "enabled": true,
      "sensitivity": 5
    }
  },
  "createdAt": "2020-10-19T07:22:07.787Z"
}
```

### 删除摄像头

**DELETE** `/cameras/:id`

请求示例：
```bash
curl -X DELETE http://localhost:5000/api/cameras/5f8d0d5f5ce3f40b8c8a1b2c \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

响应示例：
```json
{
  "message": "摄像头删除成功"
}
```

## 视频管理

### 获取视频列表

**GET** `/videos`

查询参数：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cameraId | string | 否 | 摄像头ID |
| page | number | 否 | 页码，默认1 |
| limit | number | 否 | 每页数量，默认20 |

请求示例：
```bash
curl -X GET "http://localhost:5000/api/videos?cameraId=5f8d0d5f5ce3f40b8c8a1b2b&page=1&limit=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

响应示例：
```json
{
  "videos": [
    {
      "_id": "5f8d0d5f5ce3f40b8c8a1b2d",
      "camera": "5f8d0d5f5ce3f40b8c8a1b2b",
      "filename": "20201019_072500.mp4",
      "fileUrl": "https://storage.example.com/videos/20201019_072500.mp4",
      "thumbnailUrl": "https://storage.example.com/thumbnails/20201019_072500.jpg",
      "startTime": "2020-10-19T07:25:00.000Z",
      "endTime": "2020-10-19T07:30:00.000Z",
      "duration": 300,
      "size": 104857600,
      "resolution": "2k",
      "hasMotion": true,
      "createdAt": "2020-10-19T07:30:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalVideos": 45
  }
}
```

### 获取单个视频详情

**GET** `/videos/:id`

请求示例：
```bash
curl -X GET http://localhost:5000/api/videos/5f8d0d5f5ce3f40b8c8a1b2d \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

响应示例：
```json
{
  "_id": "5f8d0d5f5ce3f40b8c8a1b2d",
  "camera": "5f8d0d5f5ce3f40b8c8a1b2b",
  "filename": "20201019_072500.mp4",
  "fileUrl": "https://storage.example.com/videos/20201019_072500.mp4",
  "thumbnailUrl": "https://storage.example.com/thumbnails/20201019_072500.jpg",
  "startTime": "2020-10-19T07:25:00.000Z",
  "endTime": "2020-10-19T07:30:00.000Z",
  "duration": 300,
  "size": 104857600,
  "resolution": "2k",
  "hasMotion": true,
  "createdAt": "2020-10-19T07:30:00.000Z"
}
```

### 删除视频

**DELETE** `/videos/:id`

请求示例：
```bash
curl -X DELETE http://localhost:5000/api/videos/5f8d0d5f5ce3f40b8c8a1b2d \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

响应示例：
```json
{
  "message": "视频删除成功"
}
```