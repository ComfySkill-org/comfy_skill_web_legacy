"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiClient, clearAuth, getToken, isFirebaseEnabled, type User } from "@/lib/api";
import { isLowCreditBalance } from "@/lib/credits";
import { getFirebaseAuth, subscribeToAuthToken } from "@/lib/firebase";

export function SiteHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!user) return;

    function refreshUserCredits() {
      void apiClient
        .me()
        .then(setUser)
        .catch(() => undefined);
    }

    function onWindowFocus() {
      refreshUserCredits();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") refreshUserCredits();
    }

    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user?.id]);

  useEffect(() => {
    setAccountMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const accountLabel = user?.email.split("@")[0] ?? "Account";
  const avatarInitial = (user?.name || user?.email || "U").trim().charAt(0).toUpperCase();
  const lowCreditBalance = user !== null && isLowCreditBalance(user.balance_credits);

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
              <Link href="/studio" className="text-skill-muted hover:text-skill-ink">
                Studio
              </Link>
              <Link href="/app" className="text-skill-muted hover:text-skill-ink">
                Quick form
              </Link>
              {user.role === "admin" && (
                <Link href="/admin" className="text-skill-muted hover:text-skill-ink">
                  Admin
                </Link>
              )}
              <div ref={accountMenuRef} className="relative">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-skill-blue/30 bg-white px-3 py-1.5 text-xs font-semibold text-skill-ink shadow-sm transition hover:bg-skill-yellow/40"
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  onClick={() => setAccountMenuOpen((open) => !open)}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-skill-blue-dark text-xs font-bold text-white">
                    {avatarInitial}
                  </span>
                  <span className="max-w-32 truncate">{accountLabel}</span>
                  <span aria-hidden="true">{accountMenuOpen ? "^" : "v"}</span>
                </button>

                {accountMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-skill-blue/20 bg-white shadow-lg"
                  >
                    <div className="border-b border-skill-blue/10 p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-skill-blue-dark text-sm font-bold text-white">
                          {avatarInitial}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-skill-muted">
                            User info
                          </p>
                          <p className="mt-1 truncate text-sm font-semibold text-skill-ink">
                            {user.name}
                          </p>
                          <p className="truncate text-xs text-skill-muted">{user.email}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 border-b border-skill-blue/10 p-4 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-skill-muted">Account level</span>
                        <span className="rounded-full bg-skill-yellow px-2 py-0.5 text-xs font-semibold capitalize">
                          {user.role}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-skill-muted">Credits</span>
                        <span
                          className={
                            lowCreditBalance ? "font-semibold text-amber-700" : "font-semibold"
                          }
                        >
                          {user.balance_credits.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="p-2 text-sm">
                      <Link
                        href="/studio"
                        role="menuitem"
                        className="block rounded-xl px-3 py-2 text-skill-muted hover:bg-skill-yellow/40 hover:text-skill-ink"
                      >
                        Studio
                      </Link>
                      <Link
                        href="/app"
                        role="menuitem"
                        className="block rounded-xl px-3 py-2 text-skill-muted hover:bg-skill-yellow/40 hover:text-skill-ink"
                      >
                        Quick form
                      </Link>
                      <Link
                        href="/app/jobs"
                        role="menuitem"
                        className="block rounded-xl px-3 py-2 text-skill-muted hover:bg-skill-yellow/40 hover:text-skill-ink"
                      >
                        Generation history
                      </Link>
                      <Link
                        href="/settings/billing?plan=standard"
                        role="menuitem"
                        className="block rounded-xl px-3 py-2 text-skill-muted hover:bg-skill-yellow/40 hover:text-skill-ink"
                      >
                        Billing & usage
                      </Link>
                      {user.role === "admin" && (
                        <Link
                          href="/admin"
                          role="menuitem"
                          className="block rounded-xl px-3 py-2 text-skill-muted hover:bg-skill-yellow/40 hover:text-skill-ink"
                        >
                          Admin dashboard
                        </Link>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full rounded-xl px-3 py-2 text-left text-red-600 hover:bg-red-50"
                        onClick={() => {
                          void clearAuth().then(() => {
                            setUser(null);
                            setAccountMenuOpen(false);
                            window.location.href = "/";
                          });
                        }}
                      >
                        Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
