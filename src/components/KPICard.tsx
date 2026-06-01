import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import clsx from "clsx";

interface KPICardProps {
  title: string;
  value: string | number;
  trend: number;
  icon: ReactNode;
  trendLabel?: string;
  trendGoodIfDown?: boolean;
}

export function KPICard({ title, value, trend, icon, trendLabel = "vs last week", trendGoodIfDown = false }: KPICardProps) {
  const isPositiveTrend = trend > 0;
  const isGood = trendGoodIfDown ? !isPositiveTrend : isPositiveTrend;

  return (
    <div className="glass-card p-6 flex flex-col gap-4 hover:border-white/20 transition-colors">
      <div className="flex items-center justify-between">
        <h3 className="text-muted-foreground font-medium">{title}</h3>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      
      <div>
        <div className="text-3xl font-bold tracking-tight text-white">{value}</div>
        <div className="flex items-center gap-2 mt-2">
          <span className={clsx("text-sm font-medium", isGood ? "text-emerald-400" : "text-rose-400")}>
            {isPositiveTrend ? "+" : ""}{trend}%
          </span>
          <span className="text-xs text-muted-foreground">{trendLabel}</span>
        </div>
      </div>
    </div>
  );
}
