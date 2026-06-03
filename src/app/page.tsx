import { KPICard } from "@/components/KPICard";
import { OverviewChart } from "@/components/OverviewChart";
import { Mail, Send, Reply, CircleDollarSign, ZapOff, CheckCircle, Clock } from "lucide-react";
import { PrismaClient } from "@prisma/client";
import { SyncButton } from "@/components/SyncButton";

const prisma = new PrismaClient();

export const revalidate = 0;

export default async function Dashboard() {
  // Core counts
  const totalSent    = await prisma.emailEvent.count({ where: { type: 'sent' } });
  const totalReplies = await prisma.emailEvent.count({ where: { type: 'replied' } });
  const hardBounces  = await prisma.emailEvent.count({ where: { type: 'bounced', campaignId: { not: null } } });
  const softBounces  = await prisma.emailEvent.count({ where: { type: 'delayed' } }); // still being retried

  // Delivery metrics
  const delivered    = Math.max(0, totalSent - hardBounces);
  const deliveryRate = totalSent > 0 ? ((delivered / totalSent) * 100).toFixed(1) : "0.0";
  const bounceRate   = totalSent > 0 ? ((hardBounces / totalSent) * 100).toFixed(1) : "0.0";
  const replyRate    = totalSent > 0 ? ((totalReplies / totalSent) * 100).toFixed(1) : "0.0";

  // API cost
  const apiUsage  = await prisma.apiUsage.aggregate({ _sum: { cost: true } });
  const totalCost = apiUsage._sum.cost || 0;

  // Recent replies
  const recentReplies = await prisma.emailEvent.findMany({
    where: { type: 'replied' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  // Last 7 days chart — sent + delivered per day
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const chartData = await Promise.all(last7Days.map(async (day) => {
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end   = new Date(day); end.setHours(23, 59, 59, 999);

    const sent     = await prisma.emailEvent.count({ where: { type: 'sent',    createdAt: { gte: start, lte: end } } });
    const bounced  = await prisma.emailEvent.count({ where: { type: 'bounced', createdAt: { gte: start, lte: end } } });
    const replied  = await prisma.emailEvent.count({ where: { type: 'replied', createdAt: { gte: start, lte: end } } });
    const deliveredDay = Math.max(0, sent - bounced);

    return {
      date: day.toLocaleDateString('en-US', { weekday: 'short' }),
      sent,
      delivered: deliveredDay,
      replied,
    };
  }));

  // Campaigns with full delivery breakdown
  const campaigns = await prisma.campaign.findMany({
    include: { events: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  // Last sync time
  const lastEvent = await prisma.emailEvent.findFirst({ orderBy: { createdAt: 'desc' } });

  return (
    <div className="p-8 pb-20 sm:p-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Outreach Intelligence</h1>
          <p className="text-muted-foreground mt-1">
            Real-time performance · Last synced: {lastEvent ? new Date(lastEvent.createdAt).toLocaleString() : 'Never'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <SyncButton />
          <div className="px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium border border-emerald-500/20 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Auto-sync every 15 min
          </div>
        </div>
      </header>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KPICard
          title="Total Sent"
          value={totalSent.toLocaleString()}
          trend={0}
          icon={<Send className="w-5 h-5" />}
        />
        <KPICard
          title="Delivered"
          value={delivered.toLocaleString()}
          trend={0}
          trendLabel={`${deliveryRate}% delivery rate`}
          icon={<CheckCircle className="w-5 h-5" />}
        />
        <KPICard
          title="Hard Bounced"
          value={hardBounces.toLocaleString()}
          trend={0}
          trendLabel={`${bounceRate}% bounce rate`}
          trendGoodIfDown={true}
          icon={<ZapOff className="w-5 h-5" />}
        />
        <KPICard
          title="Soft Bounces"
          value={softBounces.toLocaleString()}
          trend={0}
          trendLabel="retrying · rechecked in 24h"
          trendGoodIfDown={true}
          icon={<Clock className="w-5 h-5" />}
        />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          title="Replies"
          value={totalReplies.toLocaleString()}
          trend={0}
          trendLabel={`${replyRate}% reply rate`}
          icon={<Reply className="w-5 h-5" />}
        />
        <KPICard
          title="Delivery Rate"
          value={`${deliveryRate}%`}
          trend={0}
          trendLabel="of sent emails"
          icon={<Mail className="w-5 h-5" />}
        />
        <KPICard
          title="Reply Rate"
          value={`${replyRate}%`}
          trend={0}
          trendLabel="of sent emails"
          icon={<Reply className="w-5 h-5" />}
        />
        <KPICard
          title="LLM API Cost"
          value={`$${totalCost.toFixed(4)}`}
          trend={0}
          trendGoodIfDown={true}
          icon={<CircleDollarSign className="w-5 h-5" />}
        />
      </div>

      {/* Soft bounce info banner */}
      {softBounces > 0 && (
        <div className="mb-6 px-5 py-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">
            <span className="font-semibold">{softBounces} emails</span> are soft bounces (Gmail is retrying delivery). 
            These will automatically resolve to <span className="text-emerald-400">Delivered</span> or <span className="text-rose-400">Hard Bounced</span> within 24–48 hours as Gmail sends follow-up notifications.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <OverviewChart data={chartData} />
        </div>

        <div className="glass-card p-6 flex flex-col gap-4">
          <h3 className="font-semibold text-lg text-white">Recent Replies</h3>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {recentReplies.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent replies found.</p>
            ) : (
              recentReplies.map((reply) => (
                <div key={reply.id} className="flex items-start justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium text-white truncate">{reply.subject || "No Subject"}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{reply.snippet}</p>
                  </div>
                  <div className="px-2.5 py-1 rounded text-xs font-medium border text-emerald-400 bg-emerald-500/10 border-emerald-500/20 whitespace-nowrap ml-2">
                    Replied
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Campaign Performance Table — full delivery breakdown */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-lg text-white mb-6">Campaign Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="text-xs text-gray-500 uppercase bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Sent</th>
                <th className="px-4 py-3 font-medium text-emerald-400">Delivered</th>
                <th className="px-4 py-3 font-medium text-blue-400">Delivery %</th>
                <th className="px-4 py-3 font-medium text-amber-400">Soft Bounce</th>
                <th className="px-4 py-3 font-medium text-rose-400">Hard Bounce</th>
                <th className="px-4 py-3 font-medium">Replies</th>
                <th className="px-4 py-3 font-medium">Reply %</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No campaign data yet. Sync your emails to get started!
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => {
                  const sent       = campaign.events.filter(e => e.type === 'sent').length;
                  const replied    = campaign.events.filter(e => e.type === 'replied').length;
                  const hard       = campaign.events.filter(e => e.type === 'bounced').length;
                  const soft       = campaign.events.filter(e => e.type === 'delayed').length;
                  const deliveredC = Math.max(0, sent - hard);
                  const delRate    = sent > 0 ? ((deliveredC / sent) * 100).toFixed(1) : "0.0";
                  const repRate    = sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0.0";
                  return (
                    <tr key={campaign.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-4 font-medium text-white capitalize">
                        {campaign.name.replace(/-/g, ' ')}
                      </td>
                      <td className="px-4 py-4">{sent}</td>
                      <td className="px-4 py-4 text-emerald-400 font-medium">{deliveredC}</td>
                      <td className="px-4 py-4">
                        <span className={`font-semibold ${parseFloat(delRate) >= 90 ? 'text-emerald-400' : parseFloat(delRate) >= 75 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {delRate}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-amber-400">{soft}</td>
                      <td className="px-4 py-4 text-rose-400">{hard}</td>
                      <td className="px-4 py-4 text-blue-400">{replied}</td>
                      <td className="px-4 py-4 text-blue-400">{repRate}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          * Soft bounces are Gmail retries — they resolve automatically within 24–48h. Delivery % = (Sent − Hard Bounces) / Sent.
        </p>
      </div>
    </div>
  );
}
