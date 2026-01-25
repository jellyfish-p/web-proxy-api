<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
    <UCard class="w-full max-w-2xl">
      <template #header>
        <div class="text-center">
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Web Proxy API</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-2">多项目 Web 逆向代理服务</p>
        </div>
      </template>

      <div class="space-y-6">
        <div class="text-center">
          <p class="text-lg text-gray-700 dark:text-gray-300">
            欢迎使用 Web Proxy API 管理系统
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UCard>
            <div class="text-center p-4">
              <UIcon name="i-heroicons-key" class="text-4xl mb-3 text-primary" />
              <h3 class="font-semibold text-lg mb-2">API 接口</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                OpenAI 兼容的 API 接口
              </p>
              <UButton 
                to="/docs" 
                variant="soft"
                block
              >
                查看文档
              </UButton>
            </div>
          </UCard>

          <UCard>
            <div class="text-center p-4">
              <UIcon name="i-heroicons-cog-6-tooth" class="text-4xl mb-3 text-primary" />
              <h3 class="font-semibold text-lg mb-2">管理面板</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                管理项目和令牌
              </p>
              <UButton 
                to="/admin" 
                color="primary"
                block
              >
                进入管理
              </UButton>
            </div>
          </UCard>
        </div>

        <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 class="font-semibold mb-3">支持的项目</h3>
          <div class="flex flex-wrap gap-2">
            <UBadge color="primary" variant="soft">DeepSeek</UBadge>
            <UBadge color="neutral" variant="soft">更多项目...</UBadge>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="text-center text-sm text-gray-500">
          <p>基于 Nuxt 3 + NuxtUI 构建</p>
        </div>
      </template>
    </UCard>
  </div>
</template>
