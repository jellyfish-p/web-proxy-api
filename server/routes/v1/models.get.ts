export default defineEventHandler(() => {
  // 使用配置
  return {
    models: [
      {
        id: 'deepseek-chat',
        object: 'model',
        created: Date.now(),
        owned_by: 'deepseek'
      },
      {
        id: 'grok-beta',
        object: 'model',
        created: Date.now(),
        owned_by: 'xai'
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        object: 'model',
        created: Date.now(),
        owned_by: 'anthropic'
      },
      {
        id: 'moonshot-v1-8k',
        object: 'model',
        created: Date.now(),
        owned_by: 'moonshot'
      }
    ]
  }
})
