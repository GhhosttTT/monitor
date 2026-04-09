// 如果找不到 Arduino.h，则使用下面的模拟头文件
#ifndef ARDUINO
// 模拟 Arduino.h 的核心宏与类型，仅保证编译通过
#define ARDUINO 100
#define PI 3.1415926535897932384626433832795
#define HALF_PI 1.5707963267948966
#define TWO_PI 6.283185307179586
#define DEG_TO_RAD 0.017453292519943295
#define RAD_TO_DEG 57.29577951308232
#define SERIAL  0x0
#define DISPLAY 0x1

extern "C" {
   typedef unsigned char uint8_t;
   typedef unsigned short uint16_t;
   typedef unsigned long uint32_t;
   typedef unsigned long long uint64_t;
   typedef signed char int8_t;
   typedef signed short int16_t;
   typedef signed long int32_t;
   typedef signed long long int64_t;
}

#define F(str) (str)
#define PROGMEM
#define pgm_read_byte(addr) (*(const unsigned char *)(addr))
#define pgm_read_word(addr) (*(const unsigned short *)(addr))
#define pgm_read_dword(addr) (*(const unsigned long *)(addr))
#define pgm_read_float(addr) (*(const float *)(addr))
#define pgm_read_ptr(addr) (*(const void **)(addr))
#define lowByte(w) ((uint8_t) ((w) & 0xff))
#define highByte(w) ((uint8_t) ((w) >> 8))
#define bitRead(value, bit) (((value) >> (bit)) & 0x01)
#define bitSet(value, bit) ((value) |= (1UL << (bit)))
#define bitClear(value, bit) ((value) &= ~(1UL << (bit)))
#define bitWrite(value, bit, bitvalue) (bitvalue ? bitSet(value, bit) : bitClear(value, bit))
#define bit(b) (1UL << (b))
#define _BV(bit) (1 << (bit))
#endif
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <esp_camera.h>
#include <SD.h>
#include <FS.h>
#include <SPIFFS.h>
#include <time.h>
#include <stdint.h>
#include <string>
#include <vector>
#include <functional>
#include <iostream>

// 如果编译器找不到Serial，添加这个模拟实现
#ifndef ARDUINO
class SerialClass {
public:
    void begin(unsigned long baud) { std::cout << "Serial initialized at " << baud << " baud\n"; }
    void print(const char* str) { std::cout << str; }
    void print(int val) { std::cout << val; }
    void print(unsigned int val) { std::cout << val; }
    void print(long val) { std::cout << val; }
    void print(unsigned long val) { std::cout << val; }
    void print(float val) { std::cout << val; }
    void print(double val) { std::cout << val; }
    void println(const char* str) { std::cout << str << std::endl; }
    void println(int val) { std::cout << val << std::endl; }
    void println(unsigned int val) { std::cout << val << std::endl; }
    void println(long val) { std::cout << val << std::endl; }
    void println(unsigned long val) { std::cout << val << std::endl; }
    void println(float val) { std::cout << val << std::endl; }
    void println(double val) { std::cout << val << std::endl; }
    void println() { std::cout << std::endl; }
    int printf(const char* format, ...) {
        va_list args;
        va_start(args, format);
        int ret = vprintf(format, args);
        va_end(args);
        return ret;
    }
};

SerialClass Serial;
#endif

// 摄像头型号配置
#define CAMERA_MODEL_AI_THINKER
#include "camera_pins.h"

// 使用Arduino String，不需要替代
// 如果编译器不支持Arduino String，可以取消下面的注释
// using String = std::string;

// ESP32摄像头特定的类型已在esp_camera.h中定义
// 如果编译器找不到，可以取消下面的注释
/*
typedef enum {
    FRAMESIZE_QXGA = 9,     // 2048x1536
    // 其他分辨率...
} framesize_t;
*/

