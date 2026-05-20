# Conviction Telegram Bot

Telegram bot workspace for Conviction Markets. The bot is a thin Telegram surface: it does not own a database and does not create fake markets, users, profiles, or trading history. Product state comes from the core API.

## Setup

Package manager: npm.

```sh
npm install
cp .env.example .env
npm run dev
```

Set `TELEGRAM_BOT_TOKEN` to a real bot token and `CORE_API_URL` to a running Conviction Core API instance.

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
- `/leaderboard` shows real leaderboard data only when the core API exposes it.

If `/markets` receives an empty list, the bot tells the user that markets have not been synced yet. It does not show fallback markets.

## Core API Contract

The bot expects the core API to own all product logic and persistence. Current calls:

- `POST /social-accounts` with `platform: "TELEGRAM"` to create or fetch the user and social account.
- `GET /markets` for synced markets.
- `GET /markets/:id` for one synced market.
- `GET /leaderboard` for real leaderboard data when that endpoint exists.

The social account call should be idempotent and return a real user in the standard API response envelope. If a core endpoint is unavailable, the bot reports that cleanly instead of creating local fallback state.

## Structure

- `src/bot` keeps bot bootstrap code.
- `src/config` keeps environment and runtime config.
- `src/handlers` keeps Telegram command handlers.
- `src/lib` keeps shared helpers such as the core API client.
- `tests` is reserved for test coverage.
