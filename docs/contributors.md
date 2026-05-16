# Contributors

This is the quick onboarding guide for contributors. It is intentionally high level.

For deeper internals:

- Architecture and data flow: [docs/architecture.md](architecture.md)
- Database migration details: [docs/database-migrations.md](database-migrations.md)
- SSE API behavior and payloads: [docs/sse.md](sse.md)
- Repository engineering conventions: [AGENTS.md](../AGENTS.md)

This repository uses a Turborepo monorepo with applications under `apps/*` and shared libraries under `packages/*`.

## Prerequisites

- **Node.js** 22.14.0 or higher
- **pnpm** 9.x or higher
- **Docker** and Docker Compose (for local database)

## Quick Start

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

6. **Start development pipeline:**

   ```bash
   pnpm dev
   ```

The GraphQL API is available at `http://localhost:3000/graphql` unless `PORT` is changed in `.env`.

## Development Commands

```bash
pnpm dev                 # Run all workspace dev tasks through Turbo
pnpm dev:api             # Run apps/api and its local dependencies
pnpm dev:eddn-listener   # Run apps/eddn-listener and its local dependencies
pnpm dev:eddn-worker     # Run apps/eddn-worker and its local dependencies
pnpm typecheck           # Type check the code
pnpm build               # Build all apps and packages
pnpm format              # Format all code with Prettier
pnpm lint                # Lint code with Oxlint
pnpm drizzle:generate    # Delegate to packages/db and generate migrations
pnpm drizzle:migrate     # Delegate to packages/db and run migrations
pnpm drizzle:studio      # Delegate to packages/db and open Drizzle Studio

# Docker
pnpm docker:up           # Start PostgreSQL + Redis
pnpm docker:down         # Stop services
```

## Testing

Automated tests run through `pnpm test` (Turbo) and currently live in multiple workspaces, including:

- `apps/api/src/**/*.test.ts`
- `packages/queue-contracts/src/**/*.test.ts`

Use targeted runs when possible:

- API route, auth, SSE, or GraphQL behavior changed:
  `pnpm --filter @elitehub/api test`
- Realtime contracts, event payloads, or queue schemas changed:
  `pnpm --filter @elitehub/queue-contracts test`
- Cross-workspace or risky changes:
  `pnpm test`

## Contributing Guidelines

1. **Fork the repository** and create a feature branch
2. **Follow code style** guidelines (see [AGENTS.md](../AGENTS.md))
3. **Write clear commit messages**
4. **Run verification** before submitting:
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm format`
   - relevant tests from the testing section
5. **Submit a pull request** with a clear description of changes, or cause of a bug.

## Environment Variables

See `.env.example` for all available configuration options. Key variables:

- `PORT` - HTTP server port (default: 3000)
- `LOG_LEVEL` - Logging level (`debug`, `info`, `warn`, `error`)
- `SENTRY_DSN_API` - API Sentry DSN (optional)
- `SENTRY_DSN_EDDN_WORKER` - EDDN worker Sentry DSN (optional)
- `SENTRY_DSN_EDDN_LISTENER` - EDDN listener Sentry DSN (optional)
