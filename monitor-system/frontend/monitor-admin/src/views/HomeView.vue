<template>
  <div class="home">
    <el-card class="welcome-card">
      <template #header>
        <div class="card-header">
          <h1>欢迎使用智能监控系统管理后台</h1>
        </div>
      </template>
      <div class="content">
        <p>这是一个现代化的管理系统，包含以下功能模块：</p>
        <ul>
          <li><strong>仪表板</strong> - 系统概览和统计数据</li>
          <li><strong>用户管理</strong> - 管理系统用户和权限</li>
          <li><strong>摄像头管理</strong> - 管理监控设备</li>
          <li><strong>视频管理</strong> - 管理录制视频</li>
          <li><strong>系统监控</strong> - 监控系统运行状态</li>
        </ul>
        <el-alert
          title="提示"
          type="info"
          description="请使用顶部导航菜单访问各个功能模块"
          show-icon
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
// 这是一个简单的欢迎页面
</script>

<style scoped>
.home {
  padding: 20px;
  min-height: 100%;
  width: 100%;
  box-sizing: border-box;
}

.welcome-card {
  max-width: none;
  margin: 0;
  width: 100%;
  box-sizing: border-box;
}

.card-header h1 {
  margin: 0;
  font-size: 24px;
  color: #303133;
  text-align: center;
}

.content {
  padding: 20px;
}

.content p {
  font-size: 16px;
  color: #606266;
  margin-bottom: 15px;
}

.content ul {
  margin: 20px 0;
  padding-left: 20px;
}

.content li {
  margin-bottom: 10px;
  color: #606266;
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .home {
    padding: 10px;
  }
  
  .content {
    padding: 10px;
  }
  
  .card-header h1 {
    font-size: 20px;
  }
}
</style>