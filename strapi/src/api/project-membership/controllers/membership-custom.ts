// ============================================================
// src/api/project-membership/controllers/membership-custom.ts
// ใช้ enum จริง: membershipStatus "Requested" | "Member"
// ใช้ relation จริง: member (ไม่ใช่ user)
// ============================================================

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::project-membership.project-membership",
  ({ strapi }) => ({

    async approve(ctx: any) {
      const { id } = ctx.params;

      const membership = await strapi.documents(
        "api::project-membership.project-membership"
      ).findOne({
        documentId: id,
        populate: ["member", "project"],  // field จริงชื่อ member
      });

      if (!membership) return ctx.notFound("ไม่พบคำขอเข้าร่วมโปรเจกต์");
      if (membership.membershipStatus !== "Requested") {  // enum จริง
        return ctx.badRequest("คำขอนี้ถูกดำเนินการไปแล้ว");
      }

      const updated = await strapi.documents(
        "api::project-membership.project-membership"
      ).update({
        documentId: id,
        data: { membershipStatus: "Member" } as any,  // enum จริง
        populate: ["member", "project"],
      });

      return ctx.send({ data: updated });
    },
  })
);
