package com.monitorapp.ui.settings

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.navigation.findNavController
import androidx.navigation.fragment.findNavController
import com.google.android.material.button.MaterialButton
import com.google.android.material.switchmaterial.SwitchMaterial
import com.monitorapp.MainActivity
import com.monitorapp.R
import com.monitorapp.data.UserRepository
import com.monitorapp.network.ApiClient

class SettingsFragment : Fragment() {
    
    private lateinit var notificationSwitch: SwitchMaterial
    private lateinit var changePasswordButton: MaterialButton
    private lateinit var logoutButton: MaterialButton
    private lateinit var sharedPreferences: android.content.SharedPreferences
    private lateinit var userRepository: UserRepository

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val root = inflater.inflate(R.layout.fragment_settings, container, false)
        
        // 初始化视图组件
        notificationSwitch = root.findViewById(R.id.switch_notifications)
        changePasswordButton = root.findViewById(R.id.btn_change_password)
        logoutButton = root.findViewById(R.id.btn_logout)
        
        // 初始化SharedPreferences
        sharedPreferences = requireContext().getSharedPreferences("monitor_app_settings", android.content.Context.MODE_PRIVATE)
        
        // 初始化用户仓库
        val apiClient = ApiClient.getInstance(requireContext())
        userRepository = UserRepository.getInstance(apiClient)
        
        // 加载设置
        loadSettings()
        
        // 设置监听器
        setupListeners()
        
        // 设置注销按钮点击事件
        logoutButton.setOnClickListener {
            performLogout()
        }
        
        return root
    }
    
    private fun loadSettings() {
        // 从SharedPreferences加载设置
        notificationSwitch.isChecked = sharedPreferences.getBoolean("notifications_enabled", true)
    }
    
    private fun setupListeners() {
        // 通知开关监听器
        notificationSwitch.setOnCheckedChangeListener { _, isChecked ->
            saveSetting("notifications_enabled", isChecked)
        }
        
        // 更改密码按钮
        changePasswordButton.setOnClickListener {
            // 导航到更改密码界面
            findNavController().navigate(R.id.navigation_change_password)
        }
    }
    
    private fun saveSetting(key: String, value: Any) {
        val editor = sharedPreferences.edit()
        when (value) {
            is Boolean -> editor.putBoolean(key, value)
            is Float -> editor.putFloat(key, value)
            is String -> editor.putString(key, value)
            is Int -> editor.putInt(key, value)
        }
        editor.apply()
    }
    
    private fun performLogout() {
        // 执行注销操作
        userRepository.logout()
        
        // 跳转到登录页面
        val intent = Intent(activity, MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        
        // 显示注销成功提示
        Toast.makeText(context, "您已成功注销", Toast.LENGTH_SHORT).show()
    }
}