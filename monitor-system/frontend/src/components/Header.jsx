import React from 'react'
import { Layout, Dropdown, Menu, Avatar } from 'antd'
import { UserOutlined } from '@ant-design/icons'

const { Header } = Layout

const HeaderBar = () => {
  const menu = (
    <Menu>
      <Menu.Item key="profile">
        个人信息
      </Menu.Item>
      <Menu.Item key="logout">
        退出登录
      </Menu.Item>
    </Menu>
  )

  return (
    <Header className="site-layout-background" style={{ padding: 0 }}>
      <div style={{ float: 'right', marginRight: 24 }}>
        <Dropdown overlay={menu} placement="bottomRight">
          <Avatar size="large" icon={<UserOutlined />} />
        </Dropdown>
      </div>
    </Header>
  )
}

export default HeaderBar