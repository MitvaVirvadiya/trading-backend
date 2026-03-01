import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const margins = pgTable("margins", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  segment: text("segment").notNull(),               // equity | fno | cd | mcx
  availableMargin: numeric("available_margin", { precision: 20, scale: 4 }).default("0"),
  usedMargin: numeric("used_margin", { precision: 20, scale: 4 }).default("0"),
  totalMargin: numeric("total_margin", { precision: 20, scale: 4 }).default("0"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Margin = typeof margins.$inferSelect;
export type NewMargin = typeof margins.$inferInsert;
