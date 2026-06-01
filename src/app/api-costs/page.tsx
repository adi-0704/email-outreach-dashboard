import { PrismaClient } from "@prisma/client";
import { CircleDollarSign } from "lucide-react";

const prisma = new PrismaClient();
export const revalidate = 0;

export default async function ApiCostsPage() {
  const usage = await prisma.apiUsage.findMany({
    orderBy: { createdAt: 'desc' }
  });

  const totalCost = usage.reduce((sum, u) => sum + u.cost, 0);
  const totalTokens = usage.reduce((sum, u) => sum + u.tokens, 0);

  return (
    <div className="p-8 pb-20 sm:p-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">API Costs</h1>
          <p className="text-muted-foreground mt-1">Track your LLM token usage and expenses.</p>
        </div>
        <div className="flex gap-4">
          <div className="px-4 py-2 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium border border-blue-500/20 flex items-center gap-2">
            {totalTokens.toLocaleString()} Tokens
          </div>
          <div className="px-4 py-2 rounded-full bg-rose-500/10 text-rose-400 text-sm font-medium border border-rose-500/20 flex items-center gap-2">
            <CircleDollarSign className="w-4 h-4" />
            ${totalCost.toFixed(4)}
          </div>
        </div>
      </header>

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
                <th className="px-4 py-3 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {usage.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
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
