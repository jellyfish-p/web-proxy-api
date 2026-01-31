<template>
  <div class="flex flex-col w-dvw h-dvh">
    <div class="border-b-gray-300 border-b">
      <p class="text-2xl font-bold m-4">WPAMC</p>
    </div>
    <div class="flex flex-row">
      <div v-show="showAside" class="w-32">
        <UNavigationMenu :collapsed="false" :items="NavigationItems" orientation="vertical" />
      </div>
      <NuxtPage class="w-full" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()

// 定义不显示aside的页面列表
const hideAsideRoutes = ['login']

const showAside = computed(() => {
  return !hideAsideRoutes.includes(route.name as string)
})

const NavigationItems = ref<NavigationMenuItem[][]>([
  [
    {
      label: '仪表盘',
      icon: 'i-heroicons-chart-bar',
      to: '/dashboard'
    },
    {
      label: '项目管理',
      icon: 'i-heroicons-cube',
      children: [
        {
          label: '所有项目',
          to: '/projects'
        },
        {
          label: 'deepseek',
          to: '/projects/deepseek'
        },
        {
          label: 'grok',
          to: '/projects/grok'
        }
      ]
    },
  ],
  [
    {
      label: '设置',
      icon: 'i-heroicons-cog',
      to: '/settings'
    },
    {
      label: '帮助',
      icon: 'i-heroicons-question-mark-circle',
      to: '/help'
    }
  ]
])
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
