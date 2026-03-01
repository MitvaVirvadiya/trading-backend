# Local Development Guide

All commands, URLs, credentials, and GUI steps to manage every service in this project.

---

## Quick Start (after every PC reboot)

```powershell
# 1. Start Docker Desktop (from taskbar or Start Menu)
#    Wait for the whale icon in system tray to stop animating (~30s)

# 2. Start all containers
docker compose -f docker/docker-compose.yml up -d

# 3. Start the API dev server (in a separate terminal)
cd "e:\Project Novacaine\trading-bot"
bun run dev
```

That's it — all services are back up.

---

## All Services at a Glance

| Service | URL | Username | Password |
|---|---|---|---|
| **API Server** | http://localhost:3000 | — | — |
| **Swagger Docs** | http://localhost:3000/swagger | — | — |
| **Health Check** | http://localhost:3000/health | — | — |
| **pgAdmin** (PostgreSQL GUI) | http://localhost:5050 | `admin@trading.dev` | `admin` |
| **RedisInsight** (DragonflyDB GUI) | http://localhost:5540 | — | — |
| **PostgreSQL** (direct) | `localhost:5432` | `trading_user` | `trading_pass` |
| **DragonflyDB** (direct) | `localhost:6379` | — | no password |

---

## Docker Compose Commands

```powershell
# Start all services in the background (-d = detached)
docker compose -f docker/docker-compose.yml up -d

# Start only one specific service
docker compose -f docker/docker-compose.yml up -d timescaledb
docker compose -f docker/docker-compose.yml up -d dragonflydb
docker compose -f docker/docker-compose.yml up -d pgadmin
docker compose -f docker/docker-compose.yml up -d redisinsight

# Stop all services (keeps data volumes intact)
docker compose -f docker/docker-compose.yml down

# Stop all services AND wipe all data (full reset)
docker compose -f docker/docker-compose.yml down -v

# See status and ports of all running containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# See logs for a specific container
docker logs trading_timescaledb
docker logs trading_dragonflydb
docker logs trading_pgadmin
docker logs trading_redisinsight

# Follow logs in real time (Ctrl+C to stop)
docker logs -f trading_timescaledb
```

---

## PostgreSQL / TimescaleDB

### Connection credentials
```
Host:     localhost
Port:     5432
Database: trading_db
Username: trading_user
Password: trading_pass
```

Connection URL (used in `.env`):
```
postgres://trading_user:trading_pass@localhost:5432/trading_db
```

### Terminal commands (psql inside the container)

```powershell
# Open an interactive psql shell
docker exec -it trading_timescaledb psql -U trading_user -d trading_db

# Run a single SQL command without entering the shell
docker exec trading_timescaledb psql -U trading_user -d trading_db -c "YOUR SQL HERE"
```

### Useful psql commands (run these inside the psql shell)

```sql
-- List all tables
\dt

-- Describe a table's columns
\d trades
\d users

-- Exit psql
\q
```

### Useful SQL queries

```sql
-- Check TimescaleDB is installed and version
SELECT default_version FROM pg_available_extensions WHERE name = 'timescaledb';

-- List all hypertables (TimescaleDB partitioned tables)
SELECT hypertable_name, num_chunks, compression_enabled
FROM timescaledb_information.hypertables;

-- Count rows in each table
SELECT 'users' AS table_name, COUNT(*) FROM users
UNION ALL
SELECT 'trades', COUNT(*) FROM trades;

-- Show all users
SELECT id, email, username, is_active, created_at FROM users;

-- Show all trades ordered by newest first
SELECT * FROM trades ORDER BY time DESC LIMIT 20;

-- TimescaleDB: show chunk info for the trades hypertable
SELECT * FROM timescaledb_information.chunks WHERE hypertable_name = 'trades';

-- TimescaleDB: hourly OHLCV-style stats (last 24h)
SELECT
  time_bucket('1 hour', time) AS bucket,
  symbol,
  COUNT(*)                    AS trade_count,
  MIN(price::numeric)         AS low,
  MAX(price::numeric)         AS high,
  AVG(price::numeric)         AS avg_price,
  SUM(quantity::numeric)      AS volume
FROM trades
WHERE time > NOW() - INTERVAL '24 hours'
GROUP BY bucket, symbol
ORDER BY bucket DESC;
```

### pgAdmin GUI — how to connect (first time only)

1. Open http://localhost:5050
2. Login: `admin@trading.dev` / `admin`
3. Click **Add New Server** (on the Welcome dashboard)
4. **General tab** → Name: `trading-timescaledb`
5. **Connection tab** → fill in:
   - Host: `timescaledb`  ← use the Docker service name, NOT localhost
   - Port: `5432`
   - Maintenance database: `trading_db`
   - Username: `trading_user`
   - Password: `trading_pass`
   - Check **Save password**
6. Click **Save**

> The host must be `timescaledb` (the Docker container name) because pgAdmin
> itself runs inside Docker. From inside Docker, `localhost` means the pgAdmin
> container itself — not your PC. The service name `timescaledb` resolves via
> Docker's internal DNS.

