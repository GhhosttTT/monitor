// 摄像头端WebRTC服务实现
class CameraWebRTCService {
  constructor() {
    this.connections = new Map(); // 存储所有连接
    this.streams = new Map();     // 存储视频流
  }

  // 初始化WebRTC连接
  async initializeConnection(cameraId, userId) {
    try {
      // 创建连接ID
      const connectionId = `${cameraId}-${userId}-${Date.now()}`;
      
      // 创建RTCPeerConnection对象
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // 存储连接
      this.connections.set(connectionId, {
        peerConnection,
        cameraId,
        userId,
        createdAt: new Date()
      });

      // 设置事件监听器
      this.setupEventListeners(peerConnection, connectionId);

      return connectionId;
    } catch (error) {
      console.error('初始化WebRTC连接失败:', error);
      throw error;
    }
  }

  // 设置事件监听器
  setupEventListeners(peerConnection, connectionId) {
    // ICE候选事件
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // 发送ICE候选到客户端
        this.sendIceCandidate(connectionId, event.candidate);
      }
    };

    // 连接状态变化
    peerConnection.onconnectionstatechange = () => {
      const connection = this.connections.get(connectionId);
      if (connection) {
        console.log(`连接状态变化: ${connection.peerConnection.connectionState}`);
        
        // 如果连接关闭，清理资源
        if (connection.peerConnection.connectionState === 'closed' || 
            connection.peerConnection.connectionState === 'failed') {
          this.closeConnection(connectionId);
        }
      }
    };

    // 轨道事件
    peerConnection.ontrack = (event) => {
      console.log('收到媒体轨道:', event.track.kind);
    };
  }

  // 创建offer
  async createOffer(connectionId) {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new Error('连接不存在');
      }

      // 创建offer
      const offer = await connection.peerConnection.createOffer();
      await connection.peerConnection.setLocalDescription(offer);

      return offer;
    } catch (error) {
      console.error('创建offer失败:', error);
      throw error;
    }
  }

  // 处理answer
  async handleAnswer(connectionId, answer) {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new Error('连接不存在');
      }

      await connection.peerConnection.setRemoteDescription(answer);
    } catch (error) {
      console.error('处理answer失败:', error);
      throw error;
    }
  }

  // 处理ICE候选
  async handleIceCandidate(connectionId, candidate) {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new Error('连接不存在');
      }

      await connection.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.error('处理ICE候选失败:', error);
      throw error;
    }
  }

  // 发送ICE候选（需要实现具体的发送逻辑）
  sendIceCandidate(connectionId, candidate) {
    // 这里应该通过WebSocket或其他方式发送ICE候选到客户端
    console.log(`发送ICE候选到连接 ${connectionId}:`, candidate);
  }

  // 添加视频流到连接
  addStream(connectionId, stream) {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new Error('连接不存在');
      }

      // 添加所有轨道到连接
      stream.getTracks().forEach(track => {
        connection.peerConnection.addTrack(track, stream);
      });

      // 存储流
      this.streams.set(connectionId, stream);
    } catch (error) {
      console.error('添加视频流失败:', error);
      throw error;
    }
  }

  // 关闭连接
  closeConnection(connectionId) {
    try {
      const connection = this.connections.get(connectionId);
      if (connection) {
        // 关闭RTCPeerConnection
        connection.peerConnection.close();
        
        // 移除连接
        this.connections.delete(connectionId);
        
        // 移除流
        if (this.streams.has(connectionId)) {
          this.streams.delete(connectionId);
        }
        
        console.log(`连接 ${connectionId} 已关闭`);
      }
    } catch (error) {
      console.error('关闭连接失败:', error);
    }
  }

  // 获取连接状态
  getConnectionStatus(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return null;
    }

    return {
      connectionState: connection.peerConnection.connectionState,
      signalingState: connection.peerConnection.signalingState,
      iceConnectionState: connection.peerConnection.iceConnectionState
    };
  }

  // 清理所有连接
  cleanup() {
    for (const [connectionId] of this.connections) {
      this.closeConnection(connectionId);
    }
  }
}

// 客户端WebRTC服务实现
class ClientWebRTCService {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
  }

  // 初始化WebRTC客户端
  async initialize() {
    try {
      // 创建RTCPeerConnection对象
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // 设置事件监听器
      this.setupEventListeners();

      return true;
    } catch (error) {
      console.error('初始化WebRTC客户端失败:', error);
      throw error;
    }
  }

  // 设置事件监听器
  setupEventListeners() {
    // ICE候选事件
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // 发送ICE候选到服务器
        this.sendIceCandidate(event.candidate);
      }
    };

    // 远程流事件
    this.peerConnection.ontrack = (event) => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      this.remoteStream.addTrack(event.track);
      this.onRemoteStream(this.remoteStream);
    };

    // 连接状态变化
    this.peerConnection.onconnectionstatechange = () => {
      console.log(`客户端连接状态变化: ${this.peerConnection.connectionState}`);
      this.onConnectionStateChange(this.peerConnection.connectionState);
    };
  }

  // 处理offer
  async handleOffer(offer) {
    try {
      await this.peerConnection.setRemoteDescription(offer);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.error('处理offer失败:', error);
      throw error;
    }
  }

  // 处理ICE候选
  async handleIceCandidate(candidate) {
    try {
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.error('处理ICE候选失败:', error);
      throw error;
    }
  }

  // 发送ICE候选（需要实现具体的发送逻辑）
  sendIceCandidate(candidate) {
    // 这里应该通过WebSocket或其他方式发送ICE候选到服务器
    console.log('发送ICE候选:', candidate);
  }

  // 远程流回调（需要外部实现）
  onRemoteStream(stream) {
    console.log('收到远程流');
  }

  // 连接状态变化回调（需要外部实现）
  onConnectionStateChange(state) {
    console.log('连接状态变化:', state);
  }

  // 关闭连接
  close() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
      this.remoteStream = null;
    }
  }
}

module.exports = {
  CameraWebRTCService,
  ClientWebRTCService
};