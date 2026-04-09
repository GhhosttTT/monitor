package com.monitorapp.ui.history

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.monitorapp.R
import com.monitorapp.data.CameraRepository
import com.monitorapp.ui.history.HistoryItem
import com.monitorapp.network.ApiClient
import kotlinx.coroutines.launch

class HistoryFragment : Fragment() {

    private lateinit var cameraRepository: CameraRepository
    private lateinit var historyRecyclerView: RecyclerView
    private lateinit var emptyStateLayout: View
    private lateinit var historyAdapter: HistoryAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val root = inflater.inflate(R.layout.fragment_history, container, false)
        
        // 初始化数据仓库
        val apiClient = ApiClient.getInstance(requireContext())
        cameraRepository = CameraRepository.getInstance(apiClient)
        
        historyRecyclerView = root.findViewById(R.id.history_recycler_view)
        historyRecyclerView.layoutManager = LinearLayoutManager(requireContext())
        
        emptyStateLayout = root.findViewById(R.id.no_history_card)
        
        // 检查是否有配对的摄像头
        lifecycleScope.launch {
            updateHistoryView()
        }
        
        return root
    }
    
    override fun onResume() {
        super.onResume()
        // 当返回此页面时，刷新视图
        lifecycleScope.launch {
            updateHistoryView()
        }
    }

    private suspend fun updateHistoryView() {
        Log.d("HistoryFragment", "更新历史记录视图")
        // 检查是否有配对的摄像头
        val cameras = cameraRepository.fetchCamerasFromServer()
        
        if (cameras.isNullOrEmpty()) {
            Log.d("HistoryFragment", "没有配对的摄像头，显示空状态")
            // 没有配对的摄像头，显示空状态
            showEmptyState()
        } else {
            Log.d("HistoryFragment", "发现${cameras.size}个摄像头，显示历史记录")
            // 有配对的摄像头，显示历史记录
            showHistoryData()
        }
    }

    private fun showEmptyState() {
        // 显示空状态，提示用户先绑定摄像头
        emptyStateLayout.visibility = View.VISIBLE
        historyRecyclerView.visibility = View.GONE
        Log.d("HistoryFragment", "显示空状态视图")
    }

    private fun showHistoryData() {
        emptyStateLayout.visibility = View.GONE
        historyRecyclerView.visibility = View.VISIBLE
        
        // 从服务器获取历史记录数据
        lifecycleScope.launch {
            try {
                val token = ApiClient.getInstance(requireContext()).getToken()
                if (token != null) {
                    // 这里应该调用获取视频历史记录的API
                    // 暂时使用示例数据
                    val historyItems = createSampleHistoryData()
                    historyAdapter = HistoryAdapter(historyItems) { historyItem ->
                        // 点击历史记录项，跳转到视频播放页面
                        playHistoryVideo(historyItem)
                    }
                    historyRecyclerView.adapter = historyAdapter
                    Log.d("HistoryFragment", "显示${historyItems.size}条历史记录")
                } else {
                    val message = "未登录，请先登录"
                    Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                    Log.d("HistoryFragment", message)
                }
            } catch (e: Exception) {
                val errorMessage = "获取历史记录失败: ${e.message}"
                Log.e("HistoryFragment", errorMessage, e)
                Toast.makeText(context, errorMessage, Toast.LENGTH_LONG).show()
                // 出错时显示示例数据
                val historyItems = createSampleHistoryData()
                historyAdapter = HistoryAdapter(historyItems) { historyItem ->
                    playHistoryVideo(historyItem)
                }
                historyRecyclerView.adapter = historyAdapter
                Log.d("HistoryFragment", "显示示例历史记录，数量: ${historyItems.size}")
            }
        }
    }

    private fun playHistoryVideo(historyItem: HistoryItem) {
        try {
            // 实际项目中会从服务器获取真实的视频URL
            val videoUrl = "http://127.0.0.1:5001/api/videos/${historyItem.cameraName}/stream"
            Log.d("HistoryFragment", "播放历史视频: $videoUrl")
            
            // 使用NavController导航到视频播放页面
            val bundle = Bundle()
            bundle.putString("video_url", videoUrl)
            bundle.putBoolean("is_live_stream", false)
            // findNavController().navigate(R.id.navigation_player, bundle) // 注释掉导航相关代码
        } catch (e: Exception) {
            // 处理可能的异常
            val errorMessage = "播放视频失败: ${e.message}"
            Log.e("HistoryFragment", errorMessage, e)
            e.printStackTrace()
            Toast.makeText(context, errorMessage, Toast.LENGTH_LONG).show()
        }
    }

    private fun createSampleHistoryData(): List<HistoryItem> {
        // 实际项目中这里会从服务器获取历史记录数据
        val sampleData = listOf(
            HistoryItem("2025-10-28 14:30", "客厅摄像头", "10分钟", "正常"),
            HistoryItem("2025-10-28 12:15", "大门摄像头", "5分钟", "正常"),
            HistoryItem("2025-10-28 09:45", "车库摄像头", "15分钟", "正常"),
            HistoryItem("2025-10-27 18:20", "客厅摄像头", "8分钟", "正常"),
            HistoryItem("2025-10-27 15:10", "大门摄像头", "12分钟", "正常"),
            HistoryItem("2025-10-27 11:30", "车库摄像头", "7分钟", "正常")
        )
        Log.d("HistoryFragment", "创建示例历史数据，数量: ${sampleData.size}")
        return sampleData
    }
}