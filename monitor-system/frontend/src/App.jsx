import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from 'antd'
import Dashboard from './pages/Dashboard'
import CameraManagement from './pages/CameraManagement'
import VideoManagement from './pages/VideoManagement'
import SystemMonitor from './pages/SystemMonitor'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import './App.css'

const { Content, Footer } = Layout

function App() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout className="site-layout" style={{ overflow: 'hidden' }}>
        <Header />
        <Content style={{ margin: '16px', overflow: 'auto', height: 'calc(100vh - 112px)' }}>
          <div className="site-layout-background" style={{ padding: 24, minHeight: 360 }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/cameras" element={<CameraManagement />} />
              <Route path="/videos" element={<VideoManagement />} />
              <Route path="/system" element={<SystemMonitor />} />
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