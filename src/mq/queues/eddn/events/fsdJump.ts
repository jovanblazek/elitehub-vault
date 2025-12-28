import type { EDDNJournalFSDJumpMessage } from '../../../../eddn/types.js'
import { db } from '../../../../db/db.js'
import {
  upsertSystem,
  buildFullSystemData,
  processPowerplayData,
  processFactionsData,
} from '../helpers/index.js'

export const processFSDJumpEvent = async (message: EDDNJournalFSDJumpMessage) => {
  await db.transaction(async (tx) => {
    const system = await upsertSystem(tx, buildFullSystemData(message))
    await processPowerplayData(tx, message, system.id)
    await processFactionsData(tx, message, system.id)
  })
}
