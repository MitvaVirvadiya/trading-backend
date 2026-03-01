import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { accounts } from "./accounts";

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  type: text("type").notNull(),                     // deposit | withdrawal
  amount: numeric("amount", { precision: 20, scale: 4 }).notNull(),
  status: text("status").default("pending"),        // pending | processing | completed | failed
  referenceNumber: text("reference_number").unique(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
