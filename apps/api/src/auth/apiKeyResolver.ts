import { eq } from 'drizzle-orm'
import { LRUCache } from 'lru-cache'
import { ApiKeys } from '@elitehub/db/schema'
import { db } from '../db/db.js'
import logger from '../utils/logger.js'
import { anonymousApiConsumer, type ApiConsumer, type ApiKeyConsumer } from './apiConsumer.js'
import { hashApiKeySecret, parseOpaqueApiKey, timingSafeEqualHex } from './apiKeyCrypto.js'

type ApiKeyCacheRecord = {
  apiKeyId: string
  publicId: string
  keyName: string
  secretHash: string
  rpmLimit: number
  maxSseConnections: number
  isActive: boolean
}

type ApiKeyResolverDependencies = {
  getCacheValue?: (key: string) => Promise<string | null>
  setCacheValue?: (key: string, value: string, ttlSeconds: number) => Promise<void>
  lookupApiKeyRecord?: (publicId: string) => Promise<ApiKeyCacheRecord | null>
  localCache?: LRUCache<string, ApiKeyCacheRecord>
}

export type ApiConsumerResolution =
  | {
      ok: true
      consumer: ApiConsumer
    }
  | {
      ok: false
      reason: 'invalid_api_key' | 'service_unavailable'
    }

const LOCAL_CACHE_TTL_MS = 30_000
const REDIS_POSITIVE_TTL_SECONDS = 300 // 5 minutes
const REDIS_NEGATIVE_TTL_SECONDS = 45

const toCacheKey = (publicId: string) => `api-key:meta:${publicId}`
const toNegativeCacheKey = (publicId: string) => `api-key:missing:${publicId}`

const defaultLocalCache = new LRUCache<string, ApiKeyCacheRecord>({
  max: 1_000,
  ttl: LOCAL_CACHE_TTL_MS,
})

const getRedis = async () => {
  const { Redis } = await import('../utils/redis.js')
  return Redis
}

const defaultLookupApiKeyRecord = async (publicId: string): Promise<ApiKeyCacheRecord | null> => {
  const [record] = await db
    .select({
      apiKeyId: ApiKeys.id,
      publicId: ApiKeys.publicId,
      keyName: ApiKeys.name,
      secretHash: ApiKeys.secretHash,
      rpmLimit: ApiKeys.rpmLimit,
      maxSseConnections: ApiKeys.maxSseConnections,
      isActive: ApiKeys.isActive,
    })
    .from(ApiKeys)
    .where(eq(ApiKeys.publicId, publicId))
    .limit(1)

  if (!record?.publicId || !record.secretHash) {
    return null
  }

  return {
    apiKeyId: record.apiKeyId,
    publicId: record.publicId,
    keyName: record.keyName,
    secretHash: record.secretHash,
    rpmLimit: record.rpmLimit,
    maxSseConnections: record.maxSseConnections,
    isActive: record.isActive,
  }
}

export class ApiKeyResolver {
  private readonly localCache: LRUCache<string, ApiKeyCacheRecord>
  private readonly getCacheValue: (key: string) => Promise<string | null>
  private readonly setCacheValue: (key: string, value: string, ttlSeconds: number) => Promise<void>
  private readonly lookupApiKeyRecord: (publicId: string) => Promise<ApiKeyCacheRecord | null>

  constructor({
    getCacheValue = async (key) => (await getRedis()).get(key),
    setCacheValue = async (key, value, ttlSeconds) => {
      await (await getRedis()).set(key, value, 'EX', ttlSeconds)
    },
    lookupApiKeyRecord = defaultLookupApiKeyRecord,
    localCache = defaultLocalCache,
  }: ApiKeyResolverDependencies = {}) {
    this.getCacheValue = getCacheValue
    this.setCacheValue = setCacheValue
    this.lookupApiKeyRecord = lookupApiKeyRecord
    this.localCache = localCache
  }

