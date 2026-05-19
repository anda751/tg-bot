// ============================================================
// bot/src/webhooks/strapi.ts
// Receives lifecycle webhooks FROM Strapi → triggers bot notifications
// POST /strapi-webhook  ← Strapi sends on every entry.create / entry.update
// ============================================================

import type { Request, Response } from "express";
import { NotificationService } from "../services/notifications";
import { strapi } from "../services/strapi";
import type { Task, StrapiUser } from "@tma/shared/types";

interface StrapiWebhookBody {
  event: string;  // "entry.create" | "entry.update" | "entry.delete"
  model: string;  // "task" | "project" | "project-membership" | "plugin::users-permissions.user"
  uid: string;
  entry: Record<string, unknown> & {
    documentId?: string;
    id?: number;
    // Raw Strapi field names from webhook payload
    status_task?: string;
    account_status?: string;
    handover_requested_by?: unknown;
    rejection_note?: string | null;
  };
}

export function createStrapiWebhookHandler(notify: NotificationService) {
  return async (req: Request, res: Response) => {
    // Validate secret header
    const secret = req.headers["x-strapi-webhook-secret"];
    if (secret !== process.env.BOT_WEBHOOK_SECRET) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const body = req.body as StrapiWebhookBody;
    const { event, model, entry } = body;

    console.log(`[Webhook] ${event} on ${model}`, entry?.documentId ?? entry?.id);

    try {
      // ---- Task events ----
      if (model === "task" && entry?.documentId) {
        const docId = String(entry.documentId);

        if (event === "entry.create") {
          const task = await strapi.getTaskById(docId);
          await notify.announceTaskCreated(task);
          return res.status(200).json({ ok: true });
        }

        if (event === "entry.update") {
          const task = await strapi.getTaskById(docId);
          await handleTaskUpdate(task, entry, notify);
          return res.status(200).json({ ok: true });
        }
      }

      // ---- User account approval ----
      if (
        (model === "plugin::users-permissions.user" || model === "up_user") &&
        entry?.id &&
        event === "entry.update" &&
        entry.account_status === "Approved"
      ) {
        // Re-fetch full user to get telegram_id + full_name
        const user = await strapi
          .getUserByTelegramId(String((entry as any).telegram_id ?? ""))
          .catch(() => null);
        if (user) {
          await notify.notifyStaffAccountApproved(user);
        }
      }

      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[Webhook] Handler error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  };
}

async function handleTaskUpdate(
  task: Task,
  rawEntry: StrapiWebhookBody["entry"],
  notify: NotificationService
) {
  const status = task.status_task;

  switch (status) {
    case "Under Review":
      // Staff submitted → DM manager(s) only, never group
      await notify.notifyManagerTaskSubmitted(task);
      break;

    case "Waiting for Pickup":
      if (task.handover_requested_by) {
        // Someone pressed request-pickup → DM manager(s)
        await notify.notifyManagerHandoverRequested(task, task.handover_requested_by);
      } else {
        // Owner triggered handover, no requester yet → group announcement
        await notify.announceHandoverAvailable(task);
      }
      break;

    case "Done":
      // Manager approved → group announcement (text only, no photo)
      await notify.announceTaskDone(task);
      break;

    case "In Progress":
      // Two scenarios land here:
      // A) Manager rejected task → rejection_note is set → DM staff privately
      // B) handover_requested_by was cleared (timeout/cancel) → group announcement
      // C) handover approved, new owner set → no announcement needed

      if (task.rejection_note && task.current_owner) {
        // Scenario A — rejection: DM staff, never group
        await notify.notifyStaffTaskRejected(task);
      } else if (!task.handover_requested_by && rawEntry.handover_requested_by === null) {
        // Scenario B — handover cancelled/timed-out: group announcement
        await notify.announceHandoverCancelled(task);
      }
      // Scenario C (approve-pickup) → silent, Mini App handles the UX
      break;
  }
}
