# EliteHub Vault

EliteHub Vault is a real-time data collection and processing system for Elite Dangerous. It subscribes to the [EDDN (Elite Dangerous Data Network)](https://github.com/EDCD/EDDN) feed, processes player-submitted events, and stores game state in a PostgreSQL database with a GraphQL API layer powered by PostGraphile.

Support the development of this project by [buying me a coffee](https://buymeacoffee.com/jovanblazek).

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/yellow_img.png)](https://buymeacoffee.com/jovanblazek)

## Table of Contents

- [Why another data collection system?](#why-another-data-collection-system)
- [Usage For API Consumers](#usage-for-api-consumers)
  - [Authentication](#authentication)
  - [Rate Limits](#rate-limits)
  - [API Endpoints](#api-endpoints)
  - [Realtime SSE Endpoint](#realtime-sse-endpoint)
  - [Realtime SSE Event Payload](#realtime-sse-event-payload)
  - [Example Queries](#example-queries)
  - [Support](#support)
- [For Contributors](#for-contributors)
- [Roadmap](#roadmap)
- [License](#license)
- [Credits](#credits)

## Why another data collection system?

There are already several websites and services for Elite Dangerous that provide similar data and functionality. However, most of them lack an API for BGS related data that is comprehensive and well documented.

After EliteBGS started to have frequent availability issues with their API, I decided to build my own data collection system and API.

## Usage For API Consumers

EliteHub Vault provides:

- a **read-only GraphQL API** with Elite Dangerous galaxy data (systems, factions, stations, powerplay, conflicts)
- a **real-time SSE stream** for selected powerplay updates

### Authentication

All protected API requests require an **API key** in the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key" https://your-endpoint/graphql
```

Contact [jovanblazek](https://github.com/jovanblazek) on Discord, username: qwerty22, or create an [issue](https://github.com/jovanblazek/elitehub-vault/issues/new) to obtain an API key.

### Rate Limits

- **GraphQL:** 60 requests per minute per API key (subject to change)
- **SSE:** concurrent connection limit per API key (`maxSseConnections`, default `3`)
- Rate limit headers are included in GraphQL responses

### API Endpoints

```
POST /graphql
GET /graphql (for GraphiQL playground)
GET /realtime/sse
```

### Realtime SSE Endpoint

`GET /realtime/sse` requires:

- `eventType=systemPowerplayUpdated`
- `powerId=<id>` repeated 1-4 times

Optional filters:

- `systemId=<id>` repeated up to 20 times

Notes:

- duplicate `powerId` and `systemId` values are deduplicated server-side
- stream uses standard SSE framing with `id`, `event`, and `data`
- heartbeat comments are emitted periodically to keep connections alive

Example:

```bash
curl -N \
  -H "X-API-Key: your-api-key" \
  -H "Accept: text/event-stream" \
  "https://your-endpoint/realtime/sse?eventType=systemPowerplayUpdated&powerId=<power-id>"
```

Common error responses:

- `400` invalid/missing subscription query params
- `401` missing/invalid API key
- `429` max concurrent SSE connections reached for the API key

### Realtime SSE Event Payload

Current supported realtime event: `systemPowerplayUpdated`

Example `data` payload:

```json
{
  "event": "systemPowerplayUpdated",
  "systemId": "uuid",
  "powerId": "uuid",
  "changedFields": [
    "powerplayState",
    "powerplayStateControlProgress",
    "powerplayStateReinforcement",
    "powerplayStateUndermining"
  ],
  "timestamp": "2026-02-07T00:00:00.000Z",
  "source": "eddn-worker",
  "metadata": {}
}
```

### Example Queries

<!-- TODO: Add example queries -->

TODO: Add example queries

### Support

For API issues or questions, please open an [issue](https://github.com/jovanblazek/elitehub-vault/issues/new).

## For Contributors

### Prerequisites

- **Node.js** 22.14.0 or higher
- **pnpm** 9.x or higher
- **Docker** and Docker Compose (for local database)

### Quick Start

1. **Clone the repository:**

   ```bash
   git clone https://github.com/jovanblazek/elitehub-vault.git
   cd elitehub-vault
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Set up environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start database services:**

   ```bash
   pnpm docker:up
   ```

5. **Run database migrations:**

   ```bash
   pnpm drizzle:migrate
   ```

6. **Start development server:**
   ```bash
   pnpm dev
   ```

The GraphQL API will be available at `http://localhost:3000/graphql`. Replace the port with the one specified in your `.env` file.

### Development Commands

```bash
pnpm dev                 # Run the API app in watch mode
pnpm dev:api             # Run the API app in watch mode
pnpm dev:eddn-listener   # Run the EDDN listener in watch mode
pnpm dev:eddn-worker     # Run the EDDN worker in watch mode
pnpm typecheck           # Type check the code
pnpm build               # Build all apps and packages
pnpm format              # Format all code with Prettier
pnpm lint                # Lint code with Oxlint

# Database
pnpm drizzle:generate    # Generate migrations from schema changes
pnpm drizzle:migrate     # Run pending migrations
pnpm drizzle:studio      # Open Drizzle Studio (visual database explorer)

# Docker
pnpm docker:up           # Start PostgreSQL + Redis
pnpm docker:down         # Stop services
```

### Architecture Overview

```mermaid
flowchart TD
    A[EDDN Feed ZeroMQ]
    B[apps/eddn-listener]
    C[Redis BullMQ Queue]
    D[apps/eddn-worker]
    E[PostgreSQL + eventOutbox]
    F[apps/api relay + SSE]
    G[GraphQL API Koa]

    A --> B --> C --> D --> E --> F
    E --> G
```

**Component Responsibilities:**

- `apps/api/` - Koa API, PostGraphile, SSE, auth, and outbox relay
- `apps/eddn-listener/` - ZeroMQ EDDN consumer that enqueues BullMQ jobs
- `apps/eddn-worker/` - BullMQ workers and database update pipeline
- `packages/db/` - Shared Drizzle schema and DB factory
- `packages/eddn-contracts/` - Shared EDDN message types and filters
- `packages/queue-contracts/` - Shared queue names, job types, and realtime contracts
- `packages/runtime-config/` - Shared env, Redis, logger, and Sentry factories
- `packages/typescript-config/` - Shared base TypeScript config

### Code Style

- Use **ES modules** (`.js` extensions in imports, even for `.ts` files)
- **Destructure imports** when possible: `import { foo } from 'bar'`
- Create process-local runtime instances from shared factories; do not share live Redis/BullMQ/DB instances across apps
- **Prefix logs** with component name: `logger.info('[ComponentName] Message')`
- **All database operations** via Drizzle ORM
- Use `db.transaction()` for multi-step database operations
- Run lint and format commands before committing

### Workflow

1. Make your changes
2. Run `pnpm typecheck` to verify types
3. Test your changes locally, using `pnpm dev`
4. Run `pnpm lint` and `pnpm format` to check for linting and formatting errors
5. Commit with descriptive messages

When done, open a pull request to the main branch.

### Database Migrations

When done modifying the schema in `packages/db/src/schema.ts`:

1. **Generate migration:**

   ```bash
   pnpm drizzle:generate
   ```

2. **Review generated SQL** in `drizzle/` directory. Update if necessary.

3. **Run migration:**

   ```bash
   pnpm drizzle:migrate
   ```

4. **Commit both** `packages/db/src/schema.ts` and generated migration files

### Tech Stack

- **Koa** - HTTP server
- **PostGraphile** - GraphQL API auto-generation
- **Drizzle ORM** - Type-safe database operations
- **BullMQ** - Redis-backed job queue
- **ZeroMQ** - EDDN data subscription
- **PostgreSQL** - Primary database
- **Redis** - Queue backend and rate limiting
- **TypeScript** - Type safety
- **Pino** - Structured logging
- **Sentry** - Error tracking

### Testing

Current automated tests live in `apps/api/src/**/*.test.ts` and run via `pnpm test`.

### Contributing Guidelines

1. **Fork the repository** and create a feature branch
2. **Follow code style** guidelines (see README.md and CLAUDE.md)
3. **Write clear commit messages**
4. **Run typecheck** before submitting
5. **Run lint and format** to check for linting and formatting errors
6. **Submit a pull request** with description of changes

### Environment Variables

See `.env.example` for all available configuration options. Key variables:

- `PORT` - HTTP server port (default: 3000)
- `LOG_LEVEL` - Logging level (debug, info, warn, error)
- `DEBUG_EDDN_LISTENER` - Set to `true` to enable EDDN listener in development mode
- `SENTRY_DSN` - Error tracking (optional)

The rest should be self-explanatory from the example file.

### Resources

- [EDDN GitHub](https://github.com/EDCD/EDDN)
- [Elite Dangerous Journal Schemas](https://jixxed.github.io/ed-journal-schemas/index.html)
- [PostGraphile Documentation](https://postgraphile.org/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)

## Roadmap

- [ ] Process stronghold carriers and megaships. Remove them when they are not present in the FSSSignalDiscovered event or update their location when they appear somewhere else.
- [ ] Add mechanism to remove stations that are not present in the FSSSignalDiscovered event. Stations may be demolished in colonized systems.
- [ ] Track historical data for faction states (Influence, Happiness, Active States, Recovering States, Pending States) and faction presence in systems.

## License

[GPL-3.0](./LICENSE)

## Credits

Data sourced from the Elite Dangerous Data Network (EDDN), contributed by thousands of Elite Dangerous players.

Constants and other useful data types inspired by [EDSM](https://github.com/EDSM-NET/Alias), [Spansh](https://spansh.co.uk/) and [EliteBGS](https://github.com/elite-kode/elitebgs).
