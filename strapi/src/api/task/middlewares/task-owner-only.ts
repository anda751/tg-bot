// ============================================================
// src/api/task/middlewares/task-owner-only.ts
// ใช้ field จริง: current_owner
// ============================================================

export default () => {
  return async (ctx: any, next: () => Promise<void>) => {
    const user = ctx.state.user;
    const { id } = ctx.params;

    if (!user) return ctx.unauthorized("กรุณาเข้าสู่ระบบ");
    if (user.account_status !== "Approved") {
      return ctx.forbidden("บัญชียังไม่ได้รับการอนุมัติ");
    }

    const task = await strapi.documents("api::task.task").findOne({
      documentId: id,
      populate: ["current_owner"],
    });

    if (!task) return ctx.notFound("ไม่พบงานนี้");
    if ((task.current_owner as any)?.id !== user.id) {
      return ctx.forbidden("คุณไม่ใช่เจ้าของงานนี้");
    }

    await next();
  };
};
