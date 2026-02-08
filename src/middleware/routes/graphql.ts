import type { Middleware } from 'koa'
import { parse, visit } from 'postgraphile/graphql'
import { requireApiKey } from '../auth/requireApiKey.js'

interface RequestBody {
  operationName?: string
  query?: string
  variables?: Record<string, any>
}

/**
 * Introspection queries use __schema or __type as actual field selections (not aliases).
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

export const graphqlRoute: Middleware = async (ctx, next) => {
  if (ctx.path !== '/graphql') {
    await next()
    return
  }

  // Allow GraphiQL interface (GET requests).
  if (ctx.method === 'GET') {
    await next()
    return
  }

  // Allow POST introspection queries (check actual query content, not just operation name).
  if (ctx.method === 'POST') {
    const body = ctx.request.body as RequestBody
    if (isIntrospectionQuery(body?.query)) {
      await next()
      return
    }

    // Require API key for all other POST requests (queries and mutations), except in development.
    const authorizedApiKey = await requireApiKey(ctx)
    if (!authorizedApiKey) {
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
