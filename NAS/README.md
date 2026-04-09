# NAS 监控系统部署说明

## 系统架构

1. ESP32-CAM 通过 WiFi 连接到 NAS
2. NAS 提供后端服务，监听 11111 端口
3. 实时视频流通过 11111 端口提供访问
4. 历史记录以 MP4 格式存储，按年月日小时分钟命名
5. 每 1G 数据传输一次到 NAS 存储

## 部署步骤

### 1. 环境准备

1. 确保 NAS 上安装了 Node.js 和 MySQL
2. 创建 MySQL 数据库:
   ```sql
   CREATE DATABASE monitor_system;
   ```

### 2. 配置 NAS 服务

1. 修改 [.env](file:///Users/tangjinhao/Downloads/bigproject/NAS/.env) 文件中的配置参数:
   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=monitor_system
   DB_USER=your_username
   DB_PASSWORD=your_password
   PORT=11111
   VIDEO_STORAGE_PATH=./videos
   ```

2. 配置说明:
   - `DB_HOST`: MySQL数据库主机地址
   - `DB_PORT`: MySQL数据库端口
   - `DB_NAME`: 数据库名称
   - `DB_USER`: 数据库用户名
   - `DB_PASSWORD`: 数据库密码
   - `PORT`: NAS服务监听端口
   - `VIDEO_STORAGE_PATH`: 视频文件存储路径

3. 安装依赖:
   ```bash
   npm install
   ```

4. 启动服务:
   ```bash
   npm start
   ```

### 3. 配置 ESP32-CAM

1. 将 [esp32_cam_complete_firmware.cpp](file:///Users/tangjinhao/Downloads/bigproject/NAS/esp32_cam_complete_firmware.cpp) 中的代码烧录到 ESP32-CAM
2. 使用 SmartConfig 配置 WiFi 连接
3. 修改代码中的 NAS_IP_ADDRESS 为 NAS 的实际 IP 地址

### ESP32-CAM 烧录步骤

1. 准备一个 USB 转 TTL 适配器
2. 将 USB 转 TTL 适配器与 ESP32-CAM 连接：
   - USB-TTL GND -> ESP32-CAM GND
   - USB-TTL 5V -> ESP32-CAM 5V
   - USB-TTL TX -> ESP32-CAM RX
   - USB-TTL RX -> ESP32-CAM TX
   - 将 ESP32-CAM 的 GPIO0 引脚接地（烧录模式）
3. 安装 PlatformIO 开发环境
4. 修改 [esp32_cam_complete_firmware.cpp](file:///Users/tangjinhao/Downloads/bigproject/NAS/esp32_cam_complete_firmware.cpp) 中的 `NAS_IP_ADDRESS` 为您的 NAS 实际 IP 地址
5. 使用命令 `pio run --target upload` 烧录固件
6. 烧录完成后，断开 GPIO0 的接地连接
7. 重新上电 ESP32-CAM

### 4. 访问系统

1. 主界面访问: `http://NAS_IP:11111`
2. 实时视频流访问: `http://NAS_IP:11111/api/stream`
3. API 接口文档: `http://NAS_IP:11111/api/videos`

## 操作指南

### 1. ESP32-CAM 配网

1. 下载并安装 Espressif 的 SmartConfig 配网 APP（如 ESP Touch）
2. 确保手机连接到目标 WiFi 网络
3. 启动 ESP32-CAM 设备
4. 在配网 APP 中输入 WiFi 密码并开始配网
5. 等待配网完成，设备会显示连接成功的 IP 地址

### 2. 开始/停止录制视频

1. 打开浏览器访问 ESP32-CAM 的 IP 地址
2. 点击"开始录制"按钮开始录制视频
3. 点击"停止录制"按钮停止录制视频
4. 录制的视频会自动上传到 NAS

### 3. 查看实时画面

1. 打开浏览器访问 NAS 的 11111 端口
2. 在主界面点击"实时监控"区域
3. 可以看到来自 ESP32-CAM 的实时画面

### 4. 查看历史视频

1. 打开浏览器访问 NAS 的 11111 端口
2. 在主界面的"历史记录"区域可以看到已上传的视频文件列表
3. 点击任意视频文件即可播放

### 5. 管理视频文件

1. 可以通过 NAS 的文件系统直接访问视频存储目录
2. 视频文件按时间命名，便于查找和管理
3. 可以手动删除不需要的视频文件以释放存储空间
4. 可以通过 API 接口 `/api/videos/storage-path` 获取当前配置的存储路径

## 文件存储说明

视频文件将按照以下格式存储:
```
/videos/
  ├── 202311191430.mp4  (2023年11月19日14点30分)
  ├── 202311191530.mp4  (2023年11月19日15点30分)
  └── ...
```

### 存储路径配置

视频文件的存储路径可以通过修改 [.env](file:///Users/tangjinhao/Downloads/bigproject/NAS/.env) 文件中的 `VIDEO_STORAGE_PATH` 参数进行配置。默认存储路径为 `./videos`，即 NAS 项目目录下的 videos 文件夹。

例如，要将视频存储在 NAS 的 `/home/nas/videos` 目录下，可以修改 [.env](file:///Users/tangjinhao/Downloads/bigproject/NAS/.env) 文件：
```
VIDEO_STORAGE_PATH=/home/nas/videos
```

修改配置后需要重启 NAS 服务以使配置生效。

## API 接口

### 获取视频列表
```
GET /api/videos
```

### 获取特定视频
```
GET /api/videos/:id
```

### 获取视频文件
```
GET /api/videos/file/:filename
```

### 获取视频流
```
GET /api/videos/stream/:filename
```

### 上传视频
```
POST /api/videos/upload
```

### 获取存储路径
```
GET /api/videos/storage-path
```