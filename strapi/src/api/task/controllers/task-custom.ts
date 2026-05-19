// ============================================================
// src/api/task/controllers/task-custom.ts
//
// Schema relations ที่ populate ได้:
//   project, current_owner, previous_owner, handover_requested_by
// ============================================================

import { createClient } from "@supabase/supabase-js";

const STORAGE_BUCKET = "task-proofs";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function validateText(value: string, minLen = 5): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "ห้ามเว้นว่าง";
  if (trimmed.length < minLen) return `ต้องมีอย่างน้อย ${minLen} ตัวอักษร`;
  if (!/[a-zA-Zก-๙]/.test(trimmed)) return "ต้องมีตัวอักษรภาษาไทยหรืออังกฤษ";
  return null;
}

// cast ครั้งเดียวตรงนี้ — ทุก field ใน schema เข้าถึงได้เลยโดยไม่มี TS error
async function findTask(documentId: string, populate: string[] = []) {
  return (strapi.documents("api::task.task") as any).findOne({
    documentId,
    populate,
  }) as Promise<Record<string, any> | null>;
}

async function updateTask(
  documentId: string,
  data: Record<string, any>,
  populate: string[] = []
) {
  return (strapi.documents("api::task.task") as any).update({
    documentId,
    data,
    populate,
  });
}

