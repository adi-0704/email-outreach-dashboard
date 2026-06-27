export default function Loading() {
  return (
    <div className="p-8 pb-20 sm:p-12 animate-pulse">
      <div className="mb-10 space-y-3">
        <div className="h-8 bg-white/5 rounded-lg w-48" />
        <div className="h-4 bg-white/5 rounded-lg w-64" />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-white/5 rounded-xl border border-white/5" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="h-96 bg-white/5 rounded-xl border border-white/5" />
    </div>
  );
}
