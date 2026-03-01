# Trading App — Agent PRD
**Stack:** Bun + ElysiaJS + Drizzle ORM + PostgreSQL

---

## Context & Design Decisions

- **Single owner app** — all accounts belong to one person, no multi-user KYC/PAN/bank details needed
- **No instruments table** — live instrument data comes from a third-party market API; instrument info (symbol, name, ISIN, exchange token) is stored inline on orders/trades/positions/holdings at the time of the trade
- **Segments:** equity | fno | cd | mcx (no crypto)
- **All values in INR**

---

## DB Schema (Drizzle)

```ts
// schema/users.ts
// Minimal — just an account identity (single owner use case)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// schema/accounts.ts
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  balance: numeric('balance', { precision: 20, scale: 4 }).default('0'),
  blockedBalance: numeric('blocked_balance', { precision: 20, scale: 4 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// schema/ledger.ts
export const ledger = pgTable('ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  type: text('type').notNull(),                   // credit | debit
  category: text('category').notNull(),           // deposit | withdrawal | trade_buy | trade_sell | charges | pnl
  amount: numeric('amount', { precision: 20, scale: 4 }).notNull(),
  balanceAfter: numeric('balance_after', { precision: 20, scale: 4 }).notNull(),
  referenceId: uuid('reference_id'),              // tradeId or transactionId
  referenceType: text('reference_type'),          // trade | transaction
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

// schema/orders.ts
// Instrument info stored inline — sourced from third-party market API at order time
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),

  // Instrument snapshot from market API
  symbol: text('symbol').notNull(),               // e.g. RELIANCE, NIFTY24DECFUT
  instrumentName: text('instrument_name').notNull(),
  isin: text('isin'),                             // for equity
  exchangeToken: text('exchange_token'),          // broker/exchange internal token
  exchange: text('exchange').notNull(),           // NSE | BSE | NFO | MCX | CDS
  segment: text('segment').notNull(),             // equity | fno | cd | mcx
  instrumentType: text('instrument_type').notNull(), // EQ | FUT | OPT | CUR | COM
  expiryDate: date('expiry_date'),                // for fno/cd/mcx
  strikePrice: numeric('strike_price', { precision: 20, scale: 4 }),
  optionType: text('option_type'),                // CE | PE
  lotSize: integer('lot_size').default(1),

  // Order details
  orderType: text('order_type').notNull(),        // market | limit | sl | sl-m
  side: text('side').notNull(),                   // buy | sell
  product: text('product').notNull(),             // mis | cnf | nrml
  quantity: integer('quantity').notNull(),
  price: numeric('price', { precision: 20, scale: 4 }),
  triggerPrice: numeric('trigger_price', { precision: 20, scale: 4 }),
  filledQuantity: integer('filled_quantity').default(0),
  averagePrice: numeric('average_price', { precision: 20, scale: 4 }),
  status: text('status').default('pending'),      // pending | open | partial | complete | cancelled | rejected
  rejectionReason: text('rejection_reason'),
  validity: text('validity').default('day'),      // day | ioc
  tag: text('tag'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// schema/trades.ts
export const trades = pgTable('trades', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  userId: uuid('user_id').notNull().references(() => users.id),

  // Instrument snapshot
  symbol: text('symbol').notNull(),
  instrumentName: text('instrument_name').notNull(),
  isin: text('isin'),
  exchangeToken: text('exchange_token'),
  exchange: text('exchange').notNull(),
  segment: text('segment').notNull(),
  instrumentType: text('instrument_type').notNull(),
  expiryDate: date('expiry_date'),
  strikePrice: numeric('strike_price', { precision: 20, scale: 4 }),
  optionType: text('option_type'),
  lotSize: integer('lot_size').default(1),

  // Trade details
  side: text('side').notNull(),                   // buy | sell
  product: text('product').notNull(),
  quantity: integer('quantity').notNull(),
  price: numeric('price', { precision: 20, scale: 4 }).notNull(),
  value: numeric('value', { precision: 20, scale: 4 }).notNull(), // qty * price
  charges: numeric('charges', { precision: 20, scale: 4 }).default('0'),
  tradeDate: timestamp('trade_date').defaultNow(),
  settlementDate: date('settlement_date'),
  createdAt: timestamp('created_at').defaultNow(),
});

// schema/positions.ts
// Per-day, per-product open positions (intraday MIS + overnight FnO/MCX/CD nrml)
export const positions = pgTable('positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),

  // Instrument snapshot
  symbol: text('symbol').notNull(),
  instrumentName: text('instrument_name').notNull(),
  isin: text('isin'),
  exchangeToken: text('exchange_token'),
  exchange: text('exchange').notNull(),
  segment: text('segment').notNull(),
  instrumentType: text('instrument_type').notNull(),
  expiryDate: date('expiry_date'),
  strikePrice: numeric('strike_price', { precision: 20, scale: 4 }),
  optionType: text('option_type'),
  lotSize: integer('lot_size').default(1),

  // Position tracking
  product: text('product').notNull(),             // mis | nrml
  netQuantity: integer('net_quantity').default(0), // +ve long, -ve short
  buyQuantity: integer('buy_quantity').default(0),
  sellQuantity: integer('sell_quantity').default(0),
  buyAvgPrice: numeric('buy_avg_price', { precision: 20, scale: 4 }).default('0'),
  sellAvgPrice: numeric('sell_avg_price', { precision: 20, scale: 4 }).default('0'),
  lastPrice: numeric('last_price', { precision: 20, scale: 4 }).default('0'),
  realizedPnl: numeric('realized_pnl', { precision: 20, scale: 4 }).default('0'),
  unrealizedPnl: numeric('unrealized_pnl', { precision: 20, scale: 4 }).default('0'),
  pnl: numeric('pnl', { precision: 20, scale: 4 }).default('0'),
  isOpen: boolean('is_open').default(true),
  tradingDate: date('trading_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// schema/holdings.ts
// Equity CNF/delivery — accumulates across days
export const holdings = pgTable('holdings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),

  // Instrument snapshot
  symbol: text('symbol').notNull(),
  instrumentName: text('instrument_name').notNull(),
  isin: text('isin'),
  exchangeToken: text('exchange_token'),
  exchange: text('exchange').notNull(),           // NSE | BSE

  // Holding details
  quantity: integer('quantity').notNull(),
  averagePrice: numeric('average_price', { precision: 20, scale: 4 }).notNull(),
  lastPrice: numeric('last_price', { precision: 20, scale: 4 }).default('0'),
  pnl: numeric('pnl', { precision: 20, scale: 4 }).default('0'),
  pnlPercent: numeric('pnl_percent', { precision: 10, scale: 4 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// schema/transactions.ts
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  type: text('type').notNull(),                   // deposit | withdrawal
  amount: numeric('amount', { precision: 20, scale: 4 }).notNull(),
  status: text('status').default('pending'),      // pending | processing | completed | failed
  referenceNumber: text('reference_number').unique(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// schema/margins.ts
export const margins = pgTable('margins', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  segment: text('segment').notNull(),             // equity | fno | cd | mcx
  availableMargin: numeric('available_margin', { precision: 20, scale: 4 }).default('0'),
  usedMargin: numeric('used_margin', { precision: 20, scale: 4 }).default('0'),
  totalMargin: numeric('total_margin', { precision: 20, scale: 4 }).default('0'),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

---

## Phase 1 — Core APIs

### Base URL: `/api/v1`

---

### 👤 User Management

| Method | Path | Description |
|--------|------|-------------|
| POST | `/users` | Create user |
| GET | `/users/:id` | Get user |
| PUT | `/users/:id` | Update user name |
| DELETE | `/users/:id` | Soft delete |
| GET | `/users/:id/account` | Get account + balance |

**POST /users body:**
```json
{ "name": "string" }
```

---

### 💰 Fund Management

| Method | Path | Description |
|--------|------|-------------|
| POST | `/funds/deposit` | Add funds |
| POST | `/funds/withdraw` | Withdraw funds |
| GET | `/funds/:userId/balance` | Available + blocked balance |
| GET | `/funds/:userId/transactions` | Transaction history (paginated) |
| GET | `/funds/:userId/ledger` | Full ledger (filter: category, date) |

**POST /funds/deposit body:**
```json
{ "userId", "amount", "referenceNumber", "note" }
```

**POST /funds/withdraw body:**
```json
{ "userId", "amount", "note" }
```

---

### 📋 Orders

| Method | Path | Description |
|--------|------|-------------|
| POST | `/orders` | Place order |
| GET | `/orders/:id` | Order details |
| DELETE | `/orders/:id` | Cancel order |
| PUT | `/orders/:id` | Modify order (price/qty) |
| GET | `/orders/user/:userId` | User orders (filter: date, segment, status) |

**POST /orders body:**
```json
{
  "userId": "uuid",
  "symbol": "RELIANCE",
  "instrumentName": "Reliance Industries Ltd",
  "isin": "INE002A01018",
  "exchangeToken": "2885",
  "exchange": "NSE",
  "segment": "equity",
  "instrumentType": "EQ",
  "lotSize": 1,
  "expiryDate": null,
  "strikePrice": null,
  "optionType": null,
  "orderType": "market|limit|sl|sl-m",
  "side": "buy|sell",
  "product": "mis|cnf|nrml",
  "quantity": 10,
  "price": 2850.00,
  "triggerPrice": null,
  "validity": "day|ioc",
  "tag": "optional"
}
```

**Order placement flow:**
1. Check margin/funds availability
2. Block required margin
3. Create order (`pending`)
4. Execute fill (via market API or simulate)
5. Create trade record
6. Update position (mis/nrml) or holding (equity cnf)
7. Create ledger entries (trade_buy/trade_sell + charges)
8. Release/adjust blocked margin

---

### 📊 Trades

| Method | Path | Description |
|--------|------|-------------|
| GET | `/trades/user/:userId` | All trades (filter: date, segment) |
| GET | `/trades/:id` | Single trade |

---

### 📈 Portfolio & PnL

| Method | Path | Description |
|--------|------|-------------|
| GET | `/portfolio/:userId/positions` | Open positions with PnL |
| GET | `/portfolio/:userId/holdings` | Equity holdings with PnL |
| GET | `/portfolio/:userId/pnl` | Day PnL summary |
| GET | `/portfolio/:userId/pnl/summary` | Segment-wise PnL breakdown |
| PUT | `/portfolio/:userId/positions/close-all` | Square off all MIS positions |
| PUT | `/portfolio/positions/:positionId/close` | Square off single position |

**GET /portfolio/:userId/pnl response:**
```json
{
  "dayPnl": 0,
  "realizedPnl": 0,
  "unrealizedPnl": 0,
  "totalPnl": 0,
  "segments": {
    "equity": { "realizedPnl": 0, "unrealizedPnl": 0 },
    "fno":    { "realizedPnl": 0, "unrealizedPnl": 0 },
    "mcx":    { "realizedPnl": 0, "unrealizedPnl": 0 },
    "cd":     { "realizedPnl": 0, "unrealizedPnl": 0 }
  }
}
```

---

### 🏦 Margin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/margin/:userId` | Margin summary by segment |
| POST | `/margin/calculate` | Pre-trade margin estimate |

