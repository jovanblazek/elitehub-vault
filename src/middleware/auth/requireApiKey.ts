import type { Context } from 'koa'
import logger from '../../utils/logger.js'
import { validateApiKey } from '../../auth/apiKeyValidator.js'

const isDevelopmentEnvironment = () => process.env.NODE_ENV === 'development'

export const requireApiKey = async (ctx: Context): Promise<boolean> => {
  if (isDevelopmentEnvironment()) {
    return true
  }

  const apiKey = ctx.headers['x-api-key']?.toString()
  const validationResult = await validateApiKey(apiKey)

  if (!validationResult.ok) {
    if (validationResult.reason === 'internal_error') {
      ctx.status = 500
      ctx.body = {
        error: 'Internal Server Error',
        message: 'Failed to validate API key',
      }
      return false
    }

    ctx.status = 401
    ctx.body = {
      error: 'Unauthorized',
      message: validationResult.reason === 'missing' ? 'API key is required' : 'Invalid or inactive API key',
    }
    return false
  }

  logger.debug(`[ApiKeyAuth] Valid API key used: ${validationResult.keyName}`)
  return true
}
