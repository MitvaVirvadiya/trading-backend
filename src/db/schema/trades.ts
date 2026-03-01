import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  timestamp,
  date,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { orders } from "./orders";

export const trades = pgTable("trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
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

  // Trade details
  side: text("side").notNull(),
  product: text("product").notNull(),
  quantity: integer("quantity").notNull(),
  price: numeric("price", { precision: 20, scale: 4 }).notNull(),
  value: numeric("value", { precision: 20, scale: 4 }).notNull(),
  charges: numeric("charges", { precision: 20, scale: 4 }).default("0"),
  tradeDate: timestamp("trade_date").defaultNow(),
  settlementDate: date("settlement_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;
