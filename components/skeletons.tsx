export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 space-y-2">
      <div className="skeleton h-4 w-2/3" />
      <div className="skeleton h-3 w-1/2" />
      <div className="skeleton h-3 w-1/3" />
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-3 space-y-2">
      <div className="skeleton h-2 w-1/2" />
      <div className="skeleton h-6 w-2/3" />
    </div>
  );
}

export function SectionSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="skeleton h-2 w-2 rounded-full" />
        <div className="skeleton h-3 w-24" />
        <div className="skeleton ml-auto h-4 w-6 rounded-full" />
      </div>
      {Array.from({ length: cards }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TodaySkeleton() {
  return (
    <div className="space-y-8 pb-4 pt-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="skeleton h-8 w-24" />
          <div className="skeleton h-3 w-40" />
        </div>
        <div className="skeleton h-8 w-16 rounded-lg" />
      </div>
      <SectionSkeleton cards={1} />
      <SectionSkeleton cards={1} />
      <SectionSkeleton cards={2} />
    </div>
  );
}
