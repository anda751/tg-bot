// ============================================================
// bot/src/utils/messages.ts
// แก้ไข: project.name → project.project_name ทุกจุด
// ============================================================

import type { Task, Project, StrapiUser } from "@tma/shared/types";
import { TASK_STATUS_LABEL } from "@tma/shared/constants";

export function escMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

function bold(text: string) {
  return `*${escMd(text)}*`;
}

// ✅ helper: แสดงชื่อโปรเจกต์ (field จริงคือ project_name)
function projectName(project: Project | undefined | null): string {
  return project?.project_name ?? "ไม่ระบุโปรเจกต์";
}

function displayName(user: StrapiUser): string {
  return user.full_name ?? user.username;
}

function ownerHandle(user: StrapiUser | null | undefined): string {
  if (!user) return "\\(ไม่มีคนรับ\\)";
  return `@${escMd(user.username)}`;
}

function taskLine(task: Task): string {
  return `• ${bold(task.task_name)} — ${ownerHandle(task.current_owner)}`;
}

// ------ Group Announcements ------

export function msgTaskCreated(task: Task): string {
  return [
    `📋 ${bold("งานใหม่ถูกสร้างแล้ว")}`,
    ``,
    `โปรเจกต์: ${bold(projectName(task.project))}`,
    `ชื่องาน: ${bold(task.task_name)}`,
    `ผู้รับผิดชอบ: ${ownerHandle(task.current_owner)}`,
    `สถานะ: ${escMd(TASK_STATUS_LABEL["In Progress"])}`,
  ].join("\n");
}

export function msgTaskDone(task: Task): string {
  return [
    `✅ ${bold("ปิดงานเรียบร้อยแล้ว")}`,
    ``,
    `โปรเจกต์: ${bold(projectName(task.project))}`,
    `ชื่องาน: ${bold(task.task_name)}`,
    `ดำเนินการโดย: ${ownerHandle(task.current_owner)}`,
    ``,
    `_หัวหน้าอนุมัติปิดงานแล้ว_`,
  ].join("\n");
}

export function msgTaskHandoverAvailable(task: Task): string {
  const prev = task.previous_owner;
  return [
    `📬 ${bold("มีงานรอรับช่วงต่อ")}`,
    ``,
    `โปรเจกต์: ${bold(projectName(task.project))}`,
    `ชื่องาน: ${bold(task.task_name)}`,
    `ส่งต่อโดย: ${prev ? `@${escMd(prev.username)}` : "\\(ไม่ระบุ\\)"}`,
    task.handover_reason ? `เหตุผล: ${escMd(task.handover_reason)}` : "",
    ``,
    `_กด \\[รับงานนี้ต่อ\\] ใน Mini App เพื่อรับช่วงต่อ_`,
  ].filter(Boolean).join("\n");
}

export function msgHandoverCancelled(task: Task, byUser?: StrapiUser): string {
  const who = byUser
    ? `โดย @${escMd(byUser.username)}`
    : "อัตโนมัติ \\(หมดเวลา 30 นาที\\)";
  return [
    `🔄 ${bold("ยกเลิกคำขอรับงานแล้ว")}`,
    ``,
    `ชื่องาน: ${bold(task.task_name)}`,
    `ยกเลิก: ${who}`,
    ``,
    `_งานกลับสู่ตลาดรอรับช่วงต่ออีกครั้ง_`,
  ].join("\n");
}

export function msgDeadlineWarning(project: Project, hoursLeft: number): string {
  return [
    `⚠️ ${bold("ใกล้ถึงเดดไลน์")}`,
    ``,
    `โปรเจกต์: ${bold(projectName(project))}`,
    `เหลือเวลา: ${bold(`${hoursLeft} ชั่วโมง`)}`,
    ``,
    `_รีบเคลียร์งานค้างให้เสร็จก่อนหมดเวลา_`,
  ].join("\n");
}

export function msgTaskOverdue(task: Task): string {
  return [
    `🚨 ${bold("งานเลยกำหนด\\!")}`,
    ``,
    `โปรเจกต์: ${bold(projectName(task.project))}`,
    `ชื่องาน: ${bold(task.task_name)}`,
    `ผู้รับผิดชอบปัจจุบัน: ${ownerHandle(task.current_owner)}`,
    `สถานะ: ${escMd(TASK_STATUS_LABEL[task.status_task])}`,
  ].join("\n");
}

