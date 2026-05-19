// ============================================================
// src/api/task/policies/is-manager.ts
// ใช้ field จริง: role_level, account_status (enum: "Manager", "Approved")
// ============================================================

export default async (policyContext: any) => {
  const user = policyContext.state.user;
  if (!user) return false;
  if (user.role_level !== "Manager") return false;
  if (user.account_status !== "Approved") return false;
  return true;
};
