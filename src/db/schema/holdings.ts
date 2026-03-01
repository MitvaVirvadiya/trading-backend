import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const holdings = pgTable("holdings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),

  // Instrument snapshot
  symbol: text("symbol").notNull(),
  instrumentName: text("instrument_name").notNull(),
  isin: text("isin"),
  exchangeToken: text("exchange_token"),
  exchange: text("exchange").notNull(),             // NSE | BSE

  // Holding details
  quantity: integer("quantity").notNull(),
  averagePrice: numeric("average_price", { precision: 20, scale: 4 }).notNull(),
  lastPrice: numeric("last_price", { precision: 20, scale: 4 }).default("0"),
  pnl: numeric("pnl", { precision: 20, scale: 4 }).default("0"),
  pnlPercent: numeric("pnl_percent", { precision: 10, scale: 4 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Holding = typeof holdings.$inferSelect;
export type NewHolding = typeof holdings.$inferInsert;
