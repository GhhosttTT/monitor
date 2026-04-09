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
  Card,
  Tag
} from 'antd'
import axios from 'axios'

const { Option } = Select

const CameraManagement = () => {
  const [cameras, setCameras] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingCamera, setEditingCamera] = useState(null)
  const [form] = Form.useForm()

  // 获取摄像头列表
  const fetchCameras = async () => {
    setLoading(true)
    try {
      // 这里应该调用实际的API
      // const response = await axios.get('/api/cameras')
      // 模拟数据
      const response = {
        data: [
          {
            id: '1',
            name: '客厅摄像头',
            serialNumber: 'SN000001',
            owner: 'user1',
            status: 'online',
            lastConnected: '2022-01-01T10:00:00Z',
            settings: {
              resolution: '2k',
              storageRetention: 30
            }
          },
          {
            id: '2',
            name: '卧室摄像头',
            serialNumber: 'SN000002',
            owner: 'user1',
            status: 'offline',
            lastConnected: '2022-01-01T09:00:00Z',
            settings: {
              resolution: '2k',
              storageRetention: 30
            }
          }
        ]
      }
      setCameras(response.data)
    } catch (error) {
      message.error('获取摄像头列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 获取用户列表（用于选择摄像头所有者）
  const fetchUsers = async () => {
    try {
      // 这里应该调用实际的API
      // const response = await axios.get('/api/users')
      // 模拟数据
      const response = {
        data: [
          {
            id: 'user1',
            username: 'user1'
          },
          {
            id: 'user2',
            username: 'user2'
          }
        ]
      }
      setUsers(response.data)
    } catch (error) {
      message.error('获取用户列表失败')
    }
  }

  useEffect(() => {
    fetchCameras()
    fetchUsers()
  }, [])

  // 处理添加/编辑摄像头
  const handleFinish = async (values) => {
    try {
      if (editingCamera) {
        // 更新摄像头
        // await axios.put(`/api/cameras/${editingCamera.id}`, values)
        message.success('摄像头更新成功')
      } else {
        // 创建摄像头
        // await axios.post('/api/cameras', values)
        message.success('摄像头创建成功')
      }
      setModalVisible(false)
      form.resetFields()
      fetchCameras()
    } catch (error) {
      message.error(editingCamera ? '摄像头更新失败' : '摄像头创建失败')
    }
  }

  // 处理删除摄像头
  const handleDeleteCamera = async (cameraId) => {
    try {
      // await axios.delete(`/api/cameras/${cameraId}`)
      message.success('摄像头删除成功')
      fetchCameras()
    } catch (error) {
      message.error('摄像头删除失败')
    }
  }

  // 处理编辑摄像头
  const handleEditCamera = (camera) => {
    setEditingCamera(camera)
    form.setFieldsValue({
      ...camera,
      ownerId: camera.owner
    })
    setModalVisible(true)
  }

  // 显示添加摄像头模态框
  const showAddCameraModal = () => {
    setEditingCamera(null)
    form.resetFields()
    setModalVisible(true)
  }

  // 状态标签颜色
  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'green'
      case 'offline': return 'gray'
      case 'error': return 'red'
      default: return 'gray'
    }
  }

  // 表格列定义
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '序列号',
      dataIndex: 'serialNumber',
      key: 'serialNumber',
    },
    {
      title: '所有者',
      dataIndex: 'owner',
      key: 'owner',
      render: (_, record) => {
        const user = users.find(u => u.id === record.owner)
        return user ? user.username : '未知用户'
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      )
    },
    {
      title: '最后连接时间',
      dataIndex: 'lastConnected',
      key: 'lastConnected',
      render: (text) => text ? new Date(text).toLocaleString() : '从未连接'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <span>
          <Button 
            type="link" 
            onClick={() => handleEditCamera(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个摄像头吗？"
            onConfirm={() => handleDeleteCamera(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </span>
      ),
    },
  ]

  return (
    <Card title="摄像头管理" extra={<Button type="primary" onClick={showAddCameraModal}>添加摄像头</Button>}>
      <Table 
        dataSource={cameras} 
        columns={columns} 
        loading={loading}
        rowKey="id"
      />

      <Modal
        title={editingCamera ? "编辑摄像头" : "添加摄像头"}
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
            name="name"
            label="摄像头名称"
            rules={[{ required: true, message: '请输入摄像头名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="serialNumber"
            label="序列号"
            rules={[{ required: true, message: '请输入序列号' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="ownerId"
            label="所有者"
            rules={[{ required: true, message: '请选择所有者' }]}
          >
            <Select>
              {users.map(user => (
                <Option key={user.id} value={user.id}>{user.username}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default CameraManagement