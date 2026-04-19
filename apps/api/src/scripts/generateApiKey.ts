import crypto from 'node:crypto'
import process from 'node:process'
import { ApiKeys } from '@elitehub/db/schema'
import { db } from '../db/db.js'
import { hashApiKeySecret } from '../auth/apiKeyCrypto.js'

type CliOptions = {
  name: string
  rpmLimit: number
  maxSseConnections: number
  isActive: boolean
}

const DEFAULT_RPM_LIMIT = 60
const DEFAULT_MAX_SSE_CONNECTIONS = 3
const API_KEY_PREFIX = 'eh_live_'

const printUsage = () => {
  console.log(`Usage:
  pnpm generate:api-key -- --name <name> [options]

Options:
  --name <name>                 Human-readable key name
  --rpmLimit <number>           Requests per minute limit (default: ${DEFAULT_RPM_LIMIT})
  --maxSseConnections <number>  Max concurrent SSE connections (default: ${DEFAULT_MAX_SSE_CONNECTIONS})
  --inactive                    Create the key as inactive
  --help                        Show help

Examples:
  pnpm generate:api-key -- --name local-dev
  pnpm generate:api-key -- --name staging-client --rpmLimit 120 --maxSseConnections 5
`)
}

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

const parseCliArgs = (args: string[]): CliOptions => {
  const options: CliOptions = {
    name: '',
    rpmLimit: DEFAULT_RPM_LIMIT,
    maxSseConnections: DEFAULT_MAX_SSE_CONNECTIONS,
    isActive: true,
  }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--') {
      continue
    }

    switch (arg) {
      case '--help':
        printUsage()
        process.exit(0)
      case '--name':
        options.name = requireArgValue(args, i, 'name')
        i += 1
        break
      case '--rpmLimit':
        options.rpmLimit = parsePositiveInteger(requireArgValue(args, i, 'rpmLimit'), 'rpmLimit')
        i += 1
        break
      case '--maxSseConnections':
        options.maxSseConnections = parsePositiveInteger(
          requireArgValue(args, i, 'maxSseConnections'),
          'maxSseConnections'
        )
        i += 1
        break
      case '--inactive':
        options.isActive = false
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!options.name.trim()) {
    throw new Error('--name is required')
  }

  return {
    ...options,
    name: options.name.trim(),
  }
}

const generateOpaqueApiKey = () => {
  const publicId = crypto.randomBytes(8).toString('hex')
  const secret = crypto.randomBytes(24).toString('hex')
  const rawApiKey = `${API_KEY_PREFIX}${publicId}_${secret}`

  return {
    publicId,
    secret,
    rawApiKey,
  }
}

const main = async () => {
  const options = parseCliArgs(process.argv.slice(2))
  const { publicId, secret, rawApiKey } = generateOpaqueApiKey()
  const secretHash = hashApiKeySecret(secret)

  const [insertedApiKey] = await db
    .insert(ApiKeys)
    .values({
      name: options.name,
      publicId,
      secretHash,
      rpmLimit: options.rpmLimit,
      maxSseConnections: options.maxSseConnections,
      isActive: options.isActive,
    })
    .returning({
      id: ApiKeys.id,
      name: ApiKeys.name,
      publicId: ApiKeys.publicId,
      rpmLimit: ApiKeys.rpmLimit,
      maxSseConnections: ApiKeys.maxSseConnections,
      isActive: ApiKeys.isActive,
      createdAt: ApiKeys.createdAt,
    })

  console.log('API key created successfully.\n')
  console.log(`apiKey: ${rawApiKey}`)
  console.log(`id: ${insertedApiKey.id}`)
  console.log(`name: ${insertedApiKey.name}`)
  console.log(`publicId: ${insertedApiKey.publicId}`)
  console.log(`rpmLimit: ${insertedApiKey.rpmLimit}`)
  console.log(`maxSseConnections: ${insertedApiKey.maxSseConnections}`)
  console.log(`isActive: ${insertedApiKey.isActive}`)
  console.log(`createdAt: ${insertedApiKey.createdAt.toISOString()}`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error(`[generate-api-key] ${message}`)
  process.exit(1)
})
