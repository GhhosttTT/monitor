package com.monitorapp.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.monitorapp.services.NotificationService

class AlertReceiver : BroadcastReceiver() {
    
    companion object {
        const val ACTION_MOTION_DETECTED = "com.monitorapp.MOTION_DETECTED"
        const val ACTION_CAMERA_OFFLINE = "com.monitorapp.CAMERA_OFFLINE"
        const val ACTION_STORAGE_WARNING = "com.monitorapp.STORAGE_WARNING"
        
        const val EXTRA_CAMERA_NAME = "camera_name"
        const val EXTRA_TIMESTAMP = "timestamp"
        const val EXTRA_USAGE_PERCENT = "usage_percent"
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        val notificationService = NotificationService(context)
        
        when (intent.action) {
            ACTION_MOTION_DETECTED -> {
                val cameraName = intent.getStringExtra(EXTRA_CAMERA_NAME) ?: "未知摄像头"
                val timestamp = intent.getStringExtra(EXTRA_TIMESTAMP) ?: "未知时间"
                notificationService.sendMotionDetectionAlert(cameraName, timestamp)
            }
            
            ACTION_CAMERA_OFFLINE -> {
                val cameraName = intent.getStringExtra(EXTRA_CAMERA_NAME) ?: "未知摄像头"
                notificationService.sendOfflineAlert(cameraName)
            }
            
            ACTION_STORAGE_WARNING -> {
                val cameraName = intent.getStringExtra(EXTRA_CAMERA_NAME) ?: "未知摄像头"
                val usagePercent = intent.getIntExtra(EXTRA_USAGE_PERCENT, 0)
                notificationService.sendStorageAlert(cameraName, usagePercent)
            }
        }
    }
}