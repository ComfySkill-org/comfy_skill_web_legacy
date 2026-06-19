"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient, getToken } from "@/lib/api";

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<
    Awaited<ReturnType<typeof apiClient.adminUsers>>["users"]
  >([]);

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Users</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-skill-blue/20 text-skill-muted">
              <th className="p-2">Email</th>
              <th className="p-2">Role</th>
              <th className="p-2">Credits</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-skill-blue/10">
                <td className="p-2">{u.email}</td>
                <td className="p-2 capitalize">{u.role}</td>
                <td className="p-2">{u.balance_credits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
