import { CheckApiKey } from "~~/server/utils/config"

export default defineEventHandler(async event => {
  let apiKey = event.headers.get('Authorization') || ''
  if (apiKey.startsWith('Bearer ')) {
    apiKey = apiKey.slice(7)
  }
  if (!CheckApiKey(apiKey)) {
    throw createError({
      status: 401,
      message: 'Unauthorized'
    })
  }
})
