// ============================================================
// shared/types/index.ts
// ใช้ field names ตรงกับ Strapi schema จริงทั้งหมด
// ============================================================

// ------ Enums (ตรงกับ Strapi enum values จริง) ------

export type TaskStatus =
  | "In Progress"
  | "Waiting for Pickup"
  | "Under Review"
  | "Done";

export type MembershipStatus = "Requested" | "Member";
export type AccountStatus = "Pending" | "Approved";
export type RoleLevel = "Manager" | "Staff";

// ------ Core Entities ------

export interface StrapiUser {
  id: number;
  username: string;
  full_name?: string;           // field จริง
  telegram_id?: string;         // field จริง
  role_level?: RoleLevel;       // field จริง
  account_status?: AccountStatus; // field จริง
  createdAt?: string;
  updatedAt?: string;
}

export interface Project {
  id: number;
  documentId: string;
  project_name?: string;        // field จริงใน schema
  name?: string;                // Strapi populate อาจ return ชื่อ display
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: number;
  documentId: string;
  task_name: string;            // field จริง
  status_task: TaskStatus;      // field จริง
  handover_reason?: string;     // field จริง
  rejection_note?: string;      // field จริง
  final_report?: string;        // field จริง
  task_image_url?: string;      // field จริง
  handover_at?: string;         // field จริง
  project: Project;
  current_owner?: StrapiUser | null;      // field จริง
  previous_owner?: StrapiUser | null;     // field จริง
  handover_requested_by?: StrapiUser | null; // field จริง (เพิ่มใน schema แล้ว)
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMembership {
  id: number;
  documentId: string;
  membershipStatus: MembershipStatus; // field จริง (camelCase ใน schema)
  project?: Project;
  member?: StrapiUser;          // field จริง (ไม่ใช่ user)
  createdAt: string;
  updatedAt: string;
}

// ------ API Response Wrappers ------

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

// ------ Request Payloads ------

export interface RejectTaskPayload {
  rejection_note: string;       // field จริง (ส่งไป Strapi controller)
}

export interface HandoverPayload {
  handoverReason: string;       // body key ที่ controller รับ
}

// ------ Bot Notification ------

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
