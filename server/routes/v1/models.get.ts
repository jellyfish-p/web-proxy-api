// 导入账号选择器函数
import { getRegisteredModels } from '~~/server/utils/selector'

/**
 * 获取模型列表的 API 端点
 * 返回所有已注册的模型信息
 */
export default defineEventHandler(() => {
  // 获取所有已注册的模型并转换为标准格式
  const models = getRegisteredModels().map(model => ({
    id: model.id, // 模型 ID
    object: 'model', // 对象类型
    created: model.created, // 创建时间戳
    owned_by: model.owner // 模型所有者
  }))

  return {
    object: 'list',
    data: models
  }
})