// WebSocket类型已在WebSocketsClient.h中定义
// 如果编译器找不到，可以取消下面的注释
/*
typedef enum {
    WStype_DISCONNECTED,
    WStype_CONNECTED,
    WStype_TEXT,
    WStype_BIN,
    WStype_ERROR,
    WStype_FRAGMENT_TEXT_START,
    WStype_FRAGMENT_BIN_START,
    WStype_FRAGMENT,
    WStype_FRAGMENT_FIN,
} WStype_t;
*/

// File类型已在SD.h中定义
// 如果编译器找不到，可以取消下面的注释
/*
class File {
public:
    File() {}
    bool isDirectory() const { return false; }
    const char* name() const { return ""; }
    File openNextFile() { return File(); }
    void close() {}
    size_t write(const uint8_t* buf, size_t size) { return 0; }
    size_t write(uint8_t b) { return 0; }
    operator bool() const { return false; }
};
*/

// 网络配置 - 修改为NAS的地址
const char* ssid = "YOUR_WIFI_SSID"; // 请修改为你的WiFi名称
const char* password = "YOUR_WIFI_PASSWORD"; // 请修改为你的WiFi密码
const char* serverUrl = "192.168.1.108"; // 改为你的电脑IP地址
const int serverPort = 11111; // NAS服务端口
const char* serverPath = "/ws/stream"; // WebSocket路径

// 配网状态
bool smartConfigDone = false;
bool apMode = false;

// 摄像头配置
const int cameraFrameRate = 20; // FPS
const int cameraQuality = 10;   // 10-63，数字越小质量越高
const framesize_t cameraResolution = FRAMESIZE_QXGA; // 2048x1536 (2K)

// SD卡配置
const int sdCardPinCS = 13;
const char* videoPath = "/videos";
const int videoSegmentDuration = 60; // 每个视频片段的时长（秒）
const int videoRetentionDays = 30;   // 视频保留天数

// 全局变量
WebSocketsClient webSocket;
String cameraId = "CAM_001";
String serialNumber = "SN12345678";
bool isConnected = false;
bool isRecording = false;
unsigned long lastFrameTime = 0;
unsigned long recordingStartTime = 0;
File videoFile;
String currentVideoFilename;

// 函数声明
bool initCamera();
bool initSDCard();
bool initWiFi();
bool initWebSocket();
void captureFrame();
void startRecording();
void stopRecording();
void saveFrameToSD(uint8_t* buf, size_t len);
void cleanupOldVideos();
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length);

// 前置声明：startSmartConfig 和 saveWiFiConfig 在文件下面定义，但在 setup() 中被调用，需要先声明
void startSmartConfig();
void saveWiFiConfig();

void setup() {
  // 初始化串口，波特率 115200
  Serial.begin(115200);
  Serial.println("启动智能监控摄像头...");
  
  // 初始化摄像头
  if (!initCamera()) {
    Serial.println("摄像头初始化失败");
    return;
  }
  
  // 初始化SD卡
  if (!initSDCard()) {
    Serial.println("SD卡初始化失败");
    return;
  }
  
  // 创建视频目录
  if (!SD.exists(videoPath)) {
    SD.mkdir(videoPath);
  }
  
  // 尝试连接已保存的WiFi
  if (!initWiFi()) {
    Serial.println("WiFi连接失败，进入配网模式");
    // 进入SmartConfig配网模式
    startSmartConfig();
  }
  
  // 初始化WebSocket
  if (!initWebSocket()) {
    Serial.println("WebSocket初始化失败");
    return;
  }
  
  // 清理过期视频
  cleanupOldVideos();
  
  // 开始录制
  startRecording();
  
  Serial.println("摄像头初始化完成，开始工作");
}

