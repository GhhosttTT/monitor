import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Divider, Spin, Alert } from 'antd'
import { 
  UserOutlined, 
  VideoCameraOutlined, 
  PlaySquareOutlined,
  HddOutlined
} from '@ant-design/icons'
import { cameraAPI, videoAPI } from '../services/api'
import axios from 'axios'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#52c41a', '#ff4d4f', '#faad14']

const Dashboard = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({
    total: 0,
    online: 0,
    offline: 0,
    error: 0
  })
  const [videoStats, setVideoStats] = useState({
    totalVideos: 0,
    totalSize: 0,
    totalDuration: 0
  })
  const [diskInfo, setDiskInfo] = useState({
    total: 0,
    used: 0,
    free: 0,
    usagePercent: 0
  })

  // 获取设备状态统计
  const fetchDeviceStats = async () => {
    try {
      console.log('正在获取设备统计...')
      const data = await cameraAPI.getStatusStats()
      console.log('设备统计:', data)
      setStats(data)
    } catch (err) {
      console.error('获取设备统计失败:', err)
      setError(`无法连接到后端服务器: ${err.message}`)
    }
  }

  // 获取视频统计
  const fetchVideoStats = async () => {
    try {
      console.log('正在获取视频统计...')
      const data = await videoAPI.getStats()
      console.log('视频统计:', data)
      setVideoStats(data)
    } catch (err) {
      console.error('获取视频统计失败:', err)
      // 视频统计失败不影响显示
    }
  }

  // 获取磁盘信息
  const fetchDiskInfo = async () => {
    try {
      console.log('正在获取磁盘信息...')
      const response = await axios.get('/api/system/disk-usage')
      if (response.success) {
        setDiskInfo(response.data)
        console.log('磁盘信息:', response.data)
      }
    } catch (err) {
      console.error('获取磁盘信息失败:', err)
    }
  }

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        await Promise.all([fetchDeviceStats(), fetchVideoStats(), fetchDiskInfo()])
      } catch (err) {
        console.error('加载数据异常:', err)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
    
    // 每30秒刷新一次
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  // 计算存储使用率（使用真实磁盘信息）
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const storageUsedGB = formatBytes(diskInfo.used || videoStats.totalSize)
  const storageTotalGB = formatBytes(diskInfo.total || 100 * 1024 * 1024 * 1024)
  const storagePercent = diskInfo.usagePercent || ((videoStats.totalSize / (100 * 1024 * 1024 * 1024)) * 100).toFixed(1)

  // 摄像头状态数据
  const cameraStatusData = [
    { name: '在线', value: stats.online },
    { name: '离线', value: stats.offline },
    { name: '错误', value: stats.error },
  ].filter(item => item.value > 0)

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  return (
    <div>
      <h1>仪表板</h1>
      <Divider />
      
      {error && (
        <Alert
          message="连接错误"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总设备数"
              value={stats.total}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="在线设备"
              value={stats.online}
              suffix={`/ ${stats.total}`}
              prefix={<VideoCameraOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总视频数"
              value={videoStats.totalVideos}
              prefix={<PlaySquareOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="存储使用"
              value={storageUsedGB}
              suffix={`/ ${storageTotalGB} (${storagePercent}%)`}
              prefix={<HddOutlined />}
              valueStyle={{ color: storagePercent > 80 ? '#ff4d4f' : '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      <Divider />

      <Row gutter={16}>
        <Col span={12}>
          <Card title="摄像头状态分布">
            {cameraStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={cameraStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {cameraStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
                暂无设备数据
              </div>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="系统信息">
            <div style={{ padding: '20px' }}>
              <p><strong>后端地址:</strong> {window.location.origin}</p>
              <p><strong>当前页面:</strong> {window.location.href}</p>
              <p><strong>最后更新:</strong> {new Date().toLocaleString('zh-CN')}</p>
              <p><strong>自动刷新:</strong> 每30秒</p>
              <p><strong>设备总数:</strong> {stats.total} (在线: {stats.online}, 离线: {stats.offline})</p>
              <p><strong>视频总数:</strong> {videoStats.totalVideos}</p>
              <p><strong>存储使用:</strong> {storageUsedGB} / {storageTotalGB} ({storagePercent}%)</p>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard