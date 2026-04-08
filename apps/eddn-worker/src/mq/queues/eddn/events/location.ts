import type { EDDNJournalLocationMessage } from '@elitehub/eddn-contracts'
import { db } from '../../../../db/db.js'
import logger from '../../../../utils/logger.js'
import {
  buildFullSystemData,
  deleteSystem,
  shouldDeleteSystem,
  upsertSystem,
} from '../helpers/systemHelpers.js'
import { processPowerplayData } from '../helpers/powerplayHelpers.js'
import { processFactionsData } from '../helpers/factionHelpers.js'
import { upsertStationFromLocation } from '../helpers/stationHelpers.js'

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
