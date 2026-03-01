// ==============================================================================
// src/routes/health.ts
//
// Health-check endpoint — the simplest but most important route.
//
// Why have a health check?
//   • Docker, Kubernetes, and load balancers ping this to know if the service
//     is alive. If it returns non-200, the container is restarted or traffic
//     is rerouted.
//   • It also checks that the database and cache are reachable, not just that
//     the HTTP server is running.
//
// How Elysia routes work:
//   Elysia uses a plugin-based architecture. A "plugin" is just an Elysia
//   instance. You call `app.use(healthPlugin)` to mount it in the main app.
//   This keeps code modular — each route file owns its own logic.
// ==============================================================================

import { Elysia, t } from "elysia";
import { db } from "@/db";
import { cache } from "@/cache";
import { sql } from "drizzle-orm"; // `sql` is a tagged-template for raw SQL fragments

// `new Elysia({ prefix: "/health" })` means all routes defined below are
// automatically prefixed. `.get("")` maps to GET /health
export const healthRoutes = new Elysia({ prefix: "/health" })
  // ── GET /health ─────────────────────────────────────────────────────────────
  .get(
    "",
    async () => {
      // We check both services concurrently with Promise.allSettled so a
      // single service failure doesn't block the other check.
      const [dbResult, cacheResult] = await Promise.allSettled([
        // Drizzle raw SQL — `sql`1`` is equivalent to SELECT 1 as a DB ping
        db.execute(sql`SELECT 1`),
        cache.ping(), // ioredis .ping() returns "PONG" if DragonflyDB is up
      ]);

      const services = {
        database: dbResult.status === "fulfilled" ? "ok" : "error",
        cache: cacheResult.status === "fulfilled" ? "ok" : "error",
      };

      const allHealthy = Object.values(services).every((s) => s === "ok");

      // Elysia automatically serialises the returned object as JSON
      return {
        status: allHealthy ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        services,
      };
    },
    {
      // Response schema — Elysia validates the response AND includes it in
      // auto-generated OpenAPI/Swagger docs.
      response: t.Object({
        status: t.String(),
        timestamp: t.String(),
        services: t.Object({
          database: t.String(),
          cache: t.String(),
        }),
      }),
      detail: {
        // OpenAPI documentation metadata
        tags: ["System"],
        summary: "Health check",
        description:
          "Returns the operational status of the API, database, and cache.",
      },
    }
  );
