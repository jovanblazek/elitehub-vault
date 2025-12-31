# EliteHub Vault

EliteHub Vault is a real-time data collection and processing system for Elite Dangerous. It subscribes to the EDDN feed, processes player sent events, and stores game state in database with a GraphQL API layer.

## TODO

- [ ] Process stronghold carriers. To remove them use postgres trigger on system powerplay state change from stronghold to something else.
- [ ] Process detention centers, they seem to have no controlling faction
- [ ] Process engineers as minor factions, their bases are throwing warnings Could not find controlling faction for station {"systemId":"9c09d051-cb03-49ac-8586-6b2e01614f8b","stationFactionName":"Felicity Farseer","stationName":"Farseer Inc"}
- [ ] Process Pilots' Federation Local Branch stations, manually add this faction? (and others?)
- [ ] Disable listening for carrier jumps for now
- [ ] Truncate the database to get rid of invalid old data