export function msgMorningSummary(tasks: Task[]): string {
  if (tasks.length === 0) {
    return [
      `☀️ ${bold("สรุปยอดประจำวัน — ไม่มีงานค้าง")}`,
      ``,
      `ทุกงานเรียบร้อยดี\\! มีวันที่ดีนะครับ 🎉`,
    ].join("\n");
  }

  const inProgressNormal  = tasks.filter(t => t.status_task === "In Progress" && !t.rejection_note);
  const inProgressRejected = tasks.filter(t => t.status_task === "In Progress" && !!t.rejection_note);
  const waitingPickup     = tasks.filter(t => t.status_task === "Waiting for Pickup");

  const lines: string[] = [`☀️ ${bold("สรุปงานค้างประจำวัน")}`, ``];

  if (inProgressNormal.length > 0) {
    lines.push(`🔨 ${bold(`กำลังดำเนินงาน \\(${inProgressNormal.length}\\)`)}`);
    inProgressNormal.forEach(t => lines.push(taskLine(t)));
    lines.push("");
  }
  if (waitingPickup.length > 0) {
    lines.push(`📬 ${bold(`รอคนรับช่วงต่อ \\(${waitingPickup.length}\\)`)}`);
    waitingPickup.forEach(t => lines.push(taskLine(t)));
    lines.push("");
  }
  if (inProgressRejected.length > 0) {
    lines.push(`❌ ${bold(`ถูกตีกลับ — รอแก้ไข \\(${inProgressRejected.length}\\)`)}`);
    inProgressRejected.forEach(t => lines.push(taskLine(t)));
  }

  return lines.join("\n");
}

// ------ Direct Messages ------

export function dmTaskSubmittedForReview(task: Task): string {
  return [
    `🔔 ${bold("มีงานส่งตรวจใหม่")}`,
    ``,
    `โปรเจกต์: ${bold(projectName(task.project))}`,
    `ชื่องาน: ${bold(task.task_name)}`,
    `ส่งโดย: ${ownerHandle(task.current_owner)}`,
    task.final_report ? `\nรายงาน: _${escMd(task.final_report)}_` : "",
    ``,
    `กรุณาตรวจสอบใน Manager Dashboard`,
  ].filter(l => l !== undefined).join("\n");
}

export function dmTaskRejected(task: Task): string {
  return [
    `📩 ${bold("งานของคุณถูกตีกลับ")}`,
    ``,
    `ชื่องาน: ${bold(task.task_name)}`,
    ``,
    `เหตุผลจากหัวหน้า:`,
    `_${escMd(task.rejection_note ?? "ไม่ระบุ")}_`,
    ``,
    `กรุณาแก้ไขงานและส่งใหม่อีกครั้งใน Mini App`,
  ].join("\n");
}

export function dmHandoverRequested(task: Task, requester: StrapiUser): string {
  return [
    `🤝 ${bold("คำขอรับงานช่วงต่อ")}`,
    ``,
    `ชื่องาน: ${bold(task.task_name)}`,
    `โปรเจกต์: ${bold(projectName(task.project))}`,
    `ผู้ขอรับ: @${escMd(requester.username)}${requester.full_name ? ` \\(${escMd(requester.full_name)}\\)` : ""}`,
    ``,
    `กรุณากด ${bold("[อนุมัติ]")} หรือ ${bold("[ปฏิเสธ]")} ใน Mini App ภายใน 30 นาที`,
    `_ระบบจะยกเลิกคำขออัตโนมัติหากไม่มีการตอบสนอง_`,
  ].join("\n");
}

export function dmAccountApproved(user?: StrapiUser): string {
  const name = user?.full_name ? ` คุณ${escMd(user.full_name)}` : "";
  return [
    `🎉 ${bold(`บัญชี${name}ได้รับการอนุมัติแล้ว`)}`,
    ``,
    `คุณสามารถเข้าใช้งาน Mini App และขอเข้าร่วมโปรเจกต์ได้แล้วครับ`,
  ].join("\n");
}
