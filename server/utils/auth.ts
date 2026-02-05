// 导入加密模块
import { createHash } from 'crypto'
// 导入配置管理函数
import { getConfig, saveConfig } from './config'

// 加密密码的前缀标识
const ENCRYPT_PREFIX = '$encrypt$'

/**
 * 加密密码
 * 使用 SHA256 算法对密码进行加密
 * @param password 明文密码
 * @returns 加密后的密码（带前缀）
 */
function encryptPassword(password: string): string {
  const hash = createHash('sha256')
  hash.update(password)
  return ENCRYPT_PREFIX + hash.digest('hex')
}

/**
 * 验证密码
 * 支持明文密码和加密密码的验证
 * @param plainPassword 用户输入的明文密码
 * @param encryptedPassword 存储的密码（可能是明文或加密后的）
 * @returns 密码是否匹配
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
 * @param password 要检查的密码
 * @returns 如果密码已加密返回 true，否则返回 false
 */
function isPasswordEncrypted(password: string): boolean {
  return password.startsWith(ENCRYPT_PREFIX)
}

/**
 * 初始化仪表板密码 - 检测明文密码并自动加密
 * 如果配置文件中的密码是明文，则自动加密并保存
 * @returns 如果密码被加密并保存返回 true，否则返回 false
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

// 导出所有认证相关函数
export { encryptPassword, verifyPassword, isPasswordEncrypted, initDashboardPassword }
