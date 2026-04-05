import type { EDDNJournalFSDJumpMessage } from '@elitehub/eddn-contracts'
import { db } from '../../../../db/db.js'
import {
  upsertSystem,
  buildFullSystemData,
  processPowerplayData,
  processFactionsData,
  shouldDeleteSystem,
  deleteSystem,
} from '../helpers/index.js'
import logger from '../../../../utils/logger.js'

export const processFSDJumpEvent = async (message: EDDNJournalFSDJumpMessage) => {
  await db.transaction(async (tx) => {
    const systemData = buildFullSystemData(message)
    if (shouldDeleteSystem(systemData)) {
      const deleted = await deleteSystem(tx, systemData.systemAddress)
      if (deleted) {
        logger.info(
          { systemAddress: systemData.systemAddress, systemName: systemData.name },
          '[FSDJump] Deleted system with 0 population and null government'
        )
      }
      return
    }

    const system = await upsertSystem(tx, systemData)
    await processPowerplayData(tx, message, system.id)
    await processFactionsData(tx, message, system.id)
  })
}
