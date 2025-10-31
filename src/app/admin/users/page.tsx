"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiClient, getToken } from "@/lib/api";
import {
  ADMIN_USER_ROLE_FILTERS,
  countLowBalanceUsers,
  filterAdminUsers,
  sortAdminUsersByBalance,
  type AdminUserBalanceSort,
  type AdminUserRoleFilter,
} from "@/lib/adminUsers";
import { isLowCreditBalance } from "@/lib/credits";

type AdminUser = Awaited<ReturnType<typeof apiClient.adminUsers>>["users"][number];

function GrantCreditsForm({
  user,
  onGranted,
}: {
  user: AdminUser;
  onGranted: (updated: AdminUser) => void;
}) {
  const [amount, setAmount] = useState("10");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = Number.parseInt(amount, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a positive credit amount.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const updated = await apiClient.adminGrantCredits(user.id, {
        amount: parsed,
        description: description.trim() || undefined,
      });
      onGranted(updated);
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grant failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="flex flex-wrap items-end gap-2">
      <label className="text-xs">
        Amount
        <input
          className="input mt-1 w-20"
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <label className="min-w-[8rem] flex-1 text-xs">
        Note
        <input
          className="input mt-1 w-full"
          type="text"
          placeholder="Optional"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <button type="submit" className="btn-secondary text-xs" disabled={loading}>
        {loading ? "Granting…" : "Grant"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminUserRoleFilter>("all");
  const [balanceSort, setBalanceSort] = useState<AdminUserBalanceSort>("asc");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiClient
      .me()
      .then((u) => {
        if (u.role !== "admin") router.replace("/app");
        else return apiClient.adminUsers();
      })
      .then((r) => r && setUsers(r.users))
      .catch(() => router.replace("/app"));
  }, [router]);

  const filteredUsers = useMemo(
    () => sortAdminUsersByBalance(filterAdminUsers(users, { query, role: roleFilter }), balanceSort),
    [users, query, roleFilter, balanceSort],
  );
  const lowBalanceCount = useMemo(() => countLowBalanceUsers(users), [users]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Users</h1>
        <Link href="/admin" className="text-sm underline hover:text-skill-ink">
          Back to dashboard
        </Link>
      </div>
      {notice && <p className="mb-4 text-sm text-skill-blue-dark">{notice}</p>}

      <label className="mb-4 block text-sm">
        <span className="sr-only">Search users</span>
        <input
          className="input w-full max-w-md"
          type="search"
          placeholder="Search by email or name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className="mb-4 flex flex-wrap gap-2">
        {ADMIN_USER_ROLE_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`rounded-full border px-3 py-1 text-sm transition ${
              roleFilter === id
                ? "border-skill-blue-dark bg-skill-blue/20 font-semibold"
                : "border-skill-blue/20 bg-white hover:bg-skill-yellow/30"
            }`}
            onClick={() => setRoleFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-skill-muted">
        <p>
          Showing {filteredUsers.length} of {users.length}
          {lowBalanceCount > 0 && (
            <>
              {" "}
              · {lowBalanceCount} low-balance account{lowBalanceCount === 1 ? "" : "s"}
            </>
          )}
        </p>
        <label>
          <span className="sr-only">Sort by balance</span>
          <select
            className="input py-1 text-sm"
            value={balanceSort}
            onChange={(e) => setBalanceSort(e.target.value as AdminUserBalanceSort)}
          >
            <option value="asc">Balance: low → high</option>
            <option value="desc">Balance: high → low</option>
          </select>
        </label>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-skill-blue/20 text-skill-muted">
              <th className="p-2">Email</th>
              <th className="p-2">Name</th>
              <th className="p-2">Role</th>
              <th className="p-2">Credits</th>
              <th className="p-2">Grant credits</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-skill-muted">
                  No users match the current filters.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr
                  key={u.id}
                  className={`border-b border-skill-blue/10 align-top ${
                    isLowCreditBalance(u.balance_credits)
                      ? "border-l-4 border-l-amber-500 bg-amber-50/40"
                      : ""
                  }`}
                >
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">{u.name || "—"}</td>
                  <td className="p-2 capitalize">{u.role}</td>
                  <td className="p-2">{u.balance_credits.toLocaleString()}</td>
                  <td className="p-2">
                    <GrantCreditsForm
                      user={u}
                      onGranted={(updated) => {
                        setUsers((current) =>
                          current.map((row) => (row.id === updated.id ? updated : row)),
                        );
                        setNotice(
                          `Granted credits to ${updated.email} — new balance ${updated.balance_credits.toLocaleString()}.`,
                        );
                      }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
