<template>
  <div class="video-management">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>视频管理</span>
        </div>
      </template>
      
      <el-table :data="videos" style="width: 100%" v-loading="loading">
        <el-table-column prop="name" label="视频名称" width="200" />
        <el-table-column prop="camera.name" label="所属摄像头" width="180" />
        <el-table-column prop="camera.owner.username" label="所属用户" width="150" />
        <el-table-column prop="duration" label="时长" width="100" />
        <el-table-column prop="size" label="大小" width="100">
          <template #default="scope">
            {{ formatFileSize(scope.row.size) }}
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="录制时间" width="200">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default="scope">
            <el-button size="small" @click="playVideo(scope.row)">播放</el-button>
            <el-button size="small" @click="downloadVideo(scope.row)">下载</el-button>
            <el-button size="small" type="danger" @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from '../axios-config'

// 定义用户类型
interface User {
  id: number
  username: string
}

// 定义摄像头类型
interface Camera {
  id: number
  name: string
  owner: User
}

// 定义视频类型
interface Video {
  id: number
  name: string
  camera: Camera
  duration: string
  size: number
  createdAt: string
}

// 视频数据
const videos = ref<Video[]>([])

const loading = ref(false)

// 格式化日期
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('zh-CN')
}

// 格式化文件大小
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB'
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB'
  return (bytes / 1073741824).toFixed(2) + ' GB'
}

// 播放视频
const playVideo = (video: Video) => {
  ElMessage.info(`播放视频: ${video.name}`)
  // 实际应用中，这里会打开视频播放器或跳转到播放页面
}

// 下载视频
const downloadVideo = (video: Video) => {
  ElMessage.info(`下载视频: ${video.name}`)
  // 实际应用中，这里会触发视频下载
}

// 删除视频
const handleDelete = (video: Video) => {
  ElMessageBox.confirm(
    `确定要删除视频 "${video.name}" 吗？`,
    '确认删除',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    // 调用后端API删除视频
    axios.delete(`/api/videos/${video.id}`)
      .then(() => {
        // 从本地列表中移除
        const index = videos.value.findIndex(v => v.id === video.id)
        if (index !== -1) {
          videos.value.splice(index, 1)
        }
        ElMessage.success('删除成功')
      })
      .catch(() => {
        ElMessage.error('删除失败')
      })
  }).catch(() => {
    ElMessage.info('已取消删除')
  })
}

// 获取视频列表
const fetchVideos = () => {
  loading.value = true
  axios.get('/api/videos')
    .then(response => {
      videos.value = response.data
      loading.value = false
    })
    .catch(() => {
      ElMessage.error('获取视频列表失败')
      loading.value = false
    })
}

onMounted(() => {
  fetchVideos()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.video-management {
  padding: 20px;
}
</style>