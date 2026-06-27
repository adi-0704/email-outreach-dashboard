import { prisma } from "@/lib/prisma";
import { Search, Filter, UserPlus } from "lucide-react";
export const revalidate = 60;

interface LeadRow {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  status: string;
  campaignName: string | null;
  createdAt: Date;
}

async function getLeads(search?: string, status?: string, page = 1, pageSize = 50) {
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status && status !== "all") {
    where.status = status;
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip,
      take: pageSize,
      include: { campaign: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lead.count({ where }),
  ]);

  const formatted: LeadRow[] = leads.map((l) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    company: l.company,
    status: l.status,
    campaignName: l.campaign?.name || null,
    createdAt: l.createdAt,
  }));

  return { leads: formatted, total };
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params?.page) || 1;
  const search = params?.q || "";
  const statusFilter = params?.status || "all";
  const pageSize = 50;

  const { leads, total } = await getLeads(search, statusFilter, page, pageSize);
  const totalPages = Math.ceil(total / pageSize);

  const statusCounts = await prisma.lead.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      interested: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      not_interested: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      new: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      contacted: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    };
    return map[s] || "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  };

  return (
    <div className="p-8 pb-20 sm:p-12">
      <header className="mb-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Leads CRM</h1>
          <p className="text-muted-foreground mt-1">Track and manage your outreach targets.</p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-1">
          <a
            href="/leads"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!statusFilter || statusFilter === "all" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"}`}
          >
            All ({total})
          </a>
          {statusCounts.map((s) => (
            <a
              key={s.status}
              href={`/leads?status=${s.status}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${statusFilter === s.status ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"}`}
            >
              {s.status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())} ({s._count.status})
            </a>
          ))}
        </div>
      </header>

      {/* Search bar */}
      <form className="mb-6 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            name="q"
            defaultValue={search}
            placeholder="Search by name, email, or company..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
          />
        </div>
        {statusFilter !== "all" && (
          <input type="hidden" name="status" value={statusFilter} />
        )}
        <button
          type="submit"
          className="px-4 py-2.5 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-colors"
        >
          Search
        </button>
        {search && (
          <a
            href={statusFilter !== "all" ? `/leads?status=${statusFilter}` : "/leads"}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-white border border-white/10 transition-colors"
          >
            Clear
          </a>
        )}
      </form>

      <div className="glass-card p-6">
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-500 uppercase bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Company</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Campaign</th>
                <th className="px-4 py-3 font-semibold">Added</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-3xl opacity-20">👤</span>
                      <p>{search ? "No leads match your search." : "No leads imported yet."}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4 font-medium text-white">
                      {lead.name || "—"}
                    </td>
                    <td className="px-4 py-4">
                      <a href={`mailto:${lead.email}`} className="text-blue-400 hover:text-blue-300 transition-colors">
                        {lead.email}
                      </a>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{lead.company || "—"}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadge(lead.status)}`}>
                        {lead.status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {lead.campaignName ? lead.campaignName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—"}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground text-xs">
                      {lead.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 px-2">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} leads
            </p>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <a
                  href={`/leads?page=${page - 1}${search ? `&q=${encodeURIComponent(search)}` : ""}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`}
                  className="px-3 py-1.5 rounded-lg text-sm border border-white/10 hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
                >
                  ← Previous
                </a>
              )}
              <span className="text-sm text-muted-foreground px-2">Page {page} of {totalPages}</span>
              {page < totalPages && (
                <a
                  href={`/leads?page=${page + 1}${search ? `&q=${encodeURIComponent(search)}` : ""}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`}
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
