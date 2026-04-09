package com.monitorapp.ui.auth

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.monitorapp.R
import com.monitorapp.data.UserRepository
import com.monitorapp.network.ApiClient
import kotlinx.coroutines.launch

class LoginFragment : Fragment() {

    private lateinit var emailInput: TextInputEditText
    private lateinit var passwordInput: TextInputEditText
    private lateinit var loginButton: MaterialButton
    private lateinit var registerButton: MaterialButton
    private lateinit var userRepository: UserRepository

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val root = inflater.inflate(R.layout.fragment_login, container, false)
        
        // 初始化数据仓库
        val apiClient = ApiClient.getInstance(requireContext())
        userRepository = UserRepository.getInstance(apiClient)
        
        emailInput = root.findViewById(R.id.email_input)
        passwordInput = root.findViewById(R.id.password_input)
        loginButton = root.findViewById(R.id.login_button)
        registerButton = root.findViewById(R.id.register_button)
        
        loginButton.setOnClickListener {
            val email = emailInput.text.toString().trim()
            val password = passwordInput.text.toString()
            
            if (email.isNotEmpty() && password.isNotEmpty()) {
                lifecycleScope.launch {
                    performLogin(email, password)
                }
            } else {
                Toast.makeText(context, "请填写所有字段", Toast.LENGTH_SHORT).show()
                Log.d("LoginFragment", "请填写所有字段")
            }
        }
        
        registerButton.setOnClickListener {
            // 导航到注册页面
            findNavController().navigate(R.id.navigation_register)
        }
        
        return root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        // 隐藏底部导航栏
        activity?.findViewById<View>(R.id.nav_view)?.visibility = View.GONE
        
        // 隐藏ActionBar
        (activity as? com.monitorapp.MainActivity)?.supportActionBar?.hide()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        // 显示底部导航栏
        activity?.findViewById<View>(R.id.nav_view)?.visibility = View.VISIBLE
        
        // 显示ActionBar
        (activity as? com.monitorapp.MainActivity)?.supportActionBar?.show()
    }

    private suspend fun performLogin(email: String, password: String) {
        loginButton.isEnabled = false
        loginButton.text = "登录中..."
        Log.d("LoginFragment", "开始登录: $email")
        
        try {
            val result = userRepository.login(email, password)
            if (result.isSuccess) {
                Log.d("LoginFragment", "登录成功")
                Toast.makeText(context, "登录成功", Toast.LENGTH_SHORT).show()
                // 导航到主界面
                findNavController().navigate(R.id.navigation_cameras)
            } else {
                // 显示统一的错误信息"账号或者密码错误"
                val errorMessage = "账号或者密码错误"
                Log.e("LoginFragment", errorMessage)
                Toast.makeText(context, errorMessage, Toast.LENGTH_LONG).show()
            }
        } catch (e: Exception) {
            val errorMessage = "登录过程中出现错误: ${e.message}"
            Log.e("LoginFragment", errorMessage, e)
            Toast.makeText(context, errorMessage, Toast.LENGTH_LONG).show()
        } finally {
            loginButton.isEnabled = true
            loginButton.text = "登录"
        }
    }
}