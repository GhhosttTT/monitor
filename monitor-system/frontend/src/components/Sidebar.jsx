import React from 'react'
import { Layout, Menu } from 'antd'
import { 
  DashboardOutlined, 
  VideoCameraOutlined, 
  PlaySquareOutlined,
  MonitorOutlined
} from '@ant-design/icons'
import { Link } from 'react-router-dom'

const { Sider } = Layout

const Sidebar = () => {
  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="/dashboard">仪表板</Link>
    },
    {
      key: 'cameras',
      icon: <VideoCameraOutlined />,
      label: <Link to="/cameras">摄像头管理</Link>
    },
    {
      key: 'videos',
      icon: <PlaySquareOutlined />,
      label: <Link to="/videos">视频管理</Link>
    },
    {
      key: 'system',
      icon: <MonitorOutlined />,
      label: <Link to="/system">系统监控</Link>
    }
  ]

  return (
    <Sider breakpoint="lg" collapsedWidth="0">
      <div style={{ 
        height: '64px', 
        margin: '16px', 
        textAlign: 'center',
        color: 'white',
        fontSize: '18px',
        fontWeight: 'bold',
        lineHeight: '64px',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        监控系统
      </div>
      <Menu 
        theme="dark" 
        mode="inline" 
        defaultSelectedKeys={['dashboard']}
        items={menuItems}
      />
    </Sider>
  )
}

export default Sidebar