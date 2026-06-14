import { PrismaClient } from "@prisma/client";
import { CircleDollarSign, IndianRupee, RefreshCw } from "lucide-react";

const prisma = new PrismaClient();
export const revalidate = 0; // Always fresh — no cache

async function getLiveUsdToInr(): Promise<{ rate: number; updatedAt: string | null }> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 }, // Re-fetch at most once per hour
    });
    if (!res.ok) throw new Error("Exchange rate fetch failed");
    const data = await res.json();
    const rate: number = data?.rates?.INR ?? 84;
    const updatedAt: string | null = data?.time_last_update_utc ?? null;
    return { rate, updatedAt };
  } catch {
    // Graceful fallback if API is unreachable
    return { rate: 84, updatedAt: null };
  }
}

export default async function ApiCostsPage() {
  const [usage, { rate: usdToInr, updatedAt: rateUpdatedAt }] = await Promise.all([
    prisma.apiUsage.findMany({ orderBy: { createdAt: "desc" } }),
    getLiveUsdToInr(),
  ]);

  const totalCost = usage.reduce((sum, u) => sum + u.cost, 0);
  const totalTokens = usage.reduce((sum, u) => sum + u.tokens, 0);

  return (
    <div className="p-8 pb-20 sm:p-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">API Costs</h1>
          <p className="text-muted-foreground mt-1">Track your LLM token usage and expenses.</p>
        </div>
        <div className="flex gap-4 flex-wrap justify-end">
          <div className="px-4 py-2 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium border border-blue-500/20 flex items-center gap-2">
            {totalTokens.toLocaleString()} Tokens
          </div>
          <div className="px-4 py-2 rounded-full bg-rose-500/10 text-rose-400 text-sm font-medium border border-rose-500/20 flex items-center gap-2">
            <CircleDollarSign className="w-4 h-4" />
            ${totalCost.toFixed(4)}
          </div>
          <div className="px-4 py-2 rounded-full bg-orange-500/10 text-orange-400 text-sm font-medium border border-orange-500/20 flex items-center gap-2">
            <IndianRupee className="w-4 h-4" />
            ₹{(totalCost * usdToInr).toFixed(2)}
          </div>
        </div>
      </header>

      {/* Live rate info bar */}
      <div className="mb-6 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400 w-fit">
        <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
        <span>
          Live rate:{" "}
          <strong className="text-white">1 USD = ₹{usdToInr.toFixed(2)}</strong>
        </span>
        {rateUpdatedAt ? (
          <span className="text-gray-600">· Updated {new Date(rateUpdatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
        ) : (
          <span className="text-yellow-500/70">· Using fallback rate (API unreachable)</span>
        )}
      </div>

      <div className="glass-card p-6">
        <h3 className="font-semibold text-lg text-white mb-6">Usage Log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="text-xs text-gray-500 uppercase bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Tokens</th>
                <th className="px-4 py-3 font-medium">Cost (USD)</th>
                <th className="px-4 py-3 font-medium">Cost (INR ₹{usdToInr.toFixed(0)}/$)</th>
              </tr>
            </thead>
            <tbody>
              {usage.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No API usage recorded yet.
                  </td>
                </tr>
              ) : (
                usage.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-4 whitespace-nowrap">{log.createdAt.toLocaleString()}</td>
                    <td className="px-4 py-4 font-medium text-white">{log.source}</td>
                    <td className="px-4 py-4">{log.model}</td>
                    <td className="px-4 py-4 text-blue-400">{log.tokens.toLocaleString()}</td>
                    <td className="px-4 py-4 text-rose-400">${log.cost.toFixed(6)}</td>
                    <td className="px-4 py-4 text-orange-400">₹{(log.cost * usdToInr).toFixed(4)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
