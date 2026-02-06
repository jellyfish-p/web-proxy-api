/**
 * deepseek/index.ts - DeepSeek Provider Handler 模块
 *
 * 本模块实现了 DeepSeek 网页版 API 的完整调用流程，包括：
 * 1. 账号选择与令牌管理
 * 2. 会话创建
 * 3. PoW（工作量证明）挑战计算
 * 4. 流式对话补全
 * 5. OpenAI 格式 SSE 输出
 *
 * 主要参考: deepseek2api/app.py
 */

import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { MiddleContentToPrompt, type MiddleContent } from '../../converter'
import { getAccountsWithFiles } from '../../accounts'
import { registerProviderHandler } from '../../handler'
import { clearSkip, registerAccount, releaseAccount, selectAccount, skipAccount } from '../../selector'
import {
  DEEPSEEK_BASE_HEADERS,
  DEEPSEEK_COMPLETION_URL,
  DEEPSEEK_CREATE_POW_URL,
  DEEPSEEK_CREATE_SESSION_URL,
  DEEPSEEK_MODELS
} from './const'
import { loginDeepseekViaAccount } from './auth'
import { countTokens } from './tokenizer'

/**
 * DeepSeek 账号配置类型
 */
type DeepseekAccount = {
  /** 用户名（用于登录） */
  username?: string
  /** 密码（用于登录） */
  password?: string
  /** Bearer Token（直接使用或登录后获取） */
  token?: string
  /** 账号类型标识 */
  type?: string
  /** 账号配置文件名（内部使用） */
  fileName?: string
}

/**
 * DeepSeek 流式响应事件类型
 *
 * DeepSeek 使用自定义的 SSE 格式，每个事件包含：
 * - p: 事件路径/类型（如 "response/thinking_content", "response/search_status"）
 * - v: 事件值（字符串内容或数组等）
 */
type DeepseekStreamEvent = {
  /** 事件路径/类型 */
  p?: string
  /** 事件值 */
  v?: unknown
}

/**
 * PoW WASM 文件候选路径
 *
 * deepseek 的 wasm 已拷贝进当前项目，优先使用项目内固定路径。
 * 同时保留 import.meta.url 路径，兼容本地直接运行。
 */
const wasmCandidatePaths = [
  // Bun/Node 从项目根目录启动时的固定路径
  resolve(process.cwd(), 'server/utils/projects/deepseek/sha3_wasm_bg.7b9ca65ddd.wasm'),
  // 本地模块相对路径（开发兜底）
  fileURLToPath(new URL('./sha3_wasm_bg.7b9ca65ddd.wasm', import.meta.url))
]

/** WASM 实例缓存（单例模式，避免重复加载） */
let wasmInstancePromise: Promise<WebAssembly.Instance> | null = null

/**
 * 获取当前 Unix 时间戳（秒）
 */
function nowInSeconds() {
  return Math.floor(Date.now() / 1000)
}

/**
 * 判断是否为推理模型
 *
 * 推理模型（如 deepseek-reasoner）会启用 thinking_enabled 参数，
 * 并在响应中返回 reasoning_content
 */
function isReasoningModel(model: string) {
  const normalized = model.toLowerCase()
  return normalized.includes('reasoner') || normalized.includes('reasoning')
}

/**
 * 判断是否为搜索模型
 *
 * 搜索模型会启用 search_enabled 参数，支持联网搜索
 */
function isSearchModel(model: string) {
  return model.toLowerCase().includes('search')
}

/**
 * 构建 DeepSeek API 请求头
 *
 * @param token - Bearer Token
 * @param extraHeaders - 额外的请求头（如 PoW 响应头）
 */
function getDeepseekHeaders(token: string, extraHeaders?: Record<string, string>) {
  return {
    ...DEEPSEEK_BASE_HEADERS,
    authorization: `Bearer ${token}`,
    ...(extraHeaders || {})
  }
}

