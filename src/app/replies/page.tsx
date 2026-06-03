import { PrismaClient } from "@prisma/client";
import { MessageCircle } from "lucide-react";

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

export default async function RepliesPage() {
  const replies = await prisma.emailEvent.findMany({
    where: { type: 'replied' },
    orderBy: { createdAt: 'desc' },
    include: { campaign: true },
  });

  return (
    <div className="p-8 pb-20 sm:p-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Inbox</h1>
          <p className="text-muted-foreground mt-1">All replies and engagements from your campaigns.</p>
        </div>
        <div className="px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium border border-emerald-500/20 flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          {replies.length} Replies
        </div>
      </header>

      <div className="space-y-4">
        {replies.length === 0 ? (
          <div className="glass-card p-12 text-center text-muted-foreground">
            No replies yet. Keep sending!
          </div>
        ) : (
          replies.map((reply) => (
            <div key={reply.id} className="glass-card p-6 flex flex-col gap-2 transition-all hover:bg-white/5">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-lg text-white">{decodeHtmlEntities(reply.subject || "No Subject")}</h3>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">{reply.createdAt.toLocaleString()}</span>
              </div>
              <p className="text-gray-300 text-sm mt-2 leading-relaxed">{decodeHtmlEntities(reply.snippet || '')}</p>
              <div className="mt-4 flex gap-2">
                <span className="px-2 py-1 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 capitalize">
                  {reply.campaign?.name?.replace(/-/g, ' ') || "Unknown Campaign"}
                </span>
                <span className="px-2 py-1 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Replied
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
