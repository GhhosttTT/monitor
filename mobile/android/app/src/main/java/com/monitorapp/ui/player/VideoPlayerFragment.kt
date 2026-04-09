package com.monitorapp.ui.player

import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.SeekBar
import android.widget.TextView
import androidx.fragment.app.Fragment
import com.google.android.exoplayer2.ExoPlayer
import com.google.android.exoplayer2.MediaItem
import com.google.android.exoplayer2.ui.StyledPlayerView
import com.monitorapp.R

class VideoPlayerFragment : Fragment() {

    private lateinit var videoTitle: TextView
    private lateinit var playerView: StyledPlayerView
    private lateinit var playPauseButton: ImageButton
    private lateinit var seekBar: SeekBar
    private lateinit var durationText: TextView
    
    private var exoPlayer: ExoPlayer? = null
    private var videoUrl: String? = null
    private var isLiveStream: Boolean = false
    private var isPlaying = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        arguments?.let {
            videoUrl = it.getString("video_url")
            isLiveStream = it.getBoolean("is_live_stream", false)
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val root = inflater.inflate(R.layout.fragment_video_player, container, false)
        
        videoTitle = root.findViewById(R.id.video_title)
        playerView = root.findViewById(R.id.player_view)
        playPauseButton = root.findViewById(R.id.btn_play_pause)
        seekBar = root.findViewById(R.id.seek_bar)
        durationText = root.findViewById(R.id.tv_duration)
        
        Log.d("VideoPlayerFragment", "初始化视频播放器，URL: $videoUrl, 是否直播: $isLiveStream")
        
        // 初始化视频播放器
        initializePlayer()
        
        // 设置控制按钮监听器
        setupControlListeners()
        
        return root
    }

    private fun initializePlayer() {
        if (videoUrl.isNullOrEmpty()) {
            val errorMessage = "无法播放视频：URL为空"
            videoTitle.text = errorMessage
            Log.e("VideoPlayerFragment", errorMessage)
            return
        }
        
        try {
            // 创建ExoPlayer实例
            exoPlayer = ExoPlayer.Builder(requireContext()).build()
            playerView.player = exoPlayer
            
            // 设置媒体资源
            val mediaItem = MediaItem.fromUri(Uri.parse(videoUrl))
            exoPlayer?.setMediaItem(mediaItem)
            
            // 准备播放器
            exoPlayer?.prepare()
            
            // 根据是否为直播流设置标题
            if (isLiveStream) {
                videoTitle.text = "实时视频流"
                // 直播流不需要进度条控制
                seekBar.visibility = View.GONE
                Log.d("VideoPlayerFragment", "初始化直播流播放器")
            } else {
                videoTitle.text = "历史视频回放"
                // 历史视频需要进度条控制
                seekBar.visibility = View.VISIBLE
                Log.d("VideoPlayerFragment", "初始化历史视频播放器")
            }
            
            // 开始播放
            exoPlayer?.playWhenReady = true
            isPlaying = true
            updatePlayPauseButton()
            Log.d("VideoPlayerFragment", "播放器初始化完成并开始播放")
        } catch (e: Exception) {
            val errorMessage = "初始化播放器失败: ${e.message}"
            Log.e("VideoPlayerFragment", errorMessage, e)
            videoTitle.text = errorMessage
        }
    }

    private fun setupControlListeners() {
        playPauseButton.setOnClickListener {
            togglePlayPause()
        }
        
        seekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                if (fromUser && !isLiveStream) {
                    exoPlayer?.seekTo(progress.toLong())
                    Log.d("VideoPlayerFragment", "跳转到进度: $progress")
                }
            }
            
            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })
    }

    private fun togglePlayPause() {
        isPlaying = !isPlaying
        exoPlayer?.playWhenReady = isPlaying
        updatePlayPauseButton()
        Log.d("VideoPlayerFragment", "切换播放状态: $isPlaying")
    }

    private fun updatePlayPauseButton() {
        if (isPlaying) {
            playPauseButton.setImageResource(R.drawable.ic_pause)
        } else {
            playPauseButton.setImageResource(R.drawable.ic_play)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        // 释放播放器资源
        try {
            exoPlayer?.release()
            exoPlayer = null
            Log.d("VideoPlayerFragment", "播放器资源已释放")
        } catch (e: Exception) {
            Log.e("VideoPlayerFragment", "释放播放器资源时出错", e)
        }
    }

    companion object {
        @JvmStatic
        fun newInstance(videoUrl: String, isLiveStream: Boolean) =
            VideoPlayerFragment().apply {
                arguments = Bundle().apply {
                    putString("video_url", videoUrl)
                    putBoolean("is_live_stream", isLiveStream)
                }
            }
    }
}