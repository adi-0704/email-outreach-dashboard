import { PrismaClient } from "@prisma/client";
import { Send, Users, ShieldAlert, BarChart3 } from "lucide-react";

const prisma = new PrismaClient();
export const revalidate = 0;

export default async function CampaignsPage() {
  const events = await prisma.emailEvent.findMany();
  
  // Group by campaignId
  const campaigns: Record<string, { sent: number, replied: number, bounced: number }> = {};
  
  events.forEach(event => {
    const cid = event.campaignId || "Unknown Campaign";
    if (!campaigns[cid]) {
      campaigns[cid] = { sent: 0, replied: 0, bounced: 0 };
    }
    if (event.type === 'sent') campaigns[cid].sent++;
    if (event.type === 'replied') campaigns[cid].replied++;
    if (event.type === 'bounced') campaigns[cid].bounced++;
  });

  return (
    <div className="p-8 pb-20 sm:p-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-white tracking-tight">Campaigns</h1>
        <p className="text-muted-foreground mt-1">Manage and track your active outreach workflows.</p>
      </header>

      <div className="glass-card p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="text-xs text-gray-500 uppercase bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 font-medium">Campaign Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Sent</th>
                <th className="px-4 py-3 font-medium">Replied</th>
                <th className="px-4 py-3 font-medium">Bounced</th>
                <th className="px-4 py-3 font-medium">Reply Rate</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(campaigns).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No campaigns found. Start syncing your emails!
                  </td>
                </tr>
              ) : (
                Object.entries(campaigns).map(([name, stats]) => {
                  const replyRate = stats.sent > 0 ? ((stats.replied / stats.sent) * 100).toFixed(1) : "0.0";
                  return (
                    <tr key={name} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-4 font-medium text-white">{name}</td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>
                      </td>
                      <td className="px-4 py-4">{stats.sent}</td>
                      <td className="px-4 py-4 text-emerald-400">{stats.replied}</td>
                      <td className="px-4 py-4 text-rose-400">{stats.bounced}</td>
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
