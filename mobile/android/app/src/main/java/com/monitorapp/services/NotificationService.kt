package com.monitorapp.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.monitorapp.MainActivity
import com.monitorapp.R

class NotificationService(private val context: Context) {
    
    companion object {
        private const val CHANNEL_ID = "camera_alerts"
        private const val CHANNEL_NAME = "摄像头警报"
        private const val CHANNEL_DESCRIPTION = "摄像头报警和事件通知"
    }
    
    init {
        createNotificationChannel()
    }
    
    private fun createNotificationChannel() {
        // 创建通知渠道（Android 8.0及以上版本需要）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESCRIPTION
            }
            
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    fun sendMotionDetectionAlert(cameraName: String, timestamp: String) {
        val contentText = "摄像头 $cameraName 在 $timestamp 检测到移动"
        showNotification("移动侦测警报", contentText)
    }
    
    fun sendOfflineAlert(cameraName: String) {
        val contentText = "摄像头 $cameraName 已离线"
        showNotification("设备离线通知", contentText)
    }
    
    fun sendStorageAlert(cameraName: String, usagePercent: Int) {
        val contentText = "摄像头 $cameraName 存储空间已使用 ${usagePercent}%"
        showNotification("存储空间警告", contentText)
    }
    
    private fun showNotification(title: String, content: String) {
        // 创建点击通知时要启动的Intent
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        
        val pendingIntent = PendingIntent.getActivity(
            context, 0, intent, 
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        
        // 构建通知
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_camera) // 使用摄像头图标作为通知小图标
            .setContentTitle(title)
            .setContentText(content)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
        
        // 显示通知前检查权限
        val notificationManager = NotificationManagerCompat.from(context)
        if (notificationManager.areNotificationsEnabled()) {
            try {
                notificationManager.notify(System.currentTimeMillis().toInt(), builder.build())
            } catch (e: SecurityException) {
                // 处理可能的权限异常
                e.printStackTrace()
            }
        }
    }
}