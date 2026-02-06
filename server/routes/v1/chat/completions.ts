// 导入 API 密钥验证函数
import { CheckApiKey } from '~~/server/utils/config'

/**
 * 聊天补全 API 端点
 * 处理聊天补全请求，验证 API 密钥
 */
export default defineEventHandler(async (event) => {
  // 从请求头获取 Authorization
  let apiKey = event.headers.get('Authorization') || ''
  // 如果是 Bearer token 格式，提取实际的密钥
  if (apiKey.startsWith('Bearer ')) {
    apiKey = apiKey.slice(7)
  }
  // 验证 API 密钥
  if (!CheckApiKey(apiKey)) {
    throw createError({
      status: 401,
      message: 'Unauthorized'
    })
  }
})
