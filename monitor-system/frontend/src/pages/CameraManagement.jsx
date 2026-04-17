import React, { useState, useEffect, useRef } from 'react'
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
  Tag,
  Row,
  Col
} from 'antd'
import { VideoCameraOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons'
import { cameraAPI } from '../services/api'
import axios from 'axios'

const { Option } = Select

const CameraManagement = () => {
  const [cameras, setCameras] = useState([])
  const [loading, setLoading] = useState(false)
  const [streamModalVisible, setStreamModalVisible] = useState(false)
  const [currentCamera, setCurrentCamera] = useState(null)
  const canvasRef = useRef(null)
  const videoStreamRef = useRef(null)

  // 获取摄像头列表
  const fetchCameras = async () => {
    setLoading(true)
    try {
      const data = await cameraAPI.getList()
      console.log('摄像头列表:', data)
      setCameras(data || [])
    } catch (error) {
      console.error('获取摄像头列表失败:', error)
      message.error('获取摄像头列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCameras()
    // 每10秒刷新一次
    const interval = setInterval(fetchCameras, 10000)
    return () => clearInterval(interval)
  }, [])

  // 查看实时视频流
  const handleViewStream = (camera) => {
    console.log('点击查看实时监控:', camera)
    setCurrentCamera(camera)
    setStreamModalVisible(true)
    
    // 延迟加载视频流,确保DOM已渲染
    setTimeout(() => {
      if (videoStreamRef.current) {
        videoStreamRef.current.src = `/api/cameras/${camera.id}/stream?t=${Date.now()}`
      }
    }, 100)
  }

  // 关闭视频流模态框
  const handleCloseStream = () => {
    // 停止视频流
    if (videoStreamRef.current) {
      videoStreamRef.current.src = ''
      videoStreamRef.current = null
    }
    
    setStreamModalVisible(false)
    // 延迟清空currentCamera，确保元素先被销毁
    setTimeout(() => {
      setCurrentCamera(null)
    }, 100)
  }

  // 删除摄像头
  const handleDeleteCamera = async (cameraId, cameraName) => {
    try {
      console.log(`🗑️ 删除摄像头: ${cameraName} (ID: ${cameraId})`)
      
      // 调用后端API删除
      const response = await axios.delete(`/api/cameras/${cameraId}`)
      
      if (response.data.message) {
        message.success(response.data.message)
      } else {
        message.success('摄像头删除成功')
      }
      
      // 刷新列表
      fetchCameras()
    } catch (error) {
      console.error('删除摄像头失败:', error)
      message.error('删除失败: ' + (error.response?.data?.message || error.message))
    }
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
      title: 'IP地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      render: (text) => text || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>{status === 'online' ? '在线' : status === 'offline' ? '离线' : '错误'}</Tag>
      )
    },
    {
      title: '最后心跳',
      dataIndex: 'lastHeartbeat',
      key: 'lastHeartbeat',
      render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '从未连接'
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_, record) => (
        <span>
          <Button 
            type="primary" 
            icon={<EyeOutlined />}
            onClick={() => handleViewStream(record)}
            disabled={record.status !== 'online'}
            style={{ marginRight: 8 }}
          >
            实时监控
          </Button>
          <Popconfirm
            title={`确定要删除 "${record.name}" 吗？`}
            description="删除后，该设备需要重新配网才能接入系统"
            onConfirm={() => handleDeleteCamera(record.id, record.name)}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button 
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </span>
      ),
    },
  ]

  return (
    <div>
      <Card title="摄像头管理">
        <Table 
          dataSource={cameras} 
          columns={columns} 
          loading={loading}
          rowKey="id"
        />
      </Card>

      {/* 实时视频流模态框 */}
      <Modal
        title={`实时监控 - ${currentCamera?.name}`}
        open={streamModalVisible}
        onCancel={handleCloseStream}
        footer={null}
        width={900}
        destroyOnClose={true}
      >
        {currentCamera && currentCamera.ipAddress ? (
          <div style={{ textAlign: 'center', padding: '10px' }}>
            <div style={{ 
              marginBottom: '16px',
              padding: '10px',
              backgroundColor: '#f0f2f5',
              borderRadius: '4px'
            }}>
              <p style={{ margin: '5px 0' }}>
                <strong>设备名称:</strong> {currentCamera.name}
              </p>
              <p style={{ margin: '5px 0' }}>
                <strong>设备IP:</strong> {currentCamera.ipAddress}
              </p>
              <p style={{ margin: '5px 0' }}>
                <strong>视频流地址:</strong> /api/cameras/{currentCamera.id}/stream
              </p>
            </div>
            
            <div style={{ 
              border: '2px solid #1890ff',
              borderRadius: '4px',
              overflow: 'hidden',
              backgroundColor: '#000',
              minHeight: '400px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* 使用img标签加载MJPEG流 */}
              <img 
                ref={videoStreamRef}
                alt="实时视频流"
                style={{ 
                  width: '100%',
                  maxHeight: '600px',
                  display: 'block'
                }}
                onLoad={(e) => {
                  console.log('✅ 视频流开始加载')
                }}
                onError={(e) => {
                  console.error('❌ 视频流加载失败:', e)
                  e.target.style.display = 'none'
                  // 显示错误提示
                  const parent = e.target.parentElement
                  if (parent && !parent.querySelector('.error-msg')) {
                    const errorMsg = document.createElement('div')
                    errorMsg.className = 'error-msg'
                    errorMsg.style.color = '#fff'
                    errorMsg.style.padding = '20px'
                    errorMsg.textContent = '无法加载视频流，请检查设备是否在线'
                    parent.appendChild(errorMsg)
                  }
                }}
              />
            </div>
            
            <div style={{ marginTop: 16, color: '#666', fontSize: '12px' }}>
              <p>💡 提示：视频流通过后端中转，服务器承担并发压力</p>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>暂无设备信息</p>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default CameraManagement