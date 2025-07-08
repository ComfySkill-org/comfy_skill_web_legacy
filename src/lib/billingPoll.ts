import { apiClient } from "@/lib/api";

export async function pollBalanceAfterCheckout(
  baseline: number,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<number> {
  const intervalMs = opts?.intervalMs ?? 2000;
  const timeoutMs = opts?.timeoutMs ?? 30000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const { balance_credits } = await apiClient.balance();
    if (balance_credits > baseline) return balance_credits;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Balance did not update within the expected window.");
}
