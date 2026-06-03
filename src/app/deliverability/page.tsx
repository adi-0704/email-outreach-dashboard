import { PrismaClient } from "@prisma/client";
import { ShieldAlert } from "lucide-react";

const prisma = new PrismaClient();
export const revalidate = 0;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
}

export default async function DeliverabilityPage() {
  const bounces = await prisma.emailEvent.findMany({
    where: { 
      type: 'bounced',
      campaignId: { not: null }, // Only show bounces linked to a known campaign
    },
    orderBy: { createdAt: 'desc' },
    include: { campaign: true },
  });

  return (
    <div className="p-8 pb-20 sm:p-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Deliverability</h1>
          <p className="text-muted-foreground mt-1">Monitor bounces and sender reputation.</p>
        </div>
        <div className="px-4 py-2 rounded-full bg-rose-500/10 text-rose-400 text-sm font-medium border border-rose-500/20 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          {bounces.length} Total Bounces
        </div>
      </header>

      <div className="glass-card p-6">
        <h3 className="font-semibold text-lg text-white mb-6">Recent Bounces</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="text-xs text-gray-500 uppercase bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Details</th>
                <th className="px-4 py-3 font-medium">Campaign</th>
              </tr>
            </thead>
            <tbody>
              {bounces.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No bounces detected. Your deliverability is excellent!
                  </td>
                </tr>
              ) : (
                bounces.map((bounce) => (
                  <tr key={bounce.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-4 whitespace-nowrap">{bounce.createdAt.toLocaleDateString()}</td>
                    <td className="px-4 py-4 text-white font-medium max-w-[200px]">
                      {decodeHtmlEntities(bounce.subject || "N/A")}
                    </td>
                    <td className="px-4 py-4 max-w-[380px] leading-relaxed">
                      {decodeHtmlEntities(bounce.snippet || '')}
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 rounded text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 capitalize">
                        {bounce.campaign?.name?.replace(/-/g, ' ') || 'Unknown'}
                      </span>
                    </td>
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
