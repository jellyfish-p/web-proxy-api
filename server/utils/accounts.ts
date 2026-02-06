/**
 * accounts.ts - 账号管理模块
 *
 * 本模块负责账号文件的加载和管理，包括：
 * 1. 从 ./accounts 目录加载 JSON 格式的账号文件
 * 2. 按项目类型分组账号
 * 3. 缓存账号数据到内存
 *
 * 账号文件格式：
 * - 必须为 JSON 格式，放置在 ./accounts 目录下
 * - 必须包含 type 字段指定账号所属项目（如 "deepseek"）
 * - 其他字段由各项目模块定义（如 username, password, token）
 *
 * 使用方式：
 * - getAccounts(project): 获取指定项目的账号数据数组
 * - getAccountsWithFiles(project): 获取带文件名的账号条目数组
 */

// 导入文件系统和路径操作模块
import { readdirSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'

// 项目账号映射类型：项目名称到账号数组的映射
type ProjectAccounts = Record<string, string[]>

// 账号条目类型：包含文件名和账号数据
type AccountEntry<T = any> = {
  fileName: string // 账号文件名
  data: T // 账号数据
}

// 项目账号条目映射类型：项目名称到账号条目数组的映射
type ProjectAccountEntries = Record<string, AccountEntry[]>

// 缓存的账号数据
let cachedAccounts: ProjectAccounts | null = null
// 缓存的账号条目数据（包含文件名）
let cachedAccountEntries: ProjectAccountEntries | null = null

/**
 * 加载所有账号文件
 * 从 ./accounts 目录读取所有 JSON 格式的账号文件
 * @returns 返回按项目类型分组的账号数据
 */
async function loadAccounts(): Promise<ProjectAccounts> {
  const accountsDir = './accounts'
  const accounts: ProjectAccounts = {}
  const accountsWithFiles: ProjectAccountEntries = {}

  try {
    // 检查目录是否存在
    if (!existsSync(accountsDir)) {
      console.warn(`⚠️  Accounts directory not found: ${accountsDir}`)
      // 如果不存在就创建目录
      mkdirSync(accountsDir, { recursive: true })
      cachedAccounts = null
    }

    // 读取目录中的所有文件
    const files = readdirSync(accountsDir)

    for (const file of files) {
      // 只处理 JSON 文件
      if (!file.endsWith('.json')) {
        continue
      }

      try {
        const filePath = join(accountsDir, file)
        const fileContent = readFileSync(filePath, 'utf-8')

        const accountData = JSON.parse(fileContent)

        // 根据文件名或内容中的 project 字段确定项目类型
        const projectType = accountData.type

        if (projectType) {
          // 如果该项目类型还没有账号数组，则创建一个
          if (!accounts[projectType]) {
            accounts[projectType] = []
          }
          accounts[projectType]!.push(accountData)

          // 同时保存带文件名的账号条目
          if (!accountsWithFiles[projectType]) {
            accountsWithFiles[projectType] = []
          }
          accountsWithFiles[projectType]!.push({ fileName: file, data: accountData })
        }
      } catch (error) {
        console.error(`❌ Failed to load account file ${file}:`, error)
      }
    }

    // 统计并输出加载的账号总数
    const totalAccounts = Object.values(accounts).reduce((sum, arr) => sum + arr.length, 0)
    console.log(`✅ ${totalAccounts} Accounts Loaded, including: `)
    for (const [project, arr] of Object.entries(accounts)) {
      console.log(`   - ${project}: ${arr.length} accounts`)
    }

    // 更新缓存
    cachedAccounts = accounts
    cachedAccountEntries = accountsWithFiles
    return accounts
  } catch (error) {
    console.error('❌ Failed to load accounts:', error)
    return accounts
  }
}

/**
 * 获取账号数据
 * @param project 可选的项目名称，如果提供则返回该项目的账号数组，否则返回所有项目的账号映射
 * @returns 账号数组或账号映射对象
 */
function getAccounts(project?: string) {
  if (project) {
    if (!cachedAccounts) return []
    return cachedAccounts[project] || []
  }
  return cachedAccounts || {}
}

/**
 * 获取带文件名的账号条目数据
 * @param project 可选的项目名称，如果提供则返回该项目的账号条目数组，否则返回所有项目的账号条目映射
 * @returns 账号条目数组或账号条目映射对象
 */
function getAccountsWithFiles(project?: string) {
  if (project) {
    if (!cachedAccountEntries) return []
    return cachedAccountEntries[project] || []
  }
  return cachedAccountEntries || {}
}

// 导出账号管理相关函数
export { loadAccounts, getAccounts, getAccountsWithFiles }
// 导出类型定义
export type { ProjectAccounts, ProjectAccountEntries, AccountEntry }
