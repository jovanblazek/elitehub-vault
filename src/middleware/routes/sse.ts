import type { Middleware } from 'koa'
import { requireApiKey } from '../auth/requireApiKey.js'
import { openRealtimeSseConnection } from '../../realtime/sse/sseService.js'

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

  const isAuthorized = await requireApiKey(ctx)
  if (!isAuthorized) {
    return
  }

  await openRealtimeSseConnection(ctx)
}
