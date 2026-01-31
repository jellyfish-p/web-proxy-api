import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { parse, stringify } from 'yaml'
import { encryptPassword, isPasswordEncrypted } from './crypto'

let config: any = null
let configLoaded = false
let configPath: string = ''

export function loadConfig() {
    if (configLoaded) return config

    try {
        configPath = resolve(process.cwd(), 'config.yaml')
        const file = readFileSync(configPath, 'utf-8')
        config = parse(file)
        
        // 检查并加密管理员密码
        let needsSave = false
        if (config?.admin?.password && !isPasswordEncrypted(config.admin.password)) {
            console.log('🔒 Encrypting admin password...')
            const plainPassword = config.admin.password
            config.admin.password = encryptPassword(plainPassword)
            needsSave = true
        }
        
        // 如果需要保存，更新配置文件
        if (needsSave) {
            saveConfig()
            console.log('✓ Admin password encrypted and saved')
        }
        
        configLoaded = true
        console.log('✓ Config loaded successfully')
        return config
    } catch (error) {
        console.error('✗ Failed to load config:', error)
        process.exit(1)
    }
}

export function saveConfig() {
    try {
        if (!configPath) {
            configPath = resolve(process.cwd(), 'config.yaml')
        }
        const yamlContent = stringify(config, {
            indent: 2,
            lineWidth: 0,
            minContentWidth: 0
        })
        writeFileSync(configPath, yamlContent, 'utf-8')
    } catch (error) {
        console.error('✗ Failed to save config:', error)
        throw error
    }
}

export function getConfig() {
    if (!configLoaded) {
        loadConfig()
    }
    return config
}

export function getConfigValue(path: string, defaultValue?: any) {
    if (!configLoaded) {
        loadConfig()
    }

    const keys = path.split('.')
    let value = config

    for (const key of keys) {
        value = value?.[key]
        if (value === undefined) return defaultValue
    }

    return value
}
