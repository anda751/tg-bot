// ============================================================
// shared/constants/index.ts
// ใช้ key ตรงกับ Strapi enum จริง: "In Progress", "Done" ฯลฯ
// ============================================================

import type { TaskStatus, MembershipStatus, AccountStatus } from "../types";

// ------ Validation ------

export const VALIDATION = {
  TASK_NAME_MIN_LENGTH: 5,
  REPORT_TEXT_MIN_LENGTH: 5,
  REJECTION_REASON_MIN_LENGTH: 5,
  HANDOVER_REASON_MIN_LENGTH: 5,
  MEANINGFUL_TEXT_REGEX: /[a-zA-Zก-๙]/,
} as const;

// ------ Handover Timeout ------

export const HANDOVER_TIMEOUT_MINUTES = 30;
export const HANDOVER_TIMEOUT_MS = HANDOVER_TIMEOUT_MINUTES * 60 * 1000;

// ------ Morning Summary ------

export const MORNING_SUMMARY_HOUR = 8;
export const MORNING_SUMMARY_MINUTE = 0;

// ------ Task Status Labels (key = Strapi enum value จริง) ------

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  "In Progress":        "🔵 กำลังดำเนินการ",
  "Waiting for Pickup": "🟣 รอคนรับช่วงต่อ",
  "Under Review":       "🟡 รอหัวหน้าตรวจ",
  "Done":               "✅ เสร็จสิ้น",
};

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  "In Progress":        "#3B82F6",
  "Waiting for Pickup": "#8B5CF6",
  "Under Review":       "#F59E0B",
  "Done":               "#10B981",
};

// ------ Membership Status Labels ------

export const MEMBERSHIP_STATUS_LABEL: Record<MembershipStatus, string> = {
  "Requested": "⏳ รอการอนุมัติ",
  "Member":    "✅ เป็นสมาชิกแล้ว",
};

// ------ Account Status Labels ------

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  "Pending":  "⏳ รออนุมัติบัญชี",
  "Approved": "✅ ใช้งานได้",
};

// ------ Supabase Storage ------

export const STORAGE_BUCKET = "task-proofs";

// ------ Bot Commands ------

export const BOT_COMMANDS = {
  START:    "/start",
  HELP:     "/help",
  STATUS:   "/status",
  PROJECTS: "/projects",
  MY_TASKS: "/mytasks",
  PENDING:  "/pending",
} as const;
