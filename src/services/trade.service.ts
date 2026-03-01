import { eq, and, gte, lte, count, sql } from "drizzle-orm";
import { db } from "@/db";
import { trades } from "@/db/schema";

/**
 * Get a single trade by ID.
 */
export async function getTradeById(tradeId: string) {
  const rows = await db
    .select()
    .from(trades)
    .where(eq(trades.id, tradeId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Get trades for a user with filters and pagination.
 */
export async function getUserTrades(
  userId: string,
  filters: { from?: string; to?: string; segment?: string },
  page: number = 1,
  limit: number = 20
) {
  const offset = (page - 1) * limit;

  const conditions = [eq(trades.userId, userId)];

  if (filters.segment) {
    conditions.push(eq(trades.segment, filters.segment));
  }
  if (filters.from) {
    conditions.push(gte(trades.tradeDate, new Date(filters.from)));
  }
  if (filters.to) {
    conditions.push(lte(trades.tradeDate, new Date(filters.to)));
  }

  const whereClause = and(...conditions);

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(trades)
      .where(whereClause)
      .orderBy(sql`${trades.tradeDate} DESC`)
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(trades).where(whereClause),
  ]);

  return { items, total: countResult[0]?.total ?? 0 };
}
