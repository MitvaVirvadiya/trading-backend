CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"balance" numeric(20, 4) DEFAULT '0',
	"blocked_balance" numeric(20, 4) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(20, 4) NOT NULL,
	"balance_after" numeric(20, 4) NOT NULL,
	"reference_id" uuid,
	"reference_type" text,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"instrument_name" text NOT NULL,
	"isin" text,
	"exchange_token" text,
	"exchange" text NOT NULL,
	"segment" text NOT NULL,
	"instrument_type" text NOT NULL,
	"expiry_date" date,
	"strike_price" numeric(20, 4),
	"option_type" text,
	"lot_size" integer DEFAULT 1,
	"order_type" text NOT NULL,
	"side" text NOT NULL,
	"product" text NOT NULL,
	"quantity" integer NOT NULL,
	"price" numeric(20, 4),
	"trigger_price" numeric(20, 4),
	"filled_quantity" integer DEFAULT 0,
	"average_price" numeric(20, 4),
	"status" text DEFAULT 'pending',
	"rejection_reason" text,
	"validity" text DEFAULT 'day',
	"tag" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"instrument_name" text NOT NULL,
	"isin" text,
	"exchange_token" text,
	"exchange" text NOT NULL,
	"segment" text NOT NULL,
	"instrument_type" text NOT NULL,
	"expiry_date" date,
	"strike_price" numeric(20, 4),
	"option_type" text,
	"lot_size" integer DEFAULT 1,
	"side" text NOT NULL,
	"product" text NOT NULL,
	"quantity" integer NOT NULL,
	"price" numeric(20, 4) NOT NULL,
	"value" numeric(20, 4) NOT NULL,
	"charges" numeric(20, 4) DEFAULT '0',
	"trade_date" timestamp DEFAULT now(),
	"settlement_date" date,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"instrument_name" text NOT NULL,
	"isin" text,
	"exchange_token" text,
	"exchange" text NOT NULL,
	"segment" text NOT NULL,
	"instrument_type" text NOT NULL,
	"expiry_date" date,
	"strike_price" numeric(20, 4),
	"option_type" text,
	"lot_size" integer DEFAULT 1,
	"product" text NOT NULL,
	"net_quantity" integer DEFAULT 0,
	"buy_quantity" integer DEFAULT 0,
	"sell_quantity" integer DEFAULT 0,
	"buy_avg_price" numeric(20, 4) DEFAULT '0',
	"sell_avg_price" numeric(20, 4) DEFAULT '0',
	"last_price" numeric(20, 4) DEFAULT '0',
	"realized_pnl" numeric(20, 4) DEFAULT '0',
	"unrealized_pnl" numeric(20, 4) DEFAULT '0',
	"pnl" numeric(20, 4) DEFAULT '0',
	"is_open" boolean DEFAULT true,
	"trading_date" date NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"instrument_name" text NOT NULL,
	"isin" text,
	"exchange_token" text,
	"exchange" text NOT NULL,
	"quantity" integer NOT NULL,
	"average_price" numeric(20, 4) NOT NULL,
	"last_price" numeric(20, 4) DEFAULT '0',
	"pnl" numeric(20, 4) DEFAULT '0',
	"pnl_percent" numeric(10, 4) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(20, 4) NOT NULL,
	"status" text DEFAULT 'pending',
	"reference_number" text,
	"note" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "transactions_reference_number_unique" UNIQUE("reference_number")
);
--> statement-breakpoint
CREATE TABLE "margins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"segment" text NOT NULL,
	"available_margin" numeric(20, 4) DEFAULT '0',
	"used_margin" numeric(20, 4) DEFAULT '0',
	"total_margin" numeric(20, 4) DEFAULT '0',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "margins" ADD CONSTRAINT "margins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;