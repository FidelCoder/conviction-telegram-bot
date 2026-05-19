export type BotConfig = {
  environment: string;
  logLevel: string;
  telegramBotToken: string;
};

export const config: BotConfig = {
  environment: process.env.NODE_ENV ?? "development",
  logLevel: process.env.LOG_LEVEL ?? "info",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
};
