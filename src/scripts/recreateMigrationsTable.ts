// https://github.com/drizzle-team/drizzle-orm/discussions/1604#discussioncomment-12194312

// @ts-ignore - drizzle.config.ts is not in root directory
import drizzleConfig from '../../drizzle.config.js'
import { type MigrationConfig, readMigrationFiles } from 'drizzle-orm/migrator'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js/driver'
import { PgDialect, PgSession } from 'drizzle-orm/pg-core'
import { db } from '../db/db.js'

const config = {
  ...drizzleConfig,
  migrationsFolder: drizzleConfig.out,
  migrationsTable: drizzleConfig.migrations?.table ?? '__drizzle_migrations',
  migrationsSchema: drizzleConfig.migrations?.schema ?? 'drizzle',
} as MigrationConfig

const migrations = readMigrationFiles(config)

const connection = db

const table_name = `${config.migrationsSchema}.${config.migrationsTable}`

type Schema = typeof connection._.fullSchema

async function main() {
  const db = connection as PostgresJsDatabase<Schema> as unknown as PostgresJsDatabase<Schema> & {
    dialect: PgDialect
    session: PgSession
  }

  console.log('~..................¯\\_(ツ)_/¯..................~')
  console.log('Drizzle Migration Hardsync')
  console.log('~...............................................~')
  console.log(
    'If you `drizzle-kit push` you ruin the migration history.\r\nThis script will drop the migration table and create a new one.'
  )
  console.log('~...............................................~')
  console.log('~...............................................~')

  console.log('... Dropping Existing Migration Table')
  // Drop the migration table if it exists
  await connection.execute(`DROP TABLE IF EXISTS ${table_name}`)
  console.log('... Existing Migration Table Dropped')

  console.log('... Creating Migration Table')
  // Since we pass no migrations, it only creates the table.
  await db.dialect.migrate([], db.session, {
    migrationsFolder: config.migrationsFolder,
    migrationsTable: config.migrationsTable,
    migrationsSchema: config.migrationsSchema,
  })
  console.log('... Migration Table Created')
  console.log(`... Inserting ${migrations.length} Migrations`)

  for (const migration of migrations) {
    console.log(`... Applying migration ${migration.hash}`)

    // Add migration hashes to migration table
    // oxlint-disable-next-line no-await-in-loop
    await connection.execute(
      `INSERT INTO ${table_name} (hash, created_at) VALUES ('${migration.hash}', ${migration.folderMillis})`
    )
    console.log(`... Applied migration ${migration.hash}`)
  }

  console.log('~...............................................~')
  console.log('~.. Migration Hardsync Complete! ˶ᵔ ᵕ ᵔ˶........~')
  console.log('~...............................................~')

  process.exit(0)
}

main().catch(console.error)
