/**
 * converter.ts - 请求格式转换器模块
 *
 * 本模块负责将不同 API 格式（OpenAI、Gemini、Anthropic）的请求
 * 转换为统一的中间格式（MiddleContent），便于后续统一处理。
 *
 * 支持的输入格式：
 * - OpenAI Chat Completions API (v1/chat/completions)
 * - Google Gemini API (v1beta/models/{model}:generateContent)
 * - Anthropic Messages API (v1/messages)
 *
 * 核心类型：
 * - MiddleContent: 统一的请求中间格式
 * - MiddleMessage: 统一的消息格式
 * - MiddleTool: 统一的工具定义格式
 *
 * 转换函数：
 * - OpenaiCompletion(): OpenAI 请求 -> MiddleContent
 * - GeminiGenerateContent(): Gemini 请求 -> MiddleContent
 * - AnthropicMessage(): Anthropic 请求 -> MiddleContent
 * - MiddleContentToPrompt(): MiddleContent -> DeepSeek prompt 字符串
 */

// 中间层工具调用类型定义
export type MiddleToolCall = {
  id: string
  type: string
  function: {
    name: string
    arguments: string
  }
  inlineData?: {
    mimeType: string
    data: string
  }
}

// 中间层消息类型定义
export type MiddleMessage = {
  role: 'system' | 'assistant' | 'user' | 'tool'
  content: string
  name?: string
  tool_calls?: MiddleToolCall[]
  tool_call_id?: string
  reasoning_content?: string
}

// 中间层工具类型定义
export type MiddleTool = {
  type: string
  function: {
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }
}

// 中间层工具选择类型定义
export type MiddleToolChoice = 'none' | 'auto' | 'required' | {
  type: 'function'
  function: {
    name: string
  }
}

// 中间层内容类型定义（统一格式）
export type MiddleContent = {
  model: string
  messages: MiddleMessage[]
  temperature?: number
  top_p?: number
  top_k?: number
  n?: number
  stream?: boolean
  presence_penalty?: number
  frequency_penalty?: number
  tools?: MiddleTool[]
  tool_choice?: MiddleToolChoice
  seed?: number
  reasoning_effort?: 'low' | 'medium' | 'high' | string
}

// OpenAI 聊天补全请求类型定义
export type OpenAIChatCompletionRequest = {
  model: string
  messages: Array<{
    role: 'system' | 'assistant' | 'user' | 'tool'
    content: string | Array<{ type: 'text', text: string }>
    name?: string
    tool_calls?: Array<{
      id: string
      type: 'function'
      function: {
        name: string
        arguments: string
      }
    }>
    tool_call_id?: string
    reasoning_content?: string
  }>
  temperature?: number
  top_p?: number
  n?: number
  stream?: boolean
  presence_penalty?: number
  frequency_penalty?: number
  tools?: Array<{
    type: 'function'
    function: {
      name: string
      description?: string
      parameters?: Record<string, unknown>
    }
  }>
  tool_choice?: MiddleToolChoice
  seed?: number
  reasoning_effort?: 'low' | 'medium' | 'high' | string
}

// Gemini 部分内容类型定义
export type GeminiPart = {
  text?: string
  inlineData?: {
    mimeType: string
    data: string
  }
  functionCall?: {
    name: string
    args: Record<string, unknown>
  }
  functionResponse?: {
    name: string
    response: Record<string, unknown>
  }
}

// Gemini 生成内容请求类型定义
export type GeminiGenerateContentRequest = {
  model?: string
  contents: Array<{
    role?: 'user' | 'model'
    parts: GeminiPart[]
  }>
  systemInstruction?: {
    parts: GeminiPart[]
  }
  generationConfig?: {
    temperature?: number
    topP?: number
    topK?: number
    candidateCount?: number
    stopSequences?: string[]
    maxOutputTokens?: number
    seed?: number
  }
  tools?: Array<{
    functionDeclarations?: Array<{
      name: string
      description?: string
      parameters?: Record<string, unknown>
    }>
  }>
  toolConfig?: {
    functionCallingConfig?: {
      mode?: 'AUTO' | 'ANY' | 'NONE'
      allowedFunctionNames?: string[]
    }
  }
}

