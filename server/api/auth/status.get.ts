import { getConfig } from '../../utils/config'
import { DASHBOARD_AUTH_COOKIE, verifyDashboardAuthHash } from '../../utils/auth'

export default defineEventHandler((event) => {
  const config = getConfig()

  // 仪表板未启用时直接视为未登录
  if (!config || !config.dashboard.enable) {
    return { authenticated: false }
  }

  const authHash = getCookie(event, DASHBOARD_AUTH_COOKIE) || ''
  const authenticated = verifyDashboardAuthHash(authHash, config.dashboard.password)

  return { authenticated }
})