  async resolve(rawApiKey: string | undefined): Promise<ApiConsumerResolution> {
    if (!rawApiKey) {
      return {
        ok: true,
        consumer: anonymousApiConsumer,
      }
    }

    const parsedApiKey = parseOpaqueApiKey(rawApiKey)
    if (!parsedApiKey) {
      return { ok: false, reason: 'invalid_api_key' }
    }

    const computedSecretHash = hashApiKeySecret(parsedApiKey.secret)
    const locallyCached = this.localCache.get(parsedApiKey.publicId)
    if (locallyCached) {
      logger.debug({ publicId: parsedApiKey.publicId }, '[ApiKeyAuth] Local cache hit')
      return this.validateRecord(locallyCached, computedSecretHash)
    }

    let negativeCacheValue: string | null
    try {
      negativeCacheValue = await this.getCacheValue(toNegativeCacheKey(parsedApiKey.publicId))
    } catch (error) {
      logger.error(error, '[ApiKeyAuth] Failed reading API key negative cache')
      return { ok: false, reason: 'service_unavailable' }
    }

    if (negativeCacheValue) {
      logger.warn({ publicId: parsedApiKey.publicId }, '[ApiKeyAuth] Unknown API key attempted')
      return { ok: false, reason: 'invalid_api_key' }
    }

    let redisCachedValue: string | null
    try {
      redisCachedValue = await this.getCacheValue(toCacheKey(parsedApiKey.publicId))
    } catch (error) {
      logger.error(error, '[ApiKeyAuth] Failed reading API key cache')
      return { ok: false, reason: 'service_unavailable' }
    }

    if (redisCachedValue) {
      try {
        const cachedRecord = JSON.parse(redisCachedValue) as ApiKeyCacheRecord
        this.localCache.set(parsedApiKey.publicId, cachedRecord)
        logger.debug({ publicId: parsedApiKey.publicId }, '[ApiKeyAuth] Redis cache hit')
        return this.validateRecord(cachedRecord, computedSecretHash)
      } catch (error) {
        logger.error(error, '[ApiKeyAuth] Failed parsing cached API key metadata')
      }
    }

    let record: ApiKeyCacheRecord | null
    try {
      record = await this.lookupApiKeyRecord(parsedApiKey.publicId)
    } catch (error) {
      logger.error(error, '[ApiKeyAuth] Failed loading API key from database')
      return { ok: false, reason: 'service_unavailable' }
    }

    if (!record || !record.isActive) {
      await this.cacheMissingPublicId(parsedApiKey.publicId)
      logger.warn({ publicId: parsedApiKey.publicId }, '[ApiKeyAuth] Unknown or inactive API key')
      return { ok: false, reason: 'invalid_api_key' }
    }

    this.localCache.set(parsedApiKey.publicId, record)
    void this.cacheRecord(record)
    logger.debug({ publicId: parsedApiKey.publicId }, '[ApiKeyAuth] Database fallback used')
    return this.validateRecord(record, computedSecretHash)
  }

  private validateRecord(
    record: ApiKeyCacheRecord,
    computedSecretHash: string
  ): ApiConsumerResolution {
    if (!record.isActive || !timingSafeEqualHex(computedSecretHash, record.secretHash)) {
      return { ok: false, reason: 'invalid_api_key' }
    }

    const consumer: ApiKeyConsumer = {
      type: 'apiKey',
      apiKeyId: record.apiKeyId,
      publicId: record.publicId,
      keyName: record.keyName,
      rpmLimit: record.rpmLimit,
      maxSseConnections: record.maxSseConnections,
    }

    return {
      ok: true,
      consumer,
    }
  }

  private async cacheMissingPublicId(publicId: string) {
    try {
      await this.setCacheValue(toNegativeCacheKey(publicId), '1', REDIS_NEGATIVE_TTL_SECONDS)
    } catch (error) {
      logger.error(error, '[ApiKeyAuth] Failed writing API key negative cache')
    }
  }

  private async cacheRecord(record: ApiKeyCacheRecord) {
    try {
      await this.setCacheValue(
        toCacheKey(record.publicId),
        JSON.stringify(record),
        REDIS_POSITIVE_TTL_SECONDS
      )
    } catch (error) {
      logger.error(error, '[ApiKeyAuth] Failed writing API key cache')
    }
  }
}

export const apiKeyResolver = new ApiKeyResolver()
