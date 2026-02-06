/**
 * selector.ts - 账号选择器模块
 *
 * 本模块实现了一个基于轮询的账号选择器，用于：
 * 1. 注册账号到指定模型的可用账号列表
 * 2. 按轮询顺序选择可用账号
 * 3. 管理账号的使用状态和临时跳过状态
 * 4. 记录模型的元数据（所有者、创建时间）
 *
 * 核心功能：
 * - registerAccount(): 注册账号到模型
 * - selectAccount(): 选择一个可用账号（轮询算法）
 * - releaseAccount(): 释放账号（标记为可用）
 * - skipAccount(): 临时跳过账号（如遇到错误时）
 * - clearSkip(): 清除跳过状态
 * - getModelOwner(): 获取模型所属的提供商
 *
 * 使用场景：
 * - 多账号负载均衡
 * - 账号限流/错误后的自动切换
 * - 按模型分配不同账号池
 */

// 账号类型定义
type Account = {
  inUse: boolean // 账号是否正在使用中
  fileName: string // 账号文件名
}

// 模型状态类型定义
type ModelState = {
  order: string[] // 账号轮询顺序
  cursor: number // 当前轮询位置
  skippedUntil: Map<string, number> // 账号跳过时间映射（文件名 -> 跳过截止时间戳）
}

// 模型元数据类型定义
type ModelMeta = {
  owner: string // 模型所有者
  created: number // 创建时间戳
}

// 已注册的账号列表
const registeredAccounts: Account[] = []
// 账号映射表（文件名 -> 账号对象）
const accountMap = new Map<string, Account>()
// 模型状态映射表（模型名 -> 模型状态）
const modelStates = new Map<string, ModelState>()
// 模型元数据映射表（模型名 -> 模型元数据）
const modelMeta = new Map<string, ModelMeta>()

/**
 * 确保模型状态存在
 * 如果模型状态不存在则创建新的状态对象
 * @param model 模型名称
 * @returns 模型状态对象
 */
function ensureModelState(model: string): ModelState {
  const existing = modelStates.get(model)
  if (existing) {
    return existing
  }
  const state: ModelState = {
    order: [],
    cursor: 0,
    skippedUntil: new Map()
  }
  modelStates.set(model, state)
  return state
}

/**
 * 添加或更新账号
 * 如果账号已存在则不做任何操作
 * @param account 账号文件名
 */
function upsertAccount(account: string) {
  if (accountMap.has(account)) {
    return
  }
  const item: Account = { inUse: false, fileName: account }
  registeredAccounts.push(item)
  accountMap.set(account, item)
}

/**
 * 注册账号到指定模型
 * 将账号添加到模型的轮询列表中
 * @param accounts 账号文件名数组
 * @param models 模型名称数组
 * @param owner 模型所有者
 */
function registerAccount(accounts: string[], models: string[], owner: string) {
  // 确保所有账号都已注册
  for (const account of accounts) {
    upsertAccount(account)
  }
  // 将账号添加到每个模型的轮询列表
  for (const model of models) {
    const state = ensureModelState(model)
    for (const account of accounts) {
      if (!state.order.includes(account)) {
        state.order.push(account)
      }
    }
    // 设置或更新模型元数据
    const existingMeta = modelMeta.get(model)
    if (!existingMeta) {
      modelMeta.set(model, { owner, created: Date.now() })
    } else if (existingMeta.owner !== owner && owner) {
      existingMeta.owner = owner
    }
  }
}

/**
 * 检查账号是否被跳过
 * @param state 模型状态
 * @param fileName 账号文件名
 * @param now 当前时间戳
 * @returns 如果账号被跳过返回 true，否则返回 false
 */
function isSkipped(state: ModelState, fileName: string, now: number) {
  const until = state.skippedUntil.get(fileName)
  if (!until) return false
  if (until <= now) {
    state.skippedUntil.delete(fileName)
    return false
  }
  return true
}

/**
 * 选择一个可用的账号
 * 使用轮询算法选择下一个可用的账号（跳过正在使用和被临时跳过的账号）
 * @param model 模型名称
 * @returns 可用的账号对象，如果没有可用账号则返回 null
 */
function selectAccount(model: string): Account | null {
  const state = ensureModelState(model)
  if (state.order.length === 0) return null

  const now = Date.now()
  const total = state.order.length
  let scanned = 0

  // 轮询查找可用账号
  while (scanned < total) {
    const index = state.cursor % total
    const fileName = state.order[index]!
    state.cursor = (index + 1) % total
    scanned += 1

    const account = accountMap.get(fileName)
    if (!account) continue
    if (account.inUse) continue
    if (isSkipped(state, fileName, now)) continue

    // 标记账号为使用中
    account.inUse = true
    return account
  }

  return null
}

/**
 * 释放账号
 * 将账号标记为可用状态
 * @param fileName 账号文件名
 */
function releaseAccount(fileName: string) {
  const account = accountMap.get(fileName)
  if (!account) return
  account.inUse = false
}

/**
 * 跳过账号
 * 将账号临时标记为不可用，在指定时间后自动恢复
 * @param model 模型名称
 * @param fileName 账号文件名
 * @param durationMs 跳过持续时间（毫秒），默认 30 秒
 */
function skipAccount(model: string, fileName: string, durationMs = 30_000) {
  const state = ensureModelState(model)
  const until = Date.now() + Math.max(0, durationMs)
  state.skippedUntil.set(fileName, until)
}

/**
 * 清除账号的跳过状态
 * @param model 模型名称
 * @param fileName 账号文件名
 */
function clearSkip(model: string, fileName: string) {
  const state = ensureModelState(model)
  state.skippedUntil.delete(fileName)
}

/**
 * 获取所有已注册的模型
 * @returns 模型信息数组
 */
function getRegisteredModels() {
  return Array.from(modelMeta.entries()).map(([id, meta]) => ({
    id,
    owner: meta.owner,
    created: meta.created
  }))
}

/**
 * 获取模型所有者
 * @param model 模型名称
 * @returns 模型所有者，不存在时返回 null
 */
function getModelOwner(model: string): string | null {
  const meta = modelMeta.get(model)
  if (!meta) return null
  return meta.owner
}

// 导出账号选择器相关函数
export {
  registerAccount,
  selectAccount,
  releaseAccount,
  skipAccount,
  clearSkip,
  getRegisteredModels,
  getModelOwner
}
// 导出类型定义
export type { Account }
