// ============================================================
// shared/constants/index.ts
// ============================================================

import type { TaskStatus, MembershipStatus, AccountStatus } from "../types";

// ------ Validation Rules (must match Strapi custom controller) ------

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

// ------ Morning Summary Time ------

export const MORNING_SUMMARY_HOUR = 8;
export const MORNING_SUMMARY_MINUTE = 0;

// ------ Task Status Display (Thai labels) ------
// Keys match Strapi enum values exactly

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  "In Progress":        "🔨 กำลังดำเนินงาน",
  "Under Review":       "🔍 รอหัวหน้าตรวจ",
  "Waiting for Pickup": "📬 รอคนรับช่วงต่อ",
  "Done":               "✅ เสร็จสิ้น",
};

export const TASK_STATUS_SHORT: Record<TaskStatus, string> = {
  "In Progress":        "กำลังทำ",
  "Under Review":       "รอตรวจ",
  "Waiting for Pickup": "รอรับต่อ",
  "Done":               "เสร็จ",
};

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  "In Progress":        "#3B82F6",  // blue
  "Under Review":       "#F59E0B",  // amber
  "Waiting for Pickup": "#8B5CF6",  // purple
  "Done":               "#10B981",  // green
};

// ------ Membership Status Labels ------

export const MEMBERSHIP_STATUS_LABEL: Record<MembershipStatus, string> = {
  Requested: "⏳ รอการอนุมัติ",
  Member:    "✅ เป็นสมาชิกแล้ว",
};

// ------ Account Status Labels ------

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  Pending:  "⏳ รออนุมัติบัญชี",
  Approved: "✅ ใช้งานได้",
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

// ------ Strapi API Endpoints ------

export const API = {
  PROJECTS:              "/api/projects",
  TASKS:                 "/api/tasks",
  MEMBERSHIPS:           "/api/project-memberships",
  USERS:                 "/api/users",
  TASKS_SUBMIT:          "/api/tasks/:id/submit",
  TASKS_APPROVE:         "/api/tasks/:id/approve",
  TASKS_REJECT:          "/api/tasks/:id/reject",
  TASKS_HANDOVER:        "/api/tasks/:id/handover",
  TASKS_REQUEST_PICKUP:  "/api/tasks/:id/request-pickup",
  TASKS_CANCEL_PICKUP:   "/api/tasks/:id/cancel-pickup",
  TASKS_APPROVE_PICKUP:  "/api/tasks/:id/approve-pickup",
  SIGNED_URL:            "/api/tasks/:id/signed-url",
} as const;
