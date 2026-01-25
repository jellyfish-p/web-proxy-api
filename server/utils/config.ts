import { readFileSync } from 'fs'
import { resolve } from 'path'
import { parse } from 'yaml'

let config: any = null
let configLoaded = false

export function loadConfig() {
    if (configLoaded) return config

    try {
        const configPath = resolve(process.cwd(), 'config.yaml')
        const file = readFileSync(configPath, 'utf-8')
        config = parse(file)
        configLoaded = true
        console.log('✓ Config loaded successfully')
        return config
    } catch (error) {
        console.error('✗ Failed to load config:', error)
        process.exit(1)
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
