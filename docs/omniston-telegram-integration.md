# Omniston Telegram Integration

This plan makes the Conviction Telegram bot a STON.fi/Omniston-ready surface without turning it into a local trading engine. The bot remains a thin Telegram client. Core product state, markets, users, support, signals, and portfolio records still come from Conviction Core API.

## Positioning

Conviction Markets can use Omniston as the TON liquidity route behind Telegram-native prediction-market actions:

- Users discover event markets in Telegram.
- The bot turns market posts into actions such as view market, signal, fund, or swap.
- Omniston powers TON asset routing when a user needs the right asset before funding a vault or taking a future market action.
- Conviction keeps market identity, social layer, portfolio, and risk controls in the core product.

This is stronger than a visibility-only widget because it creates repeatable Telegram behavior around market discovery, signal sharing, and liquidity routing.

## First Integration Scope

The first implementation task is quote-only:

1. Add the exact `@ston-fi/omniston-sdk` version.
2. Add an Omniston service module that can request quotes without submitting transactions.
3. Add `/quote <from> <to> <amountUnits>` for TON assets.
4. Return quote output with route, estimated receive amount, and risk disclaimers.
5. Keep swap submission disabled until wallet signing, transaction preview, and limited-funds validation are reviewed.

## Runtime Config

The Telegram bot reads these environment variables:

- `OMNISTON_ENABLED`: defaults to `false`.
- `OMNISTON_NETWORK`: `mainnet` or `testnet`; defaults to `mainnet`.
- `OMNISTON_ROUTING_MODE`: `disabled`, `quote_only`, or `swap_intent`; defaults to `disabled`.
- `OMNISTON_API_URL`: defaults to `wss://omni-ws.ston.fi`, or `wss://omni-ws-sandbox.ston.fi` when `OMNISTON_NETWORK=testnet`.
- `OMNISTON_QUOTE_TIMEOUT_MS`: quote stream timeout; defaults to `8000`.
- `CONVICTION_WEBSITE_URL`: public product URL used in Telegram responses.

`OMNISTON_ENABLED=false` or `OMNISTON_ROUTING_MODE=disabled` means no Omniston commands should send quote or swap requests.

## Quote Command

`/quote <from> <to> <amountUnits>` requests a live Omniston RFQ stream and returns the first available quote. The current aliases are `TON`, `USDT`, and `STON`; raw TON jetton addresses are also accepted.

Examples:

```text
/quote TON USDT 1000000000
/quote USDT STON 1000000
```

The command is intentionally quote-only. It does not call `tonBuildSwap`, `tonBuildEscrowTransfer`, `evmBuildOrderPayload`, tracking APIs, wallet signing, or transaction submission.

Use `/quote_status` in Telegram to confirm enabled state, network, API URL, routing mode, and timeout before running live quote tests.

## Safety Rules

Omniston routes digital assets. Bugs, wrong token addresses, wrong network selection, bad signing flow, or user misuse can cause irreversible loss of funds.

Before quote or swap execution work starts:

- Use the exact SDK version in `package.json`.
- Keep swaps disabled while quotes are being tested.
- Test with small amounts before any production path.
- Route all account-specific state through Conviction Core API.
- Do not create local fallback balances, markets, liquidity, or execution records in the bot.

## Grant Milestones

1. Quote-only Telegram bot integration.
2. Market-aware funding prompts using Omniston quote data.
3. Mini-app or deep-link handoff for wallet signing.
4. Community market digest posts with STON.fi-powered liquidity actions.
5. Metrics dashboard for Telegram users, quote requests, funded actions, and retained community activity.
