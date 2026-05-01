import type { Middleware } from 'koa'
import { apiRateLimiter } from '../../auth/apiRateLimiter.js'
import { isApiKeyConsumer } from '../../auth/apiConsumer.js'
import { resolveApiConsumer, respondWithRateLimitDecision } from '../auth/requireApiKey.js'

export const graphqlRoute: Middleware = async (ctx, next) => {
  if (ctx.path !== '/graphql') {
    await next()
    return
  }

  if (ctx.method === 'GET') {
    const decision = await apiRateLimiter.consumeAnonymousGraphql(ctx.ip)
    if (!respondWithRateLimitDecision(ctx, decision)) {
      return
    }

    await next()
    return
  }

  if (ctx.method === 'POST') {
    const consumer = await resolveApiConsumer(ctx)
    if (!consumer) {
      return
    }

    const decision = isApiKeyConsumer(consumer)
      ? await apiRateLimiter.consumeAuthenticatedGraphql(consumer.apiKeyId, consumer.rpmLimit)
      : await apiRateLimiter.consumeAnonymousGraphql(ctx.ip)

    if (!respondWithRateLimitDecision(ctx, decision)) {
      return
    }

    try {
      await next()
    } catch {
      ctx.status = 500
      ctx.body = {
        error: 'Internal Server Error',
        message: 'Failed to process request',
      }
    }
    return
  }

  ctx.status = 405
  ctx.body = {
    error: 'Method Not Allowed',
    message: 'Use GET or POST for GraphQL',
  }
}
