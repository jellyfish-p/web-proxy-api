<template>
  <UContainer>
    <NuxtPage />
  </UContainer>
</template>

<script setup lang="ts">
const route = useRoute()

// 定义不显示aside的页面列表
const hideAsideRoutes = ['login', 'register', 'forgot-password']

const showAside = computed(() => {
  return !hideAsideRoutes.includes(route.name as string)
})
</script>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 250px;
  background: #f5f5f5;
  border-right: 1px solid #ddd;
  padding: 20px;
}

.main-content {
  flex: 1;
  overflow-y: auto;
}
</style>
