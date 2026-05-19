// ============================================================
// bot/src/commands/index.ts
// Register all bot commands and their handlers
// ============================================================

import { Bot, InlineKeyboard } from "grammy";
import { strapi } from "../services/strapi";
import { escMd } from "../utils/messages";
import { TASK_STATUS_LABEL } from "@tma/shared/constants";
import process from "process";

const MINI_APP_URL = process.env.MINI_APP_URL ?? "https://mini-app-eosin-psi.vercel.app";

function miniAppKeyboard(ctx: any): InlineKeyboard | undefined {
  if (ctx.chat?.type === "private") {
    return new InlineKeyboard().webApp("📱 เปิด Mini App", MINI_APP_URL);
  }
  return new InlineKeyboard().url("📱 เปิด Mini App", MINI_APP_URL);
}

function replyOpts(ctx: any) {
  const kb = miniAppKeyboard(ctx);
  return {
    parse_mode: "MarkdownV2" as const,
    ...(kb ? { reply_markup: kb } : {}),
  };
}

export function registerCommands(bot: Bot) {
  // ---- /start ----
  bot.command("start", async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const user = await strapi.getUserByTelegramId(telegramId).catch(() => null);

    if (!user) {
      await ctx.reply(
        "👋 สวัสดีครับ\\! ยังไม่พบบัญชีของคุณในระบบ\n\nกรุณาเปิด Mini App เพื่อลงทะเบียนก่อนนะครับ",
        replyOpts(ctx)
      );
      return;
    }

    if (user.account_status === "Pending") {
      await ctx.reply(
        "⏳ บัญชีของคุณกำลังรอการอนุมัติจากหัวหน้าครับ\nจะแจ้งเตือนทาง DM เมื่ออนุมัติแล้ว",
        { parse_mode: "MarkdownV2" }
      );
      return;
    }

    const name = escMd(ctx.from?.first_name ?? user.username);
    const roleLabel = user.role_level === "Manager" ? "🔑 Manager" : "👷 Staff";

    await ctx.reply(
      `สวัสดีครับ *${name}* \\(${escMd(roleLabel)}\\)\\!\n\nกด /help เพื่อดูคำสั่งทั้งหมด หรือเปิด Mini App เพื่อจัดการงาน`,
      replyOpts(ctx)
    );
  });

  // ---- /help ----
  bot.command("help", async (ctx) => {
    await ctx.reply(
      [
        `📖 *คำสั่งทั้งหมด*`,
        ``,
        `/start \\- เริ่มต้นใช้งาน`,
        `/status \\- ดูสถานะงานของตัวเอง`,
        `/mytasks \\- รายการงานที่รับผิดชอบ`,
        `/projects \\- รายการโปรเจกต์ทั้งหมด`,
        `/pending \\- \\(Manager\\) งานรอตรวจและรออนุมัติ`,
        ``,
        `_หรือใช้งานผ่าน Mini App เพื่อประสบการณ์ที่สมบูรณ์กว่า_`,
      ].join("\n"),
      replyOpts(ctx)
    );
  });

  // ---- /mytasks ----
  bot.command("mytasks", async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const user = await strapi.getUserByTelegramId(telegramId).catch(() => null);
    if (!user) {
      await ctx.reply("ไม่พบบัญชีของคุณในระบบครับ กรุณา /start ก่อน");
      return;
    }

    const tasks = await strapi.getTasks({ ownerId: user.id });

    if (tasks.length === 0) {
      await ctx.reply("ไม่มีงานที่รับผิดชอบอยู่ครับ ✅");
      return;
    }

    const lines = tasks
      .slice(0, 10)
      .map((t) => `• *${escMd(t.task_name)}* — ${escMd(TASK_STATUS_LABEL[t.status_task])}`);

    await ctx.reply(
      [`📋 *งานของคุณ \\(${tasks.length} รายการ\\)*`, ``, ...lines].join("\n"),
      replyOpts(ctx)
    );
  });

  // ---- /projects ----
  bot.command("projects", async (ctx) => {
    const projects = await strapi.getProjects();

    if (projects.length === 0) {
      await ctx.reply("ยังไม่มีโปรเจกต์ในระบบครับ");
      return;
    }

    const lines = projects.slice(0, 8).map((p) => {
      const deadline = new Date(p.deadline).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      return `• *${escMd(p.name)}* — ครบ ${escMd(deadline)}`;
    });

    await ctx.reply(
      [`📁 *โปรเจกต์ทั้งหมด \\(${projects.length}\\)*`, ``, ...lines].join("\n"),
      replyOpts(ctx)
    );
  });

  // ---- /pending (Manager only) ----
  bot.command("pending", async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const user = await strapi.getUserByTelegramId(telegramId).catch(() => null);

    if (!user || user.role_level !== "Manager") {
      await ctx.reply("⛔ คำสั่งนี้ใช้ได้เฉพาะหัวหน้าครับ");
      return;
    }

    const [reviewTasks, pickupTasks, pendingUsers] = await Promise.all([
      strapi.getTasks({ status: "Under Review" }),
      strapi.getTasks({ status: "Waiting for Pickup" }),
      strapi.getPendingUsers(),
    ]);

    const lines: string[] = [`🔔 *รายการรออนุมัติ*`, ``];

    if (reviewTasks.length > 0) {
      lines.push(`🔍 *รอตรวจงาน \\(${reviewTasks.length}\\)*`);
      reviewTasks.slice(0, 5).forEach((t) => lines.push(`  • ${escMd(t.task_name)}`));
      lines.push("");
    }

    if (pickupTasks.filter((t) => t.handover_requested_by).length > 0) {
      const pending = pickupTasks.filter((t) => t.handover_requested_by);
      lines.push(`🤝 *รออนุมัติรับงานต่อ \\(${pending.length}\\)*`);
      pending.slice(0, 5).forEach((t) => lines.push(`  • ${escMd(t.task_name)}`));
      lines.push("");
    }

    if (pendingUsers.length > 0) {
      lines.push(`👤 *รออนุมัติบัญชีใหม่ \\(${pendingUsers.length}\\)*`);
      pendingUsers
        .slice(0, 5)
        .forEach((u) => lines.push(`  • ${escMd(u.full_name ?? u.username)}`));
    }

    const total =
      reviewTasks.length +
      pickupTasks.filter((t) => t.handover_requested_by).length +
      pendingUsers.length;

    if (total === 0) {
      lines.push("ไม่มีรายการรออนุมัติครับ ✅");
    }

    await ctx.reply(lines.join("\n"), replyOpts(ctx));
  });

  // ---- /status ----
  bot.command("status", async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const user = await strapi.getUserByTelegramId(telegramId).catch(() => null);
    if (!user) {
      await ctx.reply("ไม่พบบัญชีของคุณครับ กรุณา /start");
      return;
    }

    const tasks = await strapi.getTasks({ ownerId: user.id });
    const inProgress = tasks.filter((t) => t.status_task === "In Progress" && !t.rejection_note).length;
    const underReview = tasks.filter((t) => t.status_task === "Under Review").length;
    const rejected = tasks.filter((t) => t.status_task === "In Progress" && !!t.rejection_note).length;

    await ctx.reply(
      [
        `📊 *สถานะงานของคุณ*`,
        ``,
        `🔨 กำลังทำ: *${inProgress}* รายการ`,
        `🔍 รอตรวจ: *${underReview}* รายการ`,
        `❌ ถูกตีกลับ: *${rejected}* รายการ`,
      ].join("\n"),
      { parse_mode: "MarkdownV2" }
    );
  });
}