import { readdirSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'

type ProjectAccounts = Record<string, string[]>

let cachedAccounts: ProjectAccounts | null = null

async function loadAccounts(): Promise<ProjectAccounts> {
  const accountsDir = './accounts'
  const accounts: ProjectAccounts = {}

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
      // 只处理 JSON 和 YAML 文件
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
          if (!accounts[projectType]) {
            accounts[projectType] = []
          }
          accounts[projectType]!.push(accountData)
        }
      } catch (error) {
        console.error(`❌ Failed to load account file ${file}:`, error)
      }
    }

    const totalAccounts = Object.values(accounts).reduce((sum, arr) => sum + arr.length, 0)
    console.log(`✅ ${totalAccounts} Accounts Loaded, including: `)
    for (const [project, arr] of Object.entries(accounts)) {
      console.log(`   - ${project}: ${arr.length} accounts`)
    }

    cachedAccounts = accounts
    return accounts
  } catch (error) {
    console.error('❌ Failed to load accounts:', error)
    return accounts
  }
}

function getAccounts(project?: string) {
  if (project) {
    if (!cachedAccounts) return []
    return cachedAccounts[project] || []
  }
  return cachedAccounts || {}
}

export { loadAccounts, getAccounts }
export type { ProjectAccounts }
