// ============================================================
// shared/types/index.ts
// Domain types shared between Bot and Mini App
// Field names MUST match Strapi schema exactly (snake_case, PascalCase enums)
// ============================================================

// ------ Enums (must match Strapi enum values exactly) ------

export type TaskStatus =
  | "In Progress"
  | "Waiting for Pickup"
  | "Under Review"
  | "Done";

// NOTE: "Rejected" is NOT a TaskStatus enum in Strapi.
// When a task is rejected, status resets to "In Progress" + rejection_note is set.

export type MembershipStatus = "Requested" | "Member";
export type AccountStatus = "Pending" | "Approved";
export type RoleLevel = "Manager" | "Staff";

// ------ Core Entities (field names match Strapi response) ------

export interface StrapiUser {
  id: number;
  documentId: string;
  username: string;
  email?: string;
  full_name?: string;
  telegram_id?: string;
  account_status: AccountStatus;
  role_level: RoleLevel;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: number;
  documentId: string;
  name: string;
  deadline: string; // ISO datetime
  tasks?: Task[];
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: number;
  documentId: string;
  task_name: string;
  status_task: TaskStatus;
  final_report?: string;
  rejection_note?: string;
  task_image_url?: string;
  handover_reason?: string;
  handover_at?: string | null;
  project: Project;
  current_owner: StrapiUser | null;
  previous_owner?: StrapiUser | null;
  handover_requested_by?: StrapiUser | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMembership {
  id: number;
  documentId: string;
  membershipStatus: MembershipStatus;
  member: StrapiUser;
  project: Project;
  createdAt: string;
  updatedAt: string;
}

// ------ API Request/Response Shapes ------

export interface CreateTaskPayload {
  task_name: string;
  projectId: string; // documentId of project
}

export interface SubmitTaskPayload {
  taskId: string;
  final_report: string;
  proofImageFile?: File; // browser FileAPI (Mini App only)
}

export interface HandoverPayload {
  taskId: string;
  handover_reason: string;
}

export interface RejectTaskPayload {
  taskId: string;
  rejection_note: string;
}

// ------ Strapi Response Wrappers ------

export interface StrapiListResponse<T> {
  data: T[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface StrapiSingleResponse<T> {
  data: T;
  meta: Record<string, unknown>;
}

export interface StrapiError {
  data: null;
  error: {
    status: number;
    name: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ------ Telegram-specific ------

export interface TelegramInitData {
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  };
  auth_date: number;
  hash: string;
}

// ------ Bot Notification Shapes ------

export type BotNotificationType =
  | "task_created"
  | "task_handover_available"
  | "task_handover_requested"
  | "task_handover_approved"
  | "task_handover_cancelled"
  | "task_submitted_for_review"
  | "task_rejected"
  | "task_done"
  | "deadline_warning"
  | "task_overdue"
  | "morning_summary";

export interface BotNotificationPayload {
  type: BotNotificationType;
  task?: Task;
  project?: Project;
  triggeredBy?: StrapiUser;
  meta?: Record<string, unknown>;
}
