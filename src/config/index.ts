import "dotenv/config";

export type BotConfig = {
  environment: string;
  logLevel: string;
  telegramBotToken: string;
  coreApiUrl: string;
};

export const config: BotConfig = {
  environment: process.env.NODE_ENV ?? "development",
  logLevel: process.env.LOG_LEVEL ?? "info",
  telegramBotToken: requiredEnv("TELEGRAM_BOT_TOKEN"),
  coreApiUrl: requiredUrlEnv("CORE_API_URL"),
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(name + " is required");
  }

  return value;
}

function requiredUrlEnv(name: string) {
  const value = requiredEnv(name);

  try {
    const url = new URL(value);
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(name + " must be a valid URL");
  }
}