// Anthropic 消息请求类型定义
export type AnthropicMessageRequest = {
  model: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: string | Array<
      | { type: 'text', text: string }
      | {
        type: 'tool_use'
        id: string
        name: string
        input: Record<string, unknown>
      }
      | {
        type: 'tool_result'
        tool_use_id: string
        content: string
      }
    >
  }>
  system?: string | Array<{ type: 'text', text: string }>
  temperature?: number
  top_p?: number
  top_k?: number
  stream?: boolean
  stop_sequences?: string[]
  max_tokens?: number
  tools?: Array<{
    name: string
    description?: string
    input_schema?: Record<string, unknown>
  }>
}

/**
 * 将文本内容转换为字符串
 * @param content - 字符串或文本对象数组
 * @returns 转换后的字符串
 */
function toTextContent(content: string | Array<{ type: 'text', text: string }>): string {
  if (typeof content === 'string') {
    return content
  }
  return content
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n')
}

/**
 * 安全地将值转换为 JSON 字符串
 * @param value - 要转换的值
 * @returns JSON 字符串，失败时返回空对象字符串
 */
function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? {})
  } catch {
    return '{}'
  }
}

/**
 * 解析 JSON 对象或返回原始文本
 * @param value - 要解析的字符串
 * @returns 包含解析后的对象和文本的对象
 */
function parseJsonObjectOrRawText(value: string): { parsed: Record<string, unknown>, text: string } {
  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { parsed: parsed as Record<string, unknown>, text: '' }
    }
  } catch {
    // 解析失败，忽略错误
  }
  return { parsed: {}, text: value }
}

/**
 * 将 OpenAI v1/chat/completion 接口的请求参数转换为适合本项目使用的格式
 * @param body - OpenAI 聊天补全请求对象
 * @returns 中间层内容对象
 */
export function OpenaiCompletion(body: OpenAIChatCompletionRequest): MiddleContent {
  return {
    model: body.model,
    messages: body.messages.map(message => ({
      role: message.role,
      content: toTextContent(message.content),
      name: message.name,
      tool_calls: message.tool_calls?.map(toolCall => ({
        id: toolCall.id,
        type: toolCall.type,
        function: {
          name: toolCall.function.name,
          arguments: toolCall.function.arguments
        }
      })),
      tool_call_id: message.tool_call_id,
      reasoning_content: message.reasoning_content,
      teasoning_content: message.reasoning_content
    })),
    temperature: body.temperature,
    top_p: body.top_p,
    n: body.n,
    stream: body.stream,
    presence_penalty: body.presence_penalty,
    frequency_penalty: body.frequency_penalty,
    tools: body.tools?.map(tool => ({
      type: tool.type,
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters
      }
    })),
    tool_choice: body.tool_choice,
    seed: body.seed,
    reasoning_effort: body.reasoning_effort
  }
}

/**
 * 将 Gemini v1beta/models/{model}:generateContent 接口的请求参数转换为适合本项目使用的格式
 * @param body - Gemini 生成内容请求对象
 * @returns 中间层内容对象
 */
export function GeminiGenerateContent(body: GeminiGenerateContentRequest): MiddleContent {
  const messages: MiddleMessage[] = []

  // 处理系统指令
  if (body.systemInstruction?.parts?.length) {
    const systemText = body.systemInstruction.parts
      .map(part => part.text)
      .filter(Boolean)
      .join('\n')
    if (systemText) {
      messages.push({
        role: 'system',
        content: systemText
      })
    }
  }

  // 处理内容消息
  for (const content of body.contents ?? []) {
    const role: MiddleMessage['role'] = content.role === 'model' ? 'assistant' : 'user'

    for (const part of content.parts ?? []) {
      // 处理文本部分
      if (part.text) {
        messages.push({
          role,
          content: part.text
        })
      }

      // 处理内联数据
      if (part.inlineData) {
        messages.push({
          role,
          content: '',
          tool_calls: [
            {
              id: `inline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              type: 'inline_data',
              function: {
                name: 'inlineData',
                arguments: '{}'
              },
              inlineData: {
                mimeType: part.inlineData.mimeType,
                data: part.inlineData.data
              }
            }
          ]
        })
      }

      // 处理函数调用
      if (part.functionCall) {
        messages.push({
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: `fc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              type: 'function',
              function: {
                name: part.functionCall.name,
                arguments: safeJsonStringify(part.functionCall.args)
              }
            }
          ]
        })
      }

      // 处理函数响应
      if (part.functionResponse) {
        messages.push({
          role: 'tool',
          name: part.functionResponse.name,
          content: safeJsonStringify(part.functionResponse.response)
        })
      }
    }
  }

  // 处理工具声明
  const tools: MiddleTool[] = []
  for (const tool of body.tools ?? []) {
    for (const declaration of tool.functionDeclarations ?? []) {
      tools.push({
        type: 'function',
        function: {
          name: declaration.name,
          description: declaration.description,
          parameters: declaration.parameters
        }
      })
    }
  }

  // 处理工具选择配置
  let toolChoice: MiddleToolChoice | undefined
  const mode = body.toolConfig?.functionCallingConfig?.mode
  const allowed = body.toolConfig?.functionCallingConfig?.allowedFunctionNames
  if (mode === 'NONE') {
    toolChoice = 'none'
  } else if (mode === 'AUTO') {
    toolChoice = 'auto'
  } else if (mode === 'ANY') {
    if (allowed?.length === 1 && allowed[0]) {
      toolChoice = {
        type: 'function',
        function: {
          name: allowed[0]
        }
      }
    } else {
      toolChoice = 'required'
    }
  }

  return {
    model: body.model ?? 'gemini',
    messages,
    temperature: body.generationConfig?.temperature,
    top_p: body.generationConfig?.topP,
    top_k: body.generationConfig?.topK,
    n: body.generationConfig?.candidateCount,
    tools: tools.length ? tools : undefined,
    tool_choice: toolChoice,
    seed: body.generationConfig?.seed
  }
}

