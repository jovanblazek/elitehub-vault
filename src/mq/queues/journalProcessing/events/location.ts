import type { EDDNJournalLocationMessage } from '../../../../eddn/types.js'
import { db } from '../../../../db/db.js'
import {
  upsertSystem,
  buildFullSystemData,
  processPowerplayData,
  processFactionsData,
  upsertStationFromLocation,
} from '../helpers/index.js'

export const processLocationEvent = async (message: EDDNJournalLocationMessage) => {
  db.transaction(async (tx) => {
    const system = await upsertSystem(tx, buildFullSystemData(message))
    await processPowerplayData(tx, message, system.id)
    await processFactionsData(tx, message, system.id)
    await upsertStationFromLocation(tx, message, system.id)
  })
}
