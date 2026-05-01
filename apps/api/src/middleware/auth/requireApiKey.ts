import type { Context } from 'koa'
import { apiKeyResolver, type ApiConsumerResolution } from '../../auth/apiKeyResolver.js'
import { apiRateLimiter, applyRateLimitHeaders } from '../../auth/apiRateLimiter.js'
import { type ApiConsumer, type ApiKeyConsumer, isApiKeyConsumer } from '../../auth/apiConsumer.js'

const respondWithRateLimitError = (ctx: Context) => {
  ctx.status = 429
  ctx.body = {
    error: 'rate_limit_exceeded',
    message: 'Rate limit exceeded. Please try again later.',
  }
}

const respondWithServiceUnavailable = (ctx: Context) => {
  ctx.status = 503
  ctx.body = {
    error: 'service_unavailable',
    message: 'The API is temporarily unavailable. Please try again later.',
  }
}

const respondWithInvalidApiKey = async (ctx: Context) => {
  const invalidAttemptDecision = await apiRateLimiter.consumeInvalidApiKeyAttempt(ctx.ip)
  if (!invalidAttemptDecision.ok) {
    if (invalidAttemptDecision.reason === 'service_unavailable') {
      respondWithServiceUnavailable(ctx)
      return null
    }

    if (invalidAttemptDecision.headers) {
      applyRateLimitHeaders(ctx, invalidAttemptDecision.headers)
    }
    respondWithRateLimitError(ctx)
    return null
  }

  applyRateLimitHeaders(ctx, invalidAttemptDecision.headers)
  ctx.status = 401
  ctx.body = {
    error: 'Unauthorized',
    message: 'Invalid or inactive API key',
  }
  return null
}

const resolveApiConsumerFromHeader = async (
  ctx: Context
): Promise<ApiConsumerResolution> => {
  const apiKey = ctx.headers['x-api-key']?.toString()
  return apiKeyResolver.resolve(apiKey)
}

export const resolveApiConsumer = async (ctx: Context): Promise<ApiConsumer | null> => {
  const resolution = await resolveApiConsumerFromHeader(ctx)
  if (!resolution.ok) {
    if (resolution.reason === 'service_unavailable') {
      respondWithServiceUnavailable(ctx)
      return null
    }

    return respondWithInvalidApiKey(ctx)
  }

  ctx.state.apiConsumer = resolution.consumer
  return resolution.consumer
}

export const requireApiKey = async (ctx: Context) => {
  const consumer = await resolveApiConsumer(ctx)
  if (!consumer) {
    return null
  }

  if (!isApiKeyConsumer(consumer)) {
    ctx.status = 401
    ctx.body = {
      error: 'Unauthorized',
      message: 'API key is required',
    }
    return null
  }

  return consumer
}

export type AuthorizedApiKey = ApiKeyConsumer

export const respondWithRateLimitDecision = (
  ctx: Context,
  decision: Awaited<ReturnType<typeof apiRateLimiter.consumeAnonymousGraphql>>
) => {
  if (decision.ok) {
    applyRateLimitHeaders(ctx, decision.headers)
    return true
  }

  if (decision.headers) {
    applyRateLimitHeaders(ctx, decision.headers)
  }

  if (decision.reason === 'service_unavailable') {
    respondWithServiceUnavailable(ctx)
    return false
  }

  respondWithRateLimitError(ctx)
  return false
}
