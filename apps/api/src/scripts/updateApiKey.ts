import process from 'node:process'
import { eq } from 'drizzle-orm'
import { ApiKeys } from '@elitehub/db/schema'
import { db } from '../db/db.js'
import { Redis } from '../utils/redis.js'

type ApiKeyUpdateValues = {
  name?: string
  rpmLimit?: number
  maxSseConnections?: number
  isActive?: boolean
}

type UpdateApiKeyCliOptions = {
  publicId: string
  updates: ApiKeyUpdateValues
}

const toCacheKey = (publicId: string) => `api-key:meta:${publicId}`
const toNegativeCacheKey = (publicId: string) => `api-key:missing:${publicId}`

const requireArgValue = (args: string[], index: number, name: string): string => {
  const value = args[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for --${name}`)
  }
  return value
}

const parsePositiveInteger = (rawValue: string, optionName: string): number => {
  const value = Number.parseInt(rawValue, 10)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${optionName} must be a positive integer`)
  }
  return value
}

const printUsage = () => {
  console.log(`Usage:
  pnpm key:update -- --publicId <publicId> [options]

Options:
  --publicId <publicId>         Public ID of the API key to update
  --name <name>                New human-readable key name
  --rpmLimit <number>          New requests per minute limit
  --maxSseConnections <number> New concurrent SSE connection limit
  --active                     Mark the key as active
  --inactive                   Mark the key as inactive
  --help                       Show help

Examples:
  pnpm key:update -- --publicId 0123456789abcdef --rpmLimit 120
  pnpm key:update -- --publicId 0123456789abcdef --maxSseConnections 5 --inactive
`)
}

const parseCliArgs = (args: string[]): UpdateApiKeyCliOptions => {
  let publicId = ''
  const updates: ApiKeyUpdateValues = {}
  let activeToggleCount = 0

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--') {
      continue
    }

    switch (arg) {
      case '--help':
        printUsage()
        process.exit(0)
      case '--publicId':
        publicId = requireArgValue(args, i, 'publicId').trim()
        i += 1
        break
      case '--name':
        updates.name = requireArgValue(args, i, 'name').trim()
        i += 1
        break
      case '--rpmLimit':
        updates.rpmLimit = parsePositiveInteger(requireArgValue(args, i, 'rpmLimit'), 'rpmLimit')
        i += 1
        break
      case '--maxSseConnections':
        updates.maxSseConnections = parsePositiveInteger(
          requireArgValue(args, i, 'maxSseConnections'),
          'maxSseConnections'
        )
        i += 1
        break
      case '--active':
        updates.isActive = true
        activeToggleCount += 1
        break
      case '--inactive':
        updates.isActive = false
        activeToggleCount += 1
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!publicId) {
    throw new Error('--publicId is required')
  }

  if (updates.name === '') {
    throw new Error('--name must not be empty')
  }

  if (activeToggleCount > 1) {
    throw new Error('Use only one of --active or --inactive')
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('Provide at least one update option')
  }

  return {
    publicId,
    updates,
  }
}

const main = async () => {
  const { publicId, updates } = parseCliArgs(process.argv.slice(2))

  const [updatedApiKey] = await db
    .update(ApiKeys)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(ApiKeys.publicId, publicId))
    .returning({
      id: ApiKeys.id,
      name: ApiKeys.name,
      publicId: ApiKeys.publicId,
      rpmLimit: ApiKeys.rpmLimit,
      maxSseConnections: ApiKeys.maxSseConnections,
      isActive: ApiKeys.isActive,
      updatedAt: ApiKeys.updatedAt,
    })

  if (!updatedApiKey) {
    throw new Error(`API key with publicId "${publicId}" was not found`)
  }

  await Redis.del(toCacheKey(publicId), toNegativeCacheKey(publicId))

  console.log('API key updated successfully.\n')
  console.log(`id: ${updatedApiKey.id}`)
  console.log(`name: ${updatedApiKey.name}`)
  console.log(`publicId: ${updatedApiKey.publicId}`)
  console.log(`rpmLimit: ${updatedApiKey.rpmLimit}`)
  console.log(`maxSseConnections: ${updatedApiKey.maxSseConnections}`)
  console.log(`isActive: ${updatedApiKey.isActive}`)
  console.log(`updatedAt: ${updatedApiKey.updatedAt.toISOString()}`)
  console.log('\nRedis cache keys cleared:')
  console.log(`- ${toCacheKey(publicId)}`)
  console.log(`- ${toNegativeCacheKey(publicId)}`)
  console.log('\n')
  console.log(`Restart the API to clear in-memory cache ❗❗❗`)
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[update-api-key] ${message}`)
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await Redis.quit()
  })
