import React from 'react'
import { Layout } from 'antd'

const { Header } = Layout

const HeaderBar = () => {
  return (
    <Header className="site-layout-background" style={{ padding: '0 24px', display: 'flex', alignItems: 'center' }}>
      <h2 style={{ margin: 0, color: '#fff' }}>智能监控系统</h2>
    </Header>
  )
}

export default HeaderBar