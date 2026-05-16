# Database Migrations

Migration ownership lives in `packages/db`.

You can run commands from the workspace root via wrappers, or directly in `packages/db`.

## Standard Workflow

When you modify schema in `packages/db/src/schema.ts`:

1. Generate migration:

   ```bash
   pnpm drizzle:generate
   ```

   Direct package equivalent:
   `cd packages/db && pnpm drizzle:generate`

2. Review generated SQL in `packages/db/drizzle/`. Edit the migration if needed.
3. Run migration:

   ```bash
   pnpm drizzle:migrate
   ```

   Direct package equivalent:
   `cd packages/db && pnpm drizzle:migrate`

4. (Optional) Inspect data model in Drizzle Studio:

   ```bash
   pnpm drizzle:studio
   ```

5. Commit both:
   - `packages/db/src/schema.ts`
   - generated files in `packages/db/drizzle/`

## Recovery Utility

If local migration bookkeeping gets corrupted, use:

```bash
pnpm --dir packages/db db:recreate-migrations-table
```
