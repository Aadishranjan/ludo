# Telegram Real-Time Multiplayer Ludo (Production Starter)

Server-authoritative Ludo game for Telegram Web Apps with room-based multiplayer, anti-cheat validation, reconnect support, and scale-out-ready Socket.io adapter.

## 1) Architecture

### Components
1. `bot` service: Telegram BotFather bot, room creation commands, deep-link invites, WebApp launch.
2. `server` service: Express API + Socket.io real-time gateway + game engine.
3. `MongoDB`: persistent room snapshots and event logs.
4. `Redis` (optional but recommended): Socket.io adapter for horizontal scale.
5. `webapp`: Telegram WebApp frontend (HTML/CSS/JS + Phaser).

### Runtime flow
1. User runs `/newroom` in Telegram.
2. Bot calls `POST /internal/rooms` on server.
3. Bot returns deep link + WebApp button.
4. Players open WebApp and connect socket with `initData`.
5. Server validates Telegram signature and joins players to room.
6. Host starts game.
7. Turn loop: server rolls dice, validates move, applies kill/safe-zone/win, broadcasts state.
8. Disconnect/reconnect: player seat persists by Telegram user id.

### Scale model
1. Socket.io Redis adapter syncs rooms/events across instances.
2. Every mutating action is persisted to Mongo snapshot + `MatchEvent` log.
3. Stateless API and socket auth let you run multiple server replicas behind sticky load balancing.

## 2) Folder structure

```txt
.
├── bot/
│   ├── package.json
│   └── src/index.js
├── server/
│   ├── package.json
│   └── src/
│       ├── app.js
│       ├── index.js
│       ├── config/
│       │   ├── db.js
│       │   └── env.js
│       ├── game/
│       │   ├── constants.js
│       │   ├── engine.js
│       │   └── state.js
│       ├── models/
│       │   ├── MatchEvent.js
│       │   └── Room.js
│       ├── routes/http.js
│       ├── services/
│       │   ├── roomStore.js
│       │   └── telegramAuth.js
│       └── socket/
│           ├── events.js
│           └── index.js
├── webapp/
│   └── public/
│       ├── index.html
│       ├── styles.css
│       ├── app.js
│       └── phaserScene.js
├── .env.example
├── docker-compose.yml
├── package.json
└── README.md
```

## 3) WebSocket event map

### Client -> Server
1. `room:join` `{ roomId }`
2. `game:start` `{ roomId }` (host only)
3. `dice:roll` `{ roomId }` (current player + roll phase)
4. `token:move` `{ roomId, tokenId }` (current player + move phase)
5. `room:leave` `{ roomId }`

### Server -> Client
1. `room:state` full authoritative snapshot
2. `game:dice` rolled value + movable tokens
3. `game:move` resolved move (kills, extra turn, winner)

## 4) State management design

### Authoritative state rules
1. Client never sends dice value.
2. Client never sends position coordinates.
3. Server validates turn, phase, and token legality.
4. Room locks after `status=active`.
5. `moveVersion` increments after every mutation (idempotency + ordering hook).

### Ludo rules implemented
1. 2-4 players.
2. Token enters board only on dice `6`.
3. Kill when opponent token is on same non-safe track cell.
4. Safe zones cannot be killed.
5. Win when all 4 tokens reach finish.
6. Extra turn on rolling `6`.

## 5) Database schema

### `Room`
1. Identity: `roomId`, `hostUserId`, `status`.
2. Turn state: `turnOrder`, `currentTurnIndex`, `turnPhase`, `lastDiceValue`, `moveVersion`.
3. Players: `userId`, `color`, `connected`, `tokens[]`.
4. End state: `winnerUserId`, `ranks[]`.

### `MatchEvent`
1. Append-only audit trail for each action.
2. Stores event type, actor, payload, move version.
3. Useful for replay, anti-fraud, and betting settlement verification.

## 6) Telegram bot behavior

1. `/newroom`: creates room via internal API token and returns deep-link invite.
2. `/start room_<ID>`: opens WebApp directly in invite room.
3. Sends WebApp button that opens `/app?room=<ID>`.

## 7) Security best practices

1. Verify Telegram `initData` hash with bot token HMAC on every socket auth.
2. Reject expired `auth_date` to limit replay.
3. Internal bot-to-server endpoints protected by `x-internal-token`.
4. Enforce strict turn/phase state machine to prevent double moves/turn spoofing.
5. Lock room after game starts.
6. Use HTTPS only and secure CORS origin.
7. Add rate limiting and WAF in production edge.
8. Keep secrets in vault/ENV, never in frontend.

## 8) Deployment (VPS)

### DNS + HTTPS
1. Point `api.yourdomain.com` and `app.yourdomain.com` A records to VPS.
2. Reverse proxy with Nginx to `server:8080`.
3. Enable TLS with Let's Encrypt Certbot.
4. Configure websocket upgrade headers:
   - `proxy_set_header Upgrade $http_upgrade;`
   - `proxy_set_header Connection "upgrade";`

### Run stack
1. Copy `.env.example` -> `.env` and fill secrets.
2. `docker compose up -d`
3. Set BotFather WebApp domain to `https://app.yourdomain.com`.
4. Set BotFather menu command `/newroom`.

### Horizontal scaling
1. Run multiple `server` replicas behind load balancer.
2. Keep sticky sessions for websocket affinity.
3. Enable Redis adapter (`REDIS_URL`) for cross-instance room broadcasts.
4. Keep Mongo as source of durable state; event log supports recovery.

## 9) Future coin betting system (extensible)

1. Add `Wallet`, `Bet`, `LedgerEntry` collections.
2. On room start, reserve stake from each user wallet (escrow).
3. On win, settle via signed ledger transaction from `MatchEvent` + `Room` final state.
4. Add anti-abuse checks: KYC tiering, max stake limits, suspicious behavior detection.

## 10) Local run

1. `cp .env.example .env`
2. Fill `BOT_TOKEN`, `BOT_USERNAME`, `TELEGRAM_BOT_TOKEN`, domains, DB URLs.
3. `npm install`
4. `docker compose up -d mongo redis`
5. `npm run dev:server`
6. `npm run dev:bot`
7. Open Telegram bot and run `/newroom`.

## 11) Production readiness checklist

1. Add Redis-backed distributed lock per room for strict multi-node mutation serialization.
2. Add explicit ack+retry with request IDs for idempotent commands.
3. Add metrics (Prometheus), traces (OpenTelemetry), and structured logs.
4. Add integration tests for dice/move/kill/win/reconnect flows.
5. Add CI/CD pipeline with migration + health checks.
