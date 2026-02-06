/**
 * completions.ts - OpenAI Chat Completions API 兼容端点
 *
 * 路由: POST /v1/chat/completions
 *
 * 完全兼容 OpenAI Chat Completions API 格式。
 *
 * 工作流程:
 * 1. 验证 API 密钥
 * 2. 解析请求体为 OpenAI 格式
 * 3. 转换为 MiddleContent 中间格式
 * 4. 分发到对应的 Provider Handler
 * 5. stream=true 时返回 SSE 流，stream=false 时返回 JSON
 *
 * 支持的请求参数（完整列表见 OpenAI 文档）:
 * - model: 模型名称（必需）
 * - messages: 消息数组（必需）
 * - stream: 是否流式返回（可选，默认 false）
 * - temperature, top_p, max_tokens 等
 */

// 导入 API 密钥验证函数
import { CheckApiKey } from '~~/server/utils/config'
import { OpenaiCompletion } from '~~/server/utils/converter'
import { dispatchMiddleContent } from '~~/server/utils/chat'

export default defineEventHandler(async (event) => {
  // ====== 1. 验证 API 密钥 ======
  // 从 Authorization 请求头提取密钥
  let apiKey = event.headers.get('Authorization') || ''
  // Bearer token 格式处理: "Bearer sk-xxx" -> "sk-xxx"
  if (apiKey.startsWith('Bearer ')) {
    apiKey = apiKey.slice(7)
  }

  // 验证密钥有效性
  if (!CheckApiKey(apiKey)) {
    throw createError({
      status: 401,
      message: 'Unauthorized'
    })
  }

  // ====== 2. 解析并转换请求 ======
  const body = await readBody(event)
  // 将 OpenAI 格式请求转换为中间格式
  const middleContent = OpenaiCompletion(body)

  // ====== 3. 分发请求并返回响应 ======
  // dispatchMiddleContent 会根据 stream 参数返回:
  // - stream=true: Response (SSE 流)
  // - stream=false: OpenAICompletion (JSON 对象)
  return await dispatchMiddleContent(middleContent)
})
