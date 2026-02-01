import { readFile, writeFile } from "fs/promises"
import { join } from "path"
import { parse, stringify } from 'yaml'

type Config = {
    dashboard: {
        enable: boolean,
        password: string
    },
    projects?: {
        deepseek?: {},
        grok?: {},
        claude?: {},
        kimi?: {}
    },
    keys: [string]

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

export { loadConfig, getConfig, reloadConfig, saveConfig }
export type { Config }