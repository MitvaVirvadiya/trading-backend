import { Elysia, t } from "elysia";
import { DepositSchema, WithdrawSchema, PaginationQuery, LedgerFilterQuery } from "@/types";
import { success, error, paginated } from "@/utils/response";
import * as fundService from "@/services/fund.service";

export const fundRoutes = new Elysia({ prefix: "/api/v1/funds" })

  // POST /funds/deposit — Add funds
  .post(
    "/deposit",
    async ({ body, set }) => {
      try {
        const txn = await fundService.deposit({
          userId: body.userId,
          amount: body.amount,
          referenceNumber: body.referenceNumber,
          note: body.note,
        });
        set.status = 201;
        return success(txn);
      } catch (err: any) {
        set.status = 400;
        return error(err.message, "DEPOSIT_FAILED");
      }
    },
    { body: DepositSchema }
  )

  // POST /funds/withdraw — Withdraw funds
  .post(
    "/withdraw",
    async ({ body, set }) => {
      try {
        const txn = await fundService.withdraw({
          userId: body.userId,
          amount: body.amount,
          note: body.note,
        });
        return success(txn);
      } catch (err: any) {
        set.status = 400;
        return error(err.message, "WITHDRAWAL_FAILED");
      }
    },
    { body: WithdrawSchema }
  )

  // GET /funds/:userId/balance — Available + blocked balance
  .get(
    "/:userId/balance",
    async ({ params }) => {
      const balance = await fundService.getBalance(params.userId);
      return success(balance);
    },
    { params: t.Object({ userId: t.String() }) }
  )

  // GET /funds/:userId/transactions — Transaction history (paginated)
  .get(
    "/:userId/transactions",
    async ({ params, query }) => {
      const page = parseInt(query.page ?? "1");
      const limit = parseInt(query.limit ?? "20");

      const { items, total } = await fundService.getTransactions(
        params.userId,
        page,
        limit
      );

      return paginated(items, { page, limit, total });
    },
    {
      params: t.Object({ userId: t.String() }),
      query: PaginationQuery,
    }
  )

  // GET /funds/:userId/ledger — Full ledger (filter: category, date)
  .get(
    "/:userId/ledger",
    async ({ params, query }) => {
      const page = parseInt(query.page ?? "1");
      const limit = parseInt(query.limit ?? "20");

      const { items, total } = await fundService.getLedgerEntries(
        params.userId,
        { category: query.category, from: query.from, to: query.to },
        page,
        limit
      );

      return paginated(items, { page, limit, total });
    },
    {
      params: t.Object({ userId: t.String() }),
      query: LedgerFilterQuery,
    }
  );
