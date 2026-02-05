// 导入配置和认证相关函数
import { getConfig } from '../utils/config'
import { verifyPassword } from '../utils/auth'

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
