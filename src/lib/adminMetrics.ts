export function deriveJobHealthRates(metrics: {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
}): { completionRate: number | null; failureRate: number | null } {
  if (metrics.total_jobs <= 0) {
    return { completionRate: null, failureRate: null };
  }

  return {
    completionRate: metrics.completed_jobs / metrics.total_jobs,
    failureRate: metrics.failed_jobs / metrics.total_jobs,
  };
}

export function formatHealthRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function deriveInProgressJobMetrics(metrics: {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
}): { inProgress: number; inProgressRate: number | null } {
  const inProgress = Math.max(
    0,
    metrics.total_jobs - metrics.completed_jobs - metrics.failed_jobs,
  );

  if (metrics.total_jobs <= 0) {
    return { inProgress: 0, inProgressRate: null };
  }

  return {
    inProgress,
    inProgressRate: inProgress / metrics.total_jobs,
  };
}
