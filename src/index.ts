import { createBot } from "./bot/index.js";
import { config } from "./config/index.js";

const bot = createBot(config);

await bot.launch();
console.log("conviction-telegram-bot running in " + config.environment);

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
