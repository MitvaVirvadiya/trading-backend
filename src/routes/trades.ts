import { Elysia, t } from "elysia";
import { TradeFilterQuery } from "@/types";
import { success, error, paginated } from "@/utils/response";
import * as tradeService from "@/services/trade.service";

export const tradeRoutes = new Elysia({ prefix: "/api/v1/trades" })

  // GET /trades/:id — Single trade
  .get(
    "/:id",
    async ({ params, set }) => {
      const trade = await tradeService.getTradeById(params.id);

      if (!trade) {
        set.status = 404;
        return error("Trade not found", "TRADE_NOT_FOUND");
      }

      return success(trade);
    },
    { params: t.Object({ id: t.String() }) }
  )

  // GET /trades/user/:userId — User trades (filter: date, segment)
  .get(
    "/user/:userId",
    async ({ params, query }) => {
      const page = parseInt(query.page ?? "1");
      const limit = parseInt(query.limit ?? "20");

      const { items, total } = await tradeService.getUserTrades(
        params.userId,
        { from: query.from, to: query.to, segment: query.segment },
        page,
        limit
      );

      return paginated(items, { page, limit, total });
    },
    {
      params: t.Object({ userId: t.String() }),
      query: TradeFilterQuery,
    }
  );
