import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { holdings } from "@/db/schema";

/**
 * Update or create a holding after a CNF (delivery) trade.
 * Holdings accumulate across days — one record per symbol per user.
 */
export async function updateHolding(params: {
  userId: string;
  symbol: string;
  instrumentName: string;
  isin?: string;
  exchangeToken?: string;
  exchange: string;
  side: string;
  quantity: number;
  price: number;
}) {
  const { userId, symbol, instrumentName, isin, exchangeToken, exchange, side, quantity, price } = params;

  // Find existing holding
  const existingRows = await db
    .select()
    .from(holdings)
    .where(
      and(
        eq(holdings.userId, userId),
        eq(holdings.symbol, symbol),
        eq(holdings.exchange, exchange)
      )
    )
    .limit(1);
  const existing = existingRows[0];

  if (side === "buy") {
    if (existing) {
      // Average up: new avg = (old_qty * old_avg + new_qty * price) / (old_qty + new_qty)
      const oldQty = existing.quantity;
      const oldAvg = parseFloat(existing.averagePrice);
      const newTotalQty = oldQty + quantity;
      const newAvg = ((oldQty * oldAvg + quantity * price) / newTotalQty).toFixed(4);

      await db
        .update(holdings)
        .set({
          quantity: newTotalQty,
          averagePrice: newAvg,
          updatedAt: new Date(),
        })
        .where(eq(holdings.id, existing.id));

      return { ...existing, quantity: newTotalQty, averagePrice: newAvg };
    } else {
      // Create new holding
      const holdingRows = await db
        .insert(holdings)
        .values({
          userId,
          symbol,
          instrumentName,
          isin,
          exchangeToken,
          exchange,
          quantity,
          averagePrice: price.toFixed(4),
        })
        .returning();

      return holdingRows[0]!;
    }
  } else {
    // Sell — reduce holding quantity
    if (!existing) throw new Error("No holdings to sell");
    if (existing.quantity < quantity) throw new Error("Insufficient holdings");

    const newQty = existing.quantity - quantity;

    if (newQty === 0) {
      // Remove holding entirely
      await db.delete(holdings).where(eq(holdings.id, existing.id));
      return null;
    }

    await db
      .update(holdings)
      .set({ quantity: newQty, updatedAt: new Date() })
      .where(eq(holdings.id, existing.id));

    return { ...existing, quantity: newQty };
  }
}

/**
 * Get all holdings for a user.
 */
export async function getUserHoldings(userId: string) {
  return db
    .select()
    .from(holdings)
    .where(eq(holdings.userId, userId));
}
