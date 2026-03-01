import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { positions } from "@/db/schema";

/**
 * Get today's date string in YYYY-MM-DD format.
 */
function today(): string {
  return new Date().toISOString().split("T")[0]!;
}

/**
 * Find or create a position for the current trading day.
 * Positions are per-day, per-product, per-instrument.
 */
export async function getOrCreatePosition(params: {
  userId: string;
  symbol: string;
  exchange: string;
  segment: string;
  instrumentType: string;
  instrumentName: string;
  product: string;
  isin?: string;
  exchangeToken?: string;
  expiryDate?: string;
  strikePrice?: string;
  optionType?: string;
  lotSize?: number;
}) {
  const tradingDate = today();

  const existingRows = await db
    .select()
    .from(positions)
    .where(
      and(
        eq(positions.userId, params.userId),
        eq(positions.symbol, params.symbol),
        eq(positions.exchange, params.exchange),
        eq(positions.product, params.product),
        eq(positions.tradingDate, tradingDate)
      )
    )
    .limit(1);

  if (existingRows[0]) return existingRows[0];

  const inserted = await db
    .insert(positions)
    .values({
      userId: params.userId,
      symbol: params.symbol,
      instrumentName: params.instrumentName,
      isin: params.isin,
      exchangeToken: params.exchangeToken,
      exchange: params.exchange,
      segment: params.segment,
      instrumentType: params.instrumentType,
      expiryDate: params.expiryDate,
      strikePrice: params.strikePrice,
      optionType: params.optionType,
      lotSize: params.lotSize ?? 1,
      product: params.product,
      tradingDate,
    })
    .returning();

  return inserted[0]!;
}

/**
 * Update a position after a trade execution.
 */
export async function updatePositionOnTrade(
  positionId: string,
  side: string,
  quantity: number,
  price: number
) {
  const posRows = await db
    .select()
    .from(positions)
    .where(eq(positions.id, positionId))
    .limit(1);
  const position = posRows[0];

  if (!position) throw new Error("Position not found");

  let buyQty = position.buyQuantity ?? 0;
  let sellQty = position.sellQuantity ?? 0;
  let buyAvg = parseFloat(position.buyAvgPrice ?? "0");
  let sellAvg = parseFloat(position.sellAvgPrice ?? "0");

  if (side === "buy") {
    const totalBuyValue = buyAvg * buyQty + price * quantity;
    buyQty += quantity;
    buyAvg = buyQty > 0 ? totalBuyValue / buyQty : 0;
  } else {
    const totalSellValue = sellAvg * sellQty + price * quantity;
    sellQty += quantity;
    sellAvg = sellQty > 0 ? totalSellValue / sellQty : 0;
  }

  const netQty = buyQty - sellQty;
  const matchedQty = Math.min(buyQty, sellQty);
  const realizedPnl = matchedQty * (sellAvg - buyAvg);
  const isOpen = netQty !== 0;

  await db
    .update(positions)
    .set({
      buyQuantity: buyQty,
      sellQuantity: sellQty,
      buyAvgPrice: buyAvg.toFixed(4),
      sellAvgPrice: sellAvg.toFixed(4),
      netQuantity: netQty,
      realizedPnl: realizedPnl.toFixed(4),
      isOpen,
      updatedAt: new Date(),
    })
    .where(eq(positions.id, positionId));

  return { netQty, realizedPnl, isOpen };
}

/**
 * Get open positions for a user.
 */
export async function getOpenPositions(userId: string) {
  return db
    .select()
    .from(positions)
    .where(and(eq(positions.userId, userId), eq(positions.isOpen, true)));
}

/**
 * Get positions for a user on a given trading date.
 */
export async function getPositionsByDate(userId: string, tradingDate?: string) {
  const date = tradingDate ?? today();
  return db
    .select()
    .from(positions)
    .where(
      and(eq(positions.userId, userId), eq(positions.tradingDate, date))
    );
}

/**
 * Close a single position by setting netQuantity to 0.
 */
export async function closePosition(positionId: string) {
  const posRows = await db
    .select()
    .from(positions)
    .where(eq(positions.id, positionId))
    .limit(1);
  const position = posRows[0];

  if (!position) throw new Error("Position not found");
  if (!position.isOpen) throw new Error("Position already closed");

  // In a real scenario, this would place a counter-order at market price.
  // For now, we just mark it closed.
  await db
    .update(positions)
    .set({
      isOpen: false,
      netQuantity: 0,
      updatedAt: new Date(),
    })
    .where(eq(positions.id, positionId));

  return position;
}

/**
 * Close all open MIS positions for a user (end-of-day square off).
 */
export async function closeAllMISPositions(userId: string) {
  const openMIS = await db
    .select()
    .from(positions)
    .where(
      and(
        eq(positions.userId, userId),
        eq(positions.isOpen, true),
        eq(positions.product, "mis")
      )
    );

  for (const pos of openMIS) {
    await closePosition(pos.id);
  }

  return { closed: openMIS.length };
}
