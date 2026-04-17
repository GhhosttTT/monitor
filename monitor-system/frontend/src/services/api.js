import axios from 'axios'

// 创建axios实例
const api = axios.create({
  baseURL: '/api',  // 使用相对路径,通过Vite代理到后端
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => {
    return response.data
  },
  error => {
    console.error('API请求错误:', error.message)
    if (error.response) {
      console.error('错误状态码:', error.response.status)
      console.error('错误数据:', error.response.data)
    }
    return Promise.reject(error)
  }
)

// 设备相关API
export const cameraAPI = {
  // 获取设备列表
  getList: () => api.get('/cameras'),
  
  // 获取设备状态统计
  getStatusStats: () => api.get('/cameras/status/stats'),
  
  // 注册设备
  register: (data) => api.post('/cameras/register', data),
  
  // 发送心跳（ESP32调用）
  heartbeat: (data) => api.post('/cameras/heartbeat', data),
  
  // 手动检查设备状态
  checkStatus: () => api.post('/cameras/status/check')
}

// 视频相关API
export const videoAPI = {
  // 获取视频列表
  getList: (params) => api.get('/videos', { params }),
  
  // 删除视频
  delete: (id) => api.delete(`/videos/${id}`),
  
  // 批量删除
  bulkDelete: (videoIds) => api.post('/videos/bulk-delete', { videoIds }),
  
  // 获取视频统计
  getStats: (cameraId) => api.get('/videos/stats/summary', { params: { cameraId } })
}

// 录像计划API
export const recordingPlanAPI = {
  // 获取摄像头的录制计划
  getByCamera: (cameraId) => api.get(`/recording-plans/camera/${cameraId}`),
  
  // 创建录制计划
  create: (data) => api.post('/recording-plans', data),
  
  // 更新录制计划
  update: (id, data) => api.put(`/recording-plans/${id}`, data),
  
  // 删除录制计划
  delete: (id) => api.delete(`/recording-plans/${id}`),
  
  // 启用/禁用计划
  toggle: (id, enabled) => api.patch(`/recording-plans/${id}/toggle`, { enabled })
}

export default api
