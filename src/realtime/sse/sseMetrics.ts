type SseMetricsSummary = {
  activeConnections: number
  activeChannels: number
  eventsPerSec: number
  dropsSinceLast: number
  errorsSinceLast: number
  totals: {
    opened: number
    closed: number
    routed: number
    dropped: number
    writeErrors: number
    redisErrors: number
    redisDisconnects: number
  }
}

export class SseMetrics {
  private connectionsOpenedTotal = 0
  private connectionsClosedTotal = 0
  private eventsRoutedTotal = 0
  private eventsDroppedTotal = 0
  private writeErrorsTotal = 0
  private redisErrorsTotal = 0
  private redisDisconnectsTotal = 0
  private activeConnections = 0
  private activeChannels = 0
  private readonly routedEventsPerSecond = new Map<number, number>()
  private lastDropTotal = 0
  private lastErrorTotal = 0

  setActiveConnections(value: number) {
    this.activeConnections = Math.max(0, value)
  }

  setActiveChannels(value: number) {
    this.activeChannels = Math.max(0, value)
  }

  onConnectionOpened() {
    this.connectionsOpenedTotal += 1
  }

  onConnectionClosed() {
    this.connectionsClosedTotal += 1
  }

  onEventRouted() {
    this.eventsRoutedTotal += 1
    const second = Math.floor(Date.now() / 1000)
    const current = this.routedEventsPerSecond.get(second) ?? 0
    this.routedEventsPerSecond.set(second, current + 1)
    this.pruneOldBuckets(second)
  }

  onEventDropped() {
    this.eventsDroppedTotal += 1
  }

  onWriteError() {
    this.writeErrorsTotal += 1
  }

  onRedisError() {
    this.redisErrorsTotal += 1
  }

  onRedisDisconnect() {
    this.redisDisconnectsTotal += 1
  }

  getSummary(): SseMetricsSummary {
    const eventsPerSec = this.getEventsPerSecond(60)
    const totalErrors = this.writeErrorsTotal + this.redisErrorsTotal + this.redisDisconnectsTotal
    const summary: SseMetricsSummary = {
      activeConnections: this.activeConnections,
      activeChannels: this.activeChannels,
      eventsPerSec,
      dropsSinceLast: this.eventsDroppedTotal - this.lastDropTotal,
      errorsSinceLast: totalErrors - this.lastErrorTotal,
      totals: {
        opened: this.connectionsOpenedTotal,
        closed: this.connectionsClosedTotal,
        routed: this.eventsRoutedTotal,
        dropped: this.eventsDroppedTotal,
        writeErrors: this.writeErrorsTotal,
        redisErrors: this.redisErrorsTotal,
        redisDisconnects: this.redisDisconnectsTotal,
      },
    }

    this.lastDropTotal = this.eventsDroppedTotal
    this.lastErrorTotal = totalErrors
    return summary
  }

  private getEventsPerSecond(windowSeconds: number) {
    const nowSecond = Math.floor(Date.now() / 1000)
    this.pruneOldBuckets(nowSecond)

    let sum = 0
    for (let second = nowSecond - (windowSeconds - 1); second <= nowSecond; second += 1) {
      sum += this.routedEventsPerSecond.get(second) ?? 0
    }

    return sum / windowSeconds
  }

  private pruneOldBuckets(nowSecond: number) {
    const threshold = nowSecond - 120
    for (const second of this.routedEventsPerSecond.keys()) {
      if (second < threshold) {
        this.routedEventsPerSecond.delete(second)
      }
    }
  }
}
