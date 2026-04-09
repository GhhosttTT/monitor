package com.monitorapp.ui.camera

data class CameraItem(
    val id: String,
    val name: String,
    val status: String,
    val isOnline: Boolean,
    val serialNumber: String? = null
)