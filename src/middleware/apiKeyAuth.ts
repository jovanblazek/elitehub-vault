import type { Middleware } from 'koa'
import logger from '../utils/logger.js'
import { parse, visit } from 'postgraphile/graphql'
import { validateApiKey } from '../auth/apiKeyValidator.js'

interface RequestBody {
  operationName?: string
  query?: string
  variables?: Record<string, any>
}

/**
 * Check if a GraphQL query is an introspection query
 * Introspection queries use __schema or __type as actual field selections (not aliases)
 */
function isIntrospectionQuery(query?: string): boolean {
  if (!query) return false

  try {
    const document = parse(query)
    let hasIntrospectionRootField = false
    let hasNonIntrospectionRootField = false
    let hasNonQueryOperation = false

    visit(document, {
      OperationDefinition(node) {
        if (node.operation !== 'query') {
          hasNonQueryOperation = true
          return false
        }
        for (const selection of node.selectionSet.selections) {
          if (selection.kind !== 'Field') {
            hasNonIntrospectionRootField = true
            continue
          }
          const fieldName = selection.name.value
          if (fieldName === '__schema' || fieldName === '__type' || fieldName === '__typename') {
            hasIntrospectionRootField = true
            continue
          }
          hasNonIntrospectionRootField = true
        }
        return false
      },
    })

    return hasIntrospectionRootField && !hasNonIntrospectionRootField && !hasNonQueryOperation
  } catch {
    return false
  }
}

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

  if (ctx.path === '/graphql') {
    // Allow GraphiQL interface (GET requests)
    if (ctx.method === 'GET') {
      await next()
      return
    }

    // Allow introspection queries (check actual query content, not just operation name)
    const body = ctx.request.body as RequestBody
    if (isIntrospectionQuery(body?.query)) {
      await next()
      return
    }

    // Require API key for all other POST requests (queries and mutations)
    if (ctx.method === 'POST') {
      const apiKey = ctx.headers['x-api-key'] as string | undefined

      if (!apiKey) {
        ctx.status = 401
        ctx.body = {
          error: 'Unauthorized',
          message: 'API key is required',
        }
        return
      }

      const validationResult = await validateApiKey(apiKey)
      if (!validationResult.ok) {
        if (validationResult.reason === 'internal_error') {
          logger.error('[ApiKeyAuth] Error validating API key')
          ctx.status = 500
          ctx.body = {
            error: 'Internal Server Error',
            message: 'Failed to validate API key',
          }
          return
        }

        ctx.status = 401
        ctx.body = {
          error: 'Unauthorized',
          message: 'Invalid or inactive API key',
        }
        return
      }

      logger.debug(`[ApiKeyAuth] Valid API key used: ${validationResult.keyName}`)
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
  }

  await next()
  return
}
