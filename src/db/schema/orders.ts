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

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),

  // Instrument snapshot from market API
  symbol: text("symbol").notNull(),
  instrumentName: text("instrument_name").notNull(),
  isin: text("isin"),
  exchangeToken: text("exchange_token"),
  exchange: text("exchange").notNull(),             // NSE | BSE | NFO | MCX | CDS
  segment: text("segment").notNull(),               // equity | fno | cd | mcx
  instrumentType: text("instrument_type").notNull(), // EQ | FUT | OPT | CUR | COM
  expiryDate: date("expiry_date"),
  strikePrice: numeric("strike_price", { precision: 20, scale: 4 }),
  optionType: text("option_type"),                  // CE | PE
  lotSize: integer("lot_size").default(1),

  // Order details
  orderType: text("order_type").notNull(),          // market | limit | sl | sl-m
  side: text("side").notNull(),                     // buy | sell
  product: text("product").notNull(),               // mis | cnf | nrml
  quantity: integer("quantity").notNull(),
  price: numeric("price", { precision: 20, scale: 4 }),
  triggerPrice: numeric("trigger_price", { precision: 20, scale: 4 }),
  filledQuantity: integer("filled_quantity").default(0),
  averagePrice: numeric("average_price", { precision: 20, scale: 4 }),
  status: text("status").default("pending"),        // pending | open | partial | complete | cancelled | rejected
  rejectionReason: text("rejection_reason"),
  validity: text("validity").default("day"),        // day | ioc
  tag: text("tag"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