/**
 * 加载 PoW WASM 模块
 *
 * 使用单例模式，首次调用时从文件系统加载 WASM 并编译实例化，
 * 后续调用直接返回缓存的 Promise
 *
 * @returns Promise<WebAssembly.Instance> WASM 实例
 * @throws 当所有候选路径都找不到 WASM 文件时抛出错误
 */
async function loadWasmInstance() {
  if (wasmInstancePromise) {
    return wasmInstancePromise
  }

  wasmInstancePromise = (async () => {
    let bytes: Uint8Array | null = null

    // 尝试从候选路径加载 WASM 文件
    for (const candidate of wasmCandidatePaths) {
      try {
        bytes = await readFile(candidate)
        break
      } catch {
        // 尝试下一个候选路径
      }
    }

    if (!bytes) {
      throw new Error('DeepSeek PoW wasm file not found')
    }

    // 将 Uint8Array 转换为 ArrayBuffer（WebAssembly.compile 要求）
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    const module = await WebAssembly.compile(arrayBuffer)
    return await WebAssembly.instantiate(module, {})
  })()

  return wasmInstancePromise
}

/**
 * 计算 PoW 挑战答案
 *
 * 使用 WASM 模块执行 SHA3 哈希计算，找到满足难度要求的 nonce
 *
 * @param challenge - PoW 挑战参数
 * @returns Promise<number> 计算出的答案（nonce）
 * @throws 当算法不支持或计算失败时抛出错误
 */
async function computePowAnswer(challenge: {
  algorithm: string
  challenge: string
  salt: string
  difficulty: number
  expire_at: number
}) {
  // 目前只支持 DeepSeekHashV1 算法
  if (challenge.algorithm !== 'DeepSeekHashV1') {
    throw new Error(`Unsupported PoW algorithm: ${challenge.algorithm}`)
  }

  const instance = await loadWasmInstance()
  const exports = instance.exports as Record<string, unknown>

  // 获取 WASM 导出函数
  const memory = exports.memory as WebAssembly.Memory
  const addToStack = exports.__wbindgen_add_to_stack_pointer as (v: number) => number
  const alloc = exports.__wbindgen_export_0 as (size: number, align: number) => number
  const wasmSolve = exports.wasm_solve as (
    retPtr: number,
    challengePtr: number,
    challengeLen: number,
    prefixPtr: number,
    prefixLen: number,
    difficulty: number
  ) => void

  if (!memory || !addToStack || !alloc || !wasmSolve) {
    throw new Error('DeepSeek PoW wasm exports are incomplete')
  }

  const encoder = new TextEncoder()

  // 写入字节到 WASM 内存
  const writeBytes = (ptr: number, bytes: Uint8Array) => {
    const view = new Uint8Array(memory.buffer)
    view.set(bytes, ptr)
  }

  // 分配内存并写入字符串
  const writeString = (text: string) => {
    const bytes = encoder.encode(text)
    const ptr = alloc(bytes.length, 1)
    writeBytes(ptr, bytes)
    return { ptr, len: bytes.length }
  }

  // 构造前缀: salt_expireAt_
  const prefix = `${challenge.salt}_${challenge.expire_at}_`

  // 分配返回值空间（16 字节：4 字节状态 + 8 字节结果 + 4 字节对齐）
  const retPtr = addToStack(-16)

  // 写入挑战和前缀到 WASM 内存
  const challengeData = writeString(challenge.challenge)
  const prefixData = writeString(prefix)

  // 调用 WASM 求解函数
  wasmSolve(
    retPtr,
    challengeData.ptr,
    challengeData.len,
    prefixData.ptr,
    prefixData.len,
    Number(challenge.difficulty)
  )

  // 读取返回值
  const dv = new DataView(memory.buffer)
  const status = dv.getInt32(retPtr, true) // 小端序
  const value = dv.getFloat64(retPtr + 8, true)

  // 恢复栈指针
  addToStack(16)

  if (status === 0) {
    throw new Error('Failed to solve DeepSeek PoW challenge')
  }

  return Math.trunc(value)
}

