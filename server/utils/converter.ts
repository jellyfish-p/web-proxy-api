type MiddleContent = {
  model: string,
  messages: {
    role: 'system' | 'assistant' | 'user' | 'tool',
    content: string,
    name: string,
    tool_calls?: {
      id: string,
      type: string,
      function: {
        name: string,
        arguments: string
      },
      inlineData?: {
        mimeType: string,
        data: string
      }
    }[],
    tool_call_id?: string,
    teasoning_content?: string
  },
  temperature?: number,
  top_p?: number,
  top_k?: number,
  n?: number,
  stream?: boolean,
  presence_penalty?: number,
  frequency_penalty?: number,
  tools?: {
    type: string,
    function: {
      name: string,
      description: string,
      parameters: object
    }[]
  },
  tool_choice: {
    type: string,
    function: {
      name: string,
    }
  },
  seed: number,
  reasoning_effort: string,
}

/**
 * @description 将OPENAI v1/chat/completion接口的请求参数转换为适合本项目使用的格式
 */
function OpenaiCompletion() {

}

/**
 * @description 将GEMINI v1beta/models/{model}:generateContent接口的请求参数转换为适合本项目使用的格式
 */
function GeminiGenerateContent() {

}

/**
 * @description 将ANTHROPIC v1/messages接口的请求参数转换为适合本项目使用的格式
 */
function AnthropicMessage() {

}
