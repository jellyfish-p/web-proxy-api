<template>
  <div class="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
    <UContainer>
      <UCard class="w-full max-w-md mx-auto shadow-xl">
        <template #header>
          <div class="text-center space-y-2">
            <div class="flex justify-center mb-4">
              <div class="w-16 h-16 bg-primary-500 dark:bg-primary-400 rounded-2xl flex items-center justify-center shadow-lg">
                <UIcon name="i-heroicons-shield-check" class="text-3xl text-white" />
              </div>
            </div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">管理面板</h1>
            <p class="text-gray-600 dark:text-gray-400">Web Proxy API 管理系统</p>
          </div>
        </template>

        <UForm :state="state" @submit="handleLogin" class="space-y-5">
          <UFormField label="用户名" name="username" required>
            <UInput 
              v-model="state.username" 
              placeholder="请输入用户名"
              icon="i-heroicons-user"
              size="lg"
              :disabled="isLoading"
              autocomplete="username"
            />
          </UFormField>

          <UFormField label="密码" name="password" required>
            <UInput 
              v-model="state.password" 
              type="password"
              placeholder="请输入密码"
              icon="i-heroicons-lock-closed"
              size="lg"
              :disabled="isLoading"
              autocomplete="current-password"
            />
          </UFormField>

          <UButton 
            type="submit" 
            block 
            size="lg"
            color="primary"
            :loading="isLoading"
            :disabled="!state.username || !state.password"
            icon="i-heroicons-arrow-right-on-rectangle"
          >
            {{ isLoading ? '登录中...' : '登录' }}
          </UButton>
        </UForm>

        <template #footer>
          <UAlert
            icon="i-heroicons-information-circle"
            color="primary"
            variant="soft"
            title="提示"
            description="默认账号密码请查看 config.yaml 配置文件"
          />
        </template>
      </UCard>
    </UContainer>
  </div>
</template>

<script setup lang="ts">
import type { FormSubmitEvent } from '#ui/types'

definePageMeta({
  layout: false
});

const { login, isLoading, checkAuth } = useAuth();
const toast = useToast();

const state = reactive({
  username: '',
  password: ''
});

const handleLogin = async (event: FormSubmitEvent<any>) => {
  if (!state.username || !state.password) {
    toast.add({
      title: '请填写完整信息',
      description: '用户名和密码不能为空',
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle'
    });
    return;
  }

  const result = await login(state.username, state.password);
  
  if (result.success) {
    toast.add({
      title: '登录成功',
      description: '欢迎回来！',
      color: 'success',
      icon: 'i-heroicons-check-circle'
    });
    // Use navigateTo with replace to avoid back button issues
    await navigateTo('/admin', { replace: true });
  } else {
    toast.add({
      title: '登录失败',
      description: result.message || '用户名或密码错误',
      color: 'error',
      icon: 'i-heroicons-x-circle'
    });
  }
};

// Check if already authenticated
onMounted(async () => {
  const isAuth = await checkAuth();
  if (isAuth) {
    await navigateTo('/admin', { replace: true });
  }
});
</script>
