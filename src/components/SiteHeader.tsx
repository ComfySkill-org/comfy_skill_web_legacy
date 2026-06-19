"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient, clearToken, getToken, type User } from "@/lib/api";

export function SiteHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!getToken()) return;
    apiClient
      .me()
      .then(setUser)
      .catch(() => clearToken());
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-skill-blue/20 bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-skill-ink">
          Comfy<span className="text-skill-blue-dark">Skill</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/features" className="text-skill-muted hover:text-skill-ink">
            Features
          </Link>
          <Link href="/pricing" className="text-skill-muted hover:text-skill-ink">
            Pricing
          </Link>
          {user ? (
            <>
              <Link href="/app" className="text-skill-muted hover:text-skill-ink">
                Create
              </Link>
              {user.role === "admin" && (
                <Link href="/admin" className="text-skill-muted hover:text-skill-ink">
                  Admin
                </Link>
              )}
              <span className="rounded-full bg-skill-yellow px-3 py-1 text-xs font-medium">
                {user.balance_credits} credits
              </span>
              <button
                type="button"
                className="text-skill-muted hover:text-skill-ink"
                onClick={() => {
                  clearToken();
                  setUser(null);
                  window.location.href = "/";
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <Link href="/login" className="btn-primary text-xs">
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
