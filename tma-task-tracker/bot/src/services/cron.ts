// ============================================================
// bot/src/services/cron.ts
// Scheduled jobs: morning summary, deadline warnings, overdue alerts
// ============================================================

import cron from "node-cron";
import { Bot } from "grammy";
import { strapi } from "./strapi";
import { NotificationService } from "./notifications";
import { MORNING_SUMMARY_HOUR, MORNING_SUMMARY_MINUTE } from "@tma/shared/constants";

export function registerCronJobs(bot: Bot, notify: NotificationService) {
  // ---- Morning Summary: 08:00 every day ----
  cron.schedule(
    `${MORNING_SUMMARY_MINUTE} ${MORNING_SUMMARY_HOUR} * * *`,
    async () => {
      console.log("[Cron] Running morning summary...");
      try {
        await notify.sendMorningSummary();
      } catch (err) {
        console.error("[Cron] Morning summary error:", err);
      }
    },
    { timezone: "Asia/Bangkok" }
  );

  // ---- Deadline Warning: every hour, check projects ----
  cron.schedule("0 * * * *", async () => {
    console.log("[Cron] Checking deadlines...");
    try {
      const projects = await strapi.getProjects();
      const now = Date.now();

      for (const project of projects) {
        const deadlineMs = new Date(project.deadline).getTime();
        const diffHours = (deadlineMs - now) / (1000 * 60 * 60);

        // Warn at 24h and 2h before deadline
        if (diffHours > 0 && (Math.floor(diffHours) === 24 || Math.floor(diffHours) === 2)) {
          await notify.announceDeadlineWarning(project, Math.floor(diffHours));
        }
      }
    } catch (err) {
      console.error("[Cron] Deadline check error:", err);
    }
  });

  // ---- Overdue Alert: every hour ----
  cron.schedule("15 * * * *", async () => {
    console.log("[Cron] Checking overdue tasks...");
    try {
      const overdueTasks = await strapi.getOverdueTasks();
      for (const task of overdueTasks) {
        await notify.announceTaskOverdue(task);
      }
    } catch (err) {
      console.error("[Cron] Overdue check error:", err);
    }
  });

  console.log("[Cron] All jobs registered (TZ: Asia/Bangkok)");
}