/**
 * 将 Anthropic v1/messages 接口的请求参数转换为适合本项目使用的格式
 * @param body - Anthropic 消息请求对象
 * @returns 中间层内容对象
 */
export function AnthropicMessage(body: AnthropicMessageRequest): MiddleContent {
  const messages: MiddleMessage[] = []

  // 处理系统消息
  if (body.system) {
    const systemText = typeof body.system === 'string'
      ? body.system
      : body.system
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join('\n')

    if (systemText) {
      messages.push({
        role: 'system',
        content: systemText
      })
    }
  }

  // 处理消息内容
  for (const message of body.messages) {
    // 处理字符串类型的内容
    if (typeof message.content === 'string') {
      messages.push({
        role: message.role,
        content: message.content
      })
      continue
    }

    // 处理复杂内容类型
    for (const part of message.content) {
      // 处理文本部分
      if (part.type === 'text') {
        messages.push({
          role: message.role,
          content: part.text
        })
      }

      // 处理工具使用
      if (part.type === 'tool_use') {
        messages.push({
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: part.id,
              type: 'function',
              function: {
                name: part.name,
                arguments: safeJsonStringify(part.input)
              }
            }
          ]
        })
      }

      // 处理工具结果
      if (part.type === 'tool_result') {
        const parsed = parseJsonObjectOrRawText(part.content)
        messages.push({
          role: 'tool',
          content: parsed.text,
          tool_call_id: part.tool_use_id,
          tool_calls: Object.keys(parsed.parsed).length
            ? [
                {
                  id: part.tool_use_id,
                  type: 'function_result',
                  function: {
                    name: 'toolResult',
                    arguments: safeJsonStringify(parsed.parsed)
                  }
                }
              ]
            : undefined
        })
      }
    }
  }

  return {
    model: body.model,
    messages,
    temperature: body.temperature,
    top_p: body.top_p,
    top_k: body.top_k,
    stream: body.stream,
    tools: body.tools?.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }
    }))
  }
}

/**
 * 转prompt请求体
 * @param content 输入数据
 */
export function MiddleContentToPrompt(content: MiddleContent): string {
  let prompt = ''
  for (const message of content.messages) {
    const role = message.role
    const itemContent = message.content
    let text = ''
    if (role === 'user')
      text = `<|User|>${itemContent}`
    else if (role === 'system')
      text = `<|system|>${itemContent}`
    else if (role === 'tool')
      text = `<|tool_outputs id=${message.tool_call_id}|>${itemContent}`
    else if (role === 'assistant') {
      text = '<|Assistant|>'
      if (message.reasoning_content) {
        text += `<|Thought|>${message.reasoning_content}<｜end▁of▁sentence｜>`
      }
      if (message.tool_calls) {
        text += '<|ToolCall|>'
        for (const tool_call of message.tool_calls) {
          text += `<|Tool id=${tool_call.id} type=${tool_call.type} name=${tool_call.function.name} arguments=${tool_call.function.arguments}|>`
        }
      }
      text += itemContent
      text += '<｜end▁of▁sentence｜>'
    }
    prompt += text + '\n'
  }

  return prompt
}
