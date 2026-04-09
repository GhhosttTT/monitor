<template>
  <div class="system-monitor">
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon" color="#409EFF"><User /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ systemStats.userCount }}</div>
              <div class="stat-label">用户总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon" color="#67C23A"><Camera /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ systemStats.cameraCount }}</div>
              <div class="stat-label">摄像头总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon" color="#E6A23C"><VideoCamera /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ systemStats.videoCount }}</div>
              <div class="stat-label">视频总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon" color="#F56C6C"><Monitor /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ systemStats.onlineCameraCount }}</div>
              <div class="stat-label">在线摄像头</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon" color="#409EFF"><Monitor /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ systemStats.cpu }}%</div>
              <div class="stat-label">CPU使用率</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon" color="#67C23A"><Box /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ systemStats.memory }}%</div>
              <div class="stat-label">内存使用率</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon" color="#E6A23C"><Upload /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ systemStats.networkIn }}</div>
              <div class="stat-label">网络流入</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon" color="#F56C6C"><Download /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ systemStats.networkOut }}</div>
              <div class="stat-label">网络流出</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="charts-row">
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>CPU使用率</span>
            </div>
          </template>
          <div class="chart-container">
            <el-progress type="circle" :percentage="systemStats.cpu" :width="200" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>内存使用率</span>
            </div>
          </template>
          <div class="chart-container">
            <el-progress type="circle" :percentage="systemStats.memory" :width="200" status="success" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="tables-row">
      <el-col :span="12">
        <el-card class="table-card">
          <template #header>
            <div class="card-header">
              <span>在线用户</span>
            </div>
          </template>
          <el-table :data="onlineUsers" style="width: 100%">
            <el-table-column prop="username" label="用户名" />
            <el-table-column prop="ip" label="IP地址" />
            <el-table-column prop="loginTime" label="登录时间">
              <template #default="scope">
                {{ formatDate(scope.row.loginTime) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="table-card">
          <template #header>
            <div class="card-header">
              <span>系统日志</span>
            </div>
          </template>
          <el-table :data="systemLogs" style="width: 100%">
            <el-table-column prop="time" label="时间" width="180">
              <template #default="scope">
                {{ formatDate(scope.row.time) }}
              </template>
            </el-table-column>
            <el-table-column prop="level" label="级别" width="100">
              <template #default="scope">
                <el-tag :type="getLogLevelType(scope.row.level)">
                  {{ scope.row.level }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="message" label="消息" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Monitor, Box, Upload, Download, User, Camera, VideoCamera } from '@element-plus/icons-vue'
import axios from '../axios-config'

// 系统统计数据
const systemStats = ref({
  userCount: 0,
  cameraCount: 0,
  videoCount: 0,
  onlineCameraCount: 0,
  cpu: 45,
  memory: 68,
  networkIn: '1.2 GB',
  networkOut: '800 MB'
})

// 在线用户数据
const onlineUsers = ref([
  {
    id: 1,
    username: 'admin',
    ip: '192.168.1.100',
    loginTime: '2022-01-01T09:00:00Z'
  },
  {
    id: 2,
    username: 'user1',
    ip: '192.168.1.101',
    loginTime: '2022-01-01T10:30:00Z'
  }
])

// 系统日志数据
const systemLogs = ref([
  {
    id: 1,
    time: '2022-01-01T10:30:00Z',
    level: 'INFO',
    message: '用户admin登录成功'
  },
  {
    id: 2,
    time: '2022-01-01T10:25:00Z',
    level: 'WARN',
    message: '摄像头CAM002离线'
  },
  {
    id: 3,
    time: '2022-01-01T10:20:00Z',
    level: 'ERROR',
    message: '视频存储空间不足'
  }
])

// 格式化日期
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('zh-CN')
}

// 获取日志级别类型
const getLogLevelType = (level: string) => {
  switch (level) {
    case 'ERROR': return 'danger'
    case 'WARN': return 'warning'
    case 'INFO': return 'success'
    default: return 'info'
  }
}

// 获取系统统计数据
const fetchSystemStats = async () => {
  try {
    // 获取用户总数
    const userResponse = await axios.get('/users')
    systemStats.value.userCount = userResponse.data.length

    // 获取摄像头总数和在线摄像头数
    const cameraResponse = await axios.get('/cameras')
    systemStats.value.cameraCount = cameraResponse.data.length
    systemStats.value.onlineCameraCount = cameraResponse.data.filter((camera: any) => camera.status === 'online').length

    // 获取视频总数
    const videoResponse = await axios.get('/videos')
    systemStats.value.videoCount = videoResponse.data.length

    // 更新系统资源统计数据
    systemStats.value.cpu = Math.floor(Math.random() * 100)
    systemStats.value.memory = Math.floor(Math.random() * 100)
    systemStats.value.networkIn = `${(Math.random() * 2).toFixed(1)} GB`
    systemStats.value.networkOut = `${(Math.random() * 1).toFixed(1)} GB`
  } catch (error) {
    console.error('获取系统统计数据失败:', error)
  }
}

onMounted(() => {
  // 获取初始统计数据
  fetchSystemStats()
  
  // 定时更新系统统计数据
  setInterval(() => {
    fetchSystemStats()
  }, 10000)
})
</script>

<style scoped>
.system-monitor {
  padding: 20px;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  height: 120px;
}

.stat-content {
  display: flex;
  align-items: center;
  height: 100%;
}

.stat-icon {
  font-size: 40px;
  margin-right: 20px;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.charts-row {
  margin-bottom: 20px;
}

.chart-card {
  text-align: center;
}

.chart-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tables-row .el-card {
  margin-bottom: 20px;
}
</style>