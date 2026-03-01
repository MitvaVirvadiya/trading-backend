import { Type } from "@sinclair/typebox";
import type { Static } from "@sinclair/typebox";

// ==============================================================================
// COMMON
// ==============================================================================

const UUIDString = Type.String({ format: "uuid" });
const NumericString = Type.String({ pattern: "^[0-9]+(\\.[0-9]+)?$" });

const Segments = Type.Union([
  Type.Literal("equity"),
  Type.Literal("fno"),
  Type.Literal("cd"),
  Type.Literal("mcx"),
]);

const Exchanges = Type.Union([
  Type.Literal("NSE"),
  Type.Literal("BSE"),
  Type.Literal("NFO"),
  Type.Literal("MCX"),
  Type.Literal("CDS"),
]);

const InstrumentTypes = Type.Union([
  Type.Literal("EQ"),
  Type.Literal("FUT"),
  Type.Literal("OPT"),
  Type.Literal("CUR"),
  Type.Literal("COM"),
]);

// Instrument snapshot fields — shared across orders, trades, positions, holdings
const InstrumentFields = {
  symbol: Type.String({ minLength: 1, description: "e.g. RELIANCE, NIFTY24DECFUT" }),
  instrumentName: Type.String({ minLength: 1 }),
  isin: Type.Optional(Type.String()),
  exchangeToken: Type.Optional(Type.String()),
  exchange: Exchanges,
  segment: Segments,
  instrumentType: InstrumentTypes,
  expiryDate: Type.Optional(Type.String({ format: "date" })),
  strikePrice: Type.Optional(NumericString),
  optionType: Type.Optional(Type.Union([Type.Literal("CE"), Type.Literal("PE")])),
  lotSize: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
};

// ==============================================================================
// USER SCHEMAS
// ==============================================================================

export const CreateUserSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100, description: "User display name" }),
});
export type CreateUser = Static<typeof CreateUserSchema>;

export const UpdateUserSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
});
export type UpdateUser = Static<typeof UpdateUserSchema>;

// ==============================================================================
// FUND SCHEMAS
// ==============================================================================

export const DepositSchema = Type.Object({
  userId: UUIDString,
  amount: NumericString,
  referenceNumber: Type.Optional(Type.String()),
  note: Type.Optional(Type.String()),
});
export type Deposit = Static<typeof DepositSchema>;

export const WithdrawSchema = Type.Object({
  userId: UUIDString,
  amount: NumericString,
  note: Type.Optional(Type.String()),
});
export type Withdraw = Static<typeof WithdrawSchema>;

// ==============================================================================
// ORDER SCHEMAS
// ==============================================================================

export const CreateOrderSchema = Type.Object({
  userId: UUIDString,
  ...InstrumentFields,
  orderType: Type.Union([
    Type.Literal("market"),
    Type.Literal("limit"),
    Type.Literal("sl"),
    Type.Literal("sl-m"),
  ]),
  side: Type.Union([Type.Literal("buy"), Type.Literal("sell")]),
  product: Type.Union([
    Type.Literal("mis"),
    Type.Literal("cnf"),
    Type.Literal("nrml"),
  ]),
  quantity: Type.Number({ minimum: 1 }),
  price: Type.Optional(NumericString),
  triggerPrice: Type.Optional(NumericString),
  validity: Type.Optional(Type.Union([Type.Literal("day"), Type.Literal("ioc")])),
  tag: Type.Optional(Type.String()),
});
export type CreateOrder = Static<typeof CreateOrderSchema>;

export const ModifyOrderSchema = Type.Object({
  price: Type.Optional(NumericString),
  quantity: Type.Optional(Type.Number({ minimum: 1 })),
  triggerPrice: Type.Optional(NumericString),
  orderType: Type.Optional(Type.Union([
    Type.Literal("market"),
    Type.Literal("limit"),
    Type.Literal("sl"),
    Type.Literal("sl-m"),
  ])),
});
export type ModifyOrder = Static<typeof ModifyOrderSchema>;

// ==============================================================================
// MARGIN SCHEMAS
// ==============================================================================

export const CalculateMarginSchema = Type.Object({
  userId: UUIDString,
  segment: Segments,
  instrumentType: InstrumentTypes,
  quantity: Type.Number({ minimum: 1 }),
  price: NumericString,
  lotSize: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
});
export type CalculateMargin = Static<typeof CalculateMarginSchema>;

// ==============================================================================
// QUERY SCHEMAS
// ==============================================================================

export const PaginationQuery = Type.Object({
  page: Type.Optional(Type.String({ default: "1" })),
  limit: Type.Optional(Type.String({ default: "20" })),
});

export const DateRangeQuery = Type.Object({
  from: Type.Optional(Type.String({ format: "date" })),
  to: Type.Optional(Type.String({ format: "date" })),
});

export const OrderFilterQuery = Type.Object({
  page: Type.Optional(Type.String({ default: "1" })),
  limit: Type.Optional(Type.String({ default: "20" })),
  from: Type.Optional(Type.String()),
  to: Type.Optional(Type.String()),
  segment: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
});

export const TradeFilterQuery = Type.Object({
  page: Type.Optional(Type.String({ default: "1" })),
  limit: Type.Optional(Type.String({ default: "20" })),
  from: Type.Optional(Type.String()),
  to: Type.Optional(Type.String()),
  segment: Type.Optional(Type.String()),
});

export const LedgerFilterQuery = Type.Object({
  page: Type.Optional(Type.String({ default: "1" })),
  limit: Type.Optional(Type.String({ default: "20" })),
  category: Type.Optional(Type.String()),
  from: Type.Optional(Type.String()),
  to: Type.Optional(Type.String()),
});