### pgAdmin GUI — browse tables

Left panel tree:
```
Servers
  └─ trading-timescaledb
       └─ Databases
            └─ trading_db
                 └─ Schemas
                      └─ public
                           └─ Tables
                                ├─ trades   ← right-click → View/Edit Data
                                └─ users    ← right-click → View/Edit Data
```

To run SQL: **Tools → Query Tool** (or `Alt+Shift+Q`)

---

## DragonflyDB (Redis-compatible cache)

### Connection credentials
```
Host:     localhost
Port:     6379
Password: (none — no auth by default)
```

Connection URL (used in `.env`):
```
redis://localhost:6379
```

### Terminal commands (redis-cli inside the container)

```powershell
# Open an interactive redis-cli shell
docker exec -it trading_dragonflydb redis-cli

# Run a single command without entering the shell
docker exec trading_dragonflydb redis-cli PING
# Expected output: PONG
```

### Useful Redis commands

```bash
# ── Server info ───────────────────────────────────────────────────────
PING                    # Check connection — returns PONG
INFO server             # Server version, OS, port, memory usage
INFO memory             # Memory stats
DBSIZE                  # Number of keys in the current database

# ── Browsing keys ─────────────────────────────────────────────────────
KEYS *                  # List ALL keys (avoid on large datasets)
KEYS users:*            # List keys matching a pattern
SCAN 0 MATCH * COUNT 100  # Safe alternative to KEYS * on large datasets

# ── Reading values ────────────────────────────────────────────────────
GET users:all           # Read a string/JSON key
TYPE users:all          # Check the data type of a key (string, list, hash, etc.)
TTL users:all           # Check remaining TTL in seconds (-1 = no expiry, -2 = gone)
PTTL users:all          # TTL in milliseconds

# ── Writing values ────────────────────────────────────────────────────
SET mykey "hello"             # Set a string key
SET mykey "hello" EX 30       # Set with 30s expiry
DEL mykey                     # Delete a key
DEL key1 key2 key3            # Delete multiple keys

# ── Nuke everything (careful!) ────────────────────────────────────────
FLUSHDB                 # Delete ALL keys in current database
FLUSHALL                # Delete ALL keys in ALL databases
```

### RedisInsight GUI — how to connect (first time only)

1. Open http://localhost:5540
2. Accept the EULA / privacy settings → click **Submit**
3. The **Add database** dialog opens automatically
4. In the **Connection URL** field, clear the default and type:
   ```
   redis://dragonflydb:6379
   ```
   > Again, use the Docker service name `dragonflydb`, not `localhost`
5. Click **Add database**
6. Click on `dragonflydb:6379` in the list to open the browser

### RedisInsight tabs explained

| Tab | What it does |
|---|---|
| **Browse** | See all keys, filter by name/type, click any key to inspect its value |
| **Workbench** | Write and run Redis commands with syntax highlighting and auto-complete |
| **Analyze** | Memory usage breakdown by key prefix — find what's eating memory |
| **Pub/Sub** | Subscribe to channels and watch messages in real time |
| **CLI** (bottom bar) | Quick `redis-cli`-style terminal inside the browser |

---

## Bun / Application Commands

```powershell
# Start dev server with hot-reload (auto-restarts when you save a file)
bun run dev

# Start without hot-reload (production-like)
bun run start

# ── Database migrations ───────────────────────────────────────────────

# Generate a new migration file after you change a schema file
# (creates a new .sql file in the ./drizzle folder)
bun run db:generate

# Apply all pending migrations to the database
# (also enables TimescaleDB extension + converts trades to hypertable)
bun run db:migrate

# Push schema directly to the DB without generating migration files
# WARNING: dev only — do not use on shared/production dbs
bun run db:push

# Open Drizzle Studio (visual table browser in the browser)
bun run db:studio

# ── Docker shortcuts ─────────────────────────────────────────────────
bun run docker:up      # = docker compose up -d
bun run docker:down    # = docker compose down
bun run docker:reset   # = docker compose down -v  (wipes all data)
```

---

## Full Reset (start from scratch)

Use this if the database gets into a broken state or you want a clean slate:

```powershell
# 1. Stop containers and wipe all volumes
docker compose -f docker/docker-compose.yml down -v

# 2. Delete old migration files
Remove-Item -Recurse -Force drizzle

# 3. Regenerate migrations from your schema files
bun run db:generate

# 4. Start containers fresh
docker compose -f docker/docker-compose.yml up -d

# 5. Wait ~10 seconds for TimescaleDB to be ready, then run migrations
bun run db:migrate

# 6. Start the dev server
bun run dev
```

---

## Verify Everything is Working

```powershell
# API health check — should return { status: "ok", database: "ok", cache: "ok" }
Invoke-RestMethod http://localhost:3000/health | ConvertTo-Json

# PostgreSQL - list tables
docker exec trading_timescaledb psql -U trading_user -d trading_db -c "\dt"

# DragonflyDB - ping
docker exec trading_dragonflydb redis-cli PING
```
