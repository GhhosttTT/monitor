# 监控系统 - 快速启动指南

## 📋 已完成功能清单

✅ **设备状态监控**
- 心跳检测机制（自动上报 + 定时检查）
- 离线告警（自动创建/解决）
- 设备状态统计API

✅ **录像计划配置**
- 定时录制计划（支持按星期和时间段配置）
- 移动侦测录制
- 计划管理API（增删改查、批量操作）
- 活动计划检测

✅ **视频导出功能**
- 指定时间段视频导出
- ZIP打包下载
- 自动清理临时文件

✅ **截图功能**
- 单张视频截图（可指定时间戳）
- 批量截图
- FFmpeg集成

✅ **磁盘空间告警**
- 实时监控存储使用率
- 分级告警（high/critical）
- 可配置告警阈值

✅ **视频管理**
- 视频列表查询（支持筛选、分页）
- 视频下载
- 单个/批量删除
- 自动更新存储统计

✅ **批量操作**
- 批量删除视频
- 批量删除录制计划
- 批量截图

✅ **单元测试**
- 集成测试（9个测试全部通过）
- 服务层测试用例
- API路由测试

## 🚀 快速启动

### 1. 环境要求
- Node.js >= 20.11.0
- MySQL >= 5.7
- npm >= 6.14.5

### 2. 安装依赖
```bash
cd monitor/app-backend
npm install
```

### 3. 配置环境变量
创建 `.env` 文件：
```env
PORT=5002
DB_HOST=localhost
DB_PORT=3306
DB_NAME=monitor_system
DB_USER=root
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret_key
```

### 4. 启动服务
```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

### 5. 运行测试
```bash
npm test
```

## 📡 API使用示例

### 设备心跳
```bash
curl -X POST http://localhost:5002/api/cameras/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "serialNumber": "CAM001",
    "ipAddress": "192.168.1.100",
    "storageUsed": 5368709120
  }'
```

### 创建设备
```bash
curl -X POST http://localhost:5002/api/cameras \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "客厅摄像头",
    "serialNumber": "CAM001"
  }'
```

### 创建录像计划
```bash
curl -X POST http://localhost:5002/api/recording-plans \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cameraId": 1,
    "name": "工作日录制",
    "type": "scheduled",
    "schedule": "{\"mon\":[\"08:00-18:00\"],\"tue\":[\"08:00-18:00\"],\"wed\":[\"08:00-18:00\"],\"thu\":[\"08:00-18:00\"],\"fri\":[\"08:00-18:00\"]}",
    "enabled": true,
    "priority": 1
  }'
```

### 导出视频
```bash
curl -X POST http://localhost:5002/api/videos/export \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cameraId": 1,
    "startTime": "2026-04-10T00:00:00Z",
    "endTime": "2026-04-10T23:59:59Z"
  }'
```

### 获取视频列表
```bash
curl "http://localhost:5002/api/videos?cameraId=1&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 批量删除视频
```bash
curl -X POST http://localhost:5002/api/videos/bulk-delete \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "videoIds": [1, 2, 3, 4, 5]
  }'
```

### 截取视频截图
```bash
curl -X POST http://localhost:5002/api/videos/1/screenshot \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": 30
  }'
```

### 获取设备状态统计
```bash
curl http://localhost:5002/api/cameras/status/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📊 数据库表结构

### cameras (设备表)
- id, name, serialNumber, status
- ipAddress, lastHeartbeat, heartbeatInterval
- storageUsed, storageLimit, diskSpaceWarningThreshold
- recordingMode, recordingSchedule
- 其他设置字段...

### recording_plans (录像计划表)
- id, cameraId, name, type
- schedule, motionSensitivity
- enabled, priority

### alerts (告警表)
- id, cameraId, type, severity
- title, message, status
- metadata, acknowledgedAt, resolvedAt

### videos (视频表)
- id, cameraId, fileName, filePath
- fileSize, duration, startTime, endTime

## 🔧 核心服务说明

### HeartbeatService
位置: `src/services/heartbeat.js`

功能:
- 处理设备心跳上报
- 检测离线设备（90秒超时）
- 自动创建/解决离线告警
- 检查磁盘空间使用率
- 提供设备状态统计

### RecordingPlanService
位置: `src/services/recordingPlan.js`

功能:
- 管理录像计划（CRUD）
- 检查当前活动的录制计划
- 支持定时和移动侦测模式
- 批量操作支持

### VideoService
位置: `src/services/video.js`

功能:
- 视频文件管理（下载、删除）
- 视频导出（ZIP打包）
- 视频截图（FFmpeg）
- 批量操作
- 存储统计更新

## ⚙️ 系统特性

### 自动化
- ✅ 每60秒自动检查设备在线状态
- ✅ 设备离线自动创建告警
- ✅ 设备上线自动解决告警
- ✅ 磁盘空间超限自动告警
- ✅ 删除视频自动更新存储统计

### 实时性
- ✅ WebSocket推送设备状态变化
- ✅ 心跳实时更新设备状态
- ✅ 告警状态实时同步

### 可靠性
- ✅ 事务保证数据一致性
- ✅ 错误处理和日志记录
- ✅ 文件操作异常处理
- ✅ 数据库连接池管理

### 扩展性
- ✅ 模块化设计
- ✅ 服务层抽象
- ✅ RESTful API
- ✅ 支持多摄像头

## 📝 注意事项

1. **首次启动**: 系统会自动创建数据库表
2. **JWT Token**: 大部分API需要认证，请先登录获取token
3. **文件权限**: 确保应用有读写视频目录的权限
4. **磁盘空间**: 定期清理过期视频和导出文件
5. **心跳间隔**: 建议设备端每30秒发送一次心跳
6. **FFmpeg**: 已内置ffmpeg-static，无需单独安装

## 🐛 故障排查

### 数据库连接失败
检查.env配置文件中的数据库连接信息

### 测试失败
确保安装了sqlite3依赖: `npm install --save-dev sqlite3`

### 视频处理失败
检查FFmpeg是否正常工作，查看日志输出

### 端口占用
修改.env中的PORT配置或使用其他端口

## 📚 相关文档

- [实现总结](IMPLEMENTATION_SUMMARY.md) - 详细的功能说明和技术架构
- [API参考](../docs/api_reference.md) - 完整的API文档
- [系统架构](../docs/system_architecture.md) - 系统设计文档

## 🎯 下一步计划

待完成功能:
- ⏳ 前端管理界面
- ⏳ ESP32固件集成
- ⏳ IP自动适配
- ⏳ 移动端APP

---

**技术支持**: 如有问题请查看详细文档或提交Issue
