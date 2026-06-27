export default function Loading() {
  return (
    <div className="p-8 pb-20 sm:p-12 animate-pulse">
      <div className="mb-10 space-y-3">
        <div className="h-8 bg-white/5 rounded-lg w-40" />
        <div className="h-4 bg-white/5 rounded-lg w-56" />
      </div>

      {/* Search bar skeleton */}
      <div className="mb-6 h-10 bg-white/5 rounded-lg w-full max-w-md border border-white/5" />

      {/* Table skeleton */}
      <div className="h-96 bg-white/5 rounded-xl border border-white/5" />
    </div>
  );
}
