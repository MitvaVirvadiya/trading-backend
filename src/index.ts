// ==============================================================================
// src/index.ts
//
// Application entry point — creates and starts the Elysia HTTP server.
//
// Startup sequence:
//   1. Validate environment variables (crashes fast if .env is incomplete)
//   2. Connect to DragonflyDB (cache)
//   3. Build the Elysia app with plugins and routes
//   4. Start listening on the configured port
//
// Elysia architecture recap:
//   Elysia is inspired by Express but built for Bun with TypeScript-first.
//   Key concepts:
//     • Everything is a "plugin" — CORS, Swagger, your own routes are all plugins
//     • `.use(plugin)` mounts a plugin
//     • Lifecycle hooks (.onStart, .onStop, .onError) handle events
//     • Requests run through: onRequest → body parsing → validation → handler → response
// ==============================================================================

// Import env FIRST — this validates all required vars and exits if any are missing
import env from "@/config/env";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { connectCache } from "@/cache";
import { healthRoutes } from "@/routes/health";
import { userRoutes } from "@/routes/users";
import { fundRoutes } from "@/routes/funds";
import { orderRoutes } from "@/routes/orders";
import { tradeRoutes } from "@/routes/trades";
import { portfolioRoutes } from "@/routes/portfolio";
import { marginRoutes } from "@/routes/margin";

// ── Build the Elysia application ──────────────────────────────────────────────
const app = new Elysia()

  // ── CORS plugin ─────────────────────────────────────────────────────────────
  // Allows browsers to make cross-origin requests to your API.
  // In development, `origin: "*"` accepts requests from any domain.
  // In production, replace with your actual frontend domain:
  //   origin: "https://yourtradingapp.com"
  .use(
    cors({
      origin: env.NODE_ENV === "production" ? "https://your-frontend.com" : "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    })
  )

  // ── Swagger / OpenAPI plugin ─────────────────────────────────────────────────
  // Auto-generates interactive API docs from your route + TypeBox schemas.
  // Visit http://localhost:3000/swagger while the server is running.
  .use(
    swagger({
      path: "/swagger",         // UI available at /swagger
      documentation: {
        info: {
          title: "Trading Bot API",
          version: "0.1.0",
          description:
            "REST API for the trading bot — powered by Elysia + TimescaleDB",
        },
        tags: [
          { name: "System", description: "Health & diagnostics" },
          { name: "Users", description: "User management" },
          { name: "Funds", description: "Fund management — deposit, withdraw, balance" },
          { name: "Orders", description: "Order placement and management" },
          { name: "Trades", description: "Trade history" },
          { name: "Portfolio", description: "Positions, holdings & PnL" },
          { name: "Margin", description: "Margin summary & calculation" },
        ],
      },
    })
  )

  // ── Register route plugins ────────────────────────────────────────────────────
  // Each `.use()` call mounts a plugin. The prefix defined in each route file
  // is applied automatically (e.g. healthRoutes has prefix "/health").
  .use(healthRoutes)
  .use(userRoutes)
  .use(fundRoutes)
  .use(orderRoutes)
  .use(tradeRoutes)
  .use(portfolioRoutes)
  .use(marginRoutes)

  // ── Root route ───────────────────────────────────────────────────────────────
  .get("/", () => ({
    name: "Trading Bot API",
    version: "0.1.0",
    docs: "/swagger",
    health: "/health",
    api: "/api/v1",
  }))

  // ── Global error handler ─────────────────────────────────────────────────────
  // `code` tells us WHY the error happened. Elysia classifies every error into
  // one of these codes so we can respond appropriately without logging noise:
  //
  //   NOT_FOUND   → Browser/client hit a URL that has no matching route
  //                 (e.g. /favicon.ico, typos). This is NORMAL — don't log it.
  //   VALIDATION  → Request body / params failed TypeBox schema check.
  //                 Return 422 with a helpful message, don't log as an error.
  //   UNKNOWN     → An unexpected runtime exception in a handler.
  //                 This IS an error — log it so we can fix it.
  .onError(({ error, code, request }) => {
    if (code === "NOT_FOUND") {
      // Silent 404 — just return the JSON, no console noise.
      return new Response(
        JSON.stringify({ error: "Not Found", message: `Route ${request.method} ${new URL(request.url).pathname} not found`, statusCode: 404 }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (code === "VALIDATION") {
      // TypeBox rejected the input — tell the client exactly what was wrong.
      // `error.message` contains structured details from the schema validator.
      return new Response(
        JSON.stringify({ error: "Validation Error", message: error.message, statusCode: 422 }),
        { status: 422, headers: { "Content-Type": "application/json" } }
      );
    }

    // Everything else is a real unexpected error — log it for debugging.
    console.error(`[app] Error [${code}] ${request.method} ${new URL(request.url).pathname}:`, error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", message: "Something went wrong", statusCode: 500 }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  })

  // ── Lifecycle: onStart ───────────────────────────────────────────────────────
  // Runs once when the server starts. Good place to connect to external services.
  .onStart(async () => {
    await connectCache();
    console.log(`[app] Server running at http://localhost:${env.PORT}`);
    console.log(`[app] API docs at  http://localhost:${env.PORT}/swagger`);
  })

  // ── Start the server ──────────────────────────────────────────────────────────
  // `.listen(port)` starts the Bun HTTP server. Bun uses uWebSockets.js under
  // the hood which is one of the fastest HTTP servers available in any language.
  .listen(env.PORT);

// Export the app for testing (e.g. with bun:test)
export type App = typeof app;
