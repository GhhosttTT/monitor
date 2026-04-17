<template>
  <div class="user-management">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>App用户管理</span>
          <el-button type="primary" @click="handleAddUser">添加用户</el-button>
        </div>
      </template>
      
      <el-table :data="users" border style="width: 100%" v-loading="loading">
        <el-table-column prop="username" label="用户名" :min-width="150" />
        <el-table-column prop="email" label="邮箱" :min-width="200" />
        <el-table-column prop="role" label="角色" :min-width="100" />
        <el-table-column prop="cameras" label="绑定设备数" :min-width="120">
          <template #default="scope">
            <el-link type="primary" @click="showUserDetail(scope.row)">
              {{ scope.row.cameras ? scope.row.cameras.length : 0 }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="注册时间" :min-width="150">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column fixed="right" label="操作" width="150">
          <template #default="scope">
            <el-button @click="showUserDetail(scope.row)" type="link" size="small">查看</el-button>
            <el-button @click="handleDelete(scope.row)" type="link" size="small">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 用户详情对话框 -->
    <el-dialog v-model="detailDialogVisible" :title="`用户详情 - ${selectedUser?.username}`" width="800px">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="基本信息" name="basic">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="用户名">{{ selectedUser?.username }}</el-descriptions-item>
            <el-descriptions-item label="邮箱">{{ selectedUser?.email }}</el-descriptions-item>
            <el-descriptions-item label="角色">
              <el-tag :type="selectedUser?.role === 'admin' ? 'danger' : 'success'">
                {{ selectedUser?.role === 'admin' ? '管理员' : '用户' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="注册时间">{{ selectedUser ? formatDate(selectedUser.createdAt) : '' }}</el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
        
        <el-tab-pane label="绑定的摄像头" name="cameras">
          <el-table :data="selectedUser?.cameras || []" style="width: 100%">
            <el-table-column prop="name" label="摄像头名称" width="180">
              <template #default="scope">
                <router-link :to="`/cameras?cameraId=${scope.row.id}`" class="camera-link">
                  {{ scope.row.name }}
                </router-link>
              </template>
            </el-table-column>
            <el-table-column prop="serialNumber" label="序列号" width="180" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="scope">
                <el-tag :type="scope.row.status === 'online' ? 'success' : 'danger'">
                  {{ scope.row.status === 'online' ? '在线' : '离线' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="lastConnected" label="最后连接时间" width="200">
              <template #default="scope">
                {{ scope.row.lastConnected ? formatDate(scope.row.lastConnected) : '从未连接' }}
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        
        <el-tab-pane label="视频管理" name="videos">
          <div v-if="selectedUser && selectedUser.cameras && selectedUser.cameras.length > 0">
            <el-table :data="videos" style="width: 100%">
              <el-table-column prop="name" label="视频名称" width="200" />
              <el-table-column prop="cameraName" label="所属摄像头" width="180" />
              <el-table-column prop="duration" label="时长" width="100">
                <template #default="scope">
                  {{ formatDuration(scope.row.duration) }}
                </template>
              </el-table-column>
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
                  <router-link :to="`/videos?videoId=${scope.row.id}`">
                    <el-button size="small">查看</el-button>
                  </router-link>
                  <el-button size="small" type="danger" @click="deleteVideo(scope.row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <div v-else>
            <el-empty description="该用户尚未绑定任何摄像头" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <!-- 添加/编辑用户对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingUser ? '编辑用户' : '添加用户'" width="500px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" type="email" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="用户" value="user" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!editingUser" label="密码" prop="password">
          <el-input v-model="form.password" type="password" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitForm">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from '../axios-config'

// 定义摄像头类型
interface Camera {
  id: number
  name: string
  serialNumber: string
  status: string
  lastConnected?: string
}

// 定义视频类型
interface Video {
  id: number
  name: string
  cameraName: string
  duration: number  // 时长为秒数（数字）
  size: number
  createdAt: string
}

// 定义用户类型
interface User {
  id: number
  username: string
  email: string
  role: string
  createdAt: string
  cameras?: Camera[]
}

// 用户数据
const users = ref<User[]>([])

const loading = ref(false)
const dialogVisible = ref(false)
const detailDialogVisible = ref(false)
const activeTab = ref('basic')
const selectedUser = ref<User | null>(null)
const videos = ref<Video[]>([])
const editingUser = ref<User | null>(null)
const formRef = ref()

// 表单数据
const form = reactive({
  username: '',
  email: '',
  role: 'user',
  password: ''
})

// 表单验证规则
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱地址', trigger: ['blur', 'change'] }
  ],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

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

// 格式化时长（秒 -> HH:MM:SS）
const formatDuration = (seconds: number) => {
  if (!seconds || seconds <= 0) return '00:00:00'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  // 如果小于1小时，只显示 MM:SS
  if (hours === 0) {
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  
  // 否则显示 HH:MM:SS
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// 添加用户
const handleAddUser = () => {
  editingUser.value = null
  Object.assign(form, {
    username: '',
    email: '',
    role: 'user',
    password: ''
  })
  dialogVisible.value = true
}

// 编辑用户
const handleEdit = (user: User) => {
  editingUser.value = user
  Object.assign(form, {
    username: user.username,
    email: user.email,
    role: user.role,
    password: ''
  })
  dialogVisible.value = true
}

// 删除用户
const handleDelete = (user: User) => {
  ElMessageBox.confirm(
    `确定要删除用户 "${user.username}" 吗？`,
    '确认删除',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    // 调用后端API删除用户
    axios.delete(`/api/users/${user.id}`)
      .then(() => {
        // 从本地列表中移除
        const index = users.value.findIndex(u => u.id === user.id)
        if (index !== -1) {
          users.value.splice(index, 1)
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

// 显示用户详情
const showUserDetail = (user: User) => {
  selectedUser.value = user
  // 获取用户视频数据
  fetchUserVideos(user.id)
  detailDialogVisible.value = true
}

// 获取用户视频
const fetchUserVideos = (userId: number) => {
  // 这里应该调用后端API获取指定用户的视频数据
  // 暂时使用模拟数据
  videos.value = [
    {
      id: 1,
      name: '2023-04-15_10-30-00.mp4',
      cameraName: '前门摄像头',
      duration: '00:05:23',
      size: 102400000,
      createdAt: '2023-04-15T10:35:00Z'
    },
    {
      id: 2,
      name: '2023-04-15_14-22-15.mp4',
      cameraName: '后院摄像头',
      duration: '00:03:45',
      size: 76800000,
      createdAt: '2023-04-15T14:26:00Z'
    }
  ]
}

// 删除视频
const deleteVideo = (video: Video) => {
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

// 提交表单
const submitForm = () => {
  formRef.value.validate((valid: boolean) => {
    if (valid) {
      if (editingUser.value) {
        // 编辑用户
        axios.put(`/api/users/${editingUser.value.id}`, {
          username: form.username,
          email: form.email,
          role: form.role
        })
          .then(response => {
            // 更新本地列表
            const index = users.value.findIndex(u => u.id === editingUser.value!.id)
            if (index !== -1) {
              users.value[index] = response.data
            }
            ElMessage.success('用户更新成功')
            dialogVisible.value = false
          })
          .catch(() => {
            ElMessage.error('用户更新失败')
          })
      } else {
        // 添加用户
        axios.post('/api/users', {
          username: form.username,
          email: form.email,
          role: form.role,
          password: form.password
        })
          .then(response => {
            users.value.push(response.data)
            ElMessage.success('用户添加成功')
            dialogVisible.value = false
          })
          .catch(() => {
            ElMessage.error('用户添加失败')
          })
      }
    }
  })
}

// 获取用户列表
const fetchUsers = () => {
  loading.value = true
  axios.get('/api/users')
    .then(response => {
      users.value = response.data
      loading.value = false
    })
    .catch(error => {
      console.error('获取用户列表失败:', error)
      ElMessage.error('获取用户列表失败')
      loading.value = false
    })
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-management {
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
}

.user-management .el-table {
  width: 100%;
}

.user-management .el-card {
  width: 100%;
  box-sizing: border-box;
}

.camera-link {
  color: #409eff;
  text-decoration: none;
}

.camera-link:hover {
  text-decoration: underline;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .user-management {
    padding: 10px;
  }
  
  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .card-header .el-button {
    margin-top: 10px;
  }
}

/* 确保表格容器支持水平滚动 */
:deep(.el-table__body-wrapper) {
  overflow-x: auto;
}

:deep(.el-table__fixed-right) {
  background-color: var(--el-bg-color);
  right: 0;
}

:deep(.el-table__fixed-right-patch) {
  background-color: var(--el-bg-color);
}
</style>