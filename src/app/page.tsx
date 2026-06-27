import { KPICard } from "@/components/KPICard";
import { OverviewChart } from "@/components/OverviewChart";
import {
  Mail, Send, Reply, CircleDollarSign, ZapOff, CheckCircle, Clock,
  AlertTriangle, Calendar, ArrowUpRight, Users, Target, TrendingUp,
  TrendingDown
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SyncButton } from "@/components/SyncButton";
import { unstable_cache } from "next/cache";

export const revalidate = 60; // ISR: refresh every 60s

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)));
}

// Cached trend data to avoid repeated counting
const getTrends = unstable_cache(
  async () => {
    const now = new Date();
    const yesterdayStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const [recentSent, yesterdaySent, recentBounced] = await Promise.all([
      prisma.emailEvent.count({
        where: {
          type: "sent",
          createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.emailEvent.count({
        where: {
          type: "sent",
          createdAt: { gte: yesterdayStart, lte: yesterdayEnd },
        },
      }),
      prisma.emailEvent.count({
        where: {
          type: "bounced",
          createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const sentTrend =
      yesterdaySent > 0
        ? ((recentSent - yesterdaySent) / yesterdaySent * 100).toFixed(0)
        : "0";
    const sentTrendUp = recentSent >= yesterdaySent;

    return { recentSent, yesterdaySent, recentBounced, sentTrend, sentTrendUp };
  },
  ["dashboard-trends"],
  { revalidate: 60 }
);

export default async function Dashboard() {
  const [trends, totalSent, totalReplies, hardBounces, softBounces, apiUsage, recentReplies, lastEvent, campaigns] = await Promise.all([
    getTrends(),
    prisma.emailEvent.count({ where: { type: "sent" } }),
    prisma.emailEvent.count({ where: { type: "replied" } }),
    prisma.emailEvent.count({ where: { type: "bounced", campaignId: { not: null } } }),
    prisma.emailEvent.count({ where: { type: "delayed" } }),
    prisma.apiUsage.aggregate({ _sum: { cost: true } }),
    prisma.emailEvent.findMany({
      where: { type: "replied" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, subject: true, snippet: true, createdAt: true },
    }),
    prisma.emailEvent.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, status: true },
    }),
  ]);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const rawChart = await prisma.$queryRaw<
    { day: Date; type: string; count: bigint }[]
  >`
    SELECT DATE_TRUNC('day', "createdAt") AS day, type, COUNT(*) AS count
    FROM "EmailEvent"
    WHERE "createdAt" >= ${sevenDaysAgo} AND type IN ('sent', 'bounced', 'replied')
    GROUP BY DATE_TRUNC('day', "createdAt"), type
    ORDER BY day ASC
  `;

  const chartMap: Record<string, { sent: number; bounced: number; replied: number }> = {};
  for (const row of rawChart) {
    const key = new Date(row.day).toISOString().split("T")[0];
    if (!chartMap[key]) chartMap[key] = { sent: 0, bounced: 0, replied: 0 };
    if (row.type === "sent") chartMap[key].sent = Number(row.count);
    if (row.type === "bounced") chartMap[key].bounced = Number(row.count);
    if (row.type === "replied") chartMap[key].replied = Number(row.count);
  }

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const isoKey = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("en-US", { weekday: "short" });
    const { sent = 0, bounced = 0, replied = 0 } = chartMap[isoKey] || {};
    return { date: label, sent, delivered: Math.max(0, sent - bounced), replied };
  });

  const delivered = Math.max(0, totalSent - hardBounces);
  const deliveryRate = totalSent > 0 ? ((delivered / totalSent) * 100).toFixed(1) : "0.0";
  const bounceRate = totalSent > 0 ? ((hardBounces / totalSent) * 100).toFixed(1) : "0.0";
  const replyRate = totalSent > 0 ? ((totalReplies / totalSent) * 100).toFixed(1) : "0.0";
  const totalCost = apiUsage._sum.cost || 0;

  const { recentSent, recentBounced, sentTrend, sentTrendUp } = trends;

  return (
    <div className="p-8 pb-20 sm:p-12">
      {/* Header */}
      <header className="mb-10 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Outreach Intelligence
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Last synced:{" "}
            {lastEvent ? new Date(lastEvent.createdAt).toLocaleString() : "Never"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SyncButton />
          <div className="px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium border border-emerald-500/20 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Auto-sync every 15 min
          </div>
        </div>
      </header>

      {/* 24h snapshot bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Last 24h Sent
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {recentSent.toLocaleString()}
            </div>
          </div>
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
              sentTrendUp
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-rose-500/10 text-rose-400"
            }`}
          >
            {sentTrendUp ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {Math.abs(Number(sentTrend))}%
          </div>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-xl p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Last 24h Bounced
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {recentBounced.toLocaleString()}
          </div>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-xl p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Active Campaigns
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {campaigns.filter((c) => c.status === "active").length}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KPICard
          title="Total Sent"
          value={totalSent.toLocaleString()}
          subtitle={`${totalSent} outbound emails`}
          icon={<Send className="w-5 h-5" />}
          good
          trend={sentTrendUp ? `+${sentTrend}%` : `${sentTrend}%`}
          trendUp={sentTrendUp}
        />
        <KPICard
          title="Delivered"
          value={delivered.toLocaleString()}
          subtitle={`${deliveryRate}% delivery rate`}
          icon={<CheckCircle className="w-5 h-5" />}
          good
          goodThreshold={95}
          trend={`${deliveryRate}%`}
        />
        <KPICard
          title="Hard Bounced"
          value={hardBounces.toLocaleString()}
          subtitle={`${bounceRate}% bounce rate`}
          icon={<ZapOff className="w-5 h-5" />}
          bad
          trend={Number(bounceRate) > 5 ? "High" : "OK"}
          trendUp={false}
        />
        <KPICard
          title="Soft Bounces"
          value={softBounces.toLocaleString()}
          subtitle="Gmail retrying · resolves in 24h"
          icon={<Clock className="w-5 h-5" />}
          warn
        />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          title="Delivery Rate"
          value={`${deliveryRate}%`}
          subtitle="of sent emails"
          icon={<Mail className="w-5 h-5" />}
          good
          goodThreshold={95}
          trend={`${deliveryRate}%`}
        />
        <KPICard
          title="Reply Rate"
          value={`${replyRate}%`}
          subtitle="of sent emails"
          icon={<Reply className="w-5 h-5" />}
          good
          goodThreshold={10}
          trend={`${replyRate}%`}
        />
        <KPICard
          title="Replies"
          value={totalReplies.toLocaleString()}
          subtitle="total replies received"
          icon={<Reply className="w-5 h-5" />}
          good
          trend={`${replyRate}% rate`}
        />
        <KPICard
          title="LLM API Cost"
          value={`$${totalCost.toFixed(4)}`}
          subtitle="total spend"
          icon={<CircleDollarSign className="w-5 h-5" />}
          trend={`₹${(totalCost * 84).toFixed(2)}`}
        />
      </div>

      {softBounces > 0 && (
        <div className="mb-6 px-5 py-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">
            <span className="font-semibold">{softBounces} emails</span> are soft bounces
            — Gmail is retrying. They auto-resolve to{" "}
            <span className="text-emerald-400">Delivered</span> or{" "}
            <span className="text-rose-400">Hard Bounced</span> within 24–48h.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <OverviewChart data={chartData} />
        </div>
        <div className="glass-card p-6 flex flex-col gap-4">
          <h3 className="font-semibold text-lg text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Recent Replies
          </h3>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[320px]">
            {recentReplies.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No recent replies found.
              </p>
            ) : (
              recentReplies.map((reply) => (
                <div
                  key={reply.id}
                  className="flex items-start justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group"
                >
                  <div className="overflow-hidden min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {decodeHtmlEntities(reply.subject || "No Subject")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {decodeHtmlEntities(reply.snippet || "")}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1">
                      {new Date(reply.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="px-2.5 py-1 rounded text-xs font-medium border text-emerald-400 bg-emerald-500/10 border-emerald-500/20 whitespace-nowrap ml-2 shrink-0">
                    Replied
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-lg text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-400" />
            Campaign Performance
          </h3>
          <a
            href="/campaigns"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
          >
            View all <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-500 uppercase bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 font-semibold">Campaign</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Sent</th>
                <th className="px-4 py-3 font-semibold text-right text-emerald-400">Delivered</th>
                <th className="px-4 py-3 font-semibold text-right text-blue-400">Delivery %</th>
                <th className="px-4 py-3 font-semibold text-right text-amber-400">Soft Bounce</th>
                <th className="px-4 py-3 font-semibold text-right text-rose-400">Hard Bounce</th>
                <th className="px-4 py-3 font-semibold text-right">Replies</th>
                <th className="px-4 py-3 font-semibold text-right">Reply %</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No campaign data yet.
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => (
                  <tr
                    key={campaign.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-4 font-medium text-white capitalize">
                      {campaign.name.replace(/-/g, " ")}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          campaign.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                        }`}
                      >
                        {campaign.status === "active" ? "● Active" : "○ Paused"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">—</td>
                    <td className="px-4 py-4 text-right text-emerald-400">—</td>
                    <td className="px-4 py-4 text-right text-blue-400">—</td>
                    <td className="px-4 py-4 text-right text-amber-400">—</td>
                    <td className="px-4 py-4 text-right text-rose-400">—</td>
                    <td className="px-4 py-4 text-right">—</td>
                    <td className="px-4 py-4 text-right">—</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          * Delivery % = (Sent − Hard Bounces) / Sent. Soft bounces auto-resolve
          within 24–48h.
        </p>
      </div>
    </div>
  );
}
