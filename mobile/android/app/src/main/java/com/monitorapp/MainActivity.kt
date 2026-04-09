package com.monitorapp

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.navigation.NavController
import androidx.navigation.NavDestination
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.AppBarConfiguration
import androidx.navigation.ui.setupActionBarWithNavController
import androidx.navigation.ui.setupWithNavController
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.monitorapp.data.UserRepository
import com.monitorapp.network.ApiClient
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    
    companion object {
        private const val TAG = "MainActivity"
        private const val REQUEST_NOTIFICATION_PERMISSION = 1
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        val navView: BottomNavigationView = findViewById(R.id.nav_view)
        
        // 使用NavHostFragment获取NavController，这是一种更可靠的方法
        val navHostFragment = supportFragmentManager.findFragmentById(R.id.nav_host_fragment_activity_main) as NavHostFragment
        val navController: NavController = navHostFragment.navController

        // 设置ActionBar
        setSupportActionBar(findViewById(R.id.toolbar))
        
        // Passing each menu ID as a set of Ids because each
        // menu should be considered as top level destinations.
        val appBarConfiguration = AppBarConfiguration(
            setOf(
                R.id.navigation_cameras, R.id.navigation_history,
                R.id.navigation_player, R.id.navigation_settings
            )
        )
        setupActionBarWithNavController(navController, appBarConfiguration)
        navView.setupWithNavController(navController)
        
        // 注册导航监听器，检查用户认证状态
        navController.addOnDestinationChangedListener { _, destination, _ ->
            checkUserAuth(destination)
            // 控制底部导航栏的显示/隐藏
            controlBottomNavigationVisibility(destination, navView)
        }
        
        // 检查用户登录状态
        checkUserLoginStatus()
    }
    
    private fun controlBottomNavigationVisibility(destination: NavDestination, navView: BottomNavigationView) {
        // 定义需要隐藏底部导航栏的页面
        val hideNavDestinations = setOf(
            R.id.navigation_login,
            R.id.navigation_register
        )
        
        // 根据当前目的地决定是否显示底部导航栏
        if (hideNavDestinations.contains(destination.id)) {
            navView.visibility = View.GONE
        } else {
            navView.visibility = View.VISIBLE
        }
    }
    
    private fun checkUserAuth(destination: NavDestination) {
        val apiClient = ApiClient.getInstance(this)
        val userRepository = UserRepository.getInstance(apiClient)
        
        // 定义不需要登录的页面
        val nonAuthDestinations = setOf(
            R.id.navigation_login,
            R.id.navigation_register
        )
        
        // 如果目标页面需要认证但用户未登录，则跳转到登录页面
        if (!nonAuthDestinations.contains(destination.id) && !userRepository.isLoggedIn()) {
            try {
                val navHostFragment = supportFragmentManager.findFragmentById(R.id.nav_host_fragment_activity_main) as NavHostFragment
                val navController: NavController = navHostFragment.navController
                navController.navigate(R.id.navigation_login)
            } catch (e: Exception) {
                // 忽略导航异常
            }
        }
    }
    
    private fun checkUserLoginStatus() {
        lifecycleScope.launch {
            val apiClient = ApiClient.getInstance(this@MainActivity)
            val userRepository = UserRepository.getInstance(apiClient)
            
            if (!userRepository.isLoggedIn()) {
                // 如果用户未登录，导航到登录页面
                try {
                    val navHostFragment = supportFragmentManager.findFragmentById(R.id.nav_host_fragment_activity_main) as NavHostFragment
                    val navController: NavController = navHostFragment.navController
                    // 检查当前目的地是否已经是登录页面，避免重复导航
                    if (navController.currentDestination?.id != R.id.navigation_login) {
                        navController.navigate(R.id.navigation_login)
                    }
                } catch (e: Exception) {
                    // 忽略导航异常
                }
            }
        }
    }
    
    override fun onSupportNavigateUp(): Boolean {
        val navHostFragment = supportFragmentManager.findFragmentById(R.id.nav_host_fragment_activity_main) as NavHostFragment
        val navController: NavController = navHostFragment.navController
        return navController.navigateUp() || super.onSupportNavigateUp()
    }
}