void loop() {
  // 处理WebSocket事件
  webSocket.loop();
  
  // 如果连接断开，尝试重新连接
  if (!isConnected) {
    static unsigned long lastReconnectAttempt = 0;
    unsigned long now = millis();
    if (now - lastReconnectAttempt > 5000) {
      lastReconnectAttempt = now;
      Serial.println("尝试重新连接...");
      initWebSocket();
    }
  }
  
  // 捕获并处理视频帧
  unsigned long currentTime = millis();
  if (currentTime - lastFrameTime > (1000 / cameraFrameRate)) {
    lastFrameTime = currentTime;
    captureFrame();
  }
  
  // 检查是否需要创建新的视频片段
  if (isRecording && (currentTime - recordingStartTime > videoSegmentDuration * 1000)) {
    stopRecording();
    startRecording();
  }
}

bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  
  // 初始化高分辨率
  config.frame_size = cameraResolution;
  config.jpeg_quality = cameraQuality;
  config.fb_count = 2;
  
  // 初始化摄像头
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("摄像头初始化失败，错误: 0x%x", err);
    return false;
  }
  
  return true;
}

bool initSDCard() {
  if (!SD.begin(sdCardPinCS)) {
    Serial.println("SD卡挂载失败");
    return false;
  }
  
  uint8_t cardType = SD.cardType();
  if (cardType == CARD_NONE) {
    Serial.println("未检测到SD卡");
    return false;
  }
  
  uint64_t cardSize = SD.cardSize() / (1024 * 1024);
  Serial.printf("SD卡类型: %d\n", cardType);
  Serial.printf("SD卡大小: %lluMB\n", cardSize);
  
  return true;
}

bool initWiFi() {
  // 如果没有配置WiFi信息，直接返回false
  if (strlen(ssid) == 0 || strlen(password) == 0) {
    return false;
  }
  
  WiFi.begin(ssid, password);
  Serial.print("连接到WiFi");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi连接失败");
    return false;
  }
  
  Serial.println("");
  Serial.println("WiFi已连接");
  Serial.print("IP地址: ");
  Serial.println(WiFi.localIP());
  
  return true;
}

void startSmartConfig() {
  Serial.println("进入SmartConfig配网模式");
  WiFi.mode(WIFI_AP_STA);
  WiFi.beginSmartConfig();
  
  // 等待配网完成
  while (!WiFi.smartConfigDone()) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("SmartConfig完成");
  
  // 获取配网信息
  ssid = WiFi.SSID().c_str();
  password = WiFi.psk().c_str();
  
  Serial.printf("SSID: %s\n", ssid);
  Serial.printf("密码: %s\n", password);
  
  // 保存WiFi配置到Flash
  saveWiFiConfig();
  
  // 停止SmartConfig
  WiFi.stopSmartConfig();
  
  // 连接WiFi
  initWiFi();
}

void saveWiFiConfig() {
  // 在实际实现中，应该将WiFi配置保存到Flash中
  // 这里简化处理，仅打印信息
  Serial.println("WiFi配置已保存");
}

bool initWebSocket() {
  webSocket.begin(serverUrl, serverPort, serverPath);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
  
  return true;
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED: {
      isConnected = false;
      Serial.println("WebSocket断开连接");
      break;
    }
    case WStype_CONNECTED: {
      isConnected = true;
      Serial.println("WebSocket已连接到NAS");

      // 发送摄像头注册信息
      {
        DynamicJsonDocument doc(1024);
        doc["event"] = "camera-register";
        doc["cameraId"] = cameraId;
        doc["serialNumber"] = serialNumber;
        doc["resolution"] = "2048x1536";
        doc["fps"] = cameraFrameRate;

        char message[256];
        serializeJson(doc, message);
        webSocket.sendTXT(message);
        Serial.println("已发送摄像头注册信息");
      }
      break;
    }
    case WStype_TEXT: {
      Serial.printf("收到NAS消息: %s\n", payload);

      // 处理NAS返回的命令
      {
        DynamicJsonDocument doc(1024);
        deserializeJson(doc, payload);

        if (doc.containsKey("command")) {
          const char* command = doc["command"];

          if (strcmp(command, "start_stream") == 0) {
            Serial.println("NAS请求开始推流");
            isRecording = true;
          } else if (strcmp(command, "stop_stream") == 0) {
            Serial.println("NAS请求停止推流");
            isRecording = false;
          } else if (strcmp(command, "change_quality") == 0) {
            int quality = doc["quality"];
            Serial.printf("NAS请求更改质量: %d\n", quality);
            // 可以在这里动态调整摄像头质量
          }
        }
      }
      break;
    }
    case WStype_BIN: {
      Serial.printf("收到二进制数据: %u字节\n", length);
      break;
    }
  }
}

