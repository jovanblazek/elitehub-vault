import type { Middleware } from 'koa'

export const healthcheckRoute: Middleware = async (ctx, next) => {
  if (ctx.path !== '/healthcheck') {
    await next()
    return
  }

  if (ctx.method !== 'GET') {
    ctx.status = 405
    ctx.body = {
      error: 'Method Not Allowed',
      message: 'Use GET for healthcheck',
    }
    return
  }

  ctx.status = 200
  ctx.body = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  }
}
