import { createHash } from 'crypto'
import { getConfig } from "./config"
import { saveConfig } from "./config"

const ENCRYPT_PREFIX = '$encrypt$'

/**
 * 加密密码
 */
function encryptPassword(password: string): string {
    const hash = createHash('sha256')
    hash.update(password)
    return ENCRYPT_PREFIX + hash.digest('hex')
}

/**
 * 验证密码
 */
function verifyPassword(plainPassword: string, encryptedPassword: string): boolean {
    if (!encryptedPassword.startsWith(ENCRYPT_PREFIX)) {
        // 如果是明文密码，直接比较
        return plainPassword === encryptedPassword
    }
    const encrypted = encryptPassword(plainPassword)
    return encrypted === encryptedPassword
}

/**
 * 检查密码是否已加密
 */
function isPasswordEncrypted(password: string): boolean {
    return password.startsWith(ENCRYPT_PREFIX)
}

/**
 * 初始化仪表板密码 - 检测明文密码并自动加密
 */
async function initDashboardPassword(): Promise<boolean> {
    const config = getConfig()
    if (!config || !config.dashboard.enable) {
        return false
    }
    
    const password = config.dashboard.password
    
    // 检查密码是否已加密
    if (isPasswordEncrypted(password)) {
        console.log('✅ Dashboard password is already encrypted')
        return false
    }
    
    // 密码是明文，需要加密
    console.log('⚠️  Detected plaintext password, encrypting...')
    const encryptedPassword = encryptPassword(password)
    
    // 更新配置中的密码
    config.dashboard.password = encryptedPassword
    
    // 保存到文件
    await saveConfig(config)
    
    console.log('✅ Dashboard password encrypted and saved successfully')
    return true
}

export { encryptPassword, verifyPassword, isPasswordEncrypted, initDashboardPassword }