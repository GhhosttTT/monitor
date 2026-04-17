import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0', // 允许外部访问
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5002',
        changeOrigin: true,
        secure: false
      },
      // 只代理视频文件请求（带文件扩展名），不代理 /videos 路由
      '/videos/.*\\.(mp4|avi|mkv|mov)$': {
        target: process.env.VITE_API_URL || 'http://localhost:5002',
        changeOrigin: true,
        secure: false
      }
    }
  },
  // SPA路由支持 - 所有路由都返回index.html,由React Router处理
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})
