"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient, clearAuth, getToken, isFirebaseEnabled, type User } from "@/lib/api";
import { getFirebaseAuth, subscribeToAuthToken } from "@/lib/firebase";

export function SiteHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const loadUser = () =>
      apiClient
        .me()
        .then(setUser)
        .catch(() => {
          void clearAuth();
          setUser(null);
        });

    if (isFirebaseEnabled()) {
      const unsub = subscribeToAuthToken((token) => {
        if (token) void loadUser();
        else setUser(null);
      });
      if (getFirebaseAuth()?.currentUser) void loadUser();
      return unsub;
    }

    if (!getToken()) return;
    void loadUser();
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
                  void clearAuth().then(() => {
                    setUser(null);
                    window.location.href = "/";
                  });
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
