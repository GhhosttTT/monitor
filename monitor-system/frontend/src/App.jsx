import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from 'antd'
import Dashboard from './pages/Dashboard'
import UserManagement from './pages/UserManagement'
import CameraManagement from './pages/CameraManagement'
import VideoManagement from './pages/VideoManagement'
import SystemMonitor from './pages/SystemMonitor'
import Login from './pages/Login'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import './App.css'

const { Content, Footer } = Layout

function App() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout className="site-layout">
        <Header />
        <Content style={{ margin: '16px' }}>
          <div className="site-layout-background" style={{ padding: 24, minHeight: 360 }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/users" element={<UserManagement />} />
              <Route path="/cameras" element={<CameraManagement />} />
              <Route path="/videos" element={<VideoManagement />} />
              <Route path="/system" element={<SystemMonitor />} />
              <Route path="/login" element={<Login />} />
            </Routes>
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          智能监控系统 ©2022 Created by Your Company
        </Footer>
      </Layout>
    </Layout>
  )
}

export default App