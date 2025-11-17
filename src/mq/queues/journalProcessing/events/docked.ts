import { EDDNJournalDockedMessage } from "../../../../eddn/types.js"


export const processDockedEvent = async (message: EDDNJournalDockedMessage) => {
  console.log('processDockedEvent', message)
  // TODO: do not track colonization ships, space and planetary construction depots and fleet carriers
  // possibly filter out stations owned by `Brewer Corporation`
}