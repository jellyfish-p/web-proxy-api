export default defineNuxtRouteMiddleware(async (to) => {
  const authState = useState<boolean | null>('dashboard-authenticated', () => null)

  // 首次访问时通过服务端接口校验 HttpOnly Cookie，避免前端直接读取失败
  if (authState.value === null || authState.value === false) {
    try {
      const res = await $fetch<{ authenticated: boolean }>('/api/auth/status', {
        credentials: 'include'
      })
      authState.value = Boolean(res.authenticated)
    } catch {
      authState.value = false
    }
  }

  const isAuthenticated = authState.value === true

  // 如果访问的是登录页，且已经登录了，则重定向到仪表板首页
  if (to.path === '/login') {
    if (isAuthenticated) {
      return navigateTo('/dashboard')
    }
    return
  }

  // 如果访问首页，直接放行
  if (to.path === '/') {
    return
  }

  // 如果访问除首页外的其他页面，且没有登录，则重定向到登录页
  if (!isAuthenticated) {
    return navigateTo('/login')
  }
})