/**
 * 创建 PoW 响应
 *
 * 完整流程：
 * 1. 请求 PoW 挑战
 * 2. 计算答案
 * 3. 构造并返回 Base64 编码的响应
 *
 * @param token - Bearer Token
 * @returns Promise<string> Base64 编码的 PoW 响应，用于 x-ds-pow-response 请求头
 */
async function createPowResponse(token: string) {
  // 请求 PoW 挑战
  const response = await fetch(DEEPSEEK_CREATE_POW_URL, {
    method: 'POST',
    headers: getDeepseekHeaders(token),
    body: JSON.stringify({ target_path: '/api/v0/chat/completion' })
  })

  if (!response.ok) {
    throw new Error(`Create PoW challenge failed: ${response.status}`)
  }

  const data = await response.json() as {
    code?: number
    data?: {
      biz_data?: {
        challenge?: {
          algorithm: string
          challenge: string
          salt: string
          difficulty?: number
          expire_at?: number
          signature: string
          target_path: string
        }
      }
    }
  }

  const challenge = data?.data?.biz_data?.challenge
  if (data?.code !== 0 || !challenge) {
    throw new Error('Invalid DeepSeek PoW response')
  }

  // 计算答案
  const answer = await computePowAnswer({
    algorithm: challenge.algorithm,
    challenge: challenge.challenge,
    salt: challenge.salt,
    difficulty: challenge.difficulty ?? 144000,
    expire_at: challenge.expire_at ?? 1680000000
  })

  // 构造响应 payload
  const payload = {
    algorithm: challenge.algorithm,
    challenge: challenge.challenge,
    salt: challenge.salt,
    answer,
    signature: challenge.signature,
    target_path: challenge.target_path
  }

  // Base64 编码返回
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

/**
 * 创建 DeepSeek 会话
 *
 * 每次对话需要先创建会话获取 session_id
 *
 * @param token - Bearer Token
 * @returns Promise<string> 会话 ID
 */
async function createSession(token: string) {
  const response = await fetch(DEEPSEEK_CREATE_SESSION_URL, {
    method: 'POST',
    headers: getDeepseekHeaders(token),
    body: JSON.stringify({ agent: 'chat' })
  })

  if (!response.ok) {
    throw new Error(`Create session failed: ${response.status}`)
  }

  const data = await response.json() as {
    code?: number
    data?: { biz_data?: { id?: string } }
  }

  const id = data?.data?.biz_data?.id
  if (data?.code !== 0 || !id) {
    throw new Error('Invalid DeepSeek session response')
  }

  return id
}

/**
 * 解析账号用于指定模型
 *
 * 从 selector 选择可用账号，并确保有有效的 token
 *
 * @param model - 模型名称
 * @returns Promise<{ fileName, token }> 账号信息
 * @throws 当无可用账号时抛出 429 错误
 */
async function resolveAccountForModel(model: string) {
  const selected = selectAccount(model)
  if (!selected) {
    throw createError({ statusCode: 429, statusMessage: 'No DeepSeek account available' })
  }

  // 从账号存储中获取完整账号信息
  const accountEntries = getAccountsWithFiles('deepseek') as Array<{ fileName: string, data: DeepseekAccount }>
  const accountEntry = accountEntries.find(entry => entry.fileName === selected.fileName)

  if (!accountEntry) {
    releaseAccount(selected.fileName)
    throw createError({ statusCode: 500, statusMessage: `DeepSeek account not found: ${selected.fileName}` })
  }

  const account = accountEntry.data
  account.fileName = accountEntry.fileName

  // 如果没有 token，尝试登录获取
  if (!account.token) {
    account.token = await loginDeepseekViaAccount(account)
  }

  return {
    fileName: selected.fileName,
    token: account.token!
  }
}

/**
 * 解析 DeepSeek 流式事件
 *
 * DeepSeek 使用自定义的 SSE 格式: data: {"p": "path", "v": value}
 *
 * @param line - 原始 SSE 行
 * @returns DeepseekStreamEvent | null
 */
function parseDeepseekEvent(line: string): DeepseekStreamEvent | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return null

  const payload = trimmed.slice(5).trim()
  if (!payload || payload === '[DONE]') {
    return { p: 'done', v: '[DONE]' }
  }

  try {
    return JSON.parse(payload) as DeepseekStreamEvent
  } catch {
    return null
  }
}

