package com.monitorapp.ui.camera

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.google.android.material.floatingactionbutton.FloatingActionButton
import com.monitorapp.R
import com.monitorapp.data.CameraRepository
import com.monitorapp.network.ApiClient
import kotlinx.coroutines.launch

class CameraListFragment : Fragment() {

    private lateinit var cameraAdapter: CameraAdapter
    private lateinit var cameraRepository: CameraRepository
    private lateinit var cameraViewModel: CameraViewModel
    private lateinit var bindingGuideLayout: LinearLayout
    private lateinit var recyclerView: RecyclerView
    private lateinit var addCameraButton: FloatingActionButton
    private lateinit var addCameraGuideButton: MaterialButton

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val root = inflater.inflate(R.layout.fragment_camera_list, container, false)
        
        // 初始化 ViewModel
        cameraViewModel = ViewModelProvider(this)[CameraViewModel::class.java]
        
        // 初始化数据仓库
        val apiClient = ApiClient.getInstance(requireContext())
        cameraRepository = CameraRepository.getInstance(apiClient)
        
        // 初始化视图组件
        recyclerView = root.findViewById(R.id.camera_recycler_view)
        bindingGuideLayout = root.findViewById(R.id.binding_guide_layout)
        addCameraButton = root.findViewById(R.id.add_camera_button)
        addCameraGuideButton = root.findViewById(R.id.add_camera_guide_button)
        
        cameraAdapter = CameraAdapter(mutableListOf()) { camera ->
            // 点击摄像头项目，导航到摄像头详情页
            val bundle = Bundle().apply {
                putString("camera_id", camera.id)
            }
            // 这里应该导航到摄像头详情页，但由于我们已经移除了navigation_pairing，暂时注释掉
            // view?.findNavController()?.navigate(R.id.navigation_cameras, bundle)
        }
        recyclerView.layoutManager = LinearLayoutManager(context)
        recyclerView.adapter = cameraAdapter
        
        // 添加摄像头按钮点击事件
        addCameraButton.setOnClickListener {
            // 显示绑定引导界面
            showBindingGuide()
        }
        
        addCameraGuideButton.setOnClickListener {
            // 显示绑定引导界面
            showBindingGuide()
        }
        
        // 加载摄像头列表
        loadCameras()
        
        return root
    }
    
    override fun onResume() {
        super.onResume()
        // 每次返回页面时重新加载摄像头列表
        loadCameras()
    }
    
    private fun loadCameras() {
        lifecycleScope.launch {
            val cameras = cameraRepository.fetchCamerasFromServer()
            if (cameras != null && cameras.isNotEmpty()) {
                // 有摄像头，显示列表
                cameraAdapter.updateCameras(cameras)
                recyclerView.visibility = View.VISIBLE
                bindingGuideLayout.visibility = View.GONE
            } else {
                // 没有摄像头，显示绑定引导界面
                recyclerView.visibility = View.GONE
                bindingGuideLayout.visibility = View.VISIBLE
            }
        }
    }
    
    private fun showBindingGuide() {
        recyclerView.visibility = View.GONE
        bindingGuideLayout.visibility = View.VISIBLE
    }
}