import { config } from "./config/index.js";

export function start(): void {
  console.log(`conviction-telegram-bot ready in ${config.environment}`);
}

start();
