// 导入 Hugging Face tokenizer 库
import { Tokenizer } from '@huggingface/tokenizers'
// 导入文件系统操作模块
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'

// tokenizer 配置文件路径
const tokenizerPath = fileURLToPath(new URL('./tokenizer.json', import.meta.url))

// Tokenizer 配置类型定义
type TokenizerConfig = Record<string, unknown>

// tokenizer 实例的 Promise 缓存
let tokenizerPromise: Promise<Tokenizer> | undefined

/**
 * 加载 tokenizer
 * 从 JSON 文件加载 tokenizer 配置并创建实例
 * @returns Tokenizer 实例
 */
const loadTokenizer = async (): Promise<Tokenizer> => {
  const raw = await readFile(tokenizerPath, 'utf-8')
  const tokenizerJson = JSON.parse(raw) as Record<string, unknown>
  const tokenizerConfig
    = (tokenizerJson as { tokenizer_config?: TokenizerConfig }).tokenizer_config ?? {}
  return new Tokenizer(tokenizerJson, tokenizerConfig)
}

/**
 * 获取 tokenizer 实例
 * 使用单例模式，确保只加载一次
 * @returns Tokenizer 实例的 Promise
 */
const getTokenizer = (): Promise<Tokenizer> => {
  if (!tokenizerPromise) {
    tokenizerPromise = loadTokenizer()
  }

  return tokenizerPromise
}

/**
 * 计算文本的 token 数量
 * @param text 要计算的文本
 * @returns token 数量
 */
export const countTokens = async (text: string): Promise<number> => {
  const tokenizer = await getTokenizer()
  const encoding = tokenizer.encode(text ?? '')
  return encoding.ids.length
}
