import React, { useState, useEffect } from 'react'
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  message, 
  Popconfirm,
  Card
} from 'antd'
import axios from 'axios'

const { Option } = Select

const UserManagement = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form] = Form.useForm()

  // 获取用户列表
  const fetchUsers = async () => {
    setLoading(true)
    try {
      // 从localStorage获取token
      const token = localStorage.getItem('token')
      const response = await axios.get('/api/users', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      setUsers(response.data)
    } catch (error) {
      message.error('获取用户列表失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // 处理添加/编辑用户
  const handleFinish = async (values) => {
    try {
      const token = localStorage.getItem('token')
      if (editingUser) {
        // 更新用户
        await axios.put(`/api/users/${editingUser.id}`, values, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        message.success('用户更新成功')
      } else {
        // 创建用户
        await axios.post('/api/users', values, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        message.success('用户创建成功')
      }
      setModalVisible(false)
      form.resetFields()
      fetchUsers()
    } catch (error) {
      message.error((editingUser ? '用户更新失败' : '用户创建失败') + ': ' + error.message)
    }
  }

  // 处理删除用户
  const handleDeleteUser = async (userId) => {
    try {
      const token = localStorage.getItem('token')
      await axios.delete(`/api/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      message.success('用户删除成功')
      fetchUsers()
    } catch (error) {
      message.error('用户删除失败: ' + error.message)
    }
  }

  // 处理编辑用户
  const handleEditUser = (user) => {
    setEditingUser(user)
    form.setFieldsValue(user)
    setModalVisible(true)
  }

  // 处理重置密码
  const handleResetPassword = async (userId) => {
    try {
      const token = localStorage.getItem('token')
      // 使用默认密码重置
      await axios.post(`/api/users/${userId}/reset-password`, 
        { newPassword: '123456' }, // 默认密码
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )
      message.success('密码重置成功，默认密码为123456')
    } catch (error) {
      message.error('密码重置失败: ' + error.message)
    }
  }

  // 显示添加用户模态框
  const showAddUserModal = () => {
    setEditingUser(null)
    form.resetFields()
    setModalVisible(true)
  }

  // 表格列定义
  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => new Date(text).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <span>
          <Button 
            type="link" 
            onClick={() => handleEditUser(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个用户吗？"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
          <Button 
            type="link" 
            onClick={() => handleResetPassword(record.id)}
          >
            重置密码
          </Button>
        </span>
      ),
    },
  ]

  return (
    <Card title="用户管理" extra={<Button type="primary" onClick={showAddUserModal}>添加用户</Button>}>
      <Table 
        dataSource={users} 
        columns={columns} 
        loading={loading}
        rowKey="id"
      />

      <Modal
        title={editingUser ? "编辑用户" : "添加用户"}
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          onFinish={handleFinish}
          layout="vertical"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input />
          </Form.Item>
          {!editingUser && (
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select>
              <Option value="user">用户</Option>
              <Option value="admin">管理员</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default UserManagement