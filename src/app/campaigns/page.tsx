import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export const revalidate = 0;

export default async function CampaignsPage() {
  // Fetch all campaigns with their related email events
  const campaigns = await prisma.campaign.findMany({
    include: {
      events: true,
    },
    orderBy: { createdAt: 'desc' },
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
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No campaigns found. Start syncing your emails!
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
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded text-xs border ${
                          campaign.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        }`}>
                          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                        </span>
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
