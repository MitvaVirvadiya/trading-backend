import { Elysia, t } from "elysia";
import { CreateOrderSchema, ModifyOrderSchema, OrderFilterQuery } from "@/types";
import { success, error, paginated } from "@/utils/response";
import * as orderService from "@/services/order.service";

export const orderRoutes = new Elysia({ prefix: "/api/v1/orders" })

  // POST /orders — Place order
  .post(
    "",
    async ({ body, set }) => {
      try {
        const result = await orderService.placeOrder(body);
        set.status = 201;
        return success(result);
      } catch (err: any) {
        set.status = 400;
        return error(err.message, "ORDER_FAILED");
      }
    },
    { body: CreateOrderSchema }
  )

  // GET /orders/:id — Order details
  .get(
    "/:id",
    async ({ params, set }) => {
      const order = await orderService.getOrderById(params.id);

      if (!order) {
        set.status = 404;
        return error("Order not found", "ORDER_NOT_FOUND");
      }

      return success(order);
    },
    { params: t.Object({ id: t.String() }) }
  )

  // DELETE /orders/:id — Cancel order
  .delete(
    "/:id",
    async ({ params, set }) => {
      try {
        const order = await orderService.cancelOrder(params.id);
        return success(order);
      } catch (err: any) {
        set.status = 400;
        return error(err.message, "CANCEL_FAILED");
      }
    },
    { params: t.Object({ id: t.String() }) }
  )

  // PUT /orders/:id — Modify order (price/qty)
  .put(
    "/:id",
    async ({ params, body, set }) => {
      try {
        const order = await orderService.modifyOrder(params.id, body);
        return success(order);
      } catch (err: any) {
        set.status = 400;
        return error(err.message, "MODIFY_FAILED");
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: ModifyOrderSchema,
    }
  )

  // GET /orders/user/:userId — User orders (filter: date, segment, status)
  .get(
    "/user/:userId",
    async ({ params, query }) => {
      const page = parseInt(query.page ?? "1");
      const limit = parseInt(query.limit ?? "20");

      const { items, total } = await orderService.getUserOrders(
        params.userId,
        {
          from: query.from,
          to: query.to,
          segment: query.segment,
          status: query.status,
        },
        page,
        limit
      );

      return paginated(items, { page, limit, total });
    },
    {
      params: t.Object({ userId: t.String() }),
      query: OrderFilterQuery,
    }
  );
