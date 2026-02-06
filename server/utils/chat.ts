/**
 * chat.ts - 聊天请求分发与响应格式转换模块
 *
 * 本模块负责:
 * 1. 将中间格式（MiddleContent）分发到对应的 Provider Handler
 * 2. 将 OpenAI SSE 格式聚合为完整的 OpenAI Completion 响应
 * 3. 在不同 API 格式之间转换响应（OpenAI <-> Gemini, OpenAI <-> Anthropic）
 */

import type { MiddleContent } from './converter'
import { resolveHandlerByModel } from './handler'

/**
 * OpenAI Chat Completion 响应类型定义
 *
 * 标准 OpenAI /v1/chat/completions 非流式响应结构
 */
export type OpenAICompletion = {
  /** 响应唯一标识符，如 "chatcmpl-xxx" */
  id: string
  /** 固定为 "chat.completion" */
  object: 'chat.completion'
  /** Unix 时间戳（秒） */
  created: number
  /** 实际使用的模型名称 */
  model: string
  /** 生成结果数组，通常只有一个元素 */
  choices: Array<{
    /** 结果索引，通常为 0 */
    index: number
    /** 助手消息内容 */
    message: {
      role: 'assistant'
      /** 生成的文本内容 */
      content: string
      /** 推理/思考过程内容（DeepSeek R1 等模型支持） */
      reasoning_content?: string
    }
    /** 停止原因：stop=正常结束, length=达到长度限制, null=进行中 */
    finish_reason: string | null
  }>
  /** Token 使用统计（可选） */
  usage?: Record<string, unknown>
}

/**
 * 将 SSE 流聚合为 OpenAI Completion 对象
 *
 * 工作流程：
 * 1. 逐块读取 SSE 流
 * 2. 解析每个 "data: {...}" 行
 * 3. 累积 content 和 reasoning_content
 * 4. 提取元数据（id, model, created, usage）
 * 5. 组装完整的 OpenAICompletion 对象
 *
 * @param middleContent - 原始请求的中间格式，用于获取 fallback 值
 * @param sseResponse - Provider Handler 返回的 SSE 流响应
 * @returns Promise<OpenAICompletion> 聚合后的完整响应
 *
 * @throws 当 Provider 返回空 body 时抛出 502 错误
 */
async function aggregateSseToOpenAICompletion(middleContent: MiddleContent, sseResponse: Response): Promise<OpenAICompletion> {
  if (!sseResponse.body) {
    throw createError({
      status: 502,
      message: 'Provider returned empty stream body'
    })
  }

  const reader = sseResponse.body.getReader()
  const decoder = new TextDecoder()

  // SSE 解析缓冲区
  let buffer = ''

  // 响应元数据（从流中提取，有默认值）
  let responseId = ''
  let responseModel = middleContent.model
  let responseCreated = Math.floor(Date.now() / 1000)
  let finishReason: string | null = 'stop'

  // 内容累积器
  let content = ''
  let reasoningContent = ''
  let usage: Record<string, unknown> | undefined

  try {
    // 循环读取流直到结束
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      // 追加到缓冲区并按行分割
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // 保留最后一个可能不完整的行
      buffer = lines.pop() ?? ''

      for (const rawLine of lines) {
        const line = rawLine.trim()
        // 跳过空行和注释行
        if (!line || line.startsWith(':')) continue
        // 只处理 data: 开头的行
        if (!line.startsWith('data:')) continue

        const data = line.slice(5).trim()
        // 跳过空数据和结束标记
        if (!data || data === '[DONE]') continue

        // 解析 JSON 数据
        let chunk: Record<string, unknown>
        try {
          chunk = JSON.parse(data) as Record<string, unknown>
        } catch {
          continue
        }

        // 提取元数据
        if (typeof chunk.id === 'string' && chunk.id) {
          responseId = chunk.id
        }
        if (typeof chunk.model === 'string' && chunk.model) {
          responseModel = chunk.model
        }
        if (typeof chunk.created === 'number') {
          responseCreated = chunk.created
        }
        if (chunk.usage && typeof chunk.usage === 'object') {
          usage = chunk.usage as Record<string, unknown>
        }

        // 处理 choices 数组中的增量内容
        const choices = Array.isArray(chunk.choices) ? chunk.choices : []
        for (const choice of choices) {
          if (choice?.finish_reason != null) {
            finishReason = String(choice.finish_reason)
          }

          const delta = choice?.delta
          if (!delta || typeof delta !== 'object') continue

          // 累积内容
          if (typeof delta.content === 'string') {
            content += delta.content
          }
          if (typeof delta.reasoning_content === 'string') {
            reasoningContent += delta.reasoning_content
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  // 组装最终响应
  return {
    id: responseId || `chatcmpl-${responseCreated}`,
    object: 'chat.completion',
    created: responseCreated,
    model: responseModel,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
          // 只在有推理内容时包含该字段
          ...(reasoningContent ? { reasoning_content: reasoningContent } : {})
        },
        finish_reason: finishReason
      }
    ],
    // 只在有 usage 时包含该字段
    ...(usage ? { usage } : {})
  }
}

/**
 * 统一分发入口 - 将 MiddleContent 发送到对应的 Provider Handler
 *
 * 核心路由逻辑：
 * 1. 根据 model 名称解析出对应的 handler
 * 2. 调用 handler 获取 SSE 流响应
 * 3. 如果请求 stream=true，直接返回 SSE 流
 * 4. 如果请求 stream=false，聚合 SSE 为完整的 OpenAI Completion
 *
 * 设计原则：所有 handler 统一输出 OpenAI 格式 SSE，
 * 格式转换（如 Gemini、Anthropic）由调用方（路由层）负责
 *
 * @param middleContent - 请求的中间格式
 * @returns Promise<Response | OpenAICompletion>
 *   - stream=true 时返回 Response（SSE 流）
 *   - stream=false 时返回 OpenAICompletion（JSON 对象）
 *
 * @throws 当模型未注册时抛出 400 错误
 *
 * @example
 * ```ts
 * // 流式调用
 * const sseResponse = await dispatchMiddleContent({ ...middleContent, stream: true })
 * return sseResponse // 直接返回给客户端
 *
 * // 非流式调用
 * const completion = await dispatchMiddleContent({ ...middleContent, stream: false })
 * return completion // 返回 JSON
 * ```
 */
export async function dispatchMiddleContent(middleContent: MiddleContent): Promise<Response | OpenAICompletion> {
  // 根据模型名解析 handler
  const resolved = resolveHandlerByModel(middleContent.model)
  if (!resolved) {
    throw createError({
      status: 400,
      message: `Model not registered: ${middleContent.model}`
    })
  }

  // 调用 handler 获取 SSE 流（handler 强制以流模式工作）
  const sseResponse = await resolved.handler(middleContent)

  // 流式请求直接返回 SSE
  if (middleContent.stream) {
    return sseResponse
  }

  // 非流式请求需要聚合 SSE 为完整响应
  return await aggregateSseToOpenAICompletion(middleContent, sseResponse)
}

/**
 * 将 OpenAI SSE 流实时转换为 Gemini SSE 流
 *
 * 用于 Gemini API 兼容层的流式响应。
 * 逐块读取 OpenAI 格式 SSE，转换为 Gemini 格式后立即输出。
 *
 * 格式转换规则：
 * - OpenAI delta.content -> Gemini candidates[0].content.parts[0].text
 * - OpenAI finish_reason -> Gemini candidates[0].finishReason: "STOP"
 * - OpenAI model -> Gemini modelVersion
 *
 * @param sseResponse - OpenAI 格式的 SSE 流响应
 * @param fallbackModel - 当流中没有 model 字段时使用的默认值
 * @returns Response 包含 Gemini 格式 SSE 的新响应
 *
 * @throws 当输入流 body 为空时抛出 502 错误
 */
export function openAISSEToGeminiSSE(sseResponse: Response, fallbackModel: string): Response {
  if (!sseResponse.body) {
    throw createError({
      status: 502,
      message: 'Provider returned empty stream body'
    })
  }

  const sourceReader = sseResponse.body.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  // SSE 解析缓冲区
  let buffer = ''

  // 创建转换后的输出流
  const output = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await sourceReader.read()
          if (done) {
            break
          }
          if (!value) {
            continue
          }

          // 追加到缓冲区并按行分割
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const rawLine of lines) {
            const line = rawLine.trim()
            // 跳过空行和注释
            if (!line || line.startsWith(':')) continue
            if (!line.startsWith('data:')) continue

            const data = line.slice(5).trim()
            if (!data) continue

            // 处理结束标记
            if (data === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
              return
            }

            // 解析 OpenAI 格式 chunk
            let chunk: Record<string, unknown>
            try {
              chunk = JSON.parse(data) as Record<string, unknown>
            } catch {
              continue
            }

            // 提取字段
            const model = typeof chunk.model === 'string' && chunk.model ? chunk.model : fallbackModel
            const choice = Array.isArray(chunk.choices) ? chunk.choices[0] : null
            const delta = choice?.delta && typeof choice.delta === 'object' ? choice.delta : {}
            const text = typeof delta.content === 'string' ? delta.content : ''

            // 构造 Gemini 格式 chunk
            const geminiChunk = {
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ text }]
                  },
                  // 只在有 finish_reason 时设置 finishReason
                  finishReason: choice?.finish_reason ? 'STOP' : undefined,
                  index: 0
                }
              ],
              modelVersion: model
            }

            // 输出 Gemini 格式 SSE
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(geminiChunk)}\n\n`))
          }
        }

        controller.close()
      } catch (error) {
        controller.error(error)
      } finally {
        sourceReader.releaseLock()
      }
    }
  })

  return new Response(output, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  })
}

/**
 * 将 OpenAI Completion 转换为 Gemini generateContent 响应格式
 *
 * 用于 Gemini API 兼容层的非流式响应。
 *
 * @param openai - OpenAI 格式的完整响应
 * @returns Gemini generateContent 响应格式
 */
export function openAIToGeminiResponse(openai: OpenAICompletion) {
  const message = openai.choices?.[0]?.message
  const usage = openai.usage as Record<string, number> | undefined

  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts: [
            {
              text: message?.content ?? ''
            }
          ]
        },
        finishReason: 'STOP',
        index: 0
      }
    ],
    usageMetadata: {
      promptTokenCount: usage?.prompt_tokens ?? 0,
      candidatesTokenCount: usage?.completion_tokens ?? 0,
      totalTokenCount: usage?.total_tokens ?? 0
    },
    modelVersion: openai.model
  }
}

/**
 * 将 OpenAI Completion 转换为 Anthropic messages 响应格式
 *
 * 用于 Anthropic API 兼容层的响应。
 *
 * @param openai - OpenAI 格式的完整响应
 * @returns Anthropic messages 响应格式
 */
export function openAIToAnthropicResponse(openai: OpenAICompletion) {
  const message = openai.choices?.[0]?.message
  const choice = openai.choices?.[0]
  const usage = openai.usage as Record<string, number> | undefined

  return {
    id: openai.id,
    type: 'message',
    role: 'assistant',
    model: openai.model,
    content: [
      {
        type: 'text',
        text: message?.content ?? ''
      }
    ],
    stop_reason: choice?.finish_reason ?? 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0
    }
  }
}
