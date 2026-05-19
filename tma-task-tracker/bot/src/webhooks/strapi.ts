// ============================================================
// bot/src/webhooks/strapi.ts
// Receives lifecycle webhooks FROM Strapi → triggers bot notifications
// ============================================================

import type { Request, Response } from "express";
import { NotificationService } from "../services/notifications";
import { strapi } from "../services/strapi";
import type { Task, StrapiUser } from "@tma/shared/types";

interface StrapiWebhookBody {
  event: string;
  model: string;
  uid: string;
  entry: Record<string, unknown> & {
    documentId?: string;
    id?: number;
    status_task?: string;
    account_status?: string;
    telegram_id?: string;
    handover_requested_by?: unknown;
    rejection_note?: string | null;
  };
}

export function createStrapiWebhookHandler(notify: NotificationService) {
  return async (req: Request, res: Response) => {
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
          res.status(200).json({ ok: true });
          return;
        }

        if (event === "entry.update") {
          const task = await strapi.getTaskById(docId);
          await handleTaskUpdate(task, entry, notify);
          res.status(200).json({ ok: true });
          return;
        }
      }

      // ---- User account approved ----
      if (
        (model === "plugin::users-permissions.user" || model === "up_user") &&
        entry?.id &&
        event === "entry.update" &&
        entry.account_status === "Approved" &&
        entry.telegram_id
      ) {
        const user = await strapi
          .getUserByTelegramId(String(entry.telegram_id))
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
  switch (task.status_task) {

    case "Under Review":
      // Staff ส่งงาน → DM หัวหน้าเท่านั้น ห้ามประกาศกลุ่ม
      await notify.notifyManagerTaskSubmitted(task);
      break;

    case "Waiting for Pickup":
      if (task.handover_requested_by?.id) {
        // มีคนกด request-pickup → DM หัวหน้า
        await notify.notifyManagerHandoverRequested(task, task.handover_requested_by);
      } else {
        // เจ้าของกด handover ยังไม่มีคนขอ → ประกาศกลุ่ม
        await notify.announceHandoverAvailable(task);
      }
      break;

    case "Done":
      // หัวหน้าอนุมัติปิดงาน → ประกาศกลุ่ม (ข้อความเท่านั้น ไม่มีรูป)
      await notify.announceTaskDone(task);
      break;

    case "In Progress":
      // 3 กรณี:
      // A) rejection_note มีค่า + current_owner มี → หัวหน้าตีกลับ → DM ลูกน้อง
      // B) handover_requested_by ถูกล้าง (rawEntry = null) → cancel/timeout → ประกาศกลุ่ม
      // C) approve-pickup (new owner set) → ไม่ต้องแจ้ง

      if (task.rejection_note && task.current_owner) {
        // Scenario A: ตีกลับ → DM ลูกน้องเท่านั้น ห้ามประกาศกลุ่ม
        await notify.notifyStaffTaskRejected(task);
      } else if (
        rawEntry.handover_requested_by === null &&
        !task.handover_requested_by
      ) {
        // Scenario B: ยกเลิก/timeout → ประกาศกลุ่ม
        await notify.announceHandoverCancelled(task);
      }
      // Scenario C: approve-pickup → silent
      break;
  }
}
