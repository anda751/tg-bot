// ============================================================
// src/api/auth-telegram/routes/telegram.ts
// ============================================================

export default {
  routes: [
    {
      method: "POST",
      path: "/auth/telegram",
      handler: "telegram.login",
      config: {
        auth: false, // Public — ไม่ต้อง JWT
        middlewares: [],
        policies: [],
      },
    },
    {
      method: "POST",
      path: "/auth/telegram/register",
      handler: "telegram.register",
      config: {
        auth: false, // Public — ไม่ต้อง JWT
        middlewares: [],
        policies: [],
      },
    },
  ],
};