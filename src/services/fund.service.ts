import { eq, and, sql, gte, lte, count } from "drizzle-orm";
import { db } from "@/db";
import { accounts, transactions, ledger } from "@/db/schema";
import type { Account } from "@/db/schema";

/**
 * Get or create an account for a user. Always returns a valid account.
 */
export async function getOrCreateAccount(userId: string): Promise<Account> {
  const rows = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);

  if (rows[0]) return rows[0];

  const inserted = await db
    .insert(accounts)
    .values({ userId })
    .returning();

  if (!inserted[0]) throw new Error("Failed to create account");
  return inserted[0];
}

/**
 * Get account balance for a user.
 */
export async function getBalance(userId: string) {
  const account = await getOrCreateAccount(userId);
  return {
    balance: account.balance,
    blockedBalance: account.blockedBalance,
    availableBalance: (
      parseFloat(account.balance ?? "0") - parseFloat(account.blockedBalance ?? "0")
    ).toFixed(4),
  };
}

/**
 * Deposit funds into a user's account.
 */
export async function deposit(params: {
  userId: string;
  amount: string;
  referenceNumber?: string;
  note?: string;
}) {
  const { userId, amount, referenceNumber, note } = params;
  const amountNum = parseFloat(amount);

  if (amountNum <= 0) throw new Error("Amount must be positive");

  return await db.transaction(async (tx) => {
    const account = await getOrCreateAccount(userId);
    const newBalance = (parseFloat(account.balance ?? "0") + amountNum).toFixed(4);

    await tx
      .update(accounts)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(accounts.id, account.id));

    const inserted = await tx
      .insert(transactions)
      .values({
        userId,
        accountId: account.id,
        type: "deposit",
        amount,
        status: "completed",
        referenceNumber,
        note,
      })
      .returning();

    const txn = inserted[0]!;

    await tx.insert(ledger).values({
      userId,
      accountId: account.id,
      type: "credit",
      category: "deposit",
      amount,
      balanceAfter: newBalance,
      referenceId: txn.id,
      referenceType: "transaction",
      description: note ?? `Deposit of ₹${amount}`,
    });

    return txn;
  });
}

/**
 * Withdraw funds from a user's account.
 */
export async function withdraw(params: {
  userId: string;
  amount: string;
  note?: string;
}) {
  const { userId, amount, note } = params;
  const amountNum = parseFloat(amount);

  if (amountNum <= 0) throw new Error("Amount must be positive");

  return await db.transaction(async (tx) => {
    const account = await getOrCreateAccount(userId);
    const available =
      parseFloat(account.balance ?? "0") - parseFloat(account.blockedBalance ?? "0");

    if (amountNum > available) {
      throw new Error("Insufficient funds");
    }

    const newBalance = (parseFloat(account.balance ?? "0") - amountNum).toFixed(4);

    await tx
      .update(accounts)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(accounts.id, account.id));

    const inserted = await tx
      .insert(transactions)
      .values({
        userId,
        accountId: account.id,
        type: "withdrawal",
        amount,
        status: "completed",
        note,
      })
      .returning();

    const txn = inserted[0]!;

    await tx.insert(ledger).values({
      userId,
      accountId: account.id,
      type: "debit",
      category: "withdrawal",
      amount,
      balanceAfter: newBalance,
      referenceId: txn.id,
      referenceType: "transaction",
      description: note ?? `Withdrawal of ₹${amount}`,
    });

    return txn;
  });
}

/**
 * Get transaction history for a user (paginated).
 */
export async function getTransactions(
  userId: string,
  page: number = 1,
  limit: number = 20
) {
  const offset = (page - 1) * limit;
  const account = await getOrCreateAccount(userId);

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, account.id))
      .orderBy(sql`${transactions.createdAt} DESC`)
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(transactions)
      .where(eq(transactions.accountId, account.id)),
  ]);

  return { items, total: countResult[0]?.total ?? 0 };
}

/**
 * Get ledger entries for a user (paginated, filterable).
 */
export async function getLedgerEntries(
  userId: string,
  filters: { category?: string; from?: string; to?: string },
  page: number = 1,
  limit: number = 20
) {
  const offset = (page - 1) * limit;
  const account = await getOrCreateAccount(userId);

  const conditions = [eq(ledger.accountId, account.id)];

  if (filters.category) {
    conditions.push(eq(ledger.category, filters.category));
  }
  if (filters.from) {
    conditions.push(gte(ledger.createdAt, new Date(filters.from)));
  }
  if (filters.to) {
    conditions.push(lte(ledger.createdAt, new Date(filters.to)));
  }

  const whereClause = and(...conditions);

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(ledger)
      .where(whereClause)
      .orderBy(sql`${ledger.createdAt} DESC`)
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(ledger).where(whereClause),
  ]);

  return { items, total: countResult[0]?.total ?? 0 };
}

/**
 * Block margin for an order.
 */
export async function blockMargin(accountId: string, amount: number) {
  const rows = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  const account = rows[0];
  if (!account) throw new Error("Account not found");

  const available =
    parseFloat(account.balance ?? "0") - parseFloat(account.blockedBalance ?? "0");

  if (amount > available) throw new Error("Insufficient margin");

  const newBlocked = (parseFloat(account.blockedBalance ?? "0") + amount).toFixed(4);

  await db
    .update(accounts)
    .set({ blockedBalance: newBlocked, updatedAt: new Date() })
    .where(eq(accounts.id, accountId));
}

/**
 * Release blocked margin (after order fill or cancel).
 */
export async function releaseMargin(accountId: string, amount: number) {
  const rows = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  const account = rows[0];
  if (!account) throw new Error("Account not found");

  const currentBlocked = parseFloat(account.blockedBalance ?? "0");
  const newBlocked = Math.max(0, currentBlocked - amount).toFixed(4);

  await db
    .update(accounts)
    .set({ blockedBalance: newBlocked, updatedAt: new Date() })
    .where(eq(accounts.id, accountId));
}
