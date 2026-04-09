import type { EDDNJournalDockedMessage } from '@elitehub/eddn-contracts'
import { db } from '../../../../db/db.js'
import { buildPartialSystemData, shouldUpsertSystemFromDocked } from '../helpers/systemHelpers.js'
import { upsertStationFromDocked } from '../helpers/stationHelpers.js'
import { upsertSystem } from '../helpers/systemHelpers.js'

export const processDockedEvent = async (message: EDDNJournalDockedMessage) => {
  await db.transaction(async (tx) => {
    if (!shouldUpsertSystemFromDocked(message)) {
      return
    }

    const system = await upsertSystem(tx, buildPartialSystemData(message))
    await upsertStationFromDocked(tx, message, system.id)
  })
}
