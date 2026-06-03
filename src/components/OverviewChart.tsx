"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

type ChartDataPoint = {
  date: string;
  sent: number;
  delivered: number;
  replied: number;
};

export function OverviewChart({ data }: { data: ChartDataPoint[] }) {
  return (
    <div className="glass-card p-6 h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-lg text-white">Engagement Overview</h3>
          <p className="text-sm text-muted-foreground">Sent vs Delivered vs Replied — last 7 days.</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorReplied" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
          <XAxis dataKey="date" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px' }}
            itemStyle={{ color: '#fafafa' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px', color: '#a1a1aa', paddingTop: '8px' }} />
          <Area type="monotone" dataKey="sent" name="Sent" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSent)" />
          <Area type="monotone" dataKey="delivered" name="Delivered" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorDelivered)" />
          <Area type="monotone" dataKey="replied" name="Replied" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorReplied)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
