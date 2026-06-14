import { ReactNode } from "react";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  good?: boolean;
  bad?: boolean;
  warn?: boolean;
}

export function KPICard({ title, value, subtitle, icon, good, bad, warn }: KPICardProps) {
  const subtitleColor = good
    ? "text-emerald-400"
    : bad
    ? "text-rose-400"
    : warn
    ? "text-amber-400"
    : "text-muted-foreground";

  return (
    <div className="glass-card p-6 flex flex-col gap-4 hover:border-white/20 transition-colors">
      <div className="flex items-center justify-between">
        <h3 className="text-muted-foreground font-medium">{title}</h3>
        <div className="text-muted-foreground">{icon}</div>
      </div>

      <div>
        <div className="text-3xl font-bold tracking-tight text-white">{value}</div>
        {subtitle && (
          <div className={`text-sm mt-2 font-medium ${subtitleColor}`}>
            <span className="text-emerald-400">0%</span>{" "}
            <span className="text-muted-foreground text-xs">{subtitle}</span>
          </div>
        )}
      </div>
    </div>
  );
}
