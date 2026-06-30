import { Telegraf } from "telegraf";

import type { BotConfig } from "../config/index.js";
import { registerCommands } from "../handlers/commands.js";
import { CoreApiClient } from "../lib/core-api-client.js";
import { OmnistonQuoteService } from "../lib/omniston-quote-service.js";

export function createBot(config: BotConfig) {
  const bot = new Telegraf(config.telegramBotToken);
  const coreApi = new CoreApiClient(config.coreApiUrl);
  const omnistonQuotes = new OmnistonQuoteService(config.omniston);

  registerCommands(bot, coreApi, omnistonQuotes, config.convictionWebsiteUrl);

  bot.catch((error) => {
    console.error(error);
  });

  return bot;
}
