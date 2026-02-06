/**
 * messages.post.ts - Anthropic Messages API 兼容端点
 *
 * 路由: POST /v1/messages
 *
 * 兼容 Anthropic Messages API 格式。
 *
 * 工作流程:
 * 1. 验证 API 密钥（支持 x-api-key 或 Authorization 请求头）
 * 2. 解析 Anthropic 格式请求体
 * 3. 转换为 MiddleContent 中间格式
 * 4. 分发到 Provider Handler（获取 OpenAI 格式响应）
 * 5. 转换响应为 Anthropic 格式
 *
 * 注意: 目前不支持 Anthropic 流式格式的完整转换，
 * stream=true 时直接返回 OpenAI SSE（客户端需自行处理）
 */

import { CheckApiKey } from '~~/server/utils/config'
import { AnthropicMessage } from '~~/server/utils/converter'
import { dispatchMiddleContent, openAIToAnthropicResponse } from '~~/server/utils/chat'

export default defineEventHandler(async (event) => {
  // ====== 1. 验证 API 密钥 ======
  // Anthropic 使用 x-api-key 请求头，但也支持 Authorization
  let apiKey = event.headers.get('Authorization') || ''
  if (apiKey.startsWith('Bearer ')) {
    apiKey = apiKey.slice(7)
  }

  if (!CheckApiKey(apiKey)) {
    throw createError({
      status: 401,
      message: 'Unauthorized'
    })
  }

  // ====== 2. 解析并转换请求 ======
  const body = await readBody(event)
  // 将 Anthropic 格式请求转换为中间格式
  const middleContent = AnthropicMessage(body)

  // ====== 3. 分发请求 ======
  const result = await dispatchMiddleContent(middleContent)

  // ====== 4. 处理响应 ======
  // 流式请求直接返回（目前不做 Anthropic SSE 格式转换）
  if (middleContent.stream) {
    return result
  }

  // Response 类型直接返回（fallback 处理）
  if (result instanceof Response) {
    return result
  }

  // 非流式响应: OpenAI Completion -> Anthropic Message 格式
  return openAIToAnthropicResponse(result)
})
