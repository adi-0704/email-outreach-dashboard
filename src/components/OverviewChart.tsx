"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

const data = [
  { date: "Mon", sent: 1200, opened: 800, replied: 120 },
  { date: "Tue", sent: 1500, opened: 950, replied: 140 },
  { date: "Wed", sent: 1800, opened: 1200, replied: 200 },
  { date: "Thu", sent: 2200, opened: 1600, replied: 280 },
  { date: "Fri", sent: 1900, opened: 1400, replied: 210 },
  { date: "Sat", sent: 600, opened: 300, replied: 40 },
  { date: "Sun", sent: 800, opened: 450, replied: 60 },
];

export function OverviewChart() {
  return (
    <div className="glass-card p-6 h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-lg text-white">Engagement Overview</h3>
          <p className="text-sm text-muted-foreground">Emails sent vs opened vs replied over the last 7 days.</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
          <XAxis dataKey="date" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px' }}
            itemStyle={{ color: '#fafafa' }}
          />
          <Area type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSent)" />
          <Area type="monotone" dataKey="opened" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorOpened)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
