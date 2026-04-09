<template>
  <div id="app">
    <header v-if="$route.name !== 'login'">
      <h1>智能监控系统管理后台</h1>
      <nav>
        <router-link to="/">首页</router-link>
        <router-link to="/users">用户管理</router-link>
        <router-link to="/system">系统监控</router-link>
      </nav>
    </header>
    <main>
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
// 简单的App组件
</script>

<style scoped>
#app {
  min-height: 100vh;
  padding: 0;
  margin: 0;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
  width: 100%;
}

header {
  background-color: #304156;
  color: white;
  padding: 20px;
  margin-bottom: 0;
  width: 100%;
  box-sizing: border-box;
}

header h1 {
  margin: 0 0 15px 0;
  font-size: 24px;
}

nav {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

nav a {
  color: #bfcbd9;
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 4px;
  transition: all 0.3s;
}

nav a:hover,
nav a.router-link-active {
  background-color: #409eff;
  color: white;
}

main {
  padding: 20px;
  background-color: #f5f7fa;
  min-height: calc(100vh - 120px);
  width: 100%;
  box-sizing: border-box;
}

/* 响应式设计 */
@media (max-width: 768px) {
  header {
    padding: 15px 10px;
  }
  
  header h1 {
    font-size: 20px;
  }
  
  nav {
    gap: 10px;
  }
  
  main {
    padding: 10px;
  }
}

@media (max-width: 480px) {
  header {
    padding: 10px 5px;
  }
  
  nav {
    flex-direction: column;
    gap: 5px;
  }
  
  nav a {
    padding: 6px 12px;
  }
}
</style>