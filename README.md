# EliteHub Vault

EliteHub Vault is a real-time data collection and processing system for Elite Dangerous. It subscribes to the EDDN feed, processes player sent events, and stores game state in database with a GraphQL API layer.

## TODO

- [ ] Truncate the database to get rid of invalid old data
- [ ] Process stronghold carriers and megaships. Remove them when they are not present in the FSSSignalDiscovered event or update their location when they appear somewhere else.
