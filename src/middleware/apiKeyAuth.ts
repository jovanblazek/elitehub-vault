import type { Middleware } from 'koa'
import { db } from '../db/db.js'
import { ApiKeys } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import logger from '../utils/logger.js'

/**
 * Middleware to validate API keys for protected routes
 */
export const apiKeyAuth: Middleware = async (ctx, next) => {
  if (ctx.path === '/healthcheck') {
    ctx.status = 200
    ctx.body = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    }
    return
  }

  if(process.env.NODE_ENV === 'development') {
    await next()
    return
  }

  const apiKey = ctx.headers['x-api-key'] as string | undefined

  if (!apiKey) {
    ctx.status = 401
    ctx.body = {
      error: 'Unauthorized',
      message: 'API key is required',
    }
    return
  }

  try {
    const [keyRecord] = await db.select().from(ApiKeys).where(eq(ApiKeys.key, apiKey)).limit(1)

    if (!keyRecord || !keyRecord.isActive) {
      logger.warn(`[ApiKeyAuth] Invalid or inactive API key attempted`)
      ctx.status = 401
      ctx.body = {
        error: 'Unauthorized',
        message: 'Invalid or inactive API key',
      }
      return
    }

    logger.debug(`[ApiKeyAuth] Valid API key used: ${keyRecord.name}`)
    await next()
  } catch (error) {
    logger.error(`[ApiKeyAuth] Error validating API key: ${error}`)
    ctx.status = 500
    ctx.body = {
      error: 'Internal Server Error',
      message: 'Failed to validate API key',
    }
  }
}
