import type { EDDNJournalLocationMessage } from '@elitehub/eddn-contracts'
import { db } from '../../../../db/db.js'
import {
  upsertSystem,
  buildFullSystemData,
  processPowerplayData,
  processFactionsData,
  upsertStationFromLocation,
  shouldDeleteSystem,
  deleteSystem,
} from '../helpers/index.js'
import logger from '../../../../utils/logger.js'

export const processLocationEvent = async (message: EDDNJournalLocationMessage) => {
  await db.transaction(async (tx) => {
    const systemData = buildFullSystemData(message)
    if (shouldDeleteSystem(systemData)) {
      const deleted = await deleteSystem(tx, systemData.systemAddress)
      if (deleted) {
        logger.info(
          { systemAddress: systemData.systemAddress, systemName: systemData.name },
          '[Location] Deleted system with 0 population and null government'
        )
      }
      return
    }

    const system = await upsertSystem(tx, systemData)
    await processPowerplayData(tx, message, system.id)
    await processFactionsData(tx, message, system.id)
    await upsertStationFromLocation(tx, message, system.id)
  })
}
