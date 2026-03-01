import { Elysia, t } from "elysia";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { positions } from "@/db/schema";
import { success, error } from "@/utils/response";
import * as positionService from "@/services/position.service";
import * as holdingService from "@/services/holding.service";

export const portfolioRoutes = new Elysia({ prefix: "/api/v1/portfolio" })

  // GET /portfolio/:userId/positions — Open positions with PnL
  .get(
    "/:userId/positions",
    async ({ params }) => {
      const openPositions = await positionService.getOpenPositions(params.userId);
      return success(openPositions);
    },
    { params: t.Object({ userId: t.String() }) }
  )

  // GET /portfolio/:userId/holdings — Equity holdings with PnL
  .get(
    "/:userId/holdings",
    async ({ params }) => {
      const holdings = await holdingService.getUserHoldings(params.userId);
      return success(holdings);
    },
    { params: t.Object({ userId: t.String() }) }
  )

  // GET /portfolio/:userId/pnl — Day PnL summary
  .get(
    "/:userId/pnl",
    async ({ params }) => {
      const todayPositions = await positionService.getPositionsByDate(params.userId);

      let realizedPnl = 0;
      let unrealizedPnl = 0;

      const segmentPnl: Record<string, { realizedPnl: number; unrealizedPnl: number }> = {
        equity: { realizedPnl: 0, unrealizedPnl: 0 },
        fno: { realizedPnl: 0, unrealizedPnl: 0 },
        mcx: { realizedPnl: 0, unrealizedPnl: 0 },
        cd: { realizedPnl: 0, unrealizedPnl: 0 },
      };

      for (const pos of todayPositions) {
        const realized = parseFloat(pos.realizedPnl ?? "0");
        const unrealized = parseFloat(pos.unrealizedPnl ?? "0");

        realizedPnl += realized;
        unrealizedPnl += unrealized;

        const seg = pos.segment as keyof typeof segmentPnl;
        if (segmentPnl[seg]) {
          segmentPnl[seg].realizedPnl += realized;
          segmentPnl[seg].unrealizedPnl += unrealized;
        }
      }

      return success({
        dayPnl: realizedPnl + unrealizedPnl,
        realizedPnl,
        unrealizedPnl,
        totalPnl: realizedPnl + unrealizedPnl,
        segments: segmentPnl,
      });
    },
    { params: t.Object({ userId: t.String() }) }
  )

  // GET /portfolio/:userId/pnl/summary — Segment-wise PnL breakdown
  .get(
    "/:userId/pnl/summary",
    async ({ params }) => {
      const allPositions = await positionService.getOpenPositions(params.userId);

      const segmentPnl: Record<string, { realizedPnl: number; unrealizedPnl: number; totalPnl: number; positionCount: number }> = {
        equity: { realizedPnl: 0, unrealizedPnl: 0, totalPnl: 0, positionCount: 0 },
        fno: { realizedPnl: 0, unrealizedPnl: 0, totalPnl: 0, positionCount: 0 },
        mcx: { realizedPnl: 0, unrealizedPnl: 0, totalPnl: 0, positionCount: 0 },
        cd: { realizedPnl: 0, unrealizedPnl: 0, totalPnl: 0, positionCount: 0 },
      };

      for (const pos of allPositions) {
        const seg = pos.segment as keyof typeof segmentPnl;
        if (segmentPnl[seg]) {
          const realized = parseFloat(pos.realizedPnl ?? "0");
          const unrealized = parseFloat(pos.unrealizedPnl ?? "0");
          segmentPnl[seg].realizedPnl += realized;
          segmentPnl[seg].unrealizedPnl += unrealized;
          segmentPnl[seg].totalPnl += realized + unrealized;
          segmentPnl[seg].positionCount += 1;
        }
      }

      return success(segmentPnl);
    },
    { params: t.Object({ userId: t.String() }) }
  )

  // PUT /portfolio/:userId/positions/close-all — Square off all MIS positions
  .put(
    "/:userId/positions/close-all",
    async ({ params, set }) => {
      try {
        const result = await positionService.closeAllMISPositions(params.userId);
        return success(result);
      } catch (err: any) {
        set.status = 400;
        return error(err.message, "CLOSE_ALL_FAILED");
      }
    },
    { params: t.Object({ userId: t.String() }) }
  )

  // PUT /portfolio/positions/:positionId/close — Square off single position
  .put(
    "/positions/:positionId/close",
    async ({ params, set }) => {
      try {
        const position = await positionService.closePosition(params.positionId);
        return success(position);
      } catch (err: any) {
        set.status = 400;
        return error(err.message, "CLOSE_POSITION_FAILED");
      }
    },
    { params: t.Object({ positionId: t.String() }) }
  );
