/**
 * [target].post.ts - Gemini generateContent API 兼容端点
 *
 * 路由: POST /v1beta/models/{model}:{action}
 *
 * 当前支持:
 * - action=generateContent
 * - action=streamGenerateContent（建议配合 ?alt=sse）
 *
 * 工作流程:
 * 1. 验证 API 密钥（兼容 key 查询参数、x-goog-api-key、x-api-key、Authorization）
 * 2. 解析路径参数中的 model/action
 * 3. 解析并转换 Gemini 请求体为 MiddleContent
 * 4. 分发到 Provider Handler（获取 OpenAI 格式响应）
 * 5. 按 Gemini 格式返回（stream/non-stream）
 */

import { CheckApiKey } from '~~/server/utils/config'
import { GeminiGenerateContent } from '~~/server/utils/converter'
import { dispatchMiddleContent, openAIToGeminiResponse, openAISSEToGeminiSSE } from '~~/server/utils/chat'

export default defineEventHandler(async (event) => {
  // ====== 1. 验证 API 密钥 ======
  let apiKey = String(getQuery(event).key ?? '')

  if (!apiKey) {
    apiKey = event.headers.get('x-goog-api-key') || ''
  }
  if (!apiKey) {
    apiKey = event.headers.get('x-api-key') || ''
  }
  if (!apiKey) {
    apiKey = event.headers.get('Authorization') || ''
    if (apiKey.startsWith('Bearer ')) {
      apiKey = apiKey.slice(7)
    }
  }

  if (!CheckApiKey(apiKey)) {
    throw createError({
      status: 401,
      message: 'Unauthorized'
    })
  }

  // ====== 2. 解析路径参数 ======
  // target 形如: "gemini-2.0-flash:generateContent"
  const target = getRouterParam(event, 'target') || ''
  const separatorIndex = target.lastIndexOf(':')

  if (separatorIndex <= 0 || separatorIndex >= target.length - 1) {
    throw createError({
      status: 400,
      message: 'Invalid path. Expected /v1beta/models/{model}:{generateContent|streamGenerateContent}'
    })
  }

  const model = target.slice(0, separatorIndex)
  const action = target.slice(separatorIndex + 1)

  if (action !== 'generateContent' && action !== 'streamGenerateContent') {
    throw createError({
      status: 404,
      message: `Unsupported Gemini action: ${action}`
    })
  }

  // ====== 3. 解析并转换请求 ======
  const body = await readBody(event)
  const middleContent = GeminiGenerateContent(body)
  // 路径参数优先于请求体中的 model 字段
  middleContent.model = model

  // streamGenerateContent 强制走流式返回
  if (action === 'streamGenerateContent') {
    middleContent.stream = true
  }

  // ====== 4. 分发请求 ======
  const result = await dispatchMiddleContent(middleContent)

  // ====== 5. 格式转换并返回 ======
  if (middleContent.stream) {
    if (!(result instanceof Response)) {
      throw createError({
        status: 500,
        message: 'Expected stream response from provider'
      })
    }
    return openAISSEToGeminiSSE(result, model)
  }

  if (result instanceof Response) {
    return result
  }

  return openAIToGeminiResponse(result)
})
