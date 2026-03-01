import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  date,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const positions = pgTable("positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),

  // Instrument snapshot
  symbol: text("symbol").notNull(),
  instrumentName: text("instrument_name").notNull(),
  isin: text("isin"),
  exchangeToken: text("exchange_token"),
  exchange: text("exchange").notNull(),
  segment: text("segment").notNull(),
  instrumentType: text("instrument_type").notNull(),
  expiryDate: date("expiry_date"),
  strikePrice: numeric("strike_price", { precision: 20, scale: 4 }),
  optionType: text("option_type"),
  lotSize: integer("lot_size").default(1),

  // Position tracking
  product: text("product").notNull(),               // mis | nrml
  netQuantity: integer("net_quantity").default(0),
  buyQuantity: integer("buy_quantity").default(0),
  sellQuantity: integer("sell_quantity").default(0),
  buyAvgPrice: numeric("buy_avg_price", { precision: 20, scale: 4 }).default("0"),
  sellAvgPrice: numeric("sell_avg_price", { precision: 20, scale: 4 }).default("0"),
  lastPrice: numeric("last_price", { precision: 20, scale: 4 }).default("0"),
  realizedPnl: numeric("realized_pnl", { precision: 20, scale: 4 }).default("0"),
  unrealizedPnl: numeric("unrealized_pnl", { precision: 20, scale: 4 }).default("0"),
  pnl: numeric("pnl", { precision: 20, scale: 4 }).default("0"),
  isOpen: boolean("is_open").default(true),
  tradingDate: date("trading_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