export default {

  // ================================================================
  // POST /api/tasks/:id/submit
  // ลูกน้องส่งงานพร้อมรูปหลักฐาน → status: "Under Review"
  // ================================================================
  async submit(ctx: any) {
    const { id } = ctx.params;
    const user = ctx.state.user;

    const task = await findTask(id, ["current_owner", "project"]);
    if (!task) return ctx.notFound("ไม่พบงานนี้");

    if (task.status_task !== "In Progress") {
      return ctx.badRequest("งานนี้ไม่อยู่ในสถานะที่ส่งได้");
    }
    if (task.current_owner?.id !== user.id) {
      return ctx.forbidden("คุณไม่ใช่เจ้าของงานนี้");
    }

    const { files, body } = ctx.request as any;
    const reportText: string = body?.reportText ?? "";

    const reportErr = validateText(reportText);
    if (reportErr) return ctx.badRequest(`รายงานผล: ${reportErr}`);

    if (!files?.proofImage) {
      return ctx.badRequest("กรุณาแนบรูปภาพหลักฐาน");
    }

    const file = files.proofImage;
    const ext = file.name?.split(".").pop() ?? "jpg";
    const storagePath = `tasks/${id}/${Date.now()}.${ext}`;

    const supabase = getSupabase();
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file.data, { contentType: file.type, upsert: true });

    if (uploadError) {
      strapi.log.error("[submit] Supabase upload error:", uploadError);
      return ctx.badRequest("อัพโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่");
    }

    const updated = await updateTask(
      id,
      {
        status_task: "Under Review",
        final_report: reportText.trim(),
        task_image_url: storagePath,
        rejection_note: null,
      },
      ["current_owner", "project"]
    );

    return ctx.send({ data: updated });
  },

  // ================================================================
  // POST /api/tasks/:id/approve
  // หัวหน้าอนุมัติปิดงาน → status: "Done"
  // ================================================================
  async approve(ctx: any) {
    const { id } = ctx.params;

    const task = await findTask(id);
    if (!task) return ctx.notFound("ไม่พบงานนี้");
    if (task.status_task !== "Under Review") {
      return ctx.badRequest("งานนี้ไม่ได้รอการตรวจอยู่");
    }

    const updated = await updateTask(
      id,
      { status_task: "Done" },
      ["current_owner", "project"]
    );

    return ctx.send({ data: updated });
  },

  // ================================================================
  // POST /api/tasks/:id/reject
  // หัวหน้าตีกลับงาน → rejection_note + status: "In Progress"
  // ================================================================
  async reject(ctx: any) {
    const { id } = ctx.params;
    const { rejectionReason } = ctx.request.body as { rejectionReason: string };

    const reasonErr = validateText(rejectionReason, 5);
    if (reasonErr) return ctx.badRequest(`เหตุผล: ${reasonErr}`);

    const task = await findTask(id);
    if (!task) return ctx.notFound("ไม่พบงานนี้");
    if (task.status_task !== "Under Review") {
      return ctx.badRequest("งานนี้ไม่ได้รอการตรวจอยู่");
    }

    const updated = await updateTask(
      id,
      {
        status_task: "In Progress",
        rejection_note: rejectionReason.trim(),
      },
      ["current_owner", "project"]
    );

    return ctx.send({ data: updated });
  },

  // ================================================================
  // POST /api/tasks/:id/handover
  // เจ้าของงานส่งไม้ต่อ → status: "Waiting for Pickup"
  // ================================================================
  async handover(ctx: any) {
    const { id } = ctx.params;
    const { handoverReason } = ctx.request.body as { handoverReason: string };
    const user = ctx.state.user;

    const reasonErr = validateText(handoverReason, 5);
    if (reasonErr) return ctx.badRequest(`เหตุผล: ${reasonErr}`);

    const task = await findTask(id, ["current_owner"]);
    if (!task) return ctx.notFound("ไม่พบงานนี้");
    if (task.status_task !== "In Progress") {
      return ctx.badRequest("ส่งไม้ต่อได้เฉพาะงานที่กำลังดำเนินอยู่");
    }
    if (task.current_owner?.id !== user.id) {
      return ctx.forbidden("คุณไม่ใช่เจ้าของงานนี้");
    }

    const updated = await updateTask(
      id,
      {
        status_task: "Waiting for Pickup",
        handover_reason: handoverReason.trim(),
        previous_owner: user.id,
        current_owner: null,
        handover_requested_by: null,
        handover_at: null,
      },
      ["project"]
    );

    return ctx.send({ data: updated });
  },

  // ================================================================
  // POST /api/tasks/:id/request-pickup
  // ลูกน้องขอรับงานต่อ → handover_requested_by + handover_at
  // ================================================================
  async requestPickup(ctx: any) {
    const { id } = ctx.params;
    const user = ctx.state.user;

    // handover_requested_by อยู่ใน schema แล้ว → populate ได้ปกติ
    const task = await findTask(id, ["handover_requested_by", "project"]);
    if (!task) return ctx.notFound("ไม่พบงานนี้");

    if (task.status_task !== "Waiting for Pickup") {
      return ctx.badRequest("งานนี้ไม่ได้รอคนรับช่วงต่อ");
    }
    if (task.handover_requested_by?.id) {
      return ctx.badRequest("มีคนขอรับงานนี้แล้ว กรุณารอหัวหน้าอนุมัติ");
    }

    // ตรวจสอบว่าเป็นสมาชิกโปรเจกต์นี้
    const membership = await strapi.db
      .query("api::project-membership.project-membership")
      .findOne({
        where: {
          member: { id: user.id },
          project: { id: task.project?.id },
          membershipStatus: "Member",
        },
      });

    if (!membership) {
      return ctx.forbidden("คุณไม่ได้เป็นสมาชิกโปรเจกต์นี้");
    }

    const updated = await updateTask(
      id,
      {
        handover_requested_by: user.id,
        handover_at: new Date().toISOString(),
      },
      ["project", "handover_requested_by"]
    );

    return ctx.send({ data: updated });
  },

  // ================================================================
  // POST /api/tasks/:id/cancel-pickup
  // ยกเลิกคำขอรับงาน (ตัวเอง / หัวหน้า / Edge Function timeout)
  // ================================================================
  async cancelPickup(ctx: any) {
    const { id } = ctx.params;
    const user = ctx.state.user;

    const task = await findTask(id, ["handover_requested_by"]);
    if (!task) return ctx.notFound("ไม่พบงานนี้");

    const requesterId = task.handover_requested_by?.id;
    const isRequester = requesterId === user.id;
    const isManager = user.role_level === "Manager";
    const isServiceRole = !!(ctx.state as any).isAuthenticatedViaApiToken;

    if (!isRequester && !isManager && !isServiceRole) {
      return ctx.forbidden("ไม่มีสิทธิ์ยกเลิกคำขอนี้");
    }

    const updated = await updateTask(
      id,
      {
        handover_requested_by: null,
        handover_at: null,
      },
      ["project"]
    );

    return ctx.send({ data: updated });
  },

  // ================================================================
  // POST /api/tasks/:id/approve-pickup
  // หัวหน้าอนุมัติรับไม้ต่อ → current_owner ใหม่ + status: "In Progress"
  // ================================================================
  async approvePickup(ctx: any) {
    const { id } = ctx.params;

    const task = await findTask(id, ["handover_requested_by", "project"]);
    if (!task) return ctx.notFound("ไม่พบงานนี้");

    if (task.status_task !== "Waiting for Pickup") {
      return ctx.badRequest("งานนี้ไม่ได้รอรับช่วงต่อ");
    }
    if (!task.handover_requested_by?.id) {
      return ctx.badRequest("ยังไม่มีคนขอรับงานนี้");
    }

    const newOwnerId = task.handover_requested_by.id;

    const updated = await updateTask(
      id,
      {
        status_task: "In Progress",
        current_owner: newOwnerId,
        handover_requested_by: null,
        handover_at: null,
        handover_reason: null,
      },
      ["current_owner", "project"]
    );

    return ctx.send({ data: updated });
  },

  // ================================================================
  // GET /api/tasks/:id/signed-url
  // หัวหน้าขอ Signed URL ดูรูปหลักฐาน (หมดอายุใน 5 นาที)
  // ================================================================
  async signedUrl(ctx: any) {
    const { id } = ctx.params;

    const task = await findTask(id);
    if (!task) return ctx.notFound("ไม่พบงานนี้");
    if (!task.task_image_url) {
      return ctx.badRequest("งานนี้ยังไม่มีรูปหลักฐาน");
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(task.task_image_url as string, 300);

    if (error || !data?.signedUrl) {
      strapi.log.error("[signedUrl] Error:", error);
      return ctx.internalServerError("สร้าง Signed URL ไม่สำเร็จ");
    }

    return ctx.send({ signedUrl: data.signedUrl });
  },
};