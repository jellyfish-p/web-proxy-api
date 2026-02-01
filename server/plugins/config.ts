import { loadConfig } from '../utils/config'
import { initDashboardPassword } from '../utils/auth'
import { loadAccounts } from '../utils/accounts'

/**
 * Nitro插件：在服务器启动时自动加载配置
 */
export default defineNitroPlugin(async (nitroApp) => {
    console.log('🚀 Initializing server...')

    // 在启动时加载配置到内存
    await loadConfig()

    // 检测并加密明文密码
    await initDashboardPassword()

    // 加载所有认证文件
    await loadAccounts()

    console.log('✨ Server initialization complete')

})
