// ==============================================================================
// src/config/env.ts
//
// Centralised environment-variable access.
//
// Why not just use process.env everywhere?
//   If you scatter `process.env.SOME_KEY` throughout your codebase and that
//   key is missing, your app crashes at runtime — potentially hours after
//   startup. By validating all required vars HERE at boot time, you get one
//   clear error immediately if anything is missing.
//
// Bun tip: Bun automatically loads `.env` at startup, so you don't need
//           the `dotenv` package. Just read from `process.env` directly.
// ==============================================================================

// All environment variables our application needs.
// Bun.env is the same as process.env but with Bun-aware types.
const env = {
  // ── Database ────────────────────────────────────────────────────────────────
  DATABASE_URL: Bun.env.DATABASE_URL,

  // ── Cache (DragonflyDB / Redis) ─────────────────────────────────────────────
  DRAGONFLY_URL: Bun.env.DRAGONFLY_URL,

  // ── Server ──────────────────────────────────────────────────────────────────
  PORT: Number(Bun.env.PORT ?? 3000),    // fallback to 3000 if not set
  NODE_ENV: Bun.env.NODE_ENV ?? "development",
} as const;

// ── Boot-time validation ───────────────────────────────────────────────────────
// These are the vars that MUST exist. If any are missing the app exits cleanly
// with a helpful message instead of crashing with a confusing error later.
const REQUIRED: (keyof typeof env)[] = ["DATABASE_URL", "DRAGONFLY_URL"];

for (const key of REQUIRED) {
  if (!env[key]) {
    console.error(`[config] Missing required environment variable: ${key}`);
    console.error(`[config] Copy .env.example → .env and fill in your values.`);
    process.exit(1);  // Exit with non-zero code so Docker/CI knows something went wrong
  }
}

export default env;
