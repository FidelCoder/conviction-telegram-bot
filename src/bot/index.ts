import { Telegraf } from "telegraf";

import type { BotConfig } from "../config/index.js";
import { registerCommands } from "../handlers/commands.js";
import { CoreApiClient } from "../lib/core-api-client.js";

export function createBot(config: BotConfig) {
  const bot = new Telegraf(config.telegramBotToken);
  const coreApi = new CoreApiClient(config.coreApiUrl);

  registerCommands(bot, coreApi);

  bot.catch((error) => {
    console.error(error);
  });

  return bot;
}
