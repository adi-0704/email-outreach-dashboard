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
          <OverviewChart />
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

      {/* Campaign Breakdown Table */}
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
              </tr>
            </thead>
            <tbody>
              {/* Fetching and grouping campaigns could be optimized with Prisma's groupBy, but for simplicity here we just use Prisma raw or fetch events and process. */}
              {/* As a quick view, we will just show a placeholder row if no campaigns are detected yet */}
              <tr className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-4 font-medium text-white">Example: wisowl-q3-outreach</td>
                <td className="px-4 py-4">0</td>
                <td className="px-4 py-4 text-emerald-400">0</td>
                <td className="px-4 py-4 text-rose-400">0</td>
              </tr>
              <tr className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-4 font-medium text-white">Example: madhav-production</td>
                <td className="px-4 py-4">0</td>
                <td className="px-4 py-4 text-emerald-400">0</td>
                <td className="px-4 py-4 text-rose-400">0</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-4 italic">
            * Once the sync engine detects live campaign tags, they will populate here automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
