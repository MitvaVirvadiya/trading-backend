import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { accounts } from "./accounts";

export const ledger = pgTable("ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  type: text("type").notNull(),                     // credit | debit
  category: text("category").notNull(),             // deposit | withdrawal | trade_buy | trade_sell | charges | pnl
  amount: numeric("amount", { precision: 20, scale: 4 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 20, scale: 4 }).notNull(),
  referenceId: uuid("reference_id"),                // tradeId or transactionId
  referenceType: text("reference_type"),            // trade | transaction
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Ledger = typeof ledger.$inferSelect;
export type NewLedger = typeof ledger.$inferInsert;
