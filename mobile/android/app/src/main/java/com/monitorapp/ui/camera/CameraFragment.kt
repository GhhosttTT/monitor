package com.monitorapp.ui.camera

import android.animation.AnimatorInflater
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import com.monitorapp.R
import com.monitorapp.data.CameraRepository
import com.monitorapp.network.ApiClient
import kotlinx.coroutines.launch

class CameraFragment : Fragment() {

    private lateinit var cameraRepository: CameraRepository
    private lateinit var statusTextView: TextView
    private lateinit var recordButton: Button
    private lateinit var snapshotButton: Button
    private lateinit var cameraCard: View

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val root = inflater.inflate(R.layout.fragment_camera, container, false)
        
        // 初始化数据仓库
        val apiClient = ApiClient.getInstance(requireContext())
        cameraRepository = CameraRepository.getInstance(apiClient)
        
        statusTextView = root.findViewById(R.id.status_text)
        recordButton = root.findViewById(R.id.record_button)
        snapshotButton = root.findViewById(R.id.snapshot_button)
        cameraCard = root.findViewById(R.id.camera_card)
        
        // 添加按钮动画效果
        val stateListAnimator = AnimatorInflater.loadStateListAnimator(
            requireContext(), R.animator.button_elevation
        )
        recordButton.stateListAnimator = stateListAnimator
        snapshotButton.stateListAnimator = stateListAnimator
        
        setupListeners()
        
        return root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        // 检查是否有已配对的摄像头
        lifecycleScope.launch {
            updateCameraView()
        }
    }

    private suspend fun updateCameraView() {
        Log.d("CameraFragment", "更新摄像头视图")
        // 从服务器获取摄像头列表
        val cameras = cameraRepository.fetchCamerasFromServer()
        
        if (cameras != null && cameras.isNotEmpty()) {
            Log.d("CameraFragment", "发现${cameras.size}个摄像头，显示摄像头视图")
            // 有配对的摄像头，显示视频画面
            showCameraView()
        } else if (cameraRepository.hasLocalCameras()) {
            Log.d("CameraFragment", "没有网络但有本地摄像头，显示离线模式")
            // 没有网络但有本地缓存的摄像头，显示离线模式
            showOfflineCameraView()
        } else {
            Log.d("CameraFragment", "没有配对的摄像头，显示绑定引导界面")
            // 没有配对的摄像头，显示绑定引导界面
            showBindingGuide()
        }
    }

    private fun showCameraView() {
        cameraCard.visibility = View.GONE
        statusTextView.visibility = View.VISIBLE
        recordButton.visibility = View.VISIBLE
        snapshotButton.visibility = View.VISIBLE
        
        statusTextView.text = "已连接到摄像头"
        Log.d("CameraFragment", "显示摄像头视图")
    }
    
    private fun showOfflineCameraView() {
        cameraCard.visibility = View.GONE
        statusTextView.visibility = View.VISIBLE
        recordButton.visibility = View.GONE
        snapshotButton.visibility = View.GONE
        
        statusTextView.text = "离线模式 - 显示本地缓存数据"
        Toast.makeText(context, "网络不可用，进入离线模式", Toast.LENGTH_LONG).show()
        Log.d("CameraFragment", "显示离线模式视图")
    }

    private fun showBindingGuide() {
        cameraCard.visibility = View.VISIBLE
        statusTextView.visibility = View.GONE
        recordButton.visibility = View.GONE
        snapshotButton.visibility = View.GONE
        Log.d("CameraFragment", "显示绑定引导界面")
    }

    private fun setupListeners() {
        recordButton.setOnClickListener {
            Toast.makeText(context, "录制功能将在后续版本中实现", Toast.LENGTH_SHORT).show()
        }
        
        snapshotButton.setOnClickListener {
            takeSnapshot()
        }
    }
    
    private fun takeSnapshot() {
        // 实现拍照功能
        Toast.makeText(context, "拍照功能将在后续版本中实现", Toast.LENGTH_SHORT).show()
        Log.d("CameraFragment", "用户点击拍照按钮")
    }

    override fun onDestroyView() {
        super.onDestroyView()
        // 释放WebRTC资源的操作应该在ViewModel中处理
    }
}