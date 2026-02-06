/**
 * handler.ts - Provider Handler 注册表模块
 *
 * 本模块实现了一个简单的 Provider Handler 注册表，用于：
 * 1. 注册不同提供商（如 DeepSeek、OpenAI 等）的处理函数
 * 2. 根据模型名称动态解析对应的处理函数
 *
 * 设计理念：
 * - 所有 handler 统一接收 MiddleContent 格式的请求
 * - 所有 handler 统一输出 OpenAI 格式的 SSE 流
 * - 格式转换在调用方（路由层）完成，保持 handler 的简洁性
 */

import type { MiddleContent } from './converter'
import { getModelOwner } from './selector'

/**
 * Provider Handler 类型定义
 *
 * 接收中间格式请求，返回 OpenAI 格式 SSE 流响应
 *
 * @param body - 中间格式请求体
 * @returns Response 包含 SSE 流的响应对象
 */
export type ProviderHandler = (body: MiddleContent) => Promise<Response> | Response

/**
 * Provider Handler 注册表
 *
 * key: owner（提供商标识，如 "deepseek"、"openai"）
 * value: 对应的 handler 函数
 */
const providerHandlers = new Map<string, ProviderHandler>()

/**
 * 注册 Provider Handler
 *
 * 在应用启动时由各 provider 模块调用，将自己的 handler 注册到表中。
 *
 * @param owner - 提供商标识（如 "deepseek"），与 selector.ts 中的 model owner 对应
 * @param handler - 处理函数
 *
 * @example
 * ```ts
 * // 在 deepseek/index.ts 中
 * registerProviderHandler('deepseek', DeepSeekHandler)
 * ```
 */
export function registerProviderHandler(owner: string, handler: ProviderHandler) {
  if (!owner) return
  providerHandlers.set(owner, handler)
}

/**
 * 获取指定 owner 的 handler
 *
 * @param owner - 提供商标识
 * @returns ProviderHandler | undefined
 */
export function getProviderHandler(owner: string) {
  return providerHandlers.get(owner)
}

/**
 * 根据模型名称解析对应的 handler
 *
 * 解析流程：
 * 1. 调用 getModelOwner() 从模型名获取提供商标识
 * 2. 从注册表中查找对应的 handler
 *
 * @param model - 模型名称（如 "deepseek-chat"、"gpt-4"）
 * @returns { owner, handler } | null
 *   - 成功时返回包含 owner 和 handler 的对象
 *   - 模型未注册或无对应 handler 时返回 null
 *
 * @example
 * ```ts
 * const resolved = resolveHandlerByModel('deepseek-chat')
 * if (resolved) {
 *   const response = await resolved.handler(middleContent)
 * }
 * ```
 */
export function resolveHandlerByModel(model: string) {
  // 从模型名获取 owner（提供商标识）
  const owner = getModelOwner(model)
  if (!owner) {
    return null
  }

  // 从注册表获取 handler
  const handler = getProviderHandler(owner)
  if (!handler) {
    return null
  }

  return {
    owner,
    handler
  }
}
