// ============================================================
// shared/types/index.ts
// แก้ไข: Project interface ใช้ project_name เท่านั้น (ไม่มี name?)
// ============================================================

export type TaskStatus =
  | "In Progress"
  | "Waiting for Pickup"
  | "Under Review"
  | "Done";

export type MembershipStatus = "Requested" | "Member";
export type AccountStatus = "Pending" | "Approved";
export type RoleLevel = "Manager" | "Staff";

export interface StrapiUser {
  id: number;
  username: string;
  full_name?: string;
  telegram_id?: string;
  role_level?: RoleLevel;
  account_status?: AccountStatus;
  createdAt?: string;
  updatedAt?: string;
}

// ✅ แก้ไข: ใช้ project_name ตาม schema จริง ลบ name? ออก
export interface Project {
  id: number;
  documentId: string;
  project_name: string;   // field จริงใน schema
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: number;
  documentId: string;
  task_name: string;
  status_task: TaskStatus;
  handover_reason?: string;
  rejection_note?: string;
  final_report?: string;
  task_image_url?: string;
  handover_at?: string;
  project: Project;
  current_owner?: StrapiUser | null;
  previous_owner?: StrapiUser | null;
  handover_requested_by?: StrapiUser | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMembership {
  id: number;
  documentId: string;
  membershipStatus: MembershipStatus;
  project?: Project;
  member?: StrapiUser;    // field จริง (ไม่ใช่ user)
  createdAt: string;
  updatedAt: string;
}

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

export interface HandoverPayload {
  handoverReason: string;
}

// ✅ แก้ไข: ใช้ rejectionReason ตรงกับ controller
export interface RejectTaskPayload {
  rejectionReason: string;
}

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
