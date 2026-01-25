import { loadConfig } from '../utils/config'

export default defineNitroPlugin(() => {
  // 在服务器启动时加载配置，只执行一次
  loadConfig()
  console.log('⚙️ Server initialized with config')
})
