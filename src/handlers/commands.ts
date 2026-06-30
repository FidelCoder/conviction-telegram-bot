import type { Context, Telegraf } from "telegraf";

import type { OmnistonConfig } from "../config/index.js";

import {
  CoreApiError,
  type CoreApiClient,
  type Market,
  type Position,
  type TelegramIdentity,
  type TradeSignal,
} from "../lib/core-api-client.js";
import {
  OmnistonNoQuoteError,
  OmnistonQuoteDisabledError,
  OmnistonQuoteInputError,
  type OmnistonQuoteResult,
  type OmnistonQuoteService,
  OmnistonQuoteTimeoutError,
} from "../lib/omniston-quote-service.js";

const maxMarketsToShow = 10;
const maxSignalsToShow = 10;
const maxPositionsToShow = 10;
const maxLeaderboardEntries = 10;
const decimalAmountPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/;
const integerUnitsPattern = /^(?:0|[1-9]\d*)$/;

export function registerCommands(
  bot: Telegraf<Context>,
  coreApi: CoreApiClient,
  omnistonQuotes?: OmnistonQuoteService,
  websiteUrl = "https://convictionmarkets.xyz",
  omnistonConfig?: OmnistonConfig,
) {
  bot.start(async (ctx) => {
    const identity = getTelegramIdentity(ctx);

    if (!identity) {
      await ctx.reply(
        "I could not read your Telegram account from this chat. Please try again in a direct chat.",
      );
      return;
    }

    try {
      const session = await coreApi.createOrFetchTelegramUser(identity);
      const name = session.user.displayName ?? identity.username ?? "Telegram " + identity.id;
      await ctx.reply(
        [
          "Welcome, " + name + ".",
          "Your Telegram account is connected through the core API.",
          "Use /markets to see real synced markets.",
        ].join("\n"),
      );
    } catch (error) {
      await replyForCoreApiError(
        ctx,
        error,
        "I could not connect your Telegram account through the core API yet.",
      );
    }
  });

  bot.command("profile", async (ctx) => {
    const identity = getTelegramIdentity(ctx);

    if (!identity) {
      await ctx.reply("I could not read your Telegram account from this chat.");
      return;
    }

    try {
      const session = await coreApi.createOrFetchTelegramUser(identity);
      const lines = [
        "Profile",
        "User ID: " + session.user.id,
        "Name: " + (session.user.displayName ?? "Not set"),
        "Telegram: " + (identity.username ? "@" + identity.username : identity.id),
      ];

      if (session.traderProfile) {
        lines.push("Trader: " + session.traderProfile.handle);
      }

      await ctx.reply(lines.join("\n"));
    } catch (error) {
      await replyForCoreApiError(ctx, error, "I could not load your profile from the core API.");
    }
  });

  bot.command("markets", async (ctx) => {
    try {
      const markets = await coreApi.listMarkets();

      if (markets.length === 0) {
        await ctx.reply(
          "No markets are available yet. Real markets have not been synced into the core API.",
        );
        return;
      }

      await ctx.reply(formatMarkets(markets));
    } catch (error) {
      await replyForCoreApiError(ctx, error, "I could not load markets from the core API.");
    }
  });

  bot.command("market", async (ctx) => {
    const marketId = getCommandArgument(ctx);

    if (!marketId) {
      await ctx.reply("Usage: /market <id>");
      return;
    }

    try {
      const market = await coreApi.getMarket(marketId);
      await ctx.reply(formatMarket(market));
    } catch (error) {
      if (error instanceof CoreApiError && error.statusCode === 404) {
        await ctx.reply("Market not found in the core API.");
        return;
      }

      await replyForCoreApiError(ctx, error, "I could not load that market from the core API.");
    }
  });

  bot.command("quote_status", async (ctx) => {
    if (!omnistonConfig) {
      await ctx.reply("Omniston quote config is not loaded on this bot deployment.");
      return;
    }

    await ctx.reply(formatOmnistonQuoteStatus(omnistonConfig));
  });

  bot.command("quote", async (ctx) => {
    const [fromAsset, toAsset, amountUnits] = getCommandParts(ctx);

    if (!fromAsset || !toAsset || !amountUnits) {
      await ctx.reply(
        [
          "Usage: /quote <from> <to> <amountUnits>",
          "Examples:",
          "/quote TON USDT 1000000000",
          "/quote USDT STON 1000000",
          "Amounts are base units, not display decimals.",
        ].join("\n"),
      );
      return;
    }

    if (!integerUnitsPattern.test(amountUnits) || BigInt(amountUnits) <= 0n) {
      await ctx.reply("Amount must be positive integer base units, for example 1000000.");
      return;
    }

    if (!omnistonQuotes) {
      await ctx.reply("Omniston quote routing is not configured on this bot deployment yet.");
      return;
    }

    try {
      const result = await omnistonQuotes.requestQuote({ fromAsset, toAsset, amountUnits });
      await ctx.reply(formatOmnistonQuote(result, websiteUrl));
    } catch (error) {
      await replyForOmnistonQuoteError(ctx, error);
    }
  });

  bot.command("signal", async (ctx) => {
    const [marketId, rawSide, ...thesisParts] = getCommandParts(ctx);
    const side = rawSide?.toUpperCase();
    const thesis = thesisParts.join(" ").trim();

    if (!marketId || !side || !thesis) {
      await ctx.reply("Usage: /signal <marketId> <YES|NO> <thesis>");
      return;
    }

    if (side !== "YES" && side !== "NO") {
      await ctx.reply("Signal side must be YES or NO.");
      return;
    }

    const identity = getTelegramIdentity(ctx);

    if (!identity) {
      await ctx.reply("I could not read your Telegram account from this chat.");
      return;
    }

    try {
      const session = await coreApi.createOrFetchTelegramUser(identity);

      if (!session.traderProfile) {
        await ctx.reply(
          "Your Telegram user is connected, but no trader profile exists yet. Create a real trader profile through the core API before sending signals.",
        );
        return;
      }

      const signal = await coreApi.createTradeSignal({
        traderProfileId: session.traderProfile.id,
        marketId,
        side,
        thesis,
      });

      await ctx.reply(formatSignalCreated(signal));
    } catch (error) {
      await replyForCoreApiError(
        ctx,
        error,
        "I could not create that signal through the core API.",
      );
    }
  });

  bot.command("signals", async (ctx) => {
    const marketId = getCommandArgument(ctx);

    if (!marketId) {
      await ctx.reply("Usage: /signals <marketId>");
      return;
    }

    try {
      const signals = await coreApi.listMarketSignals(marketId);

      if (signals.length === 0) {
        await ctx.reply("No real signals have been created for this market yet.");
        return;
      }

      await ctx.reply(formatSignals(signals));
    } catch (error) {
      await replyForCoreApiError(ctx, error, "I could not load signals from the core API.");
    }
  });

  bot.command("copy", async (ctx) => {
    const [positionId, amount] = getCommandParts(ctx);

    if (!positionId || !amount) {
      await ctx.reply("Usage: /copy <positionId> <amount>");
      return;
    }

    if (!decimalAmountPattern.test(amount) || Number(amount) <= 0) {
      await ctx.reply("Amount must be greater than zero with up to 8 decimal places.");
      return;
    }

    const identity = getTelegramIdentity(ctx);

    if (!identity) {
      await ctx.reply("I could not read your Telegram account from this chat.");
      return;
    }

    try {
      const session = await coreApi.createOrFetchTelegramUser(identity);
      const copyIntent = await coreApi.createCopyIntent({
        followerId: session.user.id,
        sourcePositionId: positionId,
        requestedQuantity: amount,
      });

      await ctx.reply(
        formatCopyIntent(copyIntent.status, copyIntent.id, copyIntent.requestedQuantity),
      );
    } catch (error) {
      await replyForCoreApiError(
        ctx,
        error,
        "I could not submit that copy intent through the core API.",
      );
    }
  });

  bot.command("positions", async (ctx) => {
    const identity = getTelegramIdentity(ctx);

    if (!identity) {
      await ctx.reply("I could not read your Telegram account from this chat.");
      return;
    }

    try {
      const session = await coreApi.createOrFetchTelegramUser(identity);
      const positions = await coreApi.listUserPositions(session.user.id);

      if (positions.length === 0) {
        await ctx.reply("No positions are available for your core API user yet.");
        return;
      }

      await ctx.reply(formatPositions(positions));
    } catch (error) {
      await replyForCoreApiError(ctx, error, "I could not load positions from the core API.");
    }
  });

  bot.command("leaderboard", async (ctx) => {
    try {
      const leaderboard = await coreApi.listLeaderboard();

      if (!leaderboard || leaderboard.length === 0) {
        await ctx.reply(
          "Leaderboard has no entries yet. It will show real trader data once signals or copy intents exist.",
        );
        return;
      }

      const lines = ["Leaderboard"];
      leaderboard.slice(0, maxLeaderboardEntries).forEach((entry, index) => {
        const rank = entry.rank ?? index + 1;
        const copiedVolume = entry.copiedVolume ?? "0";
        const executedVolume = entry.executedCopiedVolume
          ? " | executed copied volume: " + entry.executedCopiedVolume
          : "";
        const pnl = entry.realizedPnl ? " | realized PnL: " + entry.realizedPnl : "";

        lines.push(
          rank +
            ". " +
            entry.handle +
            " | signals: " +
            entry.numberOfSignals +
            " | copy intents: " +
            entry.numberOfCopyIntents +
            " | copied volume: " +
            copiedVolume +
            executedVolume +
            pnl,
        );
      });

      await ctx.reply(lines.join("\n"));
    } catch (error) {
      await replyForCoreApiError(ctx, error, "I could not load the leaderboard from the core API.");
    }
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      [
        "Commands",
        "/profile",
        "/markets",
        "/market <id>",
        "/signal <marketId> <YES|NO> <thesis>",
        "/signals <marketId>",
        "/quote <from> <to> <amountUnits>",
        "/quote_status",
        "/copy <positionId> <amount>",
        "/positions",
        "/leaderboard",
      ].join("\n"),
    );
  });
}

