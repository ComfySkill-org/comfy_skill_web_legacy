import { isLowCreditBalance } from "@/lib/credits";

export type AdminUserRoleFilter = "all" | "admin" | "tester" | "user";
export type AdminUserBalanceSort = "asc" | "desc";

export const ADMIN_USER_ROLE_FILTERS: { id: AdminUserRoleFilter; label: string }[] = [
  { id: "all", label: "All roles" },
  { id: "admin", label: "Admin" },
  { id: "tester", label: "Tester" },
  { id: "user", label: "User" },
];

export function filterAdminUsers<
  T extends { email: string; name: string; role: string },
>(users: readonly T[], opts: { query: string; role: AdminUserRoleFilter }): T[] {
  const needle = opts.query.trim().toLocaleLowerCase();

  return users.filter((user) => {
    if (opts.role !== "all" && user.role !== opts.role) return false;
    if (!needle) return true;
    return (
      user.email.toLocaleLowerCase().includes(needle) ||
      user.name.toLocaleLowerCase().includes(needle)
    );
  });
}

export function sortAdminUsersByBalance<T extends { balance_credits: number }>(
  users: readonly T[],
  sort: AdminUserBalanceSort,
): T[] {
  const copy = [...users];
  copy.sort((a, b) =>
    sort === "asc"
      ? a.balance_credits - b.balance_credits
      : b.balance_credits - a.balance_credits,
  );
  return copy;
}

export function countLowBalanceUsers(users: readonly { balance_credits: number }[]): number {
  return users.filter((user) => isLowCreditBalance(user.balance_credits)).length;
}
