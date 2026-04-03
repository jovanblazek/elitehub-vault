# Development commands
- pnpm dev # Run the API app in watch mode
- pnpm dev:api # Run the API app in watch mode
- pnpm dev:eddn-listener # Run the EDDN listener in watch mode
- pnpm dev:eddn-worker # Run the EDDN worker in watch mode
- pnpm typecheck # Type check the code
- (cd packages/db && pnpm drizzle:generate) # Generate migrations from schema changes
- (cd packages/db && pnpm drizzle:migrate) # Run pending migrations
- pnpm format # Format all code with Prettier

# Code style
- Use ES modules (`.js` extensions in imports, even for `.ts` files)
- Destructure imports when possible (eg. import { foo } from 'bar')
- Logger available as `import logger from './utils/logger.js'`
- Prefix logs with component name in brackets: `[ComponentName]`
- All database operations via Drizzle ORM
- Use `db.transaction()` for multi-step database operations

# Workflow
- Be sure to typecheck when you’re done making a series of code changes
- Prefer running single tests, and not the whole test suite, for performance

# Database Migrations

Run database commands from `packages/db`.

When modifying schema in `packages/db/src/schema.ts`:

1. Generate migration: `(cd packages/db && pnpm drizzle:generate)`
2. Review generated SQL in `packages/db/drizzle/` directory
3. Run migration: `(cd packages/db && pnpm drizzle:migrate)`
4. Commit both schema.ts and generated migration files

# Architecture

## Data Pipeline
1. EDDN Feed (ZeroMQ subscription)
2. `apps/eddn-listener`
3. BullMQ Queue (Redis-backed)
4. `apps/eddn-worker`
5. Drizzle ORM
6. PostgreSQL Database
7. `apps/api` outbox relay + SSE
8. GraphQL API (Koa server)

## Realtime SSE Pipeline
1. Event processors write realtime candidates into `eventOutbox` (`eventType`, `payload`, `createdAt`)
2. `EventOutboxRelay` polls outbox rows in batches, validates payloads, fans out by system's current powers, and publishes to Redis channels
3. Redis channel format for current event type:
   - `events:systemPowerplayUpdated:power:<powerId>`
4. `/realtime/sse` route authenticates API key and opens stream via `sseService`
5. `SseBroker` tracks active SSE connections, subscribes/unsubscribes Redis channels on demand, applies subscription filters, and writes SSE frames

## Realtime SSE Feature (Current Scope)
- Endpoint: `GET /realtime/sse`
- Auth: required API key in production (`X-API-Key`), bypassed in development
- Event types: currently only `systemPowerplayUpdated`
- Required query params:
  - `eventType=systemPowerplayUpdated`
  - `powerId` (repeatable, 1..4)
- Optional query params:
  - `systemId` (repeatable, up to 20)
- Per-key concurrent SSE quota:
  - sourced from `apiKeys.maxSseConnections` (default `3`)
  - exceeded quota returns HTTP `429`

## SSE Runtime Behavior
- Connection lifecycle:
  - sends `retry: 2000` hint and connected comment frame on open
  - keepalive comment frames every 15s
  - cleanup on client disconnect, write failure, server shutdown, or backpressure close
- Delivery semantics:
  - events are routed by `(eventType, powerId)` channel
  - optional `systemId` allowlist is applied per connection
  - per-connection incremental SSE `id` field starts at `1`
- Backpressure protection:
  - closes slow clients when queue exceeds 200 messages or 1 MiB buffered
  - write timeout is 10s per frame
- Redis resilience:
  - demand-count based subscribe/unsubscribe per powerId
  - reconciling subscriptions on Redis reconnect/ready
  - per-power serialized subscription operations (`runSerialized`) to avoid race conditions
- Observability:
  - periodic SSE summary log every 30s (connections, channels, routed/dropped/errors, event rate)
  - structured open/close/rejection/error logging in SSE components

## SSE Telemetry Runbook
- Instrumented components:
  - `sseService` (connection registration failures)
  - `sseBroker` (write/flush failures, demand increment failures)
  - `redisSubscriptionManager` (subscriber errors, subscribe/unsubscribe failures)
- Sampling defaults:
  - exceptions are captured at 100%

## Component Responsibilities
- apps/api/src/index.ts - API application entry point
- apps/eddn-listener/src/index.ts - EDDN ingestion entry point
- apps/eddn-worker/src/index.ts - worker entry point
- packages/db/src/schema.ts - shared database schema
- apps/api/src/realtime/eventOutboxRelay.ts - outbox polling and Redis publish fanout
- packages/queue-contracts/src/realtime.ts - realtime event model + payload builders
- apps/api/src/realtime/sse/sseService.ts - SSE endpoint/session orchestration and quota checks
- apps/api/src/realtime/sse/sseBroker.ts - connection registry, filtering, framing, backpressure handling
- apps/api/src/realtime/sse/redisSubscriptionManager.ts - Redis subscriber lifecycle and power demand subscriptions
- apps/api/src/realtime/sse/subscriptionParams.ts - SSE query parsing/validation
