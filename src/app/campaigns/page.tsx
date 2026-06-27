import { prisma } from "@/lib/prisma";
import { type Prisma } from "@prisma/client";
export const revalidate = 60; // ISR: refresh every 60s

// Type for campaign query results
interface CampaignRow {
  id: string;
  name: string;
  status: string;
  sent: number;
  replied: number;
  bounced: number;
  softBounced: number;
  replyRate: string;
  deliveryRate: string;
}

// Aggregation query replaces N+1 include: { events: true }
async function getCampaignStats(page = 1, pageSize = 25): Promise<{
  campaigns: CampaignRow[];
  total: number;
}> {
  const skip = (page - 1) * pageSize;

  const campaigns = await prisma.$queryRaw<CampaignRow[]>`
    SELECT
      c.id,
      c.name,
      c.status,
      COUNT(*) FILTER (WHERE e.type = 'sent') AS "sent",
      COUNT(*) FILTER (WHERE e.type = 'replied') AS "replied",
      COUNT(*) FILTER (WHERE e.type = 'bounced') AS "bounced",
      COUNT(*) FILTER (WHERE e.type = 'delayed') AS "softBounced"
    FROM "Campaign" c
    LEFT JOIN "EmailEvent" e ON e."campaignId" = c.id
    GROUP BY c.id
    ORDER BY c."createdAt" DESC
    LIMIT ${pageSize} OFFSET ${skip}
  `;

  const totalResult = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) FROM "Campaign"
  `;
  const total = Number(totalResult[0]?.count ?? 0);

  // Format computed fields in JS (can't do math in raw SQL with all Prisma adapters)
  const formatted = campaigns.map((c) => {
    const sent = Number(c.sent || 0);
    const replied = Number(c.replied || 0);
    const bounced = Number(c.bounced || 0);
    const softBounced = Number(c.softBounced || 0);
    const replyRate = sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0.0";
    const deliveryRate = sent > 0 ? (((sent - bounced) / sent) * 100).toFixed(1) : "0.0";
    return { ...c, replyRate, deliveryRate, sent, replied, bounced, softBounced } as CampaignRow;
  });

  return { campaigns: formatted, total };
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const page = Number((await searchParams)?.page) || 1;
  const pageSize = 25;

  const { campaigns, total } = await getCampaignStats(page, pageSize);
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-8 pb-20 sm:p-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-white tracking-tight">Campaigns</h1>
        <p className="text-muted-foreground mt-1">Manage and track your active outreach workflows.</p>
      </header>

      <div className="glass-card p-6">
        {/* Summary stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/5 border border-white/5 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{total}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Total Campaigns</div>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">
              {campaigns.reduce((sum, c) => sum + c.sent, 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Total Sent</div>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">
              {campaigns.reduce((sum, c) => sum + c.replied, 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Total Replies</div>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-rose-400">
              {campaigns.reduce((sum, c) => sum + c.bounced, 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Total Bounces</div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-500 uppercase bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 font-semibold">Campaign Name</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Sent</th>
                <th className="px-4 py-3 font-semibold text-right text-emerald-400">Delivered</th>
                <th className="px-4 py-3 font-semibold text-right text-emerald-400">Replies</th>
                <th className="px-4 py-3 font-semibold text-right text-blue-400">Reply Rate</th>
                <th className="px-4 py-3 font-semibold text-right text-amber-400">Soft Bounce</th>
                <th className="px-4 py-3 font-semibold text-right text-rose-400">Hard Bounce</th>
                <th className="px-4 py-3 font-semibold text-right">Delivery %</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-3xl opacity-20">📭</span>
                      <p>No campaigns found. Start syncing your emails!</p>
                    </div>
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => {
                  const del = Math.max(0, campaign.sent - campaign.bounced);
                  const delRate = parseFloat(campaign.deliveryRate);
                  const repRate = parseFloat(campaign.replyRate);
                  return (
                    <tr key={campaign.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4 font-medium text-white capitalize">
                        {campaign.name.replace(/-/g, ' ')}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          campaign.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        }`}>
                          {campaign.status === 'active' ? '● Active' : '○ Paused'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-medium">{campaign.sent.toLocaleString()}</td>
                      <td className="px-4 py-4 text-right text-emerald-400 font-medium">{del.toLocaleString()}</td>
                      <td className="px-4 py-4 text-right text-emerald-400 font-medium">{campaign.replied.toLocaleString()}</td>
                      <td className="px-4 py-4 text-right">
                        <span className={`font-semibold ${repRate >= 10 ? 'text-emerald-400' : repRate >= 5 ? 'text-amber-400' : 'text-blue-400'}`}>
                          {campaign.replyRate}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-amber-400">{campaign.softBounced}</td>
                      <td className="px-4 py-4 text-right text-rose-400">{campaign.bounced}</td>
                      <td className="px-4 py-4 text-right">
                        <span className={`font-semibold ${delRate >= 95 ? 'text-emerald-400' : delRate >= 85 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {campaign.deliveryRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 px-2">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} campaigns
            </p>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <a
                  href={`/campaigns?page=${page - 1}`}
                  className="px-3 py-1.5 rounded-lg text-sm border border-white/10 hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
                >
                  ← Previous
                </a>
              )}
              <span className="text-sm text-muted-foreground px-2">Page {page} of {totalPages}</span>
              {page < totalPages && (
                <a
                  href={`/campaigns?page=${page + 1}`}
                  className="px-3 py-1.5 rounded-lg text-sm border border-white/10 hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
                >
                  Next →
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
