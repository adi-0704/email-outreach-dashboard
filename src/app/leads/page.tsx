import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export const revalidate = 0;

export default async function LeadsPage() {
  const leads = await prisma.lead.findMany({
    include: { campaign: true },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="p-8 pb-20 sm:p-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-white tracking-tight">Leads CRM</h1>
        <p className="text-muted-foreground mt-1">Track the status of all your outreach targets.</p>
      </header>

      <div className="glass-card p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="text-xs text-gray-500 uppercase bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Campaign</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No leads imported yet.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-4 font-medium text-white">{lead.name || "N/A"}</td>
                    <td className="px-4 py-4">{lead.email}</td>
                    <td className="px-4 py-4">{lead.company || "N/A"}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded text-xs border ${
                        lead.status === 'interested' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                        lead.status === 'not_interested' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {lead.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4">{lead.campaign?.name || "Unassigned"}</td>
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
