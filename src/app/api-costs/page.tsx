import { prisma } from "@/lib/prisma";
import { CircleDollarSign, IndianRupee, RefreshCw, TrendingUp, TrendingDown, Clock, Zap } from "lucide-react";
import { unstable_cache } from "next/cache";
export const revalidate = 300; // 5 min ISR

const getLiveUsdToInr = unstable_cache(
  async () => {
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 3600 } });
      if (!res.ok) throw new Error("Exchange rate fetch failed");
      const data = await res.json();
      return { rate: Number(data?.rates?.INR ?? 84), updatedAt: data?.time_last_update_utc ?? null };
    } catch {
      return { rate: 84, updatedAt: null };
    }
  },
  ["usd-to-inr"],
  { revalidate: 3600 }
);

async function getCostStats(page = 1, pageSize = 50) {
  const skip = (page - 1) * pageSize;

  const [usage, total, totalCostAgg, totalTokensAgg, byModel] = await Promise.all([
    prisma.apiUsage.findMany({ orderBy: { createdAt: "desc" }, skip, take: pageSize }),
    prisma.apiUsage.count(),
    prisma.apiUsage.aggregate({ _sum: { cost: true } }),
    prisma.apiUsage.aggregate({ _sum: { tokens: true } }),
    prisma.apiUsage.groupBy({ by: ["model"], _sum: { cost: true, tokens: true }, _count: { model: true } }),
  ]);

  return { usage, total, totalCost: totalCostAgg._sum.cost || 0, totalTokens: totalTokensAgg._sum.tokens || 0, byModel };
}

export default async function ApiCostsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const page = Number((await searchParams)?.page) || 1;
  const pageSize = 50;

  const [{ rate: usdToInr, updatedAt: rateUpdatedAt }, { usage, total, totalCost, totalTokens, byModel }] = await Promise.all([
    getLiveUsdToInr(),
    getCostStats(page, pageSize),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  // Today's cost
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCost = await prisma.apiUsage.aggregate({
    where: { createdAt: { gte: today } },
    _sum: { cost: true },
  });

  // 7-day cost
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const weekCost = await prisma.apiUsage.aggregate({
    where: { createdAt: { gte: sevenDaysAgo } },
    _sum: { cost: true },
  });

  const fmtCost = (c: number) => `$${c.toFixed(4)}`;
  const fmtInr = (c: number) => `₹${(c * usdToInr).toFixed(2)}`;

  return (
    <div className="p-8 pb-20 sm:p-12">
      <header className="mb-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">API Costs</h1>
          <p className="text-muted-foreground mt-1">Track LLM token usage and expenses across all workflows.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-4 py-2 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium border border-blue-500/20 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            {totalTokens.toLocaleString()} Tokens
          </div>
          <div className="px-4 py-2 rounded-full bg-rose-500/10 text-rose-400 text-sm font-medium border border-rose-500/20 flex items-center gap-2">
            <CircleDollarSign className="w-4 h-4" />
            {fmtCost(totalCost)}
          </div>
          <div className="px-4 py-2 rounded-full bg-orange-500/10 text-orange-400 text-sm font-medium border border-orange-500/20 flex items-center gap-2">
            <IndianRupee className="w-4 h-4" />
            {fmtInr(totalCost)}
          </div>
        </div>
      </header>

      {/* Cost breakdown cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="glass-card p-5 flex flex-col gap-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Today</div>
          <div className="text-2xl font-bold text-white">{fmtCost(todayCost._sum.cost || 0)}</div>
          <div className="text-sm text-orange-400">{fmtInr(todayCost._sum.cost || 0)}</div>
        </div>
        <div className="glass-card p-5 flex flex-col gap-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Last 7 Days</div>
          <div className="text-2xl font-bold text-white">{fmtCost(weekCost._sum.cost || 0)}</div>
          <div className="text-sm text-orange-400">{fmtInr(weekCost._sum.cost || 0)}</div>
        </div>
        <div className="glass-card p-5 flex flex-col gap-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">All Time</div>
          <div className="text-2xl font-bold text-white">{fmtCost(totalCost)}</div>
          <div className="text-sm text-orange-400">{fmtInr(totalCost)}</div>
        </div>
      </div>

      {/* Model breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        {byModel.map((m) => (
          <div key={m.model} className="bg-white/5 border border-white/5 rounded-xl p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">{m.model}</div>
            <div className="text-lg font-bold text-white">{fmtCost(m._sum.cost || 0)}</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">{(m._sum.tokens || 0).toLocaleString()} tokens</span>
              <span className="text-xs text-blue-400">{m._count.model} calls</span>
            </div>
          </div>
        ))}
      </div>

      {/* Live rate info bar */}
      <div className="mb-6 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400 w-fit">
        <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
        <span>
          Live rate: <strong className="text-white">1 USD = ₹{usdToInr.toFixed(2)}</strong>
        </span>
        {rateUpdatedAt ? (
          <span className="text-gray-600">· Updated {new Date(rateUpdatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
        ) : (
          <span className="text-yellow-500/70">· Using fallback rate</span>
        )}
      </div>

      <div className="glass-card p-6">
        <h3 className="font-semibold text-lg text-white mb-6">Usage Log</h3>
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-500 uppercase bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Model</th>
                <th className="px-4 py-3 font-semibold text-right">Tokens</th>
                <th className="px-4 py-3 font-semibold text-right text-rose-400">Cost (USD)</th>
                <th className="px-4 py-3 font-semibold text-right text-orange-400">Cost (INR)</th>
              </tr>
            </thead>
            <tbody>
              {usage.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-3xl opacity-20">💰</span>
                      <p>No API usage recorded yet.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                usage.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap text-xs text-muted-foreground">
                      {log.createdAt.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-4 font-medium text-white">{log.source}</td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-0.5 rounded text-xs bg-white/5 border border-white/10 text-muted-foreground">{log.model}</span>
                    </td>
                    <td className="px-4 py-4 text-right text-blue-400 font-medium">{log.tokens.toLocaleString()}</td>
                    <td className="px-4 py-4 text-right text-rose-400 font-medium">${log.cost.toFixed(6)}</td>
                    <td className="px-4 py-4 text-right text-orange-400 font-medium">₹{(log.cost * usdToInr).toFixed(4)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 px-2">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} records
            </p>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <a href={`/api-costs?page=${page - 1}`} className="px-3 py-1.5 rounded-lg text-sm border border-white/10 hover:bg-white/5 text-muted-foreground hover:text-white transition-colors">← Previous</a>
              )}
              <span className="text-sm text-muted-foreground px-2">Page {page} of {totalPages}</span>
              {page < totalPages && (
                <a href={`/api-costs?page=${page + 1}`} className="px-3 py-1.5 rounded-lg text-sm border border-white/10 hover:bg-white/5 text-muted-foreground hover:text-white transition-colors">Next →</a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
