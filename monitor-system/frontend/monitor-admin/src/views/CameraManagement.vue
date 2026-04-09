<template>
  <div class="camera-management">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>摄像头管理</span>
        </div>
      </template>
      
      <el-table :data="cameras" style="width: 100%" v-loading="loading">
        <el-table-column prop="name" label="摄像头名称" width="180" />
        <el-table-column prop="serialNumber" label="序列号" width="200" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'online' ? 'success' : 'danger'">
              {{ scope.row.status === 'online' ? '在线' : '离线' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="owner.username" label="所属用户" width="150" />
        <el-table-column prop="lastConnected" label="最后连接时间" width="200">
          <template #default="scope">
            {{ scope.row.lastConnected ? formatDate(scope.row.lastConnected) : '从未连接' }}
          </template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default="scope">
            <el-button size="small" @click="handleView(scope.row)">查看详情</el-button>
            <el-button size="small" type="danger" @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 摄像头详情对话框 -->
    <el-dialog v-model="dialogVisible" :title="`摄像头详情 - ${selectedCamera?.name}`" width="600px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="摄像头名称">{{ selectedCamera?.name }}</el-descriptions-item>
        <el-descriptions-item label="序列号">{{ selectedCamera?.serialNumber }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="selectedCamera?.status === 'online' ? 'success' : 'danger'">
            {{ selectedCamera?.status === 'online' ? '在线' : '离线' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="所属用户">{{ selectedCamera?.owner?.username }}</el-descriptions-item>
        <el-descriptions-item label="最后连接时间">
          {{ selectedCamera?.lastConnected ? formatDate(selectedCamera.lastConnected) : '从未连接' }}
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ selectedCamera ? formatDate(selectedCamera.createdAt) : '' }}</el-descriptions-item>
      </el-descriptions>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">关闭</el-button>
        </span>
      </template>
    </el-dialog>
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
  serialNumber: string
  status: string
  lastConnected?: string
  createdAt: string
  owner?: User
}

// 摄像头数据
const cameras = ref<Camera[]>([])

const loading = ref(false)
const dialogVisible = ref(false)
const selectedCamera = ref<Camera | null>(null)

// 格式化日期
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('zh-CN')
}

// 查看摄像头详情
const handleView = (camera: Camera) => {
  selectedCamera.value = camera
  dialogVisible.value = true
}

// 删除摄像头
const handleDelete = (camera: Camera) => {
  ElMessageBox.confirm(
    `确定要删除摄像头 "${camera.name}" 吗？`,
    '确认删除',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    // 调用后端API删除摄像头
    axios.delete(`/api/cameras/${camera.id}`)
      .then(() => {
        // 从本地列表中移除
        const index = cameras.value.findIndex(c => c.id === camera.id)
        if (index !== -1) {
          cameras.value.splice(index, 1)
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

// 获取摄像头列表
const fetchCameras = () => {
  loading.value = true
  axios.get('/api/cameras')
    .then(response => {
      cameras.value = response.data
      loading.value = false
    })
    .catch(() => {
      ElMessage.error('获取摄像头列表失败')
      loading.value = false
    })
}

onMounted(() => {
  fetchCameras()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.camera-management {
  padding: 20px;
}
</style>