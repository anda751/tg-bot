// ============================================================
// src/api/project-membership/routes/custom.ts
// ============================================================

export default {
  routes: [
    {
      method: "POST",
      path: "/project-memberships/:id/approve",
      handler: "membership-custom.approve",
      config: {
        policies: ["api::task.is-manager"],
        middlewares: [],
      },
    },
  ],
};
