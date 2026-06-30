import "dotenv/config";

export type BotConfig = {
  environment: string;
  logLevel: string;
  telegramBotToken: string;
  coreApiUrl: string;
  convictionWebsiteUrl: string;
  omniston: OmnistonConfig;
};

export type OmnistonConfig = {
  enabled: boolean;
  network: "mainnet" | "testnet";
  routingMode: "disabled" | "quote_only" | "swap_intent";
};

export const config: BotConfig = {
  environment: process.env.NODE_ENV ?? "development",
  logLevel: process.env.LOG_LEVEL ?? "info",
  telegramBotToken: requiredEnv("TELEGRAM_BOT_TOKEN"),
  coreApiUrl: requiredUrlEnv("CORE_API_URL"),
  convictionWebsiteUrl: optionalUrlEnv("CONVICTION_WEBSITE_URL", "https://convictionmarkets.xyz"),
  omniston: {
    enabled: booleanEnv("OMNISTON_ENABLED", false),
    network: enumEnv("OMNISTON_NETWORK", ["mainnet", "testnet"], "mainnet"),
    routingMode: enumEnv(
      "OMNISTON_ROUTING_MODE",
      ["disabled", "quote_only", "swap_intent"],
      "disabled",
    ),
  },
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

function optionalUrlEnv(name: string, fallback: string) {
  const value = process.env[name]?.trim() || fallback;

  try {
    const url = new URL(value);
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(name + " must be a valid URL");
  }
}

function booleanEnv(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }

  throw new Error(name + " must be a boolean");
}

function enumEnv<const T extends readonly string[]>(name: string, values: T, fallback: T[number]) {
  const value = process.env[name]?.trim() || fallback;

  if (values.includes(value)) {
    return value as T[number];
  }

  throw new Error(name + " must be one of: " + values.join(", "));
}
