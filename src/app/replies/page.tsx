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

      {/* Lead Criteria Banner */}
      <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0 bg-emerald-500/20 rounded-full p-1.5">
            <MessageCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="w-full">
            <h2 className="font-semibold text-emerald-400 text-sm mb-3">📌 When is a Reply auto-promoted to a Lead?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">

              {/* Positive */}
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-3">
                <p className="text-emerald-400 font-semibold mb-2">✓ Positive intent keywords</p>
                <p className="text-gray-500 text-xs mb-2">Any one of these in the reply = Lead</p>
                <div className="flex flex-wrap gap-1">
                  {[
                    'interested','sounds good','tell me more','let\'s connect','let\'s chat',
                    'can we talk','schedule a call','book a call','hop on a call',
                    'would love to','open to','happy to','yes please',
                    'how does it work','more details','pricing','demo',
                    'free trial','looks interesting','great timing',
                  ].map((kw) => (
                    <span key={kw} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-xs border border-emerald-500/20">{kw}</span>
                  ))}
                </div>
              </div>

              {/* Auto-reply blocklist */}
              <div className="rounded-lg bg-rose-500/5 border border-rose-500/15 p-3">
                <p className="text-rose-400 font-semibold mb-2">✗ Auto-reply / OOO (excluded)</p>
                <p className="text-gray-500 text-xs mb-2">These replies are never leads</p>
                <div className="flex flex-wrap gap-1">
                  {[
                    'out of office','on vacation','on leave','away from the office',
                    'automatic reply','auto-reply','autoreply','do not reply',
                    'noreply','this is an automated','unsubscribe',
                  ].map((kw) => (
                    <span key={kw} className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 text-xs border border-rose-500/20">{kw}</span>
                  ))}
                </div>
              </div>

              {/* System senders */}
              <div className="rounded-lg bg-yellow-500/5 border border-yellow-500/15 p-3">
                <p className="text-yellow-400 font-semibold mb-2">✗ System senders (excluded)</p>
                <p className="text-gray-500 text-xs mb-2">Emails from these addresses are ignored</p>
                <div className="flex flex-wrap gap-1">
                  {[
                    'mailer-daemon','postmaster','no-reply','noreply',
                    'donotreply','notifications@','support@','bounce',
                  ].map((kw) => (
                    <span key={kw} className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-300 text-xs border border-yellow-500/20">{kw}</span>
                  ))}
                </div>
              </div>

            </div>
            <p className="text-xs text-gray-500 mt-3">
              On match → Lead is upserted with status <span className="text-emerald-400 font-medium">interested</span>.
              Existing leads are never downgraded (e.g. <span className="text-blue-400">booked</span> stays <span className="text-blue-400">booked</span>).
              The sync response returns <code className="text-gray-300 bg-white/5 px-1 rounded">leadsCreated</code> count.
            </p>
          </div>
        </div>
      </div>



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
