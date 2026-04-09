import React from 'react'
import { Layout, Menu } from 'antd'
import { 
  DashboardOutlined, 
  UserOutlined, 
  VideoCameraOutlined, 
  PlaySquareOutlined,
  MonitorOutlined
} from '@ant-design/icons'
import { Link } from 'react-router-dom'

const { Sider } = Layout

const Sidebar = () => {
  return (
    <Sider breakpoint="lg" collapsedWidth="0">
      <div className="logo" />
      <Menu theme="dark" mode="inline" defaultSelectedKeys={['dashboard']}>
        <Menu.Item key="dashboard" icon={<DashboardOutlined />}>
          <Link to="/dashboard">仪表板</Link>
        </Menu.Item>
        <Menu.Item key="users" icon={<UserOutlined />}>
          <Link to="/users">用户管理</Link>
        </Menu.Item>
        <Menu.Item key="cameras" icon={<VideoCameraOutlined />}>
          <Link to="/cameras">摄像头管理</Link>
        </Menu.Item>
        <Menu.Item key="videos" icon={<PlaySquareOutlined />}>
          <Link to="/videos">视频管理</Link>
        </Menu.Item>
        <Menu.Item key="system" icon={<MonitorOutlined />}>
          <Link to="/system">系统监控</Link>
        </Menu.Item>
      </Menu>
    </Sider>
  )
}

export default Sidebar