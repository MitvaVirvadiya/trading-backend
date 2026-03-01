// ==============================================================================
// src/db/schema/index.ts
//
// Barrel export for all Drizzle schema definitions.
//
// Why a barrel?
//   Instead of importing from individual files everywhere:
//     import { users } from "@/db/schema/users";
//     import { trades } from "@/db/schema/trades";
//
//   You import from one place:
//     import { users, trades } from "@/db/schema";
//
//   This also means when you add a new table (e.g. positions.ts), you just
//   add one export line here and everything that uses "@/db/schema" benefits.
// ==============================================================================

export * from "./users";
export * from "./accounts";
export * from "./ledger";
export * from "./orders";
export * from "./trades";
export * from "./positions";
export * from "./holdings";
export * from "./transactions";
export * from "./margins";
