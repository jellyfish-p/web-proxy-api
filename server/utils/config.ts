// 导入文件系统操作相关模块
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
// 导入 YAML 解析和序列化模块
import { parse, stringify } from 'yaml'

// 配置文件类型定义
type Config = {
  // 仪表板配置
  dashboard: {
    enable: boolean // 是否启用仪表板
    password: string // 仪表板密码
  }
  // 项目配置（可选）
  projects?: {
    [key: string]: object // 项目名称到配置对象的映射
  }
  keys: [string] // API 密钥列表

}

// 内存中的配置缓存
let cachedConfig: Config | null = null

/**
 * 从文件加载配置
 */
async function loadConfig(): Promise<Config | null> {
  try {
    const filePath = join('./config.yaml')
    const config = await readFile(filePath, 'utf-8')
      .then(text => parse(text) as Config)
    cachedConfig = config
    console.log('✅ Config loaded successfully')
    return config
  } catch (error) {
    console.error('❌ Failed to load config:', error)
    return null
  }
}

/**
 * 获取缓存的配置
 */
function getConfig(): Config | null {
  return cachedConfig
}

/**
 * 重新加载配置
 */
async function reloadConfig(): Promise<Config | null> {
  console.log('🔄 Reloading config...')
  return await loadConfig()
}

/**
 * 保存配置到文件
 */
async function saveConfig(config: Config): Promise<boolean> {
  try {
    const filePath = join('./config.yaml')
    const yamlContent = stringify(config)
    await writeFile(filePath, yamlContent, 'utf-8')
    console.log('✅ Config saved successfully')
    await reloadConfig()
    return true
  } catch (error) {
    console.error('❌ Failed to save config:', error)
    return false
  }
}

/**
 * 检查 API Key 是否存在
 * @param apiKey 要检查的 API 密钥
 * @returns 如果密钥存在返回 true，否则返回 false
 */
function CheckApiKey(apiKey: string): boolean {
  if (cachedConfig && cachedConfig.keys.includes(apiKey)) return true
  return false
}

// 导出所有配置相关函数
export { loadConfig, getConfig, reloadConfig, saveConfig, CheckApiKey }
// 导出配置类型
export type { Config }
