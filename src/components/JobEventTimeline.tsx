"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

type JobEvent = {
  id: string;
  event_type: string;
  created_at: string;
};

export function JobEventTimeline({
  jobId,
  status,
}: {
  jobId: string;
  status: string;
}) {
  const [events, setEvents] = useState<JobEvent[]>([]);

  useEffect(() => {
    let cancelled = false;

    function refreshEvents() {
      void apiClient
        .getJobEvents(jobId)
        .then((res) => {
          if (!cancelled) setEvents(res.events);
        })
        .catch(() => {
          if (!cancelled) setEvents([]);
        });
    }

    refreshEvents();

    const inFlight = status === "pending" || status === "running";
    const timer = inFlight ? window.setInterval(refreshEvents, 2000) : undefined;

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [jobId, status]);

  if (events.length === 0) {
    return (
      <p className="text-xs text-skill-muted">
        {status === "pending" || status === "running"
          ? "Waiting for worker events…"
          : "No events recorded for this job."}
      </p>
    );
  }

  return (
    <ol className="space-y-1 rounded-xl border border-skill-blue/10 bg-skill-yellow/20 p-3">
      {events.map((event) => (
        <li
          key={event.id}
          className="flex items-baseline justify-between gap-2 text-xs"
          data-testid="job-event-row"
        >
          <span className="font-medium text-skill-ink">{event.event_type}</span>
          <span className="shrink-0 text-skill-muted">
            {new Date(event.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </li>
      ))}
    </ol>
  );
}