**POST /margin/calculate body:**
```json
{ "userId", "segment", "instrumentType", "quantity", "price", "lotSize" }
```

---

## Phase 2 — Advanced (Planned)

- **Reports:** P&L statement, contract notes, tax report (STCG/LTCG)
- **Analytics:** Win rate, avg holding period, drawdown, strategy tag performance
- **Admin Dashboard:** Account overview, risk controls
- **WebSocket:** Live order status, position PnL stream

---

## Project Structure

```
src/
├── db/
│   ├── schema/
│   │   ├── users.ts
│   │   ├── accounts.ts
│   │   ├── ledger.ts
│   │   ├── orders.ts
│   │   ├── trades.ts
│   │   ├── positions.ts
│   │   ├── holdings.ts
│   │   ├── transactions.ts
│   │   └── margins.ts
│   ├── migrations/
│   └── index.ts
├── routes/
│   ├── users.ts
│   ├── funds.ts
│   ├── orders.ts
│   ├── trades.ts
│   ├── portfolio.ts
│   └── margin.ts
├── services/
│   ├── order.service.ts
│   ├── trade.service.ts
│   ├── position.service.ts
│   ├── holding.service.ts
│   ├── ledger.service.ts
│   ├── margin.service.ts
│   └── fund.service.ts
├── middleware/
│   ├── auth.ts
│   └── validate.ts
└── index.ts
```

---

## Notes for Agent

- **No instruments table** — all instrument fields stored inline as a snapshot on orders, trades, positions, holdings. Caller passes instrument data from the market API when placing an order.
- Use Drizzle for all DB ops — no raw SQL
- All monetary values: `numeric(20,4)` — never float
- All IDs: `uuid` defaultRandom()
- Wrap order → trade → position/holding → ledger in a single DB transaction
- Positions are per-day per-product; new record each trading day
- Holdings accumulate across days (equity CNF only)
- Charges config: brokerage + STT + GST + exchange fees — keep as a config object
- Auth: JWT via `@elysiajs/jwt`
- Segments: `equity | fno | cd | mcx` only
- Products: `mis` (intraday) | `cnf` (equity delivery) | `nrml` (fno/mcx/cd overnight)
- Error format: `{ success: false, error: "message", code: "ERROR_CODE" }`
- Success format: `{ success: true, data: {}, meta: { page, limit, total } }`