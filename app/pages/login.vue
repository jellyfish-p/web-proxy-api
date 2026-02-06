<script setup lang="ts">
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'clear'
})

const fields: AuthFormField[] = [
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: 'Enter your password',
    required: true
  }
]

// 表单校验：只要求密码必填
const schema = z.object({
  password: z.string().min(1, 'Password is required')
})

type Schema = z.infer<typeof schema>

// 交互状态：提交中 + 错误提示
const loading = ref(false)
const errorMessage = ref('')

// 登录提交逻辑：使用 async/await 简化 Promise 链，并完善异常处理
const onSubmit = async ({ data }: FormSubmitEvent<Schema>) => {
  errorMessage.value = ''
  loading.value = true

  try {
    const res = await $fetch<{ success: boolean, message: string }>('/api/login', {
      method: 'POST',
      body: data
    })

    // 后端接口目前返回 200 + success 字段，因此这里显式判断业务成功状态
    if (!res.success) {
      errorMessage.value = res.message || 'Login failed'
      return
    }

    await navigateTo('/dashboard')
  } catch (error) {
    // 统一捕获网络错误/服务端异常
    errorMessage.value = error instanceof Error ? error.message : 'Login failed, please try again'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UPageCard class="md:mt-32 md:max-w-96 md:mx-auto h-full max-md:h-[calc(100vh-var(--ui-header-height))] max-md:rounded-none max-md:pt-32">
    <UAuthForm
      title="Login"
      description="Enter your password to enter web proxy api management center"
      :schema="schema"
      :fields="fields"
      :loading="loading"
      icon="i-lucide-user"
      @submit="onSubmit"
    />

    <!-- 错误提示：仅在有错误时展示 -->
    <p
      v-if="errorMessage"
      class="mt-3 text-sm text-red-500"
    >
      {{ errorMessage }}
    </p>
  </UPageCard>
</template>
