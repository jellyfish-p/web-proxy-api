<script lang="ts" setup>
import type { NavigationMenuItem } from '@nuxt/ui';

const items = ref<NavigationMenuItem[]>([
  {
    label: '仪表盘',
    icon: 'i-heroicons-chart-bar-20-solid',
  },
  {
    label: '项目管理',
    icon: 'i-heroicons-document-text-20-solid',
    children: [
      { label: 'DeepSeek' }
    ]
  }, {
    label: 'OAuth登录',
    icon: 'i-heroicons-key-20-solid',
  }
])
</script>
<template>
  <div class="flex h-[calc(100vh-var(--ui-header-height))]">
    <UPageAside class="border-r-gray-200 border-r">
      <UNavigationMenu :items="items" orientation="vertical" class="h-full" />
    </UPageAside>
    <UPageBody>
      <slot />
    </UPageBody>
  </div>
</template>
