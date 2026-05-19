# Conviction Telegram Bot

Telegram bot workspace for Conviction Markets.

## Setup

Package manager: npm.

```sh
npm install
cp .env.example .env
npm run dev
```

## Commands

- `npm run dev` starts the TypeScript entrypoint with `tsx`.
- `npm run build` runs the TypeScript compiler in check mode.
- `npm run lint` runs ESLint.
- `npm run format` runs Prettier.
- `npm run format:check` checks formatting.

## Structure

- `src/bot` is reserved for bot bootstrap code.
- `src/config` keeps environment and runtime config.
- `src/handlers` is reserved for Telegram handlers.
- `src/lib` is reserved for shared helpers.
- `tests` is reserved for test coverage.
