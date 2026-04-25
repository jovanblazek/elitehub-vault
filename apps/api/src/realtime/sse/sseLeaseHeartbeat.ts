import type { ServerResponse } from 'node:http'
import logger from '../../utils/logger.js'

type LeaseRefresher = {
  refreshLease: (apiKeyId: string, connectionLeaseId: string) => Promise<boolean>
}

type RefreshSseLeaseOrCloseInput = {
  apiKeyId: string
  connectionLeaseId: string
  response: ServerResponse
  releaseQuota: () => void
  connectionLimiter: LeaseRefresher
}

export const refreshSseLeaseOrClose = async ({
  apiKeyId,
  connectionLeaseId,
  response,
  releaseQuota,
  connectionLimiter,
}: RefreshSseLeaseOrCloseInput) => {
  try {
    const refreshed = await connectionLimiter.refreshLease(apiKeyId, connectionLeaseId)
    if (refreshed) {
      return
    }

    logger.warn({ apiKeyId, connectionLeaseId }, '[SSE] Lease missing during heartbeat refresh')
  } catch (error) {
    logger.error(error, '[SSE] Failed refreshing SSE quota lease')
  }

  releaseQuota()
  if (!response.writableEnded) {
    response.end()
  }
}
