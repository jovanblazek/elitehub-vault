# EliteHub Vault

EliteHub Vault is a real-time data collection and processing system for Elite Dangerous. It subscribes to the EDDN feed, processes player sent events, and stores game state in database with a GraphQL API layer.

## TODO

- [ ] Disable GraphQL playground in production
- [ ] Disable Postgraphile explain extension in production
- [ ] Add limits to pagination queries to prevent abuse
- [ ] Add nesting limit to queries to prevent abuse
- [ ] Add rate limiting to Koa server
