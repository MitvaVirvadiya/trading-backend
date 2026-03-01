import { Elysia, t } from "elysia";
import { CalculateMarginSchema } from "@/types";
import { success, error } from "@/utils/response";
import * as marginService from "@/services/margin.service";

export const marginRoutes = new Elysia({ prefix: "/api/v1/margin" })

  // GET /margin/:userId — Margin summary by segment
  .get(
    "/:userId",
    async ({ params }) => {
      const summary = await marginService.getMarginSummary(params.userId);
      return success(summary);
    },
    { params: t.Object({ userId: t.String() }) }
  )

  // POST /margin/calculate — Pre-trade margin estimate
  .post(
    "/calculate",
    async ({ body }) => {
      const required = marginService.calculateRequiredMargin({
        segment: body.segment,
        instrumentType: body.instrumentType,
        quantity: body.quantity,
        price: parseFloat(body.price),
        lotSize: body.lotSize ?? 1,
      });

      return success({
        requiredMargin: required.toFixed(4),
        segment: body.segment,
        instrumentType: body.instrumentType,
      });
    },
    { body: CalculateMarginSchema }
  );
