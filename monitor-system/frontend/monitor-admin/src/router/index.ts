import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import UserManagement from '../views/UserManagement.vue'
import SystemMonitor from '../views/SystemMonitor.vue'
import LoginView from '../views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/users',
      name: 'users',
      component: UserManagement,
    },
    {
      path: '/system',
      name: 'system',
      component: SystemMonitor,
    },
  ],
})

// 添加路由守卫
router.beforeEach((to, from, next) => {
  // 检查是否有token
  const token = localStorage.getItem('admin-token')
  
  // 如果访问的不是登录页且没有token，重定向到登录页
  if (to.name !== 'login' && !token) {
    next({ name: 'login' })
  } else {
    next()
  }
})

export default router