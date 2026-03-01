import { eq, and, gte, lte, count, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, trades, accounts } from "@/db/schema";
import { calculateCharges } from "@/config/charges";
import { getOrCreateAccount, blockMargin, releaseMargin } from "./fund.service";
import { createTradeLedgerEntry } from "./ledger.service";
import { getOrCreatePosition, updatePositionOnTrade } from "./position.service";
import { updateHolding } from "./holding.service";
import { calculateRequiredMargin, updateMarginUsage } from "./margin.service";
import type { CreateOrder, ModifyOrder } from "@/types";

/**
 * Place a new order.
 * Full flow: validate → block margin → create order → execute → create trade → update position/holding → ledger
 */
export async function placeOrder(data: CreateOrder) {
  const account = await getOrCreateAccount(data.userId);
  const orderPrice = parseFloat(data.price ?? "0");
  const totalValue = data.quantity * orderPrice;

  // Calculate required margin
  const requiredMargin = data.product === "cnf"
    ? totalValue
    : data.product === "mis"
      ? totalValue * 0.2  // MIS gets ~5x leverage
      : calculateRequiredMargin({
          segment: data.segment,
          instrumentType: data.instrumentType,
          quantity: data.quantity,
          price: orderPrice,
          lotSize: data.lotSize ?? 1,
        });

  // Check available balance
  const available =
    parseFloat(account.balance ?? "0") - parseFloat(account.blockedBalance ?? "0");

  if (data.side === "buy" && requiredMargin > available) {
    // Create rejected order
    const rejectedRows = await db
      .insert(orders)
      .values({
        ...buildOrderValues(data),
        status: "rejected",
        rejectionReason: "Insufficient funds/margin",
      })
      .returning();

    return { order: rejectedRows[0]!, trade: null };
  }

  return await db.transaction(async (tx) => {
    // 1. Create order (pending)
    const orderRows = await tx
      .insert(orders)
      .values(buildOrderValues(data))
      .returning();
    const order = orderRows[0]!;

    // 2. Block margin for buy orders
    if (data.side === "buy") {
      await blockMargin(account.id, requiredMargin);
    }

    // 3. Simulate order execution (market order fills immediately)
    const fillPrice = orderPrice; // In production, this comes from market API
    const fillQty = data.quantity;

    // 4. Update order status
    await tx
      .update(orders)
      .set({
        status: "complete",
        filledQuantity: fillQty,
        averagePrice: fillPrice.toFixed(4),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    // 5. Calculate charges
    const chargesAmount = calculateCharges({
      segment: data.segment,
      instrumentType: data.instrumentType,
      side: data.side,
      product: data.product,
      quantity: fillQty,
      price: fillPrice,
      exchange: data.exchange,
    });

    const tradeValue = (fillQty * fillPrice).toFixed(4);

    // 6. Create trade record
    const tradeRows = await tx
      .insert(trades)
      .values({
        orderId: order.id,
        userId: data.userId,
        symbol: data.symbol,
        instrumentName: data.instrumentName,
        isin: data.isin,
        exchangeToken: data.exchangeToken,
        exchange: data.exchange,
        segment: data.segment,
        instrumentType: data.instrumentType,
        expiryDate: data.expiryDate,
        strikePrice: data.strikePrice,
        optionType: data.optionType,
        lotSize: data.lotSize ?? 1,
        side: data.side,
        product: data.product,
        quantity: fillQty,
        price: fillPrice.toFixed(4),
        value: tradeValue,
        charges: chargesAmount.toFixed(4),
      })
      .returning();
    const trade = tradeRows[0]!;

    // 7. Update position (MIS/NRML) or holding (equity CNF)
    if (data.product === "cnf" && data.segment === "equity") {
      await updateHolding({
        userId: data.userId,
        symbol: data.symbol,
        instrumentName: data.instrumentName,
        isin: data.isin,
        exchangeToken: data.exchangeToken,
        exchange: data.exchange,
        side: data.side,
        quantity: fillQty,
        price: fillPrice,
      });
    } else {
      const position = await getOrCreatePosition({
        userId: data.userId,
        symbol: data.symbol,
        exchange: data.exchange,
        segment: data.segment,
        instrumentType: data.instrumentType,
        instrumentName: data.instrumentName,
        product: data.product,
        isin: data.isin,
        exchangeToken: data.exchangeToken,
        expiryDate: data.expiryDate,
        strikePrice: data.strikePrice,
        optionType: data.optionType,
        lotSize: data.lotSize,
      });
      await updatePositionOnTrade(position.id, data.side, fillQty, fillPrice);
    }

    // 8. Create ledger entries
    await createTradeLedgerEntry({
      userId: data.userId,
      tradeId: trade.id,
      side: data.side,
      amount: tradeValue,
      charges: chargesAmount.toFixed(4),
    });

    // 9. Release blocked margin and debit/credit account
    if (data.side === "buy") {
      await releaseMargin(account.id, requiredMargin);
      // Debit actual trade value + charges from balance
      const totalDebit = parseFloat(tradeValue) + chargesAmount;
      await tx
        .update(accounts)
        .set({
          balance: (parseFloat(account.balance ?? "0") - totalDebit).toFixed(4),
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, account.id));
    } else {
      // Credit sell proceeds minus charges
      const totalCredit = parseFloat(tradeValue) - chargesAmount;
      await tx
        .update(accounts)
        .set({
          balance: (parseFloat(account.balance ?? "0") + totalCredit).toFixed(4),
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, account.id));
    }

    // Update margin usage
    await updateMarginUsage(data.userId, data.segment, requiredMargin);

    const updatedOrder = { ...order, status: "complete", filledQuantity: fillQty, averagePrice: fillPrice.toFixed(4) };
    return { order: updatedOrder, trade };
  });
}

/**
 * Get a single order by ID.
 */
export async function getOrderById(orderId: string) {
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Cancel a pending order.
 */
export async function cancelOrder(orderId: string) {
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  const order = orderRows[0];

  if (!order) throw new Error("Order not found");
  if (order.status !== "pending" && order.status !== "open") {
    throw new Error("Only pending/open orders can be cancelled");
  }

  await db
    .update(orders)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  // Release blocked margin
  if (order.side === "buy") {
    const account = await getOrCreateAccount(order.userId);
    const orderPrice = parseFloat(order.price ?? "0");
    const marginToRelease = order.quantity * orderPrice;
    await releaseMargin(account.id, marginToRelease);
  }

  return { ...order, status: "cancelled" };
}

/**
 * Modify a pending/open order.
 */
export async function modifyOrder(orderId: string, data: ModifyOrder) {
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  const order = orderRows[0];

  if (!order) throw new Error("Order not found");
  if (order.status !== "pending" && order.status !== "open") {
    throw new Error("Only pending/open orders can be modified");
  }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (data.price !== undefined) updates.price = data.price;
  if (data.quantity !== undefined) updates.quantity = data.quantity;
  if (data.triggerPrice !== undefined) updates.triggerPrice = data.triggerPrice;
  if (data.orderType !== undefined) updates.orderType = data.orderType;

  const updatedRows = await db
    .update(orders)
    .set(updates)
    .where(eq(orders.id, orderId))
    .returning();

  return updatedRows[0]!;
}

/**
 * Get orders for a user with filters and pagination.
 */
export async function getUserOrders(
  userId: string,
  filters: { from?: string; to?: string; segment?: string; status?: string },
  page: number = 1,
  limit: number = 20
) {
  const offset = (page - 1) * limit;

  const conditions = [eq(orders.userId, userId)];

  if (filters.segment) {
    conditions.push(eq(orders.segment, filters.segment));
  }
  if (filters.status) {
    conditions.push(eq(orders.status, filters.status));
  }
  if (filters.from) {
    conditions.push(gte(orders.createdAt, new Date(filters.from)));
  }
  if (filters.to) {
    conditions.push(lte(orders.createdAt, new Date(filters.to)));
  }

  const whereClause = and(...conditions);

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(whereClause)
      .orderBy(sql`${orders.createdAt} DESC`)
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(orders).where(whereClause),
  ]);

  const total = countResult[0]?.total ?? 0;
  return { items, total };
}

// ── Helper ──────────────────────────────────────────────────────────────────
function buildOrderValues(data: CreateOrder) {
  return {
    userId: data.userId,
    symbol: data.symbol,
    instrumentName: data.instrumentName,
    isin: data.isin,
    exchangeToken: data.exchangeToken,
    exchange: data.exchange,
    segment: data.segment,
    instrumentType: data.instrumentType,
    expiryDate: data.expiryDate,
    strikePrice: data.strikePrice,
    optionType: data.optionType,
    lotSize: data.lotSize ?? 1,
    orderType: data.orderType,
    side: data.side,
    product: data.product,
    quantity: data.quantity,
    price: data.price,
    triggerPrice: data.triggerPrice,
    validity: data.validity ?? "day",
    tag: data.tag,
    status: "pending" as const,
  };
}
