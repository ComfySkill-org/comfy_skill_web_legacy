"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, getApiBaseUrl } from "@/lib/api";

type HealthState = "checking" | "ok" | "error";

export function ApiHealthBadge({ variant = "compact" }: { variant?: "compact" | "card" }) {
  const [health, setHealth] = useState<HealthState>("checking");
  const [service, setService] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const checkHealth = useCallback(() => {
    setHealth("checking");
    void apiClient
      .health()
      .then((res) => {
        setService(res.service ?? null);
        setHealth("ok");
        setCheckedAt(new Date());
      })
      .catch(() => {
        setService(null);
        setHealth("error");
        setCheckedAt(new Date());
      });
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  if (variant === "card") {
    return (
      <div className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Platform API</p>
            <p className="mt-1 text-xs text-skill-muted">{getApiBaseUrl()}</p>
          </div>
          <button type="button" className="text-xs underline hover:text-skill-ink" onClick={checkHealth}>
            Retry
          </button>
        </div>
        <p className="text-sm">
          Status:{" "}
          {health === "checking" && <span className="text-skill-muted">Checking…</span>}
          {health === "ok" && (
            <span className="font-medium text-green-700">
              Reachable{service ? ` (${service})` : ""}
            </span>
          )}
          {health === "error" && (
            <span className="font-medium text-amber-800">Unreachable</span>
          )}
        </p>
        {checkedAt && (
          <p className="text-xs text-skill-muted">
            Last checked {checkedAt.toLocaleTimeString()}
          </p>
        )}
      </div>
    );
  }

  return (
    <p className="text-xs text-skill-muted">
      API status:{" "}
      {health === "checking" && <span>Checking…</span>}
      {health === "ok" && <span className="font-medium text-green-700">Reachable</span>}
      {health === "error" && (
        <span className="font-medium text-amber-800">
          Unreachable — start the API at {getApiBaseUrl()}
        </span>
      )}
    </p>
  );
}
