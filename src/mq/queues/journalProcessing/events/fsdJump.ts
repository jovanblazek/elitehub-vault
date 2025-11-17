import type { EDDNJournalFSDJumpMessage } from '../../../../eddn/types.js'


export const processFSDJumpEvent = async (message: EDDNJournalFSDJumpMessage) => {
  console.log('processFSDJumpEvent', message)

  // upsert system

  // upsert factions

  // upsert system factions

  // for each faction
  // get faction states for this system
  // compare pending states, update if incoming state is different
  // compare active states, update if incoming state is different
  // compare recovering states, update if incoming state is different
  // compare influence, update if incoming influence is different
  // compare happiness, update if incoming happiness is different
  // upsert faction states to db

  // for each conflict
    // find involved factions in DB
    // find stations by `stake` in DB
    // upsert conflict to db

  // cleanup system factions - remove faction-system relation for factions that are not in the message

  // cleanup conflicts - remove conflicts that are not in the message

  // process powerplay data

  // upsert powers into powerplayPowers table

  // upsert system powerplay powers
  // cleanup system powerplay powers - remove system powerplay powers that are not in the message

  // upsert powerplay conflicts
  // cleanup powerplay conflicts - remove powerplay conflicts that are not in the message
}
