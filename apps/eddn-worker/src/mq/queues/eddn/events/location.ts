import type { EDDNJournalLocationMessage } from '@elitehub/eddn-contracts'
import { db } from '../../../../db/db.js'
import {
  buildFullSystemData,
  shouldUpsertSystem,
  upsertSystem,
} from '../helpers/systemHelpers.js'
import { processPowerplayData } from '../helpers/powerplayHelpers.js'
import { processFactionsData } from '../helpers/factionHelpers.js'
import { upsertStationFromLocation } from '../helpers/stationHelpers.js'

export const processLocationEvent = async (message: EDDNJournalLocationMessage) => {
  await db.transaction(async (tx) => {
    const systemData = buildFullSystemData(message)
    if (!shouldUpsertSystem(message, systemData)) {
      return
    }

    const system = await upsertSystem(tx, systemData)
    await processPowerplayData(tx, message, system.id)
    await processFactionsData(tx, message, system.id)
    await upsertStationFromLocation(tx, message, system.id)
  })
}
