import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { ledger } from "@/db/schema";
import { getOrCreateAccount } from "./fund.service";

/**
 * Create a ledger entry for a trade.
 */
export async function createTradeLedgerEntry(params: {
  userId: string;
  tradeId: string;
  side: string;
  amount: string;
  charges: string;
}) {
  const { userId, tradeId, side, amount, charges } = params;
  const account = await getOrCreateAccount(userId);
  const currentBalance = parseFloat(account.balance ?? "0");
  const amountNum = parseFloat(amount);
  const chargesNum = parseFloat(charges);

  const entries: Array<{
    userId: string;
    accountId: string;
    type: string;
    category: string;
    amount: string;
    balanceAfter: string;
    referenceId: string;
    referenceType: string;
    description: string;
  }> = [];

  if (side === "buy") {
    const balanceAfterTrade = (currentBalance - amountNum).toFixed(4);
    entries.push({
      userId,
      accountId: account.id,
      type: "debit",
      category: "trade_buy",
      amount,
      balanceAfter: balanceAfterTrade,
      referenceId: tradeId,
      referenceType: "trade",
      description: `Buy trade #${tradeId.slice(0, 8)}`,
    });

    if (chargesNum > 0) {
      const balanceAfterCharges = (parseFloat(balanceAfterTrade) - chargesNum).toFixed(4);
      entries.push({
        userId,
        accountId: account.id,
        type: "debit",
        category: "charges",
        amount: charges,
        balanceAfter: balanceAfterCharges,
        referenceId: tradeId,
        referenceType: "trade",
        description: `Charges for trade #${tradeId.slice(0, 8)}`,
      });
    }
  } else {
    const balanceAfterTrade = (currentBalance + amountNum).toFixed(4);
    entries.push({
      userId,
      accountId: account.id,
      type: "credit",
      category: "trade_sell",
      amount,
      balanceAfter: balanceAfterTrade,
      referenceId: tradeId,
      referenceType: "trade",
      description: `Sell trade #${tradeId.slice(0, 8)}`,
    });

    if (chargesNum > 0) {
      const balanceAfterCharges = (parseFloat(balanceAfterTrade) - chargesNum).toFixed(4);
      entries.push({
        userId,
        accountId: account.id,
        type: "debit",
        category: "charges",
        amount: charges,
        balanceAfter: balanceAfterCharges,
        referenceId: tradeId,
        referenceType: "trade",
        description: `Charges for trade #${tradeId.slice(0, 8)}`,
      });
    }
  }

  if (entries.length > 0) {
    await db.insert(ledger).values(entries);
  }
}