/**
 * DeepSeek Handler - 主处理函数
 *
 * 接收 MiddleContent 格式的请求，返回 OpenAI 格式的 SSE 流响应
 *
 * 完整流程：
 * 1. 验证模型名称
 * 2. 转换请求为 prompt
 * 3. 选择并解析账号
 * 4. 创建会话
 * 5. 计算 PoW
 * 6. 发起补全请求
 * 7. 转换 DeepSeek SSE 为 OpenAI SSE
 *
 * @param body - 中间格式请求体
 * @returns Promise<Response> OpenAI 格式 SSE 流响应
 */
export async function DeepSeekHandler(body: MiddleContent) {
  const model = body.model

  // 验证模型是否支持
  if (!DEEPSEEK_MODELS.includes(model)) {
    throw createError({ statusCode: 400, statusMessage: `Unsupported DeepSeek model: ${model}` })
  }

  // 转换消息为 prompt 字符串
  const prompt = MiddleContentToPrompt(body)
  if (!prompt) {
    throw createError({ statusCode: 400, statusMessage: 'messages is required' })
  }

  // 选择账号
  const account = await resolveAccountForModel(model)

  try {
    // 创建会话和 PoW 响应
    const sessionId = await createSession(account.token)
    const powResponse = await createPowResponse(account.token)

    // 构造补全请求 payload
    const completionPayload = {
      chat_session_id: sessionId,
      parent_message_id: null,
      prompt,
      ref_file_ids: [],
      thinking_enabled: isReasoningModel(model), // 推理模型启用思考模式
      search_enabled: isSearchModel(model) // 搜索模型启用搜索
    }

    // 发起补全请求
    const completionResponse = await fetch(DEEPSEEK_COMPLETION_URL, {
      method: 'POST',
      headers: getDeepseekHeaders(account.token, { 'x-ds-pow-response': powResponse }),
      body: JSON.stringify(completionPayload)
    })

    if (!completionResponse.ok || !completionResponse.body) {
      // 标记账号为跳过状态
      skipAccount(model, account.fileName)
      throw createError({ statusCode: completionResponse.status || 500, statusMessage: 'DeepSeek completion failed' })
    }

    // 准备流式响应转换
    const created = nowInSeconds()
    const completionId = sessionId
    const reasoningEnabled = isReasoningModel(model)

    // 创建 OpenAI 格式 SSE 输出流
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()

        // 状态变量
        let firstChunkSent = false
        let fullReasoning = '' // 累积推理内容
        let fullContent = '' // 累积输出内容
        let finished = false
        let buffer = '' // SSE 解析缓冲区

        // 心跳定时器，保持连接活跃
        const keepAliveTimer = setInterval(() => {
          if (!finished) {
            controller.enqueue(encoder.encode(': keep-alive\n\n'))
          }
        }, 5000)

        /**
         * 发送 OpenAI 格式的 chunk
         */
        const sendChunk = (delta: Record<string, string>) => {
          const payload = {
            id: completionId,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [{ index: 0, delta }]
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        }

        /**
         * 完成流式响应
         *
         * 发送最终 chunk（包含 usage 统计）和 [DONE] 标记
         */
        const finish = async () => {
          if (finished) return
          finished = true
          clearInterval(keepAliveTimer)

          // 计算 token 使用量
          const promptTokens = await countTokens(prompt)
          const reasoningTokens = reasoningEnabled ? await countTokens(fullReasoning) : 0
          const completionTokens = await countTokens(fullContent)

          // 发送最终 chunk
          const endChunk = {
            id: completionId,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
            usage: {
              prompt_tokens: promptTokens,
              completion_tokens: reasoningTokens + completionTokens,
              total_tokens: promptTokens + reasoningTokens + completionTokens,
              completion_tokens_details: {
                reasoning_tokens: reasoningTokens,
                completion_tokens: completionTokens
              }
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(endChunk)}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }

        // 异步处理 DeepSeek 响应流
        ;(async () => {
          const reader = completionResponse.body!.getReader()

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                break
              }

              if (!value) {
                continue
              }

              // 解析 SSE 行
              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() ?? ''

              for (const line of lines) {
                const event = parseDeepseekEvent(line)
                if (!event) continue

                // 处理结束事件
                if (event.p === 'done' || event.v === '[DONE]') {
                  await finish()
                  return
                }

                // 跳过搜索状态事件
                if (event.p === 'response/search_status') {
                  continue
                }

                // 处理数组类型事件（检查是否包含 FINISHED 信号）
                if (Array.isArray(event.v)) {
                  const hasFinishedSignal = event.v.some((item: unknown) => {
                    if (!item || typeof item !== 'object') {
                      return false
                    }

                    const maybeEvent = item as { p?: unknown, v?: unknown }
                    return maybeEvent.p === 'status' && maybeEvent.v === 'FINISHED'
                  })
                  if (hasFinishedSignal) {
                    await finish()
                    return
                  }
                  continue
                }

                // 跳过非字符串内容
                if (typeof event.v !== 'string' || !event.v) {
                  continue
                }

                const delta: Record<string, string> = {}

                // 首个 chunk 需要包含 role
                if (!firstChunkSent) {
                  delta.role = 'assistant'
                  firstChunkSent = true
                }

                // 根据事件类型设置 delta 内容
                if (event.p === 'response/thinking_content') {
                  // 推理内容
                  if (!reasoningEnabled) continue
                  fullReasoning += event.v
                  delta.reasoning_content = event.v
                } else {
                  // 普通内容
                  fullContent += event.v
                  delta.content = event.v
                }

                // 发送 chunk
                if (Object.keys(delta).length > 0) {
                  sendChunk(delta)
                }
              }
            }

            await finish()
          } catch (error) {
            clearInterval(keepAliveTimer)
            controller.error(error)
          } finally {
            // 释放账号锁
            releaseAccount(account.fileName)
            reader.releaseLock()
          }
        })()
      }
    })

    // 成功开始流式响应，清除跳过标记
    clearSkip(model, account.fileName)

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // 禁用 Nginx 缓冲
      }
    })
  } catch (error) {
    // 发生错误时释放账号锁
    releaseAccount(account.fileName)
    throw error
  }
}

/**
 * 注册 DeepSeek 账号到 Selector
 *
 * 在应用启动时由 config plugin 调用，完成：
 * 1. 从配置文件加载 DeepSeek 账号
 * 2. 注册账号到 selector（用于轮询选择）
 * 3. 注册 handler 到 handler registry（用于请求分发）
 */
export function RegisterDeepSeekAccounts() {
  console.log('🔍 Registering DeepSeek accounts to selector...')

  // 加载账号配置
  const accounts = getAccountsWithFiles('deepseek') as Array<{ fileName: string }>
  const fileNames = accounts.map(account => account.fileName)

  // 注册到 selector（指定支持的模型列表和 owner）
  registerAccount(fileNames, DEEPSEEK_MODELS, 'deepseek')

  // 注册 handler 到 registry
  registerProviderHandler('deepseek', DeepSeekHandler)

  console.log(`✅ Registered ${fileNames.length} DeepSeek accounts to selector.`)
}
