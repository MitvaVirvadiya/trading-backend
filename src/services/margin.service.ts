import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { margins } from "@/db/schema";

const SEGMENTS = ["equity", "fno", "cd", "mcx"] as const;

/**
 * Get margin summary for a user across all segments.
 */
export async function getMarginSummary(userId: string) {
  const result = await db
    .select()
    .from(margins)
    .where(eq(margins.userId, userId));

  // Build a complete summary with all segments
  const summary: Record<string, { availableMargin: string; usedMargin: string; totalMargin: string }> = {};

  for (const seg of SEGMENTS) {
    const found = result.find((m) => m.segment === seg);
    summary[seg] = {
      availableMargin: found?.availableMargin ?? "0",
      usedMargin: found?.usedMargin ?? "0",
      totalMargin: found?.totalMargin ?? "0",
    };
  }

  return summary;
}

/**
 * Get or create a margin record for a user + segment.
 */
export async function getOrCreateMargin(userId: string, segment: string) {
  const rows = await db
    .select()
    .from(margins)
    .where(and(eq(margins.userId, userId), eq(margins.segment, segment)))
    .limit(1);

  if (rows[0]) return rows[0];

  const inserted = await db
    .insert(margins)
    .values({ userId, segment })
    .returning();

  if (!inserted[0]) throw new Error("Failed to create margin record");
  return inserted[0];
}

/**
 * Calculate estimated margin required for a trade.
 * This is a simplified margin calculation — real brokers have more complex logic.
 */
export function calculateRequiredMargin(params: {
  segment: string;
  instrumentType: string;
  quantity: number;
  price: number;
  lotSize: number;
}): number {
  const { segment, instrumentType, quantity, price, lotSize } = params;
  const totalValue = quantity * price;

  switch (segment) {
    case "equity":
      // Equity MIS = ~20% margin, CNF = 100%
      return totalValue; // Full value for simplicity; route handler distinguishes MIS/CNF
    case "fno":
      if (instrumentType === "FUT") {
        // Futures typically need ~10-15% SPAN margin
        return totalValue * 0.12;
      }
      // Options buy = premium, options sell = SPAN margin
      return totalValue;
    case "mcx":
      return totalValue * 0.10;
    case "cd":
      return totalValue * 0.03;
    default:
      return totalValue;
  }
}

/**
 * Update margin usage after a trade.
 */
export async function updateMarginUsage(
  userId: string,
  segment: string,
  usedAmount: number
) {
  const margin = await getOrCreateMargin(userId, segment);
  const currentUsed = parseFloat(margin.usedMargin ?? "0");
  const currentTotal = parseFloat(margin.totalMargin ?? "0");
  const newUsed = Math.max(0, currentUsed + usedAmount).toFixed(4);
  const newAvailable = Math.max(0, currentTotal - parseFloat(newUsed)).toFixed(4);

  await db
    .update(margins)
    .set({
      usedMargin: newUsed,
      availableMargin: newAvailable,
      updatedAt: new Date(),
    })
    .where(eq(margins.id, margin.id));
}
