import { KPICard } from "@/components/KPICard";
import { OverviewChart } from "@/components/OverviewChart";
import { Mail, Send, Reply, CircleDollarSign, ZapOff } from "lucide-react";
import { PrismaClient } from "@prisma/client";
import { SyncButton } from "@/components/SyncButton";

const prisma = new PrismaClient();

export const revalidate = 0; // Disable caching so it always shows fresh data

export default async function Dashboard() {
  // Fetch real data from Prisma
  const totalSent = await prisma.emailEvent.count({ where: { type: 'sent' } });
  const totalReplies = await prisma.emailEvent.count({ where: { type: 'replied' } });
  const totalBounces = await prisma.emailEvent.count({ where: { type: 'bounced' } });
  
  // Aggregate API Costs
  const apiUsage = await prisma.apiUsage.aggregate({
    _sum: { cost: true }
  });
  const totalCost = apiUsage._sum.cost || 0;

  // Calculate Rates
  const replyRate = totalSent > 0 ? ((totalReplies / totalSent) * 100).toFixed(1) : "0.0";
  const bounceRate = totalSent > 0 ? ((totalBounces / totalSent) * 100).toFixed(1) : "0.0";

  // Fetch Recent Replies
  const recentReplies = await prisma.emailEvent.findMany({
    where: { type: 'replied' },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  // Build last 7 days chart data from real events
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const chartData = await Promise.all(last7Days.map(async (day) => {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);

    const sent = await prisma.emailEvent.count({
      where: { type: 'sent', createdAt: { gte: start, lte: end } }
    });
    const replied = await prisma.emailEvent.count({
      where: { type: 'replied', createdAt: { gte: start, lte: end } }
    });

    return {
      date: day.toLocaleDateString('en-US', { weekday: 'short' }),
      sent,
      replied,
    };
  }));

  // Fetch real campaigns for the campaign table
  const campaigns = await prisma.campaign.findMany({
    include: { events: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return (
    <div className="p-8 pb-20 sm:p-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Outreach Intelligence</h1>
          <p className="text-muted-foreground mt-1">Real-time performance and deliverability monitoring.</p>
        </div>
        <div className="flex items-center gap-4">
          <SyncButton />
          <div className="px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium border border-emerald-500/20 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            System Healthy
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <KPICard 
          title="Total Sent" 
          value={totalSent.toLocaleString()} 
          trend={0} 
          icon={<Send className="w-5 h-5" />} 
        />
        <KPICard 
          title="Open Rate" 
          value="N/A" 
          trend={0} 
          icon={<Mail className="w-5 h-5" />} 
        />
        <KPICard 
          title="Reply Rate" 
          value={`${replyRate}%`} 
          trend={0} 
          icon={<Reply className="w-5 h-5" />} 
        />
        <KPICard 
          title="Bounce Rate" 
          value={`${bounceRate}%`} 
          trend={0} 
          trendGoodIfDown={true}
          icon={<ZapOff className="w-5 h-5" />} 
        />
        <KPICard 
          title="LLM API Cost" 
          value={`$${totalCost.toFixed(4)}`} 
          trend={0} 
          trendGoodIfDown={true}
          icon={<CircleDollarSign className="w-5 h-5" />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <OverviewChart data={chartData} />
        </div>
        
        <div className="glass-card p-6 flex flex-col gap-4">
          <h3 className="font-semibold text-lg text-white">Recent Replies</h3>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {recentReplies.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent replies found.</p>
            ) : (
              recentReplies.map((reply) => (
                <div key={reply.id} className="flex items-start justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium text-white truncate">{reply.subject || "No Subject"}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{reply.snippet}</p>
                  </div>
                  <div className={`px-2.5 py-1 rounded text-xs font-medium border text-emerald-400 bg-emerald-500/10 border-emerald-500/20 whitespace-nowrap ml-2`}>
                    Replied
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Campaign Breakdown Table - Real Data */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-lg text-white mb-6">Campaign Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="text-xs text-gray-500 uppercase bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 font-medium">Campaign Name</th>
                <th className="px-4 py-3 font-medium">Sent</th>
                <th className="px-4 py-3 font-medium">Replied</th>
                <th className="px-4 py-3 font-medium">Bounced</th>
                <th className="px-4 py-3 font-medium">Reply Rate</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No campaign data yet. Sync your emails to get started!
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => {
                  const sent = campaign.events.filter(e => e.type === 'sent').length;
                  const replied = campaign.events.filter(e => e.type === 'replied').length;
                  const bounced = campaign.events.filter(e => e.type === 'bounced').length;
                  const replyRate = sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0.0";
                  return (
                    <tr key={campaign.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-4 font-medium text-white capitalize">
                        {campaign.name.replace(/-/g, ' ')}
                      </td>
                      <td className="px-4 py-4">{sent}</td>
                      <td className="px-4 py-4 text-emerald-400">{replied}</td>
                      <td className="px-4 py-4 text-rose-400">{bounced}</td>
                      <td className="px-4 py-4 text-blue-400">{replyRate}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
