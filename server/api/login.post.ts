// 导入配置和认证相关函数
import { getConfig } from '../utils/config'
import { DASHBOARD_AUTH_COOKIE, createDashboardAuthHash, verifyPassword } from '../utils/auth'

/**
 * 登录 API 端点
 * 处理仪表板登录请求
 */
export default defineEventHandler(async (event) => {
  const config = getConfig()

  // 检查仪表板是否启用
  if (!config || !config.dashboard.enable) {
    return {
      success: false,
      message: 'Dashboard is not enabled'
    }
  }

  try {
    // 读取请求体
    const body = await readBody(event)
    const { password } = body

    // 验证密码是否提供
    if (!password) {
      return {
        success: false,
        message: 'Password is required'
      }
    }

    // 验证密码是否正确
    const isValid = verifyPassword(password, config.dashboard.password)

    if (isValid) {
      // 基于当前配置密码生成稳定登录态哈希：
      // 只要 config.dashboard.password 不变，该哈希就不会变化，可持续通过鉴权。
      const authHash = createDashboardAuthHash(config.dashboard.password)

      // 将登录态哈希写入 HttpOnly Cookie，前端不可读，降低被脚本窃取风险。
      setCookie(event, DASHBOARD_AUTH_COOKIE, authHash, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      })

      return {
        success: true,
        message: 'Login successful'
      }
    } else {
      return {
        success: false,
        message: 'Invalid password'
      }
    }
  } catch (error) {
    console.error('Login error:', error)
    return {
      success: false,
      message: 'Login failed'
    }
  }
})