function getTelegramIdentity(ctx: Context): TelegramIdentity | null {
  const from = ctx.from;

  if (!from) {
    return null;
  }

  return {
    id: from.id,
    isBot: from.is_bot,
    username: from.username,
    firstName: from.first_name,
    lastName: from.last_name,
    languageCode: from.language_code,
  };
}

function getCommandArgument(ctx: Context) {
  return getCommandParts(ctx).join(" ").trim();
}

function getCommandParts(ctx: Context) {
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const [, ...parts] = text.trim().split(/\s+/);

  return parts;
}

function formatMarkets(markets: Market[]) {
  const lines = ["Markets"];

  markets.slice(0, maxMarketsToShow).forEach((market, index) => {
    lines.push("", index + 1 + ". " + market.title, "ID: " + market.id, "Status: " + market.status);

    if (market.category) {
      lines.push("Category: " + market.category);
    }
  });

  if (markets.length > maxMarketsToShow) {
    lines.push("", "Showing " + maxMarketsToShow + " of " + markets.length + " markets.");
  }

  return lines.join("\n");
}

function formatSignalCreated(signal: TradeSignal) {
  return [
    "Signal created",
    "Signal ID: " + signal.id,
    "Market ID: " + signal.marketId,
    "Side: " + signal.side,
    "Status: " + signal.status,
    "Execution not yet enabled.",
  ].join("\n");
}

