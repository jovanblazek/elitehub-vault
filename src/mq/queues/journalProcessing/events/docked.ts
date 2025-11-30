import type { EDDNJournalDockedMessage } from '../../../../eddn/types.js'
import { db } from '../../../../db/db.js'
import {
  upsertSystem,
  buildPartialSystemData,
  upsertStationFromDocked,
} from '../helpers/index.js'

export const processDockedEvent = async (message: EDDNJournalDockedMessage) => {
  db.transaction(async (tx) => {
    const system = await upsertSystem(tx, buildPartialSystemData(message))
    await upsertStationFromDocked(tx, message, system.id)
  })
}
