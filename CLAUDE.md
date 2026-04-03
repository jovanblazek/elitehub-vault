# Development Commands

- `pnpm dev` runs all workspace `dev` scripts through Turbo
- `pnpm dev:api` runs `apps/api` and its local workspace dependencies
- `pnpm dev:eddn-listener` runs `apps/eddn-listener` and its local workspace dependencies
- `pnpm dev:eddn-worker` runs `apps/eddn-worker` and its local workspace dependencies
- `pnpm build` builds the full workspace
- `pnpm typecheck` type checks the full workspace
- `pnpm lint` runs Oxlint across the workspace
- `pnpm test` runs workspace tests
- `pnpm format` formats code and Markdown with Prettier
- `pnpm drizzle:generate` delegates to `packages/db` and generates migrations
- `pnpm drizzle:migrate` delegates to `packages/db` and runs pending migrations
- `pnpm drizzle:studio` delegates to `packages/db` and opens Drizzle Studio

# Monorepo Structure

- `apps/api` contains the Koa API, PostGraphile integration, auth, SSE endpoints, and the outbox relay
- `apps/eddn-listener` connects to EDDN over ZeroMQ and pushes jobs into BullMQ
- `apps/eddn-worker` consumes BullMQ jobs and writes state into PostgreSQL
- `packages/db` owns schema, DB utilities, migrations, and DB maintenance scripts
- `packages/eddn-contracts` holds shared EDDN message types and filters
- `packages/queue-contracts` holds queue names, job payloads, and realtime payload contracts
- `packages/runtime-config` holds shared env loading, logging, Redis, and Sentry helpers
- `packages/typescript-config` holds shared TS config presets

# Environment

- The repo loads environment variables from the workspace root `.env`
- `packages/runtime-config` resolves the default env path automatically, so app-local `.env` files are not required
- Override the env file path with `DOTENV_CONFIG_PATH` if needed

# Code Style

- Use ES modules and keep `.js` extensions in imports, even in `.ts` files
- Prefer named imports when practical
- Prefix logs with a component label such as `[API]` or `[EDDN Worker]`
- Use Drizzle for database access
- Use `db.transaction()` for multi-step database writes
- Keep app runtime instances process-local; do not share live Redis, BullMQ, or DB clients across apps

# Workflow

- Typecheck after a meaningful set of code changes
- Prefer targeted tests over broad test runs when validating a local change
- If you touch docs for setup or commands, keep them aligned with root `package.json`, `turbo.json`, and actual workspace package names
- Prefer root workspace scripts when documenting commands unless package-local invocation is specifically relevant

# Database Migrations

Database migration ownership lives in `packages/db`. Root `pnpm drizzle:*` scripts are convenience wrappers, not Turbo pipeline tasks.

When modifying schema in `packages/db/src/schema.ts`:

1. Generate migration with `pnpm drizzle:generate`
2. Review generated SQL in `packages/db/drizzle/`
3. Run migration with `pnpm drizzle:migrate`
4. Commit both `schema.ts` and the generated migration files

If local Drizzle migration bookkeeping gets corrupted, `packages/db` also exposes `pnpm db:recreate-migrations-table`.

# Architecture

## Data Pipeline

1. EDDN feed over ZeroMQ
2. `apps/eddn-listener`
3. BullMQ queue in Redis
4. `apps/eddn-worker`
5. PostgreSQL
6. `apps/api`

## Realtime SSE Pipeline

1. Worker-side processors write realtime candidates into `eventOutbox`
2. `EventOutboxRelay` polls outbox rows, validates payloads, and publishes Redis channel events
3. Redis channel format is `events:systemPowerplayUpdated:power:<powerId>`
4. `/realtime/sse` authenticates the API key and opens a stream through `sseService`
5. `SseBroker` manages active connections, Redis subscriptions, connection filtering, and SSE framing

## Realtime SSE Scope

- Endpoint: `GET /realtime/sse`
- Auth: API key required in production via `X-API-Key`
- Supported event type: `systemPowerplayUpdated`
- Required params: `eventType=systemPowerplayUpdated` and one to four `powerId` values
- Optional params: up to twenty `systemId` values
- Concurrent SSE quota is sourced from `apiKeys.maxSseConnections` with default `3`

## SSE Runtime Behavior

- Sends a `retry: 2000` hint on open
- Emits keepalive comments every 15 seconds
- Routes messages by `(eventType, powerId)` and optionally filters by `systemId`
- Closes slow clients under backpressure
- Reconciles Redis subscriptions on reconnect
- Logs periodic broker summaries and connection lifecycle events

# Important Files

- `apps/api/src/index.ts` is the API entry point
- `apps/eddn-listener/src/index.ts` is the EDDN ingestion entry point
- `apps/eddn-worker/src/index.ts` is the worker entry point
- `packages/db/src/schema.ts` is the main shared database schema
- `apps/api/src/realtime/eventOutboxRelay.ts` owns outbox polling and Redis publish fan-out
- `apps/api/src/realtime/sse/sseService.ts` owns SSE session orchestration and quota checks
- `apps/api/src/realtime/sse/sseBroker.ts` owns connection registry, filtering, and backpressure handling
- `apps/api/src/realtime/sse/redisSubscriptionManager.ts` owns Redis subscribe and unsubscribe lifecycle
- `apps/api/src/realtime/sse/subscriptionParams.ts` owns SSE query parsing and validation
