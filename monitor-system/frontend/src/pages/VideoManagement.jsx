import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Row, 
  Col, 
  Button, 
  Modal, 
  message,
  Empty,
  Tag,
  Space,
  Typography,
  List,
  Badge,
  Select,
  DatePicker,
  Input
} from 'antd'
import axios from 'axios'
import { 
  PlayCircleOutlined, 
  DeleteOutlined, 
  FolderOpenOutlined,
  VideoCameraOutlined,
  ArrowLeftOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  FileOutlined,
  SearchOutlined,
  FilterOutlined
} from '@ant-design/icons'

const { Text, Title } = Typography
const { Option } = Select
const { RangePicker } = DatePicker

const VideoManagement = () => {
  const [cameras, setCameras] = useState([])
  const [selectedCamera, setSelectedCamera] = useState(null)
  const [videos, setVideos] = useState([])
  const [filteredVideos, setFilteredVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [videoModalVisible, setVideoModalVisible] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState(null)
  
  // 筛选条件
  const [searchText, setSearchText] = useState('')
  const [dateRange, setDateRange] = useState(null)
  const [motionFilter, setMotionFilter] = useState('all') // all, yes, no

  // 获取摄像头列表
  const fetchCameras = async () => {
    try {
      const response = await axios.get('/api/cameras')
      console.log('摄像头列表:', response.data)
      setCameras(response.data || [])
    } catch (error) {
      console.error('获取摄像头列表失败:', error)
      message.error('获取摄像头列表失败')
    }
  }

  // 获取指定摄像头的视频列表
  const fetchVideos = async (cameraId) => {
    if (!cameraId) return
    
    setLoading(true)
    try {
      const response = await axios.get('/api/videos', { 
        params: { cameraId }
      })
      console.log('视频列表响应:', response.data)
      setVideos(response.data.videos || response.data || [])
    } catch (error) {
      console.error('获取视频列表失败:', error)
      message.error(`获取视频列表失败: ${error.response?.data?.message || error.message}`)
      setVideos([])
    } finally {
      setLoading(false)
    }
  }

  // 选择摄像头
  const handleSelectCamera = (camera) => {
    setSelectedCamera(camera)
    fetchVideos(camera.id)
  }

  // 返回摄像头列表
  const handleBackToList = () => {
    setSelectedCamera(null)
    setVideos([])
    setFilteredVideos([])
    // 重置筛选条件
    setSearchText('')
    setDateRange(null)
    setMotionFilter('all')
  }

  // 应用筛选
  useEffect(() => {
    if (!videos.length) {
      setFilteredVideos([])
      return
    }

    let filtered = [...videos]

    // 文件名搜索
    if (searchText) {
      filtered = filtered.filter(video => 
        video.filename.toLowerCase().includes(searchText.toLowerCase())
      )
    }

    // 日期范围筛选
    if (dateRange && dateRange.length === 2) {
      const [startDate, endDate] = dateRange
      filtered = filtered.filter(video => {
        const videoDate = new Date(video.startTime)
        return videoDate >= startDate && videoDate <= endDate
      })
    }

    // 移动侦测筛选
    if (motionFilter !== 'all') {
      const hasMotion = motionFilter === 'yes'
      filtered = filtered.filter(video => video.hasMotion === hasMotion)
    }

    setFilteredVideos(filtered)
  }, [videos, searchText, dateRange, motionFilter])

  useEffect(() => {
    fetchCameras()
  }, [])

  // 处理播放视频
  const handlePlayVideo = (video) => {
    // 确保 fileUrl 是完整路径
    const videoWithFullUrl = {
      ...video,
      fileUrl: video.fileUrl.startsWith('http') 
        ? video.fileUrl 
        : `http://192.168.1.10:5002${video.fileUrl}`
    }
    setSelectedVideo(videoWithFullUrl)
    setVideoModalVisible(true)
  }

  // 处理删除视频
  const handleDeleteVideo = async (videoId) => {
    try {
      await axios.delete(`/api/videos/${videoId}`)
      message.success('视频删除成功')
      if (selectedCamera) {
        fetchVideos(selectedCamera.id)
      }
    } catch (error) {
      console.error('删除视频失败:', error)
      message.error(`删除视频失败: ${error.response?.data?.message || error.message}`)
    }
  }

  // 在文件夹中打开视频
  const handleOpenFolder = async (videoId) => {
    try {
      await axios.post(`/api/videos/${videoId}/open-folder`)
      message.success('已打开文件夹')
    } catch (error) {
      console.error('打开文件夹失败:', error)
      message.error(`打开文件夹失败: ${error.response?.data?.message || error.message}`)
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

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    })
  }

  // 格式化时间
  const formatTime = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }

  // 渲染摄像头卡片
  const renderCameraCard = (camera) => {
    return (
      <Col xs={24} sm={12} md={8} lg={6} key={camera.id}>
        <Card
          hoverable
          onClick={() => handleSelectCamera(camera)}
          style={{ 
            cursor: 'pointer',
            height: '100%',
            textAlign: 'center'
          }}
          cover={
            <div style={{ 
              height: '150px', 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <VideoCameraOutlined style={{ fontSize: '64px', color: '#fff' }} />
            </div>
          }
        >
          <Card.Meta
            title={<Title level={5}>{camera.name}</Title>}
            description={
              <Space direction="vertical" size="small">
                <Text type="secondary">{camera.serialNumber}</Text>
                <Badge 
                  status={camera.status === 'online' ? 'success' : 'default'} 
                  text={camera.status === 'online' ? '在线' : '离线'} 
                />
                {camera.ipAddress && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {camera.ipAddress}
                  </Text>
                )}
              </Space>
            }
          />
        </Card>
      </Col>
    )
  }

  // 渲染视频列表项 - 紧凑型
  const renderVideoItem = (video) => {
    return (
      <List.Item
        key={video.id}
        style={{ padding: '12px 0' }}
        actions={[
          <Button 
            key="play"
            type="link" 
            icon={<PlayCircleOutlined />} 
            onClick={() => handlePlayVideo(video)}
          >
            播放
          </Button>,
          <Button 
            key="folder"
            type="link"
            icon={<FolderOpenOutlined />} 
            onClick={() => handleOpenFolder(video.id)}
          >
            打开
          </Button>,
          <Button 
            key="delete"
            type="link"
            icon={<DeleteOutlined />} 
            danger
            onClick={() => handleDeleteVideo(video.id)}
          >
            删除
          </Button>
        ]}
      >
        <List.Item.Meta
          avatar={<FileOutlined style={{ fontSize: '24px', color: '#1890ff' }} />}
          title={
            <Space size="small">
              <Text strong style={{ fontSize: '14px' }}>{video.filename}</Text>
              {video.hasMotion && <Tag color="red" style={{ fontSize: '11px' }}>移动</Tag>}
              <Tag color="blue" style={{ fontSize: '11px' }}>{video.resolution}</Tag>
            </Space>
          }
          description={
            <Space size="large" style={{ fontSize: '12px' }}>
              <Space size="small">
                <CalendarOutlined />
                <Text type="secondary">{formatDate(video.startTime)}</Text>
              </Space>
              <Space size="small">
                <ClockCircleOutlined />
                <Text type="secondary">
                  {formatTime(video.startTime)} - {formatDuration(video.duration)}
                </Text>
              </Space>
              <Text type="secondary">{formatFileSize(video.size)}</Text>
            </Space>
          }
        />
      </List.Item>
    )
  }

  return (
    <div>
      {/* 摄像头列表视图 */}
      {!selectedCamera && (
        <Card title="视频管理 - 选择设备">
          <Row gutter={[16, 16]}>
            {cameras.length > 0 ? (
              cameras.map(renderCameraCard)
            ) : (
              <Col span={24}>
                <Empty description="暂无设备" />
              </Col>
            )}
          </Row>
        </Card>
      )}

      {/* 视频列表视图 */}
      {selectedCamera && (
        <Card
          title={
            <Space>
              <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={handleBackToList}
              >
                返回
              </Button>
              <Title level={5} style={{ margin: 0 }}>
                {selectedCamera.name} - 视频列表
              </Title>
              <Badge count={filteredVideos.length} style={{ backgroundColor: '#52c41a' }} />
            </Space>
          }
          extra={
            <Space size="middle">
              {/* 搜索框 */}
              <Input
                placeholder="搜索文件名"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 200 }}
                allowClear
              />
              
              {/* 日期筛选 */}
              <RangePicker
                placeholder={['开始日期', '结束日期']}
                value={dateRange}
                onChange={setDateRange}
                style={{ width: 240 }}
              />
              
              {/* 移动侦测筛选 */}
              <Select
                value={motionFilter}
                onChange={setMotionFilter}
                style={{ width: 120 }}
                placeholder="移动侦测"
              >
                <Option value="all">全部</Option>
                <Option value="yes">有移动</Option>
                <Option value="no">无移动</Option>
              </Select>
              
              {/* 重置按钮 */}
              {(searchText || dateRange || motionFilter !== 'all') && (
                <Button 
                  icon={<FilterOutlined />}
                  onClick={() => {
                    setSearchText('')
                    setDateRange(null)
                    setMotionFilter('all')
                  }}
                >
                  重置
                </Button>
              )}
            </Space>
          }
        >
          <List
            loading={loading}
            itemLayout="horizontal"
            size="small"
            dataSource={filteredVideos}
            renderItem={renderVideoItem}
            locale={{
              emptyText: (
                <Empty 
                  description={videos.length === 0 ? "该设备暂无视频记录" : "没有符合筛选条件的视频"}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )
            }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`,
              pageSizeOptions: ['10', '20', '50', '100']
            }}
          />
        </Card>
      )}

      {/* 视频播放模态框 */}
      <Modal
        title="视频播放"
        open={videoModalVisible}
        onCancel={() => setVideoModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedVideo && (
          <div>
            <video 
              src={selectedVideo.fileUrl} 
              controls 
              autoPlay
              style={{ width: '100%', maxHeight: '500px' }}
            >
              您的浏览器不支持视频播放。
            </video>
            <div style={{ marginTop: 16 }}>
              <p><strong>文件名:</strong> {selectedVideo.filename}</p>
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
    </div>
  )
}

export default VideoManagement
