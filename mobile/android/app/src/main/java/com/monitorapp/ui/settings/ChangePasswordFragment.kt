package com.monitorapp.ui.settings

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.NavController
import androidx.navigation.fragment.findNavController
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.monitorapp.R
import com.monitorapp.data.UserRepository
import com.monitorapp.network.ApiClient
import kotlinx.coroutines.launch

class ChangePasswordFragment : Fragment() {

    private lateinit var currentPasswordInput: TextInputEditText
    private lateinit var newPasswordInput: TextInputEditText
    private lateinit var confirmPasswordInput: TextInputEditText
    private lateinit var submitButton: MaterialButton
    private lateinit var cancelButton: MaterialButton
    private lateinit var userRepository: UserRepository
    private lateinit var navController: NavController
    
    companion object {
        private const val TAG = "ChangePasswordFragment"
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val root = inflater.inflate(R.layout.fragment_change_password, container, false)
        Log.d(TAG, "onCreateView: 创建更改密码页面")

        // 初始化数据仓库
        val apiClient = ApiClient.getInstance(requireContext())
        userRepository = UserRepository.getInstance(apiClient)

        // 初始化视图组件
        currentPasswordInput = root.findViewById(R.id.edit_current_password)
        newPasswordInput = root.findViewById(R.id.edit_new_password)
        confirmPasswordInput = root.findViewById(R.id.edit_confirm_password)
        submitButton = root.findViewById(R.id.btn_submit)
        cancelButton = root.findViewById(R.id.btn_cancel)
        
        Log.d(TAG, "onCreateView: 视图组件初始化完成")

        // 设置按钮点击事件
        submitButton.setOnClickListener {
            Log.d(TAG, "提交按钮被点击")
            handleChangePassword()
        }

        cancelButton.setOnClickListener {
            Log.d(TAG, "取消按钮被点击")
            handleBackPressed()
        }
        
        Log.d(TAG, "onCreateView: 按钮点击监听器设置完成")

        return root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        Log.d(TAG, "onViewCreated: 视图创建完成")
        
        // 初始化NavController
        navController = findNavController()
        Log.d(TAG, "onViewCreated: 当前目的地ID=${navController.currentDestination?.id}, 标签=${navController.currentDestination?.label}")
        
        // 检查按钮是否正确获取
        Log.d(TAG, "onViewCreated: submitButton=${submitButton != null}, cancelButton=${cancelButton != null}")
        
        // 处理返回键事件
        val callback = object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                Log.d(TAG, "系统返回键被按下")
                handleBackPressed()
            }
        }
        requireActivity().onBackPressedDispatcher.addCallback(viewLifecycleOwner, callback)
        
        // 不再需要手动设置ActionBar，因为MainActivity中已经使用了setupActionBarWithNavController
    }

    private fun handleBackPressed() {
        Log.d(TAG, "handleBackPressed: 开始处理返回操作")
        try {
            // 获取当前目的地和返回后的目的地信息
            val currentDestination = navController.currentDestination
            Log.d(TAG, "handleBackPressed: 当前页面 - ID=${currentDestination?.id}, 标签=${currentDestination?.label}")
            
            val result = navController.navigateUp()
            if (result) {
                val newDestination = navController.currentDestination
                Log.d(TAG, "handleBackPressed: 导航返回成功 - 返回后页面ID=${newDestination?.id}, 标签=${newDestination?.label}")
            } else {
                Log.d(TAG, "handleBackPressed: 导航返回失败，可能已在起始页面")
            }
        } catch (e: Exception) {
            Log.e(TAG, "handleBackPressed: 导航返回异常", e)
        }
    }

    private fun handleChangePassword() {
        val currentPassword = currentPasswordInput.text.toString()
        val newPassword = newPasswordInput.text.toString()
        val confirmPassword = confirmPasswordInput.text.toString()
        
        Log.d(TAG, "handleChangePassword: 开始处理密码更改，当前密码长度: ${currentPassword.length}, 新密码长度: ${newPassword.length}")

        // 验证输入
        if (currentPassword.isEmpty() || newPassword.isEmpty() || confirmPassword.isEmpty()) {
            Log.d(TAG, "handleChangePassword: 输入验证失败，有字段为空")
            Toast.makeText(context, "请填写所有字段", Toast.LENGTH_SHORT).show()
            return
        }

        if (newPassword != confirmPassword) {
            Log.d(TAG, "handleChangePassword: 新密码和确认密码不匹配")
            Toast.makeText(context, "新密码和确认密码不匹配", Toast.LENGTH_SHORT).show()
            return
        }

        if (newPassword.length < 6) {
            Log.d(TAG, "handleChangePassword: 密码长度不足6位")
            Toast.makeText(context, "密码长度至少为6位", Toast.LENGTH_SHORT).show()
            return
        }

        // 执行更改密码操作
        lifecycleScope.launch {
            performChangePassword(currentPassword, newPassword)
        }
    }

    private suspend fun performChangePassword(currentPassword: String, newPassword: String) {
        Log.d(TAG, "performChangePassword: 开始执行密码更改")
        submitButton.isEnabled = false
        submitButton.text = "提交中..."

        try {
            val result = userRepository.changePassword(currentPassword, newPassword)
            if (result.isSuccess) {
                Log.d(TAG, "performChangePassword: 密码更改成功")
                Toast.makeText(context, "密码更改成功", Toast.LENGTH_SHORT).show()
                // 返回设置页面
                handleBackPressed()
            } else {
                val errorMessage = "更改密码失败: ${result.exceptionOrNull()?.message}"
                Log.e(TAG, "performChangePassword: 密码更改失败 - $errorMessage")
                Toast.makeText(context, errorMessage, Toast.LENGTH_LONG).show()
            }
        } catch (e: Exception) {
            val errorMessage = "更改密码过程中出现错误: ${e.message}"
            Log.e(TAG, "performChangePassword: 密码更改异常 - $errorMessage", e)
            Toast.makeText(context, errorMessage, Toast.LENGTH_LONG).show()
        } finally {
            submitButton.isEnabled = true
            submitButton.text = "提交"
            Log.d(TAG, "performChangePassword: 密码更改流程结束")
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        Log.d(TAG, "onDestroyView: 页面销毁")
    }
}