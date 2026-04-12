import { sql } from 'drizzle-orm'
import type { Transaction } from './systemHelpers.js'

const EDDN_STATEMENT_TIMEOUT_MS = 30_000
const EDDN_LOCK_TIMEOUT_MS = 5_000
const EDDN_IDLE_IN_TRANSACTION_TIMEOUT_MS = 30_000

export const applyEddnTransactionTimeouts = async (tx: Transaction) => {
  await tx.execute(sql.raw(`SET LOCAL statement_timeout = '${EDDN_STATEMENT_TIMEOUT_MS}ms'`))
  await tx.execute(sql.raw(`SET LOCAL lock_timeout = '${EDDN_LOCK_TIMEOUT_MS}ms'`))
  await tx.execute(
    sql.raw(
      `SET LOCAL idle_in_transaction_session_timeout = '${EDDN_IDLE_IN_TRANSACTION_TIMEOUT_MS}ms'`
    )
  )
}
