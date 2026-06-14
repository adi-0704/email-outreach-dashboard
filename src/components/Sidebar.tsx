import Link from "next/link";
import { LayoutDashboard, Send, Inbox, MessageCircle, BarChart3, Settings, ShieldAlert, Zap } from "lucide-react";

export function Sidebar() {
  return (
    <div className="w-64 h-screen border-r border-border bg-black/50 backdrop-blur-xl flex flex-col fixed left-0 top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-emerald-600 p-2 rounded-lg">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-xl tracking-tight text-white">Wisowl</span>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-blue-600/10 text-blue-500 font-medium transition-colors">
          <LayoutDashboard className="w-5 h-5" />
          Dashboard
        </Link>
        <Link href="/campaigns" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
          <Send className="w-5 h-5" />
          Campaigns
        </Link>
        <Link href="/leads" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
          <Inbox className="w-5 h-5" />
          Leads
        </Link>
        <Link href="/deliverability" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
          <ShieldAlert className="w-5 h-5" />
          Deliverability
        </Link>
        <Link href="/replies" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
          <MessageCircle className="w-5 h-5" />
          Replies
        </Link>
        <Link href="/api-costs" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
          <BarChart3 className="w-5 h-5" />
          API Costs
        </Link>
      </nav>

      <div className="p-4 border-t border-border">
        <Link href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
          <Settings className="w-5 h-5" />
          Settings
        </Link>
      </div>
    </div>
  );
}
