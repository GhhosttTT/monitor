package com.monitorapp.data

import com.monitorapp.network.ApiClient
import com.monitorapp.network.ApiService
import com.monitorapp.ui.camera.CameraItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * 摄像头数据仓库，管理已配对的摄像头
 */
class CameraRepository private constructor(private val apiClient: ApiClient) {
    private val apiService: ApiService = apiClient.getApiService()
    private val localCameras = mutableMapOf<String, CameraItem>()
    
    companion object {
        @Volatile
        private var INSTANCE: CameraRepository? = null

        fun getInstance(apiClient: ApiClient): CameraRepository {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: CameraRepository(apiClient).also { INSTANCE = it }
            }
        }
    }

    /**
     * 从服务器获取所有已配对的摄像头
     */
    suspend fun fetchCamerasFromServer(): List<CameraItem>? {
        return withContext(Dispatchers.IO) {
            try {
                val token = apiClient.getToken() ?: return@withContext null
                val response = apiService.getCameras("Bearer $token")
                if (response.isSuccessful) {
                    val cameras = response.body()
                    // 更新本地缓存
                    cameras?.forEach { camera: CameraItem ->
                        localCameras[camera.id] = camera
                    }
                    cameras
                } else {
                    null
                }
            } catch (e: Exception) {
                e.printStackTrace()
                // 网络不可用时返回本地缓存数据
                localCameras.values.toList()
            }
        }
    }

    /**
     * 添加摄像头到服务器
     */
    suspend fun addCameraToServer(name: String, serialNumber: String): CameraItem? {
        return withContext(Dispatchers.IO) {
            try {
                val token = apiClient.getToken() ?: return@withContext null
                val cameraRequest = com.monitorapp.network.CameraRequest(name, serialNumber)
                val response = apiService.addCamera("Bearer $token", cameraRequest)
                if (response.isSuccessful) {
                    val camera = response.body()
                    // 更新本地缓存
                    camera?.let { cameraItem: CameraItem ->
                        localCameras[cameraItem.id] = cameraItem
                    }
                    camera
                } else {
                    null
                }
            } catch (e: Exception) {
                e.printStackTrace()
                // 网络不可用时添加到本地缓存
                val localCamera = CameraItem(
                    id = System.currentTimeMillis().toString(),
                    name = name,
                    status = "离线",
                    isOnline = false,
                    serialNumber = serialNumber
                )
                localCameras[localCamera.id] = localCamera
                localCamera
            }
        }
    }

    /**
     * 从服务器删除摄像头
     */
    suspend fun removeCameraFromServer(cameraId: String): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val token = apiClient.getToken() ?: return@withContext false
                val response = apiService.deleteCamera("Bearer $token", cameraId)
                if (response.isSuccessful) {
                    // 从本地缓存中移除
                    localCameras.remove(cameraId)
                    true
                } else {
                    false
                }
            } catch (e: Exception) {
                e.printStackTrace()
                // 网络不可用时从本地缓存中移除
                localCameras.remove(cameraId)
                true
            }
        }
    }
    
    /**
     * 获取本地缓存的摄像头列表
     */
    fun getLocalCameras(): List<CameraItem> {
        return localCameras.values.toList()
    }
    
    /**
     * 检查是否有本地缓存的摄像头
     */
    fun hasLocalCameras(): Boolean {
        return localCameras.isNotEmpty()
    }
}