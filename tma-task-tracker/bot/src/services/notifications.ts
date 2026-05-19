// ============================================================
// bot/src/services/notifications.ts
// Central service: sends announcements to group or DMs to users
// ============================================================

import { Bot } from "grammy";
import type { Task, Project, StrapiUser } from "@tma/shared/types";
import {
  msgTaskCreated,
  msgTaskDone,
  msgTaskHandoverAvailable,
  msgHandoverCancelled,
  msgDeadlineWarning,
  msgTaskOverdue,
  msgMorningSummary,
  dmTaskSubmittedForReview,
  dmTaskRejected,
  dmHandoverRequested,
  dmAccountApproved,
} from "../utils/messages";
import { strapi } from "./strapi";

const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID!;

export class NotificationService {
  constructor(private bot: Bot) {}

  // ------ Group Announcements ------

  async announceTaskCreated(task: Task) {
    await this.sendGroup(msgTaskCreated(task));
  }

  async announceTaskDone(task: Task) {
    await this.sendGroup(msgTaskDone(task));
  }

  async announceHandoverAvailable(task: Task) {
    await this.sendGroup(msgTaskHandoverAvailable(task));
  }

  async announceHandoverCancelled(task: Task, byUser?: StrapiUser) {
    await this.sendGroup(msgHandoverCancelled(task, byUser));
  }

  async announceDeadlineWarning(project: Project, hoursLeft: number) {
    await this.sendGroup(msgDeadlineWarning(project, hoursLeft));
  }

  async announceTaskOverdue(task: Task) {
    await this.sendGroup(msgTaskOverdue(task));
  }

  async sendMorningSummary() {
    const tasks = await strapi.getPendingTasks();
    await this.sendGroup(msgMorningSummary(tasks));
  }

  // ------ Direct Messages ------

  /** Notify all Managers when staff submits a task for review */
  async notifyManagerTaskSubmitted(task: Task) {
    const managers = await strapi.getManagers();
    const text = dmTaskSubmittedForReview(task);
    for (const m of managers) {
      if (m.telegram_id) {
        await this.sendDM(m.telegram_id, text);
      }
    }
  }

  /** Notify all Managers when someone requests a handover pickup */
  async notifyManagerHandoverRequested(task: Task, requester: StrapiUser) {
    const managers = await strapi.getManagers();
    const text = dmHandoverRequested(task, requester);
    for (const m of managers) {
      if (m.telegram_id) {
        await this.sendDM(m.telegram_id, text);
      }
    }
  }

  /** Notify staff privately when their task is rejected — DM only, never group */
  async notifyStaffTaskRejected(task: Task) {
    const owner = task.current_owner;
    if (!owner?.telegram_id) return;
    await this.sendDM(owner.telegram_id, dmTaskRejected(task));
  }

  /** Notify staff when their account is approved */
  async notifyStaffAccountApproved(user: StrapiUser) {
    if (!user.telegram_id) return;
    await this.sendDM(user.telegram_id, dmAccountApproved());
  }

  // ------ Helpers ------

  private async sendGroup(text: string) {
    try {
      await this.bot.api.sendMessage(GROUP_CHAT_ID, text, {
        parse_mode: "MarkdownV2",
      });
    } catch (err) {
      console.error("[Bot] sendGroup error:", err);
    }
  }

  private async sendDM(telegramId: string, text: string) {
    try {
      await this.bot.api.sendMessage(telegramId, text, {
        parse_mode: "MarkdownV2",
      });
    } catch (err) {
      // User may have blocked bot — log and continue
      console.error(`[Bot] sendDM to ${telegramId} error:`, err);
    }
  }
}
