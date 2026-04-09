package com.monitorapp.data

import com.monitorapp.network.ApiClient
import com.monitorapp.network.ApiService
import com.monitorapp.network.ChangePasswordRequest
import com.monitorapp.network.LoginRequest
import com.monitorapp.network.RegisterRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class UserRepository private constructor(private val apiClient: ApiClient) {
    private val apiService: ApiService = apiClient.getApiService()
    
    companion object {
        @Volatile
        private var INSTANCE: UserRepository? = null

        fun getInstance(apiClient: ApiClient): UserRepository {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: UserRepository(apiClient).also { INSTANCE = it }
            }
        }
    }

    /**
     * 用户登录
     */
    suspend fun login(email: String, password: String): Result<Boolean> {
        return withContext(Dispatchers.IO) {
            try {
                val loginRequest = LoginRequest(email, password)
                val response = apiService.login(loginRequest)
                if (response.isSuccessful) {
                    val authResponse = response.body()
                    authResponse?.token?.let { token: String ->
                        apiClient.saveToken(token)
                    }
                    Result.success(true)
                } else {
                    Result.failure(Exception("登录失败: ${response.message()}"))
                }
            } catch (e: Exception) {
                e.printStackTrace()
                Result.failure<Boolean>(e)
            }
        }
    }

    /**
     * 用户注册
     */
    suspend fun register(username: String, email: String, password: String): Result<Boolean> {
        return withContext(Dispatchers.IO) {
            try {
                val registerRequest = RegisterRequest(username, email, password)
                val response = apiService.register(registerRequest)
                if (response.isSuccessful) {
                    val authResponse = response.body()
                    authResponse?.token?.let { token: String ->
                        apiClient.saveToken(token)
                    }
                    Result.success(true)
                } else {
                    Result.failure(Exception("注册失败: ${response.message()}"))
                }
            } catch (e: Exception) {
                e.printStackTrace()
                Result.failure<Boolean>(e)
            }
        }
    }

    /**
     * 更改密码
     */
    suspend fun changePassword(currentPassword: String, newPassword: String): Result<Boolean> {
        return withContext(Dispatchers.IO) {
            try {
                val token = apiClient.getToken()
                if (token == null) {
                    Result.failure(Exception("用户未登录"))
                } else {
                    val request = ChangePasswordRequest(currentPassword, newPassword)
                    val response = apiService.changePassword("Bearer $token", request)
                    if (response.isSuccessful) {
                        Result.success(true)
                    } else {
                        Result.failure(Exception("更改密码失败: ${response.message()}"))
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                Result.failure<Boolean>(e)
            }
        }
    }

    /**
     * 检查用户是否已登录
     */
    fun isLoggedIn(): Boolean {
        return apiClient.isLoggedIn()
    }

    /**
     * 登出用户
     */
    fun logout() {
        apiClient.clearToken()
    }
}