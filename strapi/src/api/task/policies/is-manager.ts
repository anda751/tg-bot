export default async (policyContext: any) => {
  const user = policyContext.state.user;
  if (!user) return false;
  if (user.role_level !== "Manager") return false;
  if (user.account_status !== "Approved") return false;
  return true;
};
