import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, accounts } from "@/db/schema";
import { CreateUserSchema, UpdateUserSchema } from "@/types";
import { success, error } from "@/utils/response";
import { getOrCreateAccount } from "@/services/fund.service";

export const userRoutes = new Elysia({ prefix: "/api/v1/users" })

  // POST /users — Create user + auto-create account
  .post(
    "",
    async ({ body, set }) => {
      try {
        const userRows = await db.insert(users).values({ name: body.name }).returning();
        const user = userRows[0]!;
        // Auto-create an account for the user
        await db.insert(accounts).values({ userId: user.id }).returning();
        set.status = 201;
        return success(user);
      } catch (err: any) {
        set.status = 400;
        return error(err.message, "CREATE_USER_FAILED");
      }
    },
    { body: CreateUserSchema }
  )

  // GET /users/:id — Get user by ID
  .get(
    "/:id",
    async ({ params, set }) => {
      const userRows = await db
        .select()
        .from(users)
        .where(eq(users.id, params.id))
        .limit(1);
      const user = userRows[0];

      if (!user) {
        set.status = 404;
        return error("User not found", "USER_NOT_FOUND");
      }

      return success(user);
    },
    { params: t.Object({ id: t.String() }) }
  )

  // PUT /users/:id — Update user name
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const updatedRows = await db
        .update(users)
        .set({ name: body.name, updatedAt: new Date() })
        .where(eq(users.id, params.id))
        .returning();
      const user = updatedRows[0];

      if (!user) {
        set.status = 404;
        return error("User not found", "USER_NOT_FOUND");
      }

      return success(user);
    },
    {
      params: t.Object({ id: t.String() }),
      body: UpdateUserSchema,
    }
  )

  // DELETE /users/:id — Soft delete
  .delete(
    "/:id",
    async ({ params, set }) => {
      const deletedRows = await db
        .update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(users.id, params.id))
        .returning();
      const user = deletedRows[0];

      if (!user) {
        set.status = 404;
        return error("User not found", "USER_NOT_FOUND");
      }

      return success({ message: "User deactivated" });
    },
    { params: t.Object({ id: t.String() }) }
  )

  // GET /users/:id/account — Get account + balance
  .get(
    "/:id/account",
    async ({ params, set }) => {
      const accountUserRows = await db
        .select()
        .from(users)
        .where(eq(users.id, params.id))
        .limit(1);
      const user = accountUserRows[0];

      if (!user) {
        set.status = 404;
        return error("User not found", "USER_NOT_FOUND");
      }

      const account = await getOrCreateAccount(params.id);
      const available = (
        parseFloat(account.balance ?? "0") - parseFloat(account.blockedBalance ?? "0")
      ).toFixed(4);

      return success({
        user,
        account: {
          id: account.id,
          balance: account.balance,
          blockedBalance: account.blockedBalance,
          availableBalance: available,
        },
      });
    },
    { params: t.Object({ id: t.String() }) }
  );
