# Conviction Telegram Bot

Telegram bot workspace for Conviction Markets. The bot is a thin Telegram surface: it does not own a database and does not create fake markets, users, profiles, or trading history. Product state comes from the core API.

## Setup

Package manager: npm.

```sh
npm install
cp .env.example .env
npm run dev
```

Set `TELEGRAM_BOT_TOKEN` to a real bot token and `CORE_API_URL` to the same running Conviction Core API instance used by the Farcaster app. For the local demo, use `CORE_API_URL=http://localhost:3000`.

Optional STON.fi/Omniston planning variables are included in `.env.example`. Keep `OMNISTON_ENABLED=false` and `OMNISTON_ROUTING_MODE=disabled` until quote-only integration is reviewed.

## Commands

- `npm run dev` starts the Telegraf bot in long polling mode.
- `npm run build` runs the TypeScript compiler in check mode.
- `npm run lint` runs ESLint.
- `npm run format` runs Prettier.
- `npm run format:check` checks formatting.

## Bot Commands

- `/start` creates or fetches the Telegram user through the core API.
- `/profile` shows the real core API user and trader profile when present.
- `/markets` lists real markets returned by the core API.
- `/market <id>` shows one real market from the core API.
- `/signal <marketId> <YES|NO> <thesis>` creates a real trade signal through the core API.
- `/signals <marketId>` lists real signals for one market.
- `/quote <from> <to> <amountUnits>` requests a quote-only Omniston route when enabled.
- `/quote_status` shows Omniston quote config state without exposing secrets.
- `/copy <positionId> <amount>` submits a copy intent through the core API.
- `/positions` lists positions for the connected core API user.
- `/leaderboard` shows real leaderboard data only when the core API exposes it.

If `/markets` receives an empty list, the bot tells the user that markets have not been synced yet. It does not show fallback markets.

Signal and copy examples:

```text
/signal market_id YES Thesis based on my real view
/signals market_id
/copy position_id 10.00000000
/positions
```

Signal responses say `Signal created`. Copy responses say `Copy intent submitted`. Pending copy or position records say `Execution not yet enabled`; the bot does not simulate balances or execution.

Omniston quote examples:

```text
/quote TON USDT 1000000000
/quote USDT STON 1000000
```

Quote amounts use token base units. The command returns an estimate only and does not build, sign, or submit a wallet transaction. Use `/quote_status` to confirm whether the deployment is in `quote_only` mode before testing.

## Core API Contract

The bot expects the core API to own all product logic and persistence. Current calls:

- `POST /social-accounts` with `platform: "TELEGRAM"` to create or fetch the user and social account.
- `GET /markets` for synced markets.
- `GET /markets/:id` for one synced market.
- `POST /signals` to create a real trade signal for the connected trader profile.
- `GET /markets/:marketId/signals` for real market signals.
- `GET /users/:userId/positions` for connected-user positions.
- `POST /copy-trades` to submit a copy intent.
- `GET /leaderboard` for real leaderboard data from persisted signals and copy intents.

The social account call should be idempotent and return a real user in the standard API response envelope. If a core endpoint is unavailable, the bot reports that cleanly instead of creating local fallback state.

## STON.fi / Omniston Direction

Conviction Markets should use Omniston as a Telegram-native liquidity route, not as a standalone trading engine inside the bot. The first implementation is quote-only: users can ask for a route before funding future Conviction actions, while wallet signing and swap submission remain disabled.

See [docs/omniston-telegram-integration.md](docs/omniston-telegram-integration.md) for the scoped rollout, safety rules, and grant milestones.

## Demo Readiness

Telegram remains a thin client in the demo. It does not store local data and it does not create fallback markets, users, balances, PnL, or execution state.

Local checklist:

1. Run the core API on `http://localhost:3000` and apply migrations.
2. Sync real markets with `npm run markets:sync:polymarket -- --limit=10` in `conviction-core-api`, or keep the market empty state if provider sync is unavailable.
3. Set `CORE_API_URL=http://localhost:3000` in this repo and in `conviction-farcaster-app`.
4. Set `TELEGRAM_BOT_TOKEN` to a real bot token.
5. Start the bot with `npm run dev`.
6. Open the bot in Telegram and run `/start` to create or fetch the real Telegram-linked user through the core API.
7. Run `/markets` to view synced markets or the clean empty state.
8. Create a real trader profile for the returned core user through `POST /trader-profiles` in the core API.
9. Run `/signal <marketId> <YES|NO> <thesis>` to create a real signal through core.
10. Run `/signals <marketId>` and open the Farcaster app to confirm the same API records are visible.
11. Run `/copy <positionId> <amount>` only against a real source position. The bot should say `Copy intent submitted` and `Execution not yet enabled` unless the core API returns `EXECUTED`.

Core API setup cURL used by the demo:

```sh
curl -X POST http://localhost:3000/trader-profiles \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "<real-user-id-from-/profile>",
    "handle": "<real-trader-handle>",
    "bio": "Local demo profile for a real operator."
  }'
```

Demo commands:

```text
/start
/profile
/markets
/market <real-market-id>
/signal <real-market-id> YES My real thesis for this market
/signals <real-market-id>
/positions
/copy <real-position-id> 5.00000000
/leaderboard
```

Do not create demo-only Telegram accounts or local fallback records. If a command needs data that does not exist yet, create the real record in the core API first or show the empty state.

## Structure

- `src/bot` keeps bot bootstrap code.
- `src/config` keeps environment and runtime config.
- `src/handlers` keeps Telegram command handlers.
- `src/lib` keeps shared helpers such as the core API client.
- `tests` is reserved for test coverage.
