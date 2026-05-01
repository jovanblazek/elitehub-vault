export type AnonymousApiConsumer = {
  type: 'anonymous'
}

export type ApiKeyConsumer = {
  type: 'apiKey'
  apiKeyId: string
  publicId: string
  keyName: string
  rpmLimit: number
  maxSseConnections: number
}

export type ApiConsumer = AnonymousApiConsumer | ApiKeyConsumer

export const anonymousApiConsumer: AnonymousApiConsumer = {
  type: 'anonymous',
}

export const isApiKeyConsumer = (consumer: ApiConsumer): consumer is ApiKeyConsumer =>
  consumer.type === 'apiKey'
