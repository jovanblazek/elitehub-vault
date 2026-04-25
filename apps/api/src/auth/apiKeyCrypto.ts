import crypto from 'node:crypto'
import { env } from '../env.js'

const API_KEY_PREFIX = 'eh_live_'
const TEST_API_KEY_SECRET_PEPPER = 'test-api-key-secret-pepper-000000000000'

export type ParsedOpaqueApiKey = {
  publicId: string
  secret: string
}

export const parseOpaqueApiKey = (value: string): ParsedOpaqueApiKey | null => {
  if (!value.startsWith(API_KEY_PREFIX)) {
    return null
  }

  const rawPayload = value.slice(API_KEY_PREFIX.length)
  const separatorIndex = rawPayload.indexOf('_')
  if (separatorIndex <= 0 || separatorIndex === rawPayload.length - 1) {
    return null
  }

  const publicId = rawPayload.slice(0, separatorIndex)
  const secret = rawPayload.slice(separatorIndex + 1)
  if (!publicId || !secret) {
    return null
  }

  return {
    publicId,
    secret,
  }
}

const getApiKeySecretPepper = () => env.API_KEY_SECRET_PEPPER ?? TEST_API_KEY_SECRET_PEPPER

export const hashApiKeySecret = (secret: string) =>
  crypto.createHmac('sha256', getApiKeySecretPepper()).update(secret).digest('hex')

export const timingSafeEqualHex = (input: string, expected: string) => {
  const inputBuffer = Buffer.from(input)
  const expectedBuffer = Buffer.from(expected)

  if (inputBuffer.length !== expectedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(inputBuffer, expectedBuffer)
}
