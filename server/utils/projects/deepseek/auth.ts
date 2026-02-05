import { writeFile } from "fs/promises"
import { join } from "path"
import { getAccountsWithFiles } from "../../accounts"
import { DEEPSEEK_BASE_HEADERS, DEEPSEEK_LOGIN_URL } from "./const"

type DeepseekAccount = {
  email?: string
  mobile?: string
  password?: string
  token?: string
  type?: string
  fileName?: string
}

const accountsDir = "./accounts"

const isMobile = (username: string) => {
  const mobileRegex = /^1[3-9]\d{9}$/
  return mobileRegex.test(username)
}

const getAccountIdentifier = (account: DeepseekAccount) => {
  const email = account.email?.trim() ?? ""
  const mobile = account.mobile?.trim() ?? ""
  return email || mobile
}

const normalizeAccountFileName = (fileName: string) => {
  if (fileName.endsWith(".json")) return fileName
  return `${fileName}.json`
}

const findAccountEntry = (account: DeepseekAccount) => {
  const entries = getAccountsWithFiles("deepseek")
  if (!Array.isArray(entries) || entries.length === 0) {
    return null
  }

  if (account.fileName) {
    const normalized = normalizeAccountFileName(account.fileName)
    return (
      entries.find(entry => normalizeAccountFileName(entry.fileName) === normalized) ||
      null
    )
  }

  const accountId = getAccountIdentifier(account)
  if (!accountId) return null

  return (
    entries.find(entry => {
      const data = entry.data as DeepseekAccount
      const dataId = getAccountIdentifier(data)
      return Boolean(dataId && dataId === accountId)
    }) || null
  )
}

const saveAccountToFile = async (account: DeepseekAccount) => {
  const entry = findAccountEntry(account)
  if (!entry) {
    console.warn("⚠️  Account file not found, skipping save")
    return false
  }

  const data = entry.data as DeepseekAccount
  Object.assign(data, account)

  try {
    const filePath = join(accountsDir, entry.fileName)
    const content = JSON.stringify(data, null, 2)
    await writeFile(filePath, content, "utf-8")
    console.log("✅ Account updated successfully")
    return true
  } catch (error) {
    console.error("❌ Failed to save account:", error)
    return false
  }
}

const buildLoginPayload = (account: DeepseekAccount) => {
  const email = account.email?.trim() ?? ""
  const mobile = account.mobile?.trim() ?? ""
  const password = account.password?.trim() ?? ""

  if (!password || (!email && !mobile)) {
    throw new Error("账号缺少必要的登录信息（必须提供 email 或 mobile 以及 password）")
  }

  if (email) {
    return {
      email,
      password,
      device_id: "web_proxy_api",
      os: "android"
    }
  }

  if (!isMobile(mobile)) {
    throw new Error("手机号格式不正确")
  }

  return {
    mobile,
    area_code: null,
    password,
    device_id: "web_proxy_api",
    os: "android"
  }
}

const parseLoginResponse = async (response: Response) => {
  let data: Record<string, any>
  try {
    const text = await response.text()
    console.warn(`[login_deepseek_via_account] ${text}`)
    data = JSON.parse(text) as Record<string, any>
  } catch (error) {
    console.error("[login_deepseek_via_account] JSON解析失败:", error)
    throw new Error("Account login failed: invalid JSON response")
  }

  if (
    data?.data == null ||
    data.data?.biz_data == null ||
    data.data?.biz_data?.user == null
  ) {
    console.error("[login_deepseek_via_account] 登录响应格式错误:", data)
    throw new Error("Account login failed: invalid response format")
  }

  const token = data.data.biz_data.user?.token
  if (!token) {
    console.error("[login_deepseek_via_account] 登录响应中缺少 token:", data)
    throw new Error("Account login failed: missing token")
  }

  return token as string
}

async function loginDeepseekViaAccount(account: DeepseekAccount) {
  const payload = buildLoginPayload(account)

  let response: Response
  try {
    response = await fetch(DEEPSEEK_LOGIN_URL, {
      method: "POST",
      headers: DEEPSEEK_BASE_HEADERS,
      body: JSON.stringify(payload)
    })
  } catch (error) {
    console.error("[login_deepseek_via_account] 登录请求异常:", error)
    throw new Error("Account login failed: 请求异常")
  }

  if (!response.ok) {
    console.error(
      `[login_deepseek_via_account] 登录失败, status=${response.status}`
    )
    throw new Error("Account login failed: status not ok")
  }

  const token = await parseLoginResponse(response)
  account.token = token
  await saveAccountToFile(account)
  return token
}

async function LoginWithPassword(username: string, password: string) {
  const account: DeepseekAccount = username.includes("@")
    ? { email: username, password }
    : { mobile: username, password }
  return await loginDeepseekViaAccount(account)
}

export { LoginWithPassword, loginDeepseekViaAccount }
export type { DeepseekAccount }
