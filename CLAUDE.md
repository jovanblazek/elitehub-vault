# Development commands
- pnpm dev # Run in watch mode with hot reload
- pnpm typecheck # Type check the code
- pnpm drizzle:generate # Generate migrations from schema changes
- pnpm drizzle:migrate # Run pending migrations
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

When modifying schema in `src/db/schema.ts`:

1. Generate migration: `pnpm drizzle:generate`
2. Review generated SQL in `drizzle/` directory
3. Run migration: `pnpm drizzle:migrate`
4. Commit both schema.ts and generated migration files

# Architecture

## Data Pipeline
1. EDDN Feed (ZeroMQ subscription)
2. Child Process (eddnProcess.js)
3. BullMQ Queue (Redis-backed)
4. Event Processors
5. Drizzle ORM
6. PostgreSQL Database
7. PostGraphile
8. GraphQL API (Koa server)

## Component Responsibilities
- src/index.ts - Application entry point
- src/eddn/ - EDDN data ingestion
- src/mq/queues/eddn/ - Event processing (BullMQ worker)
- src/mq/queues/eddn/events/ - Event-specific processors
- src/mq/queues/eddn/helpers/ - Data transformation logic
- src/db/schema.ts - Database schema
