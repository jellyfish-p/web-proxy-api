type Account = {
    inUse: boolean
    fileName: string
}

type ModelState = {
    order: string[]
    cursor: number
    skippedUntil: Map<string, number>
}

const registeredAccounts: Account[] = []
const accountMap = new Map<string, Account>()
const modelStates = new Map<string, ModelState>()

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

function upsertAccount(account: string) {
    if (accountMap.has(account)) {
        return
    }
    const item: Account = { inUse: false, fileName: account }
    registeredAccounts.push(item)
    accountMap.set(account, item)
}

function registerAccount(accounts: string[], models: string[]) {
    for (const account of accounts) {
        upsertAccount(account)
    }
    for (const model of models) {
        const state = ensureModelState(model)
        for (const account of accounts) {
            if (!state.order.includes(account)) {
                state.order.push(account)
            }
        }
    }
}

function isSkipped(state: ModelState, fileName: string, now: number) {
    const until = state.skippedUntil.get(fileName)
    if (!until) return false
    if (until <= now) {
        state.skippedUntil.delete(fileName)
        return false
    }
    return true
}

function selectAccount(model: string): Account | null {
    const state = ensureModelState(model)
    if (state.order.length === 0) return null

    const now = Date.now()
    const total = state.order.length
    let scanned = 0

    while (scanned < total) {
        const index = state.cursor % total
        const fileName = state.order[index]!
        state.cursor = (index + 1) % total
        scanned += 1

        const account = accountMap.get(fileName)
        if (!account) continue
        if (account.inUse) continue
        if (isSkipped(state, fileName, now)) continue

        account.inUse = true
        return account
    }

    return null
}

function releaseAccount(fileName: string) {
    const account = accountMap.get(fileName)
    if (!account) return
    account.inUse = false
}

function skipAccount(model: string, fileName: string, durationMs = 30_000) {
    const state = ensureModelState(model)
    const until = Date.now() + Math.max(0, durationMs)
    state.skippedUntil.set(fileName, until)
}

function clearSkip(model: string, fileName: string) {
    const state = ensureModelState(model)
    state.skippedUntil.delete(fileName)
}

export {
    registerAccount,
    selectAccount,
    releaseAccount,
    skipAccount,
    clearSkip
}
export type { Account }
