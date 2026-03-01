// ==============================================================================
// drizzle.config.ts
//
// Drizzle Kit configuration — tells drizzle-kit CLI where your schemas are
// and how to connect to the database for migration management.
//
// drizzle-kit is a DEVELOPMENT tool only. It:
//   • Reads your schema files
//   • Compares them to the current DB state
//   • Generates SQL migration files in the `out` directory
//
// Common commands (add to package.json scripts):
//   bun run db:generate  → generate new migration SQL files from schema changes
//   bun run db:migrate   → apply pending migrations to the DB
//   bun run db:studio    → open Drizzle Studio (visual DB browser) in browser
//   bun run db:push      → apply schema directly without migration files (dev only!)
// ==============================================================================

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Where to write generated migration SQL files.
  // These files should be committed to git so your team can apply them.
  out: "./drizzle",

  // Path (or glob) to your schema file(s).
  // You can use a single barrel like we do, or a glob: "./src/db/schema/*.ts"
  schema: "./src/db/schema/index.ts",

  // Database dialect — "postgresql" covers both plain PostgreSQL and TimescaleDB
  // (TimescaleDB is just PostgreSQL with extensions, so the SQL dialect is identical)
  dialect: "postgresql",

  // Connection credentials for drizzle-kit to inspect the live DB schema.
  // Loaded from environment variables so secrets don't live in source code.
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },

  // When true, drizzle-kit prints the exact SQL it will run. Very useful for
  // learning what migrations actually do.
  verbose: true,

  // When true, drizzle-kit asks for confirmation before destructive operations
  // (e.g. DROP TABLE). Keep this true in any shared environment.
  strict: true,
});