function formatSignals(signals: TradeSignal[]) {
  const lines = ["Signals"];

  signals.slice(0, maxSignalsToShow).forEach((signal, index) => {
    lines.push(
      "",
      index + 1 + ". " + signal.side + " - " + signal.status,
      "ID: " + signal.id,
      "Trader profile: " + signal.traderProfileId,
      "Thesis: " + signal.thesis,
    );
  });

  if (signals.length > maxSignalsToShow) {
    lines.push("", "Showing " + maxSignalsToShow + " of " + signals.length + " signals.");
  }

  return lines.join("\n");
}

function formatPositions(positions: Position[]) {
  const lines = ["Positions"];

  positions.slice(0, maxPositionsToShow).forEach((position, index) => {
    lines.push(
      "",
      index + 1 + ". " + position.side + " " + position.quantity,
      "ID: " + position.id,
      "Market ID: " + position.marketId,
      "Status: " + position.status,
    );

    if (position.status === "PENDING_EXECUTION") {
      lines.push("Execution not yet enabled.");
    }

    if (position.averageEntryPrice) {
      lines.push("Entry price: " + position.averageEntryPrice);
    }

    if (position.observedMarketPrice) {
      lines.push("Observed market price: " + position.observedMarketPrice);
    }
  });

  if (positions.length > maxPositionsToShow) {
    lines.push("", "Showing " + maxPositionsToShow + " of " + positions.length + " positions.");
  }

  return lines.join("\n");
}

