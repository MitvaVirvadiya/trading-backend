// ==============================================================================
// src/db/index.ts
//
// PostgreSQL connection powered by postgres.js + Drizzle ORM.
//
// Architecture overview:
//   ┌──────────────┐      ┌────────────────┐      ┌────────────────────────┐
//   │  Your code   │ ───▶ │  Drizzle ORM   │ ───▶ │  postgres.js driver    │
//   │ (queries)    │      │ (type-safe SQL) │      │  (talks to PostgreSQL) │
//   └──────────────┘      └────────────────┘      └────────────────────────┘
//
// postgres.js vs pg (node-postgres):
//   • postgres.js is the recommended Bun-native driver — it uses tagged
//     template literals and is built for modern JS runtimes.
//   • `pg` (node-postgres) works too but has more legacy Node.js overhead.
//
// Drizzle ORM:
//   Think of it as a thin, type-safe layer over raw SQL. Unlike Prisma, it
//   generates NO hidden runtime code — you always know the exact SQL it runs.
//   The mental model: "SQL written in TypeScript."
// ==============================================================================

import { drizzle } from "drizzle-orm/postgres-js"; // Drizzle adapter for postgres.js
import postgres from "postgres";                   // The actual PostgreSQL driver
import env from "@/config/env";
import * as schema from "@/db/schema";             // All table definitions (imported for relational queries)

// ── 1. Create the raw postgres.js connection pool ─────────────────────────────
//
// `postgres(url, options)` returns a "sql" tagged-template function you can
// call directly OR pass to Drizzle.
//
// max: 10  — maintain up to 10 concurrent PostgreSQL connections.
//            TimescaleDB/PostgreSQL handles connection pooling on its side too
//            (via pgBouncer if you add it), but having a sensible cap here
//            prevents your app from opening hundreds of connections under load.
const pool = postgres(env.DATABASE_URL!, {
  max: 10,                 // Max connections in the pool
  idle_timeout: 20,        // Close idle connections after 20 seconds
  connect_timeout: 10,     // Fail fast if DB unreachable after 10s
});

// ── 2. Wrap the pool with Drizzle ORM ─────────────────────────────────────────
//
// `drizzle(pool, { schema })` returns the `db` object you use everywhere:
//   db.select().from(trades).where(...)
//   db.insert(trades).values(...)
//   db.update(trades).set(...).where(...)
//   db.delete(trades).where(...)
//
// Passing `schema` here enables Drizzle's "relational queries" API which lets
// you write joins using a cleaner object-based syntax.
export const db = drizzle(pool, { schema });

// Export the raw pool too — useful if you ever need to run raw SQL,
// e.g. for enabling TimescaleDB extension on first boot.
export { pool };
