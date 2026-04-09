package com.monitorapp.network

import com.monitorapp.ui.camera.CameraItem
import retrofit2.Response


import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

data class LoginRequest(
    val email: String,
    val password: String
)

data class RegisterRequest(
    val username: String,
    val email: String,
    val password: String
)

data class AuthResponse(
    val token: String,
    val user: User
)

data class User(
    val id: Int,
    val username: String,
    val email: String,
    val role: String
)

data class CameraRequest(
    val name: String,
    val serialNumber: String
)

data class ChangePasswordRequest(
    val currentPassword: String,
    val newPassword: String
)

interface ApiService {
    @POST("/api/auth/login")
    suspend fun login(@Body loginRequest: LoginRequest): Response<AuthResponse>

    @POST("/api/auth/register")
    suspend fun register(@Body registerRequest: RegisterRequest): Response<AuthResponse>

    @GET("/api/auth/me")
    suspend fun getCurrentUser(@Header("Authorization") token: String): Response<User>

    @POST("/api/auth/change-password")
    suspend fun changePassword(
        @Header("Authorization") token: String,
        @Body request: ChangePasswordRequest
    ): Response<Unit>

    @GET("/api/cameras")
    suspend fun getCameras(@Header("Authorization") token: String): Response<List<CameraItem>>

    @POST("/api/cameras")
    suspend fun addCamera(
        @Header("Authorization") token: String,
        @Body cameraRequest: CameraRequest
    ): Response<CameraItem>

    @PUT("/api/cameras/{id}")
    suspend fun updateCamera(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Body cameraRequest: CameraRequest
    ): Response<CameraItem>

    @DELETE("/api/cameras/{id}")
    suspend fun deleteCamera(
        @Header("Authorization") token: String,
        @Path("id") id: String
    ): Response<Unit>
}