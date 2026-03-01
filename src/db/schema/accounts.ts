import {
  pgTable,
  uuid,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  balance: numeric("balance", { precision: 20, scale: 4 }).default("0"),
  blockedBalance: numeric("blocked_balance", { precision: 20, scale: 4 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