function formatCopyIntent(status: string, id: string, requestedQuantity: string) {
  const lines = [
    "Copy intent submitted",
    "Copy intent ID: " + id,
    "Requested amount: " + requestedQuantity,
    "Status: " + status,
  ];

  if (status !== "EXECUTED") {
    lines.push("Execution not yet enabled.");
  }

  return lines.join("\n");
}

function formatMarket(market: Market) {
  const lines = [
    market.title,
    "ID: " + market.id,
    "Status: " + market.status,
    "Source: " + market.source,
  ];

  if (market.category) {
    lines.push("Category: " + market.category);
  }

  if (market.resolutionDate) {
    lines.push("Resolution: " + market.resolutionDate);
  }

  if (market.lastTradePrice) {
    lines.push("Last price: " + market.lastTradePrice);
  } else if (market.bestBid || market.bestAsk) {
    lines.push("Bid/ask: " + (market.bestBid ?? "n/a") + " / " + (market.bestAsk ?? "n/a"));
  }

  if (market.externalUrl) {
    lines.push("External URL: " + market.externalUrl);
  }

  if (market.description) {
    lines.push("", market.description);
  }

  return lines.join("\n");
}

async function replyForCoreApiError(ctx: Context, error: unknown, message: string) {
  if (error instanceof CoreApiError) {
    console.error("[core-api] " + error.code + ": " + error.message);
    await ctx.reply(message + "\n" + error.message);
    return;
  }

  console.error(error);
  await ctx.reply(message + "\nPlease try again later.");
}

function formatOmnistonQuoteStatus(config: OmnistonConfig) {
  return [
    "Omniston quote status",
    "Enabled: " + (config.enabled ? "yes" : "no"),
    "Network: " + config.network,
    "Routing mode: " + config.routingMode,
    "API: " + config.apiUrl,
    "Timeout: " + config.quoteTimeoutMs + "ms",
    "Quote command: " +
      (config.enabled && config.routingMode === "quote_only" ? "ready" : "disabled"),
  ].join("\n");
}

function formatOmnistonQuote(result: OmnistonQuoteResult, websiteUrl: string) {
  const { quote } = result;
  const lines = [
    "Omniston quote",
    result.inputSymbol + " -> " + result.outputSymbol,
    "Input units: " + quote.inputUnits,
    "Estimated output units: " + quote.outputUnits,
    "Settlement: " + result.settlement,
    "Resolver: " + quote.resolverName,
    "Quote ID: " + quote.quoteId,
  ];

  if (quote.gasBudget) {
    lines.push("Gas budget: " + quote.gasBudget);
  }

  if (quote.settlementData.$case === "swap") {
    lines.push("Routes: " + quote.settlementData.value.routes.length);
    lines.push("Recommended min output: " + quote.settlementData.value.recommendedMinOutputAmount);
  }

  lines.push("", "Quote only. No wallet transaction was built or submitted.", websiteUrl);

  return lines.join("\n");
}

async function replyForOmnistonQuoteError(ctx: Context, error: unknown) {
  if (error instanceof OmnistonQuoteDisabledError) {
    await ctx.reply(
      "Omniston quotes are disabled on this deployment. Set OMNISTON_ENABLED=true and OMNISTON_ROUTING_MODE=quote_only to test quotes.",
    );
    return;
  }

  if (error instanceof OmnistonQuoteInputError) {
    await ctx.reply(error.message);
    return;
  }

  if (error instanceof OmnistonNoQuoteError || error instanceof OmnistonQuoteTimeoutError) {
    await ctx.reply(error.message);
    return;
  }

  console.error(error);
  await ctx.reply("I could not fetch an Omniston quote right now. Please try again later.");
}
