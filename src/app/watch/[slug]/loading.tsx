export default function WatchPageLoading() {
  return (
    <div className="w-full min-h-screen bg-[#0A0A0A] text-white pt-16 sm:pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Video Player Box Skeleton */}
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#141414] border border-white/10 shadow-2xl flex items-center justify-center animate-pulse">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#E50000] border-t-transparent rounded-full animate-spin" />
          </div>
        </div>

        {/* Video Title & Meta Skeleton */}
        <div className="space-y-3 pt-2">
          <div className="h-7 sm:h-9 w-2/3 max-w-md rounded-xl bg-white/10 animate-pulse" />
          <div className="flex gap-2">
            <div className="h-6 w-20 rounded-full bg-white/5 animate-pulse" />
            <div className="h-6 w-16 rounded-full bg-white/5 animate-pulse" />
          </div>
        </div>

        {/* Episode Buttons Grid Skeleton */}
        <div className="space-y-3 pt-4">
          <div className="h-5 w-32 rounded bg-white/10 animate-pulse" />
          <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-12 gap-2">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
