// ESP32-CAM 完整固件代码
// 支持SmartConfig配网、实时视频流和分段视频录制上传

#include <WiFi.h>
#include <esp_camera.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClient.h>

// WiFi credentials - will be configured via SmartConfig
const char* ssid = "";
const char* password = "";

// Server details - 需要替换为NAS的实际IP地址
const char* nas_ip = "NAS_IP_ADDRESS";
const int nas_port = 11111;

// 视频分段大小 (1GB = 1073741824 bytes)
const size_t SEGMENT_SIZE = 1073741824;

// Camera pins configuration for ESP32-CAM
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

WebServer server(80);
bool isRecording = false;

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();
  
  // 初始化摄像头
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
  
  // 初始化相机
  if (psramFound()) {
    config.frame_size = FRAMESIZE_UXGA;
    config.jpeg_quality = 10;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("摄像头初始化失败，错误代码: 0x%x", err);
    return;
  }

  // WiFi连接 - 使用SmartConfig配网
  WiFi.mode(WIFI_STA);
  WiFi.beginSmartConfig();

  Serial.println("等待SmartConfig配网...");
  // 等待配网完成
  while (!WiFi.smartConfigDone()) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("WiFi连接成功");
  Serial.print("IP地址: ");
  Serial.println(WiFi.localIP());

  // 启动Web服务器
  server.on("/", HTTP_GET, handleRoot);
  server.on("/stream", HTTP_GET, handleStream);
  server.on("/start_record", HTTP_GET, startRecord);
  server.on("/stop_record", HTTP_GET, stopRecord);
  server.begin();
  
  Serial.println("ESP32-CAM 固件启动完成");
}

void loop() {
  server.handleClient();
  
  // 如果正在录制，则处理录制逻辑
  if (isRecording) {
    recordAndUploadSegment();
  }
}

void handleRoot() {
  String html = "<html><head><title>ESP32-CAM 监控</title></head><body>";
  html += "<h1>ESP32-CAM 监控页面</h1>";
  html += "<p><a href='/stream'>实时监控</a></p>";
  html += "<p><a href='/start_record'>开始录制</a></p>";
  html += "<p><a href='/stop_record'>停止录制</a></p>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

void handleStream() {
  server.setContentLength(CONTENT_LENGTH_UNKNOWN);
  server.send(200, "multipart/x-mixed-replace;boundary=frame", "");
  
  while (true) {
    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("摄像头捕获失败");
      break;
    }
    
    server.sendContent("--frame\r\n");
    server.sendContent("Content-Type: image/jpeg\r\n\r\n", 36);
    server.sendContent((char *)fb->buf, fb->len);
    server.sendContent("\r\n", 2);
    
    esp_camera_fb_return(fb);
    
    if (!server.client().available()) {
      break;
    }
  }
}

void startRecord() {
  isRecording = true;
  server.send(200, "text/plain", "开始录制视频");
  Serial.println("开始录制视频");
}

void stopRecord() {
  isRecording = false;
  server.send(200, "text/plain", "停止录制视频");
  Serial.println("停止录制视频");
}

void recordAndUploadSegment() {
  static size_t segmentSize = 0;
  static unsigned long segmentStartTime = millis();
  
  // 检查是否需要开始新的分段
  if (segmentSize >= SEGMENT_SIZE || (millis() - segmentStartTime) > 3600000) { // 1小时或1GB
    segmentSize = 0;
    segmentStartTime = millis();
    Serial.println("开始新的视频分段");
  }
  
  // 获取摄像头画面
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("摄像头捕获失败");
    return;
  }
  
  // 上传到NAS
  if (uploadVideoSegment(fb)) {
    segmentSize += fb->len;
    Serial.printf("已上传数据: %d bytes, 总计: %d bytes\n", fb->len, segmentSize);
  }
  
  esp_camera_fb_return(fb);
}

bool uploadVideoSegment(camera_fb_t * fb) {
  WiFiClient client;
  if (!client.connect(nas_ip, nas_port)) {
    Serial.println("连接NAS失败");
    return false;
  }
  
  // 构造HTTP请求
  String head = "--frame\r\nContent-Type: image/jpeg\r\n\r\n";
  
  // 发送HTTP请求
  client.print("POST /api/videos/upload HTTP/1.1\r\n");
  client.print("Host: ");
  client.print(nas_ip);
  client.print(":");
  client.println(nas_port);
  client.println("Content-Type: application/octet-stream");
  client.print("Content-Length: ");
  client.println(fb->len + head.length());
  client.println("Connection: close");
  client.println();
  
  // 发送数据
  client.print(head);
  client.write(fb->buf, fb->len);
  
  // 等待响应
  unsigned long timeout = millis();
  while (!client.available() && (millis() - timeout < 5000)) {
    delay(10);
  }
  
  // 读取响应
  while (client.available()) {
    String line = client.readStringUntil('\r');
    Serial.println(line);
  }
  
  client.stop();
  return true;
}