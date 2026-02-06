/**
 * auth.ts - DeepSeek 账号认证模块
 *
 * 本模块负责 DeepSeek 账号的登录认证，包括：
 * 1. 支持邮箱和手机号两种登录方式
 * 2. 自动识别账号类型
 * 3. 获取并保存认证令牌
 *
 * 核心函数：
 * - loginDeepseekViaAccount(): 使用账号对象登录
 * - LoginWithPassword(): 使用用户名密码登录
 */

// 导入文件系统操作模块
import { writeFile } from 'fs/promises'
import { join } from 'path'
// 导入账号管理函数
import { getAccountsWithFiles } from '../../accounts'
// 导入 DeepSeek 相关常量
import { DEEPSEEK_BASE_HEADERS, DEEPSEEK_LOGIN_URL } from './const'

// DeepSeek 账号类型定义（仅账密）
type DeepseekAccount = {
  username?: string // 账号（邮箱或手机号）
  password?: string // 密码
  token?: string // 认证令牌
  type?: string // 账号类型
  fileName?: string // 账号文件名
}

// 账号目录路径
const accountsDir = './accounts'

/**
 * 判断是否为手机号
 * @param username 用户名
 * @returns 如果是手机号返回 true，否则返回 false
 */
const isMobile = (username: string) => {
  const mobileRegex = /^1[3-9]\d{9}$/
  return mobileRegex.test(username)
}

/**
 * 获取账号标识符
 * @param account DeepSeek 账号对象
 * @returns 账号标识符（username）
 */
const getAccountIdentifier = (account: DeepseekAccount) => {
  return account.username?.trim() ?? ''
}

/**
 * 规范化账号文件名
 * 确保文件名以 .json 结尾
 * @param fileName 文件名
 * @returns 规范化后的文件名
 */
const normalizeAccountFileName = (fileName: string) => {
  if (fileName.endsWith('.json')) return fileName
  return `${fileName}.json`
}

/**
 * 查找账号条目
 * 根据文件名或账号标识符查找对应的账号条目
 * @param account DeepSeek 账号对象
 * @returns 账号条目对象，如果未找到则返回 null
 */
const findAccountEntry = (account: DeepseekAccount) => {
  const entries = getAccountsWithFiles('deepseek')
  if (!Array.isArray(entries) || entries.length === 0) {
    return null
  }

  // 如果提供了文件名，优先按文件名查找
  if (account.fileName) {
    const normalized = normalizeAccountFileName(account.fileName)
    return (
      entries.find(entry => normalizeAccountFileName(entry.fileName) === normalized)
      || null
    )
  }

  // 否则按账号标识符（username）查找
  const accountId = getAccountIdentifier(account)
  if (!accountId) return null

  return (
    entries.find((entry) => {
      const data = entry.data as DeepseekAccount
      const dataId = getAccountIdentifier(data)
      return Boolean(dataId && dataId === accountId)
    }) || null
  )
}

/**
 * 保存账号到文件
 * 将更新后的账号信息保存到对应的 JSON 文件
 * @param account DeepSeek 账号对象
 * @returns 保存成功返回 true，否则返回 false
 */
const saveAccountToFile = async (account: DeepseekAccount) => {
  const entry = findAccountEntry(account)
  if (!entry) {
    console.warn('⚠️  Account file not found, skipping save')
    return false
  }

  const data = entry.data as DeepseekAccount
  Object.assign(data, account)

  try {
    const filePath = join(accountsDir, entry.fileName)
    const content = JSON.stringify(data, null, 2)
    await writeFile(filePath, content, 'utf-8')
    console.log('✅ Account updated successfully')
    return true
  } catch (error) {
    console.error('❌ Failed to save account:', error)
    return false
  }
}

/**
 * 构建登录请求载荷
 * 根据账号信息构建登录 API 所需的请求体
 * @param account DeepSeek 账号对象
 * @returns 登录请求载荷对象
 * @throws 如果账号信息不完整则抛出错误
 */
const buildLoginPayload = (account: DeepseekAccount) => {
  const username = account.username?.trim() ?? ''
  const password = account.password?.trim() ?? ''

  if (!username || !password) {
    throw new Error('账号缺少必要的登录信息（必须提供 username 和 password）')
  }

  // 自动识别：邮箱账号
  if (username.includes('@')) {
    return {
      email: username,
      password,
      device_id: 'web_proxy_api',
      os: 'android'
    }
  }

  // 自动识别：手机号账号
  if (!isMobile(username)) {
    throw new Error('账号格式不正确（必须是邮箱或大陆手机号）')
  }

  return {
    mobile: username,
    area_code: null,
    password,
    device_id: 'web_proxy_api',
    os: 'android'
  }
}

/**
 * DeepSeek 登录响应类型（仅包含当前逻辑使用到的字段）
 */
type DeepseekLoginResponse = {
  data?: {
    biz_data?: {
      user?: {
        token?: string
      }
    }
  }
}

/**
 * 解析登录响应
 * 从登录 API 响应中提取认证令牌
 * @param response 登录 API 响应对象
 * @returns 认证令牌字符串
 * @throws 如果响应格式不正确或缺少令牌则抛出错误
 */
const parseLoginResponse = async (response: Response) => {
  let data: DeepseekLoginResponse
  try {
    const text = await response.text()
    console.warn(`[login_deepseek_via_account] ${text}`)
    data = JSON.parse(text) as DeepseekLoginResponse
  } catch (error) {
    console.error('[login_deepseek_via_account] JSON解析失败:', error)
    throw new Error('Account login failed: invalid JSON response')
  }

  if (
    data?.data == null
    || data.data?.biz_data == null
    || data.data?.biz_data?.user == null
  ) {
    console.error('[login_deepseek_via_account] 登录响应格式错误:', data)
    throw new Error('Account login failed: invalid response format')
  }

  const token = data.data.biz_data.user?.token
  if (!token) {
    console.error('[login_deepseek_via_account] 登录响应中缺少 token:', data)
    throw new Error('Account login failed: missing token')
  }

  return token as string
}

/**
 * 使用账号登录 DeepSeek
 * 发送登录请求并保存获取的认证令牌
 * @param account DeepSeek 账号对象
 * @returns 认证令牌字符串
 * @throws 如果登录失败则抛出错误
 */
async function loginDeepseekViaAccount(account: DeepseekAccount) {
  const payload = buildLoginPayload(account)

  let response: Response
  try {
    response = await fetch(DEEPSEEK_LOGIN_URL, {
      method: 'POST',
      headers: DEEPSEEK_BASE_HEADERS,
      body: JSON.stringify(payload)
    })
  } catch (error) {
    console.error('[login_deepseek_via_account] 登录请求异常:', error)
    throw new Error('Account login failed: 请求异常')
  }

  if (!response.ok) {
    console.error(
      `[login_deepseek_via_account] 登录失败, status=${response.status}`
    )
    throw new Error('Account login failed: status not ok')
  }

  const token = await parseLoginResponse(response)
  account.token = token
  await saveAccountToFile(account)
  return token
}

/**
 * 使用用户名和密码登录
 * 根据用户名格式（邮箱或手机号）自动选择登录方式
 * @param username 账号（邮箱或手机号）
 * @param password 密码
 * @returns 认证令牌字符串
 */
async function LoginWithPassword(username: string, password: string) {
  const account: DeepseekAccount = { username, password }
  return await loginDeepseekViaAccount(account)
}

// 导出登录相关函数
export { LoginWithPassword, loginDeepseekViaAccount }
// 导出类型定义
export type { DeepseekAccount }
