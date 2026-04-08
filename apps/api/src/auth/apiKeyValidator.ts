import { eq } from 'drizzle-orm'
import { ApiKeys } from '@elitehub/db/schema'
import { db } from '../db/db.js'
import logger from '../utils/logger.js'

type ApiKeyValidationResult =
  | { ok: true; apiKeyId: string; keyName: string; maxSseConnections: number }
  | { ok: false; reason: 'missing' | 'invalid' | 'internal_error' }

export const validateApiKey = async (
  apiKey: string | undefined
): Promise<ApiKeyValidationResult> => {
  if (!apiKey) {
    return { ok: false, reason: 'missing' }
  }

  try {
    const [keyRecord] = await db.select().from(ApiKeys).where(eq(ApiKeys.key, apiKey)).limit(1)

    if (!keyRecord || !keyRecord.isActive) {
      logger.warn('[ApiKeyAuth] Invalid or inactive API key attempted')
      return { ok: false, reason: 'invalid' }
    }

    return {
      ok: true,
      apiKeyId: keyRecord.id,
      keyName: keyRecord.name,
      maxSseConnections: keyRecord.maxSseConnections,
    }
  } catch (error) {
    logger.error(error, '[ApiKeyAuth] Error validating API key')
    return { ok: false, reason: 'internal_error' }
  }
}
