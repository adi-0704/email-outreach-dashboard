"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Send,
  Inbox,
  MessageCircle,
  BarChart3,
  Settings,
  ShieldAlert,
  Zap,
  ChevronRight,
  HelpCircle,
} from "lucide-react";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard", shortcut: "D" },
  { href: "/campaigns", icon: Send, label: "Campaigns", shortcut: "C" },
  { href: "/leads", icon: Inbox, label: "Leads", shortcut: "L" },
  { href: "/replies", icon: MessageCircle, label: "Replies", shortcut: "R" },
  { href: "/deliverability", icon: ShieldAlert, label: "Deliverability", shortcut: "V" },
  { href: "/api-costs", icon: BarChart3, label: "API Costs", shortcut: "A" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 h-screen border-r border-border bg-black/50 backdrop-blur-xl flex flex-col fixed left-0 top-0 z-50">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center border-b border-white/5">
        <Image
          src="/wisowl-logo-v2.png"
          alt="WisOwl"
          width={190}
          height={52}
          priority
          style={{ objectFit: "contain" }}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider px-3 mb-2">
          Overview
        </div>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-blue-600/10 text-blue-500 border border-blue-500/20"
                  : "text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <item.icon className="w-[18px] h-[18px]" />
              <span className="flex-1">{item.label}</span>
              <span className="text-[10px] text-muted-foreground/40 font-mono bg-white/5 px-1.5 py-0.5 rounded">
                ⌘{item.shortcut}
              </span>
              {isActive && <ChevronRight className="w-4 h-4 text-blue-500" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-3 border-t border-white/5 space-y-1">
        <Link
          href="#"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
        >
          <Settings className="w-[18px] h-[18px]" />
          <span className="flex-1">Settings</span>
        </Link>
        <Link
          href="#"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
        >
          <HelpCircle className="w-[18px] h-[18px]" />
          <span className="flex-1">Help & Support</span>
        </Link>
        <div className="px-3 py-2 mt-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <Zap className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-xs font-medium text-emerald-400">
                System Active
              </div>
              <div className="text-[10px] text-muted-foreground">
                All services running
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
