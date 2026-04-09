package com.monitorapp.ui.camera

import android.util.Log
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import org.webrtc.*

class CameraViewModel : ViewModel() {
    private val _connectionStatus = MutableLiveData<String>()
    val connectionStatus: LiveData<String> = _connectionStatus

    private val _isRecording = MutableLiveData<Boolean>(false)
    val isRecording: LiveData<Boolean> = _isRecording

    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var videoSource: VideoSource? = null
    private var localVideoTrack: VideoTrack? = null
    private var peerConnection: PeerConnection? = null
    private var socket: Any? = null
    private var connectionId: String? = null

    // WebRTC配置
    private val iceServers = listOf(
        PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
        PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer()
    )

    fun initWebRTC(videoRenderer: SurfaceViewRenderer) {
        try {
            // 初始化PeerConnectionFactory
            val options = PeerConnectionFactory.InitializationOptions.builder(videoRenderer.context)
                .setEnableInternalTracer(true)
                .createInitializationOptions()

            PeerConnectionFactory.initialize(options)

            val factoryOptions = PeerConnectionFactory.Options()
            peerConnectionFactory = PeerConnectionFactory.builder()
                .setOptions(factoryOptions)
                .createPeerConnectionFactory()

            // 创建视频源和视频轨道
            val eglBaseContext = EglBase.create().eglBaseContext
            val surfaceTextureHelper = SurfaceTextureHelper.create("CaptureThread", eglBaseContext)
            videoSource = peerConnectionFactory!!.createVideoSource(false)
            localVideoTrack = peerConnectionFactory!!.createVideoTrack("local_video_track", videoSource)

            // 设置视频渲染器
            localVideoTrack?.addSink(videoRenderer)

            _connectionStatus.value = "WebRTC初始化完成"
        } catch (e: Exception) {
            Log.e("CameraViewModel", "WebRTC初始化失败", e)
            _connectionStatus.value = "WebRTC初始化失败: ${e.message}"
        }
    }

    fun connectToCamera(cameraId: String) {
        // 连接摄像头的逻辑
        _connectionStatus.value = "正在连接摄像头 $cameraId..."
    }

    fun startRecording() {
        _isRecording.value = true
        _connectionStatus.value = "开始录制"
    }

    fun stopRecording() {
        _isRecording.value = false
        _connectionStatus.value = "停止录制"
    }

    override fun onCleared() {
        super.onCleared()
        // 清理资源
        peerConnection?.close()
        peerConnection = null
        localVideoTrack = null
        videoSource = null
        peerConnectionFactory?.dispose()
        peerConnectionFactory = null
    }
}