import type { Middleware } from 'koa'
import { healthcheckRoute } from './routes/healthcheck.js'
import { graphqlRoute } from './routes/graphql.js'
import { sseRoute } from './routes/sse.js'

/**
 * Dispatch route-specific access rules.
 */
export const routeAccessMiddleware: Middleware = async (ctx, next) => {
  if (ctx.path === '/healthcheck') {
    await healthcheckRoute(ctx, next)
    return
  }

  if (ctx.path === '/graphql') {
    await graphqlRoute(ctx, next)
    return
  }

  if (ctx.path === '/realtime/sse') {
    await sseRoute(ctx, next)
    return
  }

  await next()
}
