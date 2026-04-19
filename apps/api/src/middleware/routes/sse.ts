import type { Middleware } from 'koa'
import { apiRateLimiter } from '../../auth/apiRateLimiter.js'
import { requireApiKey } from '../auth/requireApiKey.js'
import { openRealtimeSseConnection } from '../../realtime/sse/sseService.js'
import { respondWithRateLimitDecision } from '../auth/requireApiKey.js'

export const sseRoute: Middleware = async (ctx, next) => {
  if (ctx.path !== '/realtime/sse') {
    await next()
    return
  }

  if (ctx.method !== 'GET') {
    ctx.status = 405
    ctx.body = {
      error: 'Method Not Allowed',
      message: 'Use GET for SSE subscriptions',
    }
    return
  }

  const authorizedApiKey = await requireApiKey(ctx)
  if (!authorizedApiKey) {
    return
  }

  const connectDecision = await apiRateLimiter.consumeSseConnect(authorizedApiKey.apiKeyId)
  if (!respondWithRateLimitDecision(ctx, connectDecision)) {
    return
  }

  await openRealtimeSseConnection(ctx, authorizedApiKey)
}
