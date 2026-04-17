import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Divider, Table, Tag, Spin, Alert, Tooltip } from 'antd'
import { 
  DesktopOutlined, 
  CloudOutlined, 
  HddOutlined,
  SwapOutlined,
  WifiOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import axios from '../services/api'

const SystemMonitor = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // 系统状态数据
  const [systemStatus, setSystemStatus] = useState({
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 0,
    networkTraffic: 0,
    activeConnections: 0,
    totalUsers: 0,
    onlineCameras: 0,
    totalVideos: 0
  })
  
  // 磁盘使用详情
  const [diskDetails, setDiskDetails] = useState({
    total: 0,
    used: 0,
    free: 0,
    usagePercent: 0
  })

  // 模拟CPU使用率历史数据
  const [cpuHistory, setCpuHistory] = useState([
    { time: '10:00', usage: 30 },
    { time: '10:05', usage: 45 },
    { time: '10:10', usage: 50 },
    { time: '10:15', usage: 42 },
    { time: '10:20', usage: 48 },
    { time: '10:25', usage: 45 }
  ])

  // 模拟内存使用率历史数据
  const [memoryHistory, setMemoryHistory] = useState([
    { time: '10:00', usage: 55 },
    { time: '10:05', usage: 60 },
    { time: '10:10', usage: 65 },
    { time: '10:15', usage: 62 },
    { time: '10:20', usage: 68 },
    { time: '10:25', usage: 65 }
  ])
  
  // 获取系统监控数据
  const fetchSystemData = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/system/status')
      
      console.log('📊 系统监控API响应:', response)
      console.log('✅ success字段:', response.success)
      console.log('📦 data字段:', response.data)
      
      if (response.success) {
        const data = response.data
        
        console.log('🔍 解析后的数据:', {
          cpu: data.cpu,
          memory: data.memory,
          disk: data.disk,
          devices: data.devices
        })
        
        // 更新系统状态
        setSystemStatus({
          cpuUsage: parseFloat(data.cpu?.usage || 0),
          memoryUsage: parseFloat(data.memory?.usagePercent || 0),
          diskUsage: parseFloat(data.disk?.usagePercent || 0),
          networkTraffic: 0, // 需要额外实现
          activeConnections: data.devices?.online || 0,
          totalUsers: data.devices?.total || 0,
          onlineCameras: data.devices?.online || 0,
          totalVideos: data.videos?.totalVideos || 0
        })
        
        // 更新磁盘详情
        setDiskDetails({
          total: data.disk?.total || 0,
          used: data.disk?.used || 0,
          free: data.disk?.free || 0,
          usagePercent: parseFloat(data.disk?.usagePercent || 0)
        })
        
        setError(null)
      } else {
        console.error('❌ API返回success为false:', response)
        setError('API返回错误')
      }
    } catch (err) {
      console.error('获取系统数据失败:', err)
      setError('无法连接到后端服务: ' + err.message)
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    fetchSystemData()
    
    // 每10秒刷新一次
    const interval = setInterval(fetchSystemData, 10000)
    
    return () => clearInterval(interval)
  }, [])

  // 连接表格列定义
  const connectionColumns = [
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
    },
    {
      title: '连接时间',
      dataIndex: 'connectedAt',
      key: 'connectedAt',
      render: (text) => new Date(text).toLocaleString()
    },
    {
      title: '连接类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={type === 'WebSocket' ? 'blue' : 'green'}>{type}</Tag>
      )
    }
  ]
  
  // 格式化字节为可读格式
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div>
      <h1>系统监控</h1>
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
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" tip="加载中..." />
        </div>
      ) : (
        <>
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic
              title={
                <span>
                  CPU使用率
                  <Tooltip title="CPU当前使用百分比，反映处理器负载情况。数值越高表示系统计算任务越重。">
                    <QuestionCircleOutlined style={{ marginLeft: 8, color: '#999', cursor: 'help' }} />
                  </Tooltip>
                </span>
              }
              value={systemStatus.cpuUsage}
              suffix="%"
              prefix={<DesktopOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title={
                <span>
                  内存使用率
                  <Tooltip title="RAM内存当前使用百分比，反映系统内存占用情况。数值过高可能导致系统变慢。">
                    <QuestionCircleOutlined style={{ marginLeft: 8, color: '#999', cursor: 'help' }} />
                  </Tooltip>
                </span>
              }
              value={systemStatus.memoryUsage}
              suffix="%"
              prefix={<CloudOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title={
                <span>
                  磁盘使用率
                  <Tooltip title="硬盘存储空间使用百分比，显示已用空间占总容量的比例。用于监控视频存储容量。">
                    <QuestionCircleOutlined style={{ marginLeft: 8, color: '#999', cursor: 'help' }} />
                  </Tooltip>
                </span>
              }
              value={systemStatus.diskUsage}
              suffix="%"
              prefix={<HddOutlined />}
            />
            <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
              {formatBytes(diskDetails.used)} / {formatBytes(diskDetails.total)}
            </div>
          </Card>
        </Col>
      </Row>

      <Divider />

      <Row gutter={16}>
        <Col span={12}>
          <Card title="CPU使用率趋势">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={cpuHistory}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <RechartsTooltip />
                <Line type="monotone" dataKey="usage" stroke="#8884d8" activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="内存使用率趋势">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={memoryHistory}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <RechartsTooltip />
                <Line type="monotone" dataKey="usage" stroke="#82ca9d" activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Divider />

      <Row gutter={16}>
        <Col span={12}>
          <Card title="系统概览">
            <p><WifiOutlined /> 在线设备: {systemStatus.onlineCameras}</p>
            <p><DesktopOutlined /> 总设备数: {systemStatus.totalUsers}</p>
            <p><DesktopOutlined /> 总视频数: {systemStatus.totalVideos}</p>
            <p><HddOutlined /> 磁盘空间: {formatBytes(diskDetails.used)} / {formatBytes(diskDetails.total)}</p>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="系统信息">
            <p>数据每10秒自动刷新</p>
            <p style={{ color: '#999', fontSize: '12px' }}>最后更新: {new Date().toLocaleTimeString()}</p>
          </Card>
        </Col>
      </Row>
        </>
      )}
    </div>
  )
}

export default SystemMonitor