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
  Tag,
  DatePicker,
  Space
} from 'antd'
import axios from 'axios'
import { PlayCircleOutlined, DeleteOutlined } from '@ant-design/icons'

const { RangePicker } = DatePicker
const { Option } = Select

const VideoManagement = () => {
  const [videos, setVideos] = useState([])
  const [cameras, setCameras] = useState([])
  const [loading, setLoading] = useState(false)
  const [videoModalVisible, setVideoModalVisible] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [form] = Form.useForm()

  // 获取视频列表
  const fetchVideos = async () => {
    setLoading(true)
    try {
      // 这里应该调用实际的API
      // const response = await axios.get('/api/videos')
      // 模拟数据
      const response = {
        data: {
          videos: [
            {
              id: '1',
              filename: '20220101_100000.mp4',
              camera: '客厅摄像头',
              startTime: '2022-01-01T10:00:00Z',
              endTime: '2022-01-01T10:05:00Z',
              duration: 300,
              size: 104857600,
              resolution: '2k',
              hasMotion: true
            },
            {
              id: '2',
              filename: '20220101_090000.mp4',
              camera: '卧室摄像头',
              startTime: '2022-01-01T09:00:00Z',
              endTime: '2022-01-01T09:10:00Z',
              duration: 600,
              size: 209715200,
              resolution: '2k',
              hasMotion: false
            }
          ]
        }
      }
      setVideos(response.data.videos)
    } catch (error) {
      message.error('获取视频列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 获取摄像头列表（用于筛选）
  const fetchCameras = async () => {
    try {
      // 这里应该调用实际的API
      // const response = await axios.get('/api/cameras')
      // 模拟数据
      const response = {
        data: [
          {
            id: '1',
            name: '客厅摄像头'
          },
          {
            id: '2',
            name: '卧室摄像头'
          }
        ]
      }
      setCameras(response.data)
    } catch (error) {
      message.error('获取摄像头列表失败')
    }
  }

  useEffect(() => {
    fetchVideos()
    fetchCameras()
  }, [])

  // 处理删除视频
  const handleDeleteVideo = async (videoId) => {
    try {
      // await axios.delete(`/api/videos/${videoId}`)
      message.success('视频删除成功')
      fetchVideos()
    } catch (error) {
      message.error('视频删除失败')
    }
  }

  // 处理播放视频
  const handlePlayVideo = (video) => {
    setSelectedVideo(video)
    setVideoModalVisible(true)
  }

  // 处理搜索
  const handleSearch = async (values) => {
    try {
      // 这里应该调用实际的API
      // const response = await axios.get('/api/videos', { params: values })
      message.success('搜索完成')
      // setVideos(response.data.videos)
    } catch (error) {
      message.error('搜索失败')
    }
  }

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 格式化时长
  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    
    if (h > 0) {
      return `${h}小时${m}分钟${s}秒`
    } else if (m > 0) {
      return `${m}分钟${s}秒`
    } else {
      return `${s}秒`
    }
  }

  // 表格列定义
  const columns = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
    },
    {
      title: '摄像头',
      dataIndex: 'camera',
      key: 'camera',
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (text) => new Date(text).toLocaleString()
    },
    {
      title: '结束时间',
      dataIndex: 'endTime',
      key: 'endTime',
      render: (text) => new Date(text).toLocaleString()
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration) => formatDuration(duration)
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (size) => formatFileSize(size)
    },
    {
      title: '分辨率',
      dataIndex: 'resolution',
      key: 'resolution',
    },
    {
      title: '移动侦测',
      dataIndex: 'hasMotion',
      key: 'hasMotion',
      render: (hasMotion) => (
        <Tag color={hasMotion ? 'red' : 'green'}>
          {hasMotion ? '是' : '否'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button 
            icon={<PlayCircleOutlined />} 
            onClick={() => handlePlayVideo(record)}
          >
            播放
          </Button>
          <Popconfirm
            title="确定要删除这个视频吗？"
            onConfirm={() => handleDeleteVideo(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button icon={<DeleteOutlined />} danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card title="视频管理">
      <Form
        form={form}
        onFinish={handleSearch}
        layout="inline"
        style={{ marginBottom: 20 }}
      >
        <Form.Item name="cameraId" label="摄像头">
          <Select placeholder="请选择摄像头" style={{ width: 200 }}>
            <Option value="">全部</Option>
            {cameras.map(camera => (
              <Option key={camera.id} value={camera.id}>{camera.name}</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="dateRange" label="时间范围">
          <RangePicker showTime />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            搜索
          </Button>
        </Form.Item>
      </Form>
      
      <Table 
        dataSource={videos} 
        columns={columns} 
        loading={loading}
        rowKey="id"
        pagination={{
          pageSize: 10
        }}
      />

      <Modal
        title="视频播放"
        visible={videoModalVisible}
        onCancel={() => setVideoModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedVideo && (
          <div>
            <h3>{selectedVideo.filename}</h3>
            <video 
              src="#" 
              controls 
              style={{ width: '100%' }}
              poster="#"
            >
              您的浏览器不支持视频播放。
            </video>
            <div style={{ marginTop: 16 }}>
              <p><strong>摄像头:</strong> {selectedVideo.camera}</p>
              <p><strong>开始时间:</strong> {new Date(selectedVideo.startTime).toLocaleString()}</p>
              <p><strong>结束时间:</strong> {new Date(selectedVideo.endTime).toLocaleString()}</p>
              <p><strong>时长:</strong> {formatDuration(selectedVideo.duration)}</p>
              <p><strong>大小:</strong> {formatFileSize(selectedVideo.size)}</p>
              <p><strong>分辨率:</strong> {selectedVideo.resolution}</p>
              <p><strong>移动侦测:</strong> {selectedVideo.hasMotion ? '是' : '否'}</p>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}

export default VideoManagement