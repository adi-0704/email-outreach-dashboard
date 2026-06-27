export default function Loading() {
  return (
    <div className="p-8 pb-20 sm:p-12 animate-pulse">
      {/* Header skeleton */}
      <div className="mb-10 flex items-center justify-between">
        <div className="space-y-3">
          <div className="h-8 bg-white/5 rounded-lg w-64" />
          <div className="h-4 bg-white/5 rounded-lg w-48" />
        </div>
        <div className="h-10 bg-white/5 rounded-lg w-32" />
      </div>

      {/* 24h snapshot skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-white/5 rounded-xl" />
        ))}
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-white/5 rounded-xl border border-white/5" />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-white/5 rounded-xl border border-white/5" />
        ))}
      </div>

      {/* Chart + Replies skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 h-[400px] bg-white/5 rounded-xl border border-white/5" />
        <div className="h-[400px] bg-white/5 rounded-xl border border-white/5" />
      </div>

      {/* Campaign table skeleton */}
      <div className="h-64 bg-white/5 rounded-xl border border-white/5" />
    </div>
  );
}
