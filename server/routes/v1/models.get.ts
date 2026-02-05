import { getRegisteredModels } from '~~/server/utils/selector'

export default defineEventHandler(() => {
  const models = getRegisteredModels().map(model => ({
    id: model.id,
    object: 'model',
    created: model.created,
    owned_by: model.owner
  }))

  return {
    models
  }
})
