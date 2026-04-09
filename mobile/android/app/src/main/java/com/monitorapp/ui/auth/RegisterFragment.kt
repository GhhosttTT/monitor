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

class RegisterFragment : Fragment() {

    private lateinit var usernameInput: TextInputEditText
    private lateinit var emailInput: TextInputEditText
    private lateinit var passwordInput: TextInputEditText
    private lateinit var registerButton: MaterialButton
    private lateinit var loginButton: MaterialButton
    private lateinit var userRepository: UserRepository

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val root = inflater.inflate(R.layout.fragment_register, container, false)
        
        // 初始化数据仓库
        val apiClient = ApiClient.getInstance(requireContext())
        userRepository = UserRepository.getInstance(apiClient)
        
        usernameInput = root.findViewById(R.id.username_input)
        emailInput = root.findViewById(R.id.email_input)
        passwordInput = root.findViewById(R.id.password_input)
        registerButton = root.findViewById(R.id.register_button)
        loginButton = root.findViewById(R.id.login_button)
        
        registerButton.setOnClickListener {
            val username = usernameInput.text.toString().trim()
            val email = emailInput.text.toString().trim()
            val password = passwordInput.text.toString()
            
            if (username.isNotEmpty() && email.isNotEmpty() && password.isNotEmpty()) {
                lifecycleScope.launch {
                    performRegistration(username, email, password)
                }
            } else {
                Toast.makeText(context, "请填写所有字段", Toast.LENGTH_SHORT).show()
                Log.d("RegisterFragment", "请填写所有字段")
            }
        }
        
        loginButton.setOnClickListener {
            findNavController().navigate(R.id.navigation_login)
        }
        
        return root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        // 隐藏底部导航栏
        activity?.findViewById<View>(R.id.nav_view)?.visibility = View.GONE
    }

    override fun onDestroyView() {
        super.onDestroyView()
        // 显示底部导航栏
        activity?.findViewById<View>(R.id.nav_view)?.visibility = View.VISIBLE
    }

    private suspend fun performRegistration(username: String, email: String, password: String) {
        registerButton.isEnabled = false
        registerButton.text = "注册中..."
        Log.d("RegisterFragment", "开始注册: $username, $email")
        
        try {
            val result = userRepository.register(username, email, password)
            if (result.isSuccess) {
                Log.d("RegisterFragment", "注册成功")
                Toast.makeText(context, "注册成功", Toast.LENGTH_SHORT).show()
                // 导航到主界面
                findNavController().navigate(R.id.navigation_cameras)
            } else {
                val errorMessage = "注册失败: ${result.exceptionOrNull()?.message}"
                Log.e("RegisterFragment", errorMessage)
                Toast.makeText(context, errorMessage, Toast.LENGTH_LONG).show()
            }
        } catch (e: Exception) {
            val errorMessage = "注册过程中出现错误: ${e.message}"
            Log.e("RegisterFragment", errorMessage, e)
            Toast.makeText(context, errorMessage, Toast.LENGTH_LONG).show()
        } finally {
            registerButton.isEnabled = true
            registerButton.text = "注册"
        }
    }
}