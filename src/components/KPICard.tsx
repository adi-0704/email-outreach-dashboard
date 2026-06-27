import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  good?: boolean;
  bad?: boolean;
  warn?: boolean;
  goodThreshold?: number;
  trend?: string;
  trendUp?: boolean;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  good,
  bad,
  warn,
  goodThreshold,
  trend,
  trendUp,
}: KPICardProps) {
  const subtitleColor = good
    ? "text-emerald-400"
    : bad
    ? "text-rose-400"
    : warn
    ? "text-amber-400"
    : "text-muted-foreground";

  // Determine if the value itself is good/bad based on threshold
  let valueColor = "text-white";
  if (good && goodThreshold !== undefined && typeof value === "string") {
    const num = parseFloat(value.replace(/[^0-9.]/g, ""));
    if (!isNaN(num)) {
      valueColor = num >= goodThreshold ? "text-emerald-400" : "text-amber-400";
    }
  }

  return (
    <div className="glass-card p-5 flex flex-col gap-3 hover:border-white/20 transition-colors group">
      <div className="flex items-center justify-between">
        <h3 className="text-muted-foreground font-medium text-sm">{title}</h3>
        <div className="text-muted-foreground group-hover:text-white transition-colors">
          {icon}
        </div>
      </div>

      <div>
        <div className={`text-2xl font-bold tracking-tight ${valueColor}`}>
          {value}
        </div>
        {subtitle && (
          <div className={`text-sm mt-1 font-medium flex items-center gap-2 ${subtitleColor}`}>
            {trend && (
              <span
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  trendUp === true
                    ? "bg-emerald-500/10 text-emerald-400"
                    : trendUp === false
                    ? "bg-rose-500/10 text-rose-400"
                    : "bg-white/5 text-muted-foreground"
                }`}
              >
                {trendUp === true ? (
                  <TrendingUp className="w-3 h-3" />
                ) : trendUp === false ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <Minus className="w-3 h-3" />
                )}
                {trend}
              </span>
            )}
            <span className="text-muted-foreground text-xs">{subtitle}</span>
          </div>
        )}
      </div>
    </div>
  );
}
