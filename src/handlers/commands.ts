import type { Context, Telegraf } from "telegraf";

import {
  CoreApiError,
  type CoreApiClient,
  type Market,
  type TelegramIdentity,
} from "../lib/core-api-client.js";

const maxMarketsToShow = 10;
const maxLeaderboardEntries = 10;

export function registerCommands(bot: Telegraf<Context>, coreApi: CoreApiClient) {
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

  bot.command("leaderboard", async (ctx) => {
    try {
      const leaderboard = await coreApi.listLeaderboard();

      if (!leaderboard || leaderboard.length === 0) {
        await ctx.reply(
          "Leaderboard is not available yet. It will show real trader data once the core API exposes it.",
        );
        return;
      }

      const lines = ["Leaderboard"];
      leaderboard.slice(0, maxLeaderboardEntries).forEach((entry, index) => {
        const rank = entry.rank ?? index + 1;
        const name =
          entry.handle ??
          entry.displayName ??
          entry.traderProfileId ??
          entry.userId ??
          "Unknown trader";
        const score = entry.score === undefined || entry.score === null ? "" : " - " + entry.score;
        lines.push(rank + ". " + name + score);
      });

      await ctx.reply(lines.join("\n"));
    } catch (error) {
      await replyForCoreApiError(ctx, error, "I could not load the leaderboard from the core API.");
    }
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      ["Commands", "/profile", "/markets", "/market <id>", "/leaderboard"].join("\n"),
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
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const [, ...parts] = text.trim().split(/\s+/);

  return parts.join(" ").trim();
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
