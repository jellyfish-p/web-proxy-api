// DeepSeek API 主机地址
export const DEEPSEEK_HOST = "chat.deepseek.com"
// DeepSeek 用户登录 API 地址
export const DEEPSEEK_LOGIN_URL = `https://${DEEPSEEK_HOST}/api/v0/users/login`
// DeepSeek 创建会话 API 地址
export const DEEPSEEK_CREATE_SESSION_URL = `https://${DEEPSEEK_HOST}/api/v0/chat_session/create`
// DeepSeek 创建 PoW 挑战 API 地址
export const DEEPSEEK_CREATE_POW_URL = `https://${DEEPSEEK_HOST}/api/v0/chat/create_pow_challenge`
// DeepSeek 聊天补全 API 地址
export const DEEPSEEK_COMPLETION_URL = `https://${DEEPSEEK_HOST}/api/v0/chat/completion`
// DeepSeek API 基础请求头
export const DEEPSEEK_BASE_HEADERS = {
  "Host": "chat.deepseek.com",
  "User-Agent": "DeepSeek/1.0.13 Android/35",
  "Accept": "application/json",
  "Accept-Encoding": "gzip",
  "Content-Type": "application/json",
  "x-client-platform": "android",
  "x-client-version": "1.3.0-auto-resume",
  "x-client-locale": "zh_CN",
  "accept-charset": "UTF-8",
}
