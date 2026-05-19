// ============================================================
// bot/src/services/strapi.ts
// แก้ไข: rejectTask ส่ง rejectionReason (ตรงกับ controller)
// ============================================================

import axios, { AxiosInstance, AxiosError } from "axios";
import type {
  Project,
  Task,
  ProjectMembership,
  StrapiUser,
  StrapiListResponse,
  StrapiSingleResponse,
} from "@tma/shared/types";

const TASK_POPULATE = "project,current_owner,previous_owner,handover_requested_by";

class StrapiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.STRAPI_URL ?? "http://localhost:1337",
      headers: {
        Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      timeout: 10_000,
    });

    this.client.interceptors.response.use(
      (res) => res,
      (err: AxiosError) => {
        if (process.env.NODE_ENV !== "production") {
          console.error("[Strapi]", err.response?.status, err.response?.data);
        }
        return Promise.reject(err);
      }
    );
  }

  // ------ Projects ------

  async getProjects(): Promise<Project[]> {
    const res = await this.client.get<StrapiListResponse<Project>>(
      "/api/projects?pagination[pageSize]=100&sort=deadline:asc"
    );
    return res.data.data;
  }

  async getProjectById(documentId: string): Promise<Project> {
    const res = await this.client.get<StrapiSingleResponse<Project>>(
      `/api/projects/${documentId}`
    );
    return res.data.data;
  }

  // ------ Tasks ------

  async getTasks(filters?: {
    projectId?: string;
    status?: string;
    ownerId?: number;
  }): Promise<Task[]> {
    const params = new URLSearchParams();
    params.set("populate", TASK_POPULATE);
    params.set("pagination[pageSize]", "200");
    params.set("sort", "createdAt:desc");

    if (filters?.projectId) {
      params.set("filters[project][documentId][$eq]", filters.projectId);
    }
    if (filters?.status) {
      params.set("filters[status_task][$eq]", filters.status);
    }
    if (filters?.ownerId) {
      params.set("filters[current_owner][id][$eq]", String(filters.ownerId));
    }

    const res = await this.client.get<StrapiListResponse<Task>>(
      `/api/tasks?${params.toString()}`
    );
    return res.data.data;
  }

  async getTaskById(documentId: string): Promise<Task> {
    const res = await this.client.get<StrapiSingleResponse<Task>>(
      `/api/tasks/${documentId}?populate=${TASK_POPULATE}`
    );
    return res.data.data;
  }

  async getOverdueTasks(): Promise<Task[]> {
    const now = new Date().toISOString();
    const params = new URLSearchParams();
    params.set("populate", "project,current_owner");
    params.set("filters[status_task][$ne]", "Done");
    params.set("filters[project][deadline][$lt]", now);
    params.set("pagination[pageSize]", "200");

    const res = await this.client.get<StrapiListResponse<Task>>(
      `/api/tasks?${params.toString()}`
    );
    return res.data.data;
  }

  async getPendingTasks(): Promise<Task[]> {
    const params = new URLSearchParams();
    params.set("populate", "project,current_owner");
    params.set("filters[status_task][$in][0]", "In Progress");
    params.set("filters[status_task][$in][1]", "Waiting for Pickup");
    params.set("pagination[pageSize]", "200");
    params.set("sort", "createdAt:asc");

    const res = await this.client.get<StrapiListResponse<Task>>(
      `/api/tasks?${params.toString()}`
    );
    return res.data.data;
  }

  // ------ Task Actions ------

  async approveTask(documentId: string): Promise<Task> {
    const res = await this.client.post<StrapiSingleResponse<Task>>(
      `/api/tasks/${documentId}/approve`
    );
    return res.data.data;
  }

  // ✅ แก้ไข: เปลี่ยน key จาก rejection_note เป็น rejectionReason ให้ตรงกับ controller
  async rejectTask(documentId: string, reason: string): Promise<Task> {
    const res = await this.client.post<StrapiSingleResponse<Task>>(
      `/api/tasks/${documentId}/reject`,
      { rejectionReason: reason }
    );
    return res.data.data;
  }

  async approvePickup(documentId: string): Promise<Task> {
    const res = await this.client.post<StrapiSingleResponse<Task>>(
      `/api/tasks/${documentId}/approve-pickup`
    );
    return res.data.data;
  }

  async cancelPickup(documentId: string): Promise<Task> {
    const res = await this.client.post<StrapiSingleResponse<Task>>(
      `/api/tasks/${documentId}/cancel-pickup`
    );
    return res.data.data;
  }

  async getSignedUrl(documentId: string): Promise<string> {
    const res = await this.client.get<{ signedUrl: string }>(
      `/api/tasks/${documentId}/signed-url`
    );
    return res.data.signedUrl;
  }

  // ------ Memberships ------

  async getPendingMemberships(): Promise<ProjectMembership[]> {
    const res = await this.client.get<StrapiListResponse<ProjectMembership>>(
      "/api/project-memberships?filters[membershipStatus][$eq]=Requested&populate=member,project"
    );
    return res.data.data;
  }

  async approveMembership(documentId: string): Promise<ProjectMembership> {
    const res = await this.client.post<StrapiSingleResponse<ProjectMembership>>(
      `/api/project-memberships/${documentId}/approve`
    );
    return res.data.data;
  }

  // ------ Users ------

  async getUserByTelegramId(telegramId: string): Promise<StrapiUser | null> {
    const res = await this.client.get<StrapiUser[]>(
      `/api/users?filters[telegram_id][$eq]=${telegramId}`
    );
    return res.data[0] ?? null;
  }

  async getManagers(): Promise<StrapiUser[]> {
    const res = await this.client.get<StrapiUser[]>(
      "/api/users?filters[role_level][$eq]=Manager&filters[account_status][$eq]=Approved"
    );
    return res.data;
  }

  async getPendingUsers(): Promise<StrapiUser[]> {
    const res = await this.client.get<StrapiUser[]>(
      "/api/users?filters[account_status][$eq]=Pending"
    );
    return res.data;
  }

  async approveUser(userId: number): Promise<StrapiUser> {
    const res = await this.client.put<StrapiUser>(
      `/api/users/${userId}`,
      { account_status: "Approved" }
    );
    return res.data;
  }
}

export const strapi = new StrapiService();
