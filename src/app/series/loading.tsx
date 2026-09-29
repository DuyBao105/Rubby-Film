export default function SeriesLoading() {
  return (
    <div className="w-full min-h-screen bg-[#0F0F0F] text-white pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="space-y-2">
          <div className="h-8 sm:h-10 w-48 rounded-xl bg-white/10 animate-pulse" />
          <div className="h-4 w-72 rounded bg-white/5 animate-pulse" />
        </div>
        <div className="h-11 w-36 rounded-xl bg-white/10 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="aspect-[2/3] w-full rounded-2xl bg-[#1A1A1A] border border-white/5 animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-white/10 animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
