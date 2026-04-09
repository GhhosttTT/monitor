import React from 'react'
import { Card, Row, Col, Statistic, Divider } from 'antd'
import { 
  UserOutlined, 
  VideoCameraOutlined, 
  PlaySquareOutlined,
  HddOutlined
} from '@ant-design/icons'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const Dashboard = () => {
  // 模拟数据
  const userGrowthData = [
    { month: '1月', users: 400 },
    { month: '2月', users: 600 },
    { month: '3月', users: 800 },
    { month: '4月', users: 1000 },
    { month: '5月', users: 1200 },
    { month: '6月', users: 1500 },
  ]

  const cameraStatusData = [
    { name: '在线', value: 400 },
    { name: '离线', value: 100 },
    { name: '错误', value: 50 },
  ]

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28']

  return (
    <div>
      <h1>仪表板</h1>
      <Divider />
      
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={1128}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="在线摄像头"
              value={85}
              suffix="/ 100"
              prefix={<VideoCameraOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总视频数"
              value={2480}
              prefix={<PlaySquareOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="存储使用"
              value={45}
              suffix="GB / 100GB"
              prefix={<HddOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Divider />

      <Row gutter={16}>
        <Col span={12}>
          <Card title="用户增长趋势">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={userGrowthData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="users" fill="#8884d8" name="用户数" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="摄像头状态分布">
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
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard