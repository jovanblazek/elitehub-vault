export type OpenQuotaInput = {
  apiKeyId: string
  maxConnections: number
}

export type OpenQuotaDecision = {
  ok: boolean
  active: number
  max: number
}

export type SseConnectionLimiter = {
  canOpen: (input: OpenQuotaInput) => OpenQuotaDecision
  onOpen: (apiKeyId: string) => void
  onClose: (apiKeyId: string) => void
  getActiveConnectionsTotal: () => number
  getActiveConnectionsByApiKey: () => Record<string, number>
}

export class InMemorySseConnectionLimiter implements SseConnectionLimiter {
  private readonly activeByApiKey = new Map<string, number>()
  private activeTotal = 0

  canOpen(input: OpenQuotaInput): OpenQuotaDecision {
    const active = this.activeByApiKey.get(input.apiKeyId) ?? 0
    return {
      ok: active < input.maxConnections,
      active,
      max: input.maxConnections,
    }
  }

  onOpen(apiKeyId: string) {
    const active = this.activeByApiKey.get(apiKeyId) ?? 0
    this.activeByApiKey.set(apiKeyId, active + 1)
    this.activeTotal += 1
  }

  onClose(apiKeyId: string) {
    const active = this.activeByApiKey.get(apiKeyId) ?? 0
    if (active <= 0) {
      return
    }

    const next = active - 1
    if (next === 0) {
      this.activeByApiKey.delete(apiKeyId)
    } else {
      this.activeByApiKey.set(apiKeyId, next)
    }

    this.activeTotal = Math.max(0, this.activeTotal - 1)
  }

  getActiveConnectionsTotal() {
    return this.activeTotal
  }

  getActiveConnectionsByApiKey() {
    return Object.fromEntries(this.activeByApiKey.entries())
  }
}
