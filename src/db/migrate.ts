import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, pool } from "@/db";

async function main() {
  console.log("[migrate] Starting database migration...");

  // Enable uuid-ossp extension for UUID generation
  await pool`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  console.log("[migrate] UUID extension enabled");

  // Apply all pending Drizzle migrations
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] Drizzle migrations applied");

  console.log("[migrate] All done! Database is ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[migrate] Migration failed:", err);
  process.exit(1);
});
