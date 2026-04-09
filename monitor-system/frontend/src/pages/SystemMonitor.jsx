import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Divider, Table, Tag } from 'antd'
import { 
  DesktopOutlined, 
  CloudOutlined, 
  HddOutlined,
  SwapOutlined,
  WifiOutlined
} from '@ant-design/icons'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const SystemMonitor = () => {
  // 模拟系统状态数据
  const [systemStatus, setSystemStatus] = useState({
    cpuUsage: 45,
    memoryUsage: 65,
    diskUsage: 35,
    networkTraffic: 1200,
    activeConnections: 24,
    totalUsers: 1128,
    onlineCameras: 85,
    totalVideos: 2480
  })

  // 模拟连接数据
  const [connections, setConnections] = useState([
    { id: '1', user: 'user1', ip: '192.168.1.101', connectedAt: '2022-01-01T10:00:00Z', type: 'WebSocket' },
    { id: '2', user: 'user2', ip: '192.168.1.102', connectedAt: '2022-01-01T09:30:00Z', type: 'WebRTC' },
    { id: '3', user: 'admin', ip: '192.168.1.103', connectedAt: '2022-01-01T08:45:00Z', type: 'WebSocket' }
  ])

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

  return (
    <div>
      <h1>系统监控</h1>
      <Divider />

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="CPU使用率"
              value={systemStatus.cpuUsage}
              suffix="%"
              prefix={<DesktopOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="内存使用率"
              value={systemStatus.memoryUsage}
              suffix="%"
              prefix={<CloudOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="磁盘使用率"
              value={systemStatus.diskUsage}
              suffix="%"
              prefix={<HddOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="网络流量"
              value={systemStatus.networkTraffic}
              suffix="KB/s"
              prefix={<SwapOutlined />}
            />
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
                <Tooltip />
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
                <Tooltip />
                <Line type="monotone" dataKey="usage" stroke="#82ca9d" activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Divider />

      <Row gutter={16}>
        <Col span={12}>
          <Card title="实时连接">
            <Table 
              dataSource={connections} 
              columns={connectionColumns} 
              pagination={false}
              rowKey="id"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="系统概览">
            <p><WifiOutlined /> 活跃连接数: {systemStatus.activeConnections}</p>
            <p><DesktopOutlined /> 总用户数: {systemStatus.totalUsers}</p>
            <p><DesktopOutlined /> 在线摄像头: {systemStatus.onlineCameras}</p>
            <p><DesktopOutlined /> 总视频数: {systemStatus.totalVideos}</p>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default SystemMonitor