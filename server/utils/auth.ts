// 导入加密模块
import { createHash } from 'crypto'
// 导入配置管理函数
import { getConfig, saveConfig } from './config'

// 加密密码的前缀标识
const ENCRYPT_PREFIX = '$encrypt$'

// Dashboard 登录态 Cookie 名称
const DASHBOARD_AUTH_COOKIE = 'dashboard_auth'
// Dashboard 登录态哈希算法版本，用于后续平滑升级算法
const DASHBOARD_AUTH_VERSION = 'v1'
// Dashboard 登录态哈希盐（固定字符串，避免与其他哈希用途混用）
const DASHBOARD_AUTH_SALT = 'web-proxy-api:dashboard:auth'

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
 * 生成 Dashboard 登录态哈希
 *
 * 设计目标：
 * 1. 仅依赖本地 config 中的 dashboard.password（明文或加密串）
 * 2. 当且仅当 password 变化时，登录态哈希失效
 * 3. 同一份配置下可长期复用（满足“密码不变即可一直通过鉴权”）
 *
 * @param configPassword 配置中的 dashboard.password 原始值
 * @returns 可写入 Cookie 的稳定哈希字符串
 */
function createDashboardAuthHash(configPassword: string): string {
  const hash = createHash('sha256')
  hash.update(`${DASHBOARD_AUTH_SALT}:${DASHBOARD_AUTH_VERSION}:${configPassword}`)
  return `${DASHBOARD_AUTH_VERSION}.${hash.digest('hex')}`
}

/**
 * 校验 Dashboard 登录态哈希
 * @param authHash Cookie 中携带的登录态哈希
 * @param configPassword 当前配置中的 dashboard.password
 * @returns 是否有效
 */
function verifyDashboardAuthHash(authHash: string, configPassword: string): boolean {
  if (!authHash) {
    return false
  }
  return authHash === createDashboardAuthHash(configPassword)
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
export {
  ENCRYPT_PREFIX,
  DASHBOARD_AUTH_COOKIE,
  encryptPassword,
  verifyPassword,
  createDashboardAuthHash,
  verifyDashboardAuthHash,
  isPasswordEncrypted,
  initDashboardPassword
}
