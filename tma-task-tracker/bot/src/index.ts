// ============================================================
// bot/src/index.ts
// Entry point: initialise Grammy bot, Express server, cron jobs
// ============================================================

import "dotenv/config";
import express from "express";
import { Bot, webhookCallback } from "grammy";
import { registerCommands } from "./commands";
import { NotificationService } from "./services/notifications";
import { registerCronJobs } from "./services/cron";
import { createStrapiWebhookHandler } from "./webhooks/strapi";

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = Number(process.env.PORT ?? 3000);
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const IS_PROD = process.env.NODE_ENV === "production";

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is not set");
if (!process.env.TELEGRAM_GROUP_CHAT_ID) throw new Error("TELEGRAM_GROUP_CHAT_ID is not set");

// ---- Init Bot ----
const bot = new Bot(BOT_TOKEN);
const notify = new NotificationService(bot);

// ---- Register Commands ----
registerCommands(bot);

// ---- Error Handler ----
bot.catch((err) => {
  console.error("[Bot] Unhandled error:", err);
});

// ---- Express Server ----
const app = express();
app.use(express.json());

// Health check
app.get("/", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// Telegram webhook endpoint (production)
if (IS_PROD && WEBHOOK_URL) {
  app.use("/webhook", webhookCallback(bot, "express"));
}

// Strapi lifecycle webhook endpoint
app.post(
  "/strapi-webhook",
  createStrapiWebhookHandler(notify)
);

// ---- Start ----
app.listen(PORT, async () => {
  console.log(`[Bot] Server listening on port ${PORT}`);

  if (IS_PROD && WEBHOOK_URL) {
    await bot.api.setWebhook(`${WEBHOOK_URL}/webhook`);
    console.log(`[Bot] Webhook set → ${WEBHOOK_URL}/webhook`);
  } else {
    // Development: long polling
    console.log("[Bot] Starting long polling (dev mode)...");
    bot.start();
  }

  // Register cron jobs after bot is ready
  registerCronJobs(bot, notify);
  console.log("[Bot] Ready ✓");
});

export { bot, notify };