void captureFrame() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("捕获帧失败");
    return;
  }
  
  // 保存帧到SD卡（本地备份）
  if (isRecording) {
    saveFrameToSD(fb->buf, fb->len);
  }
  
  // 如果连接到NAS，实时推送帧
  if (isConnected && fb->buf && fb->len > 0) {
    // 通过WebSocket发送JPEG帧到NAS
    bool success = webSocket.sendBIN(fb->buf, fb->len);
    if (!success) {
      Serial.println("发送帧到NAS失败");
    }
  }
  
  esp_camera_fb_return(fb);
}

void startRecording() {
  recordingStartTime = millis();
  
  // 创建新的视频文件
  time_t now;
  time(&now);
  char timestamp[20];
  strftime(timestamp, sizeof(timestamp), "%Y%m%d_%H%M%S", localtime(&now));
  
  char filePath[100];
  sprintf(filePath, "%s/%s.mjpeg", videoPath, timestamp);
  currentVideoFilename = String(filePath);
  videoFile = SD.open(filePath, FILE_WRITE);
  
  if (!videoFile) {
    Serial.println("无法创建视频文件");
    return;
  }
  
  isRecording = true;
  Serial.printf("开始录制: %s\n", filePath);
}

void stopRecording() {
  if (isRecording) {
    videoFile.close();
    isRecording = false;
    Serial.printf("停止录制: %s\n", currentVideoFilename.c_str());
  }
}

void saveFrameToSD(uint8_t* buf, size_t len) {
  if (videoFile) {
    // 写入帧大小
    videoFile.write((uint8_t*)&len, 4);
    // 写入帧数据
    videoFile.write(buf, len);
  }
}

void cleanupOldVideos() {
  // 获取当前时间
  time_t now;
  time(&now);
  time_t cutoffTime = now - (videoRetentionDays * 24 * 60 * 60);
  
  // 打开视频目录
  File root = SD.open(videoPath);
  if (!root || !root.isDirectory()) {
    Serial.println("无法打开视频目录");
    return;
  }
  
  // 遍历所有文件
  File file = root.openNextFile();
  while (file) {
    if (!file.isDirectory()) {
      // 解析文件名中的时间戳
      const char* filename = file.name();
      int filenameLen = strlen(filename);
      
      // 检查文件扩展名
      if (filenameLen > 7 && strcmp(filename + filenameLen - 6, ".mjpeg") == 0) {
        // 从文件名中提取时间戳
        int year, month, day, hour, minute, second;
        sscanf(filename, "%4d%2d%2d_%2d%2d%2d", &year, &month, &day, &hour, &minute, &second);
        
        // 创建时间结构
        struct tm fileTime;
        fileTime.tm_year = year - 1900;
        fileTime.tm_mon = month - 1;
        fileTime.tm_mday = day;
        fileTime.tm_hour = hour;
        fileTime.tm_min = minute;
        fileTime.tm_sec = second;
        
        // 转换为时间戳
        time_t fileTimestamp = mktime(&fileTime);
        
        // 如果文件超过保留期限，删除它
        if (fileTimestamp < cutoffTime) {
          char fullPath[100];
          sprintf(fullPath, "%s/%s", videoPath, filename);
          SD.remove(fullPath);
          Serial.printf("删除过期视频: %s\n", fullPath);
        }
      }
    }
    file = root.openNextFile();
  }
  
  root.close();
}