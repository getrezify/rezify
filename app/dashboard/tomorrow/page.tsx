"use client";

import { useMemo, useState } from "react";

type StayCard = {
  unitName: string;
  guestName: string;
  nightsInfo: string;
};

const mockCheckIns: StayCard[] = [
  {
    unitName: "Bay Tower 3C",
    guestName: "Fatima Al-Rashid",
    nightsInfo: "4 nights · Check-in 4:00 PM",
  },
  {
    unitName: "Old Town Suite 5",
    guestName: "David Chen",
    nightsInfo: "2 nights · Check-in 3:00 PM",
  },
  {
    unitName: "Harbor House 8",
    guestName: "Amira Khalil",
    nightsInfo: "6 nights · Check-in 2:00 PM",
  },
];

const mockCheckOuts: StayCard[] = [
  {
    unitName: "Marina View 4B",
    guestName: "Sarah Al-Mansouri",
    nightsInfo: "3 nights · Check-out 11:00 AM",
  },
  {
    unitName: "Palm Heights 12",
    guestName: "James Okonkwo",
    nightsInfo: "5 nights · Check-out 10:00 AM",
  },
];

function getTomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date;
}

function formatFullDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function TomorrowPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const tomorrowLabel = useMemo(
    () => formatFullDate(getTomorrow()),
    [refreshKey],
  );

  return (
    <div key={refreshKey} className="animate-fade-up space-y-8 pb-4">
      <header className="flex items-start justify-between gap-4 pt-4">
        <div>
          <h1 className="font-display text-3xl text-text">Tomorrow</h1>
          <p className="mt-1 text-sm text-muted">{tomorrowLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="shrink-0 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text transition-colors hover:border-accent hover:text-accent"
        >
          Refresh
        </button>
      </header>

      <BriefingSection
        title="Check-ins"
        dotClassName="bg-emerald-500"
        badgeClassName="bg-emerald-500/15 text-emerald-400"
        borderClassName="border-l-emerald-500"
        items={mockCheckIns}
        emptyEmoji="📭"
        emptyMessage="No check-ins scheduled for tomorrow"
      />

      <BriefingSection
        title="Check-outs"
        dotClassName="bg-red-500"
        badgeClassName="bg-red-500/15 text-red-400"
        borderClassName="border-l-red-500"
        items={mockCheckOuts}
        emptyEmoji="🧳"
        emptyMessage="No check-outs scheduled for tomorrow"
      />
    </div>
  );
}

function BriefingSection({
  title,
  dotClassName,
  badgeClassName,
  borderClassName,
  items,
  emptyEmoji,
  emptyMessage,
}: {
  title: string;
  dotClassName: string;
  badgeClassName: string;
  borderClassName: string;
  items: StayCard[];
  emptyEmoji: string;
  emptyMessage: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClassName}`} />
        <h2 className="flex-1 text-sm font-semibold text-text">{title}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${badgeClassName}`}
        >
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center">
          <span className="text-2xl" role="img" aria-hidden>
            {emptyEmoji}
          </span>
          <p className="mt-2 text-sm text-muted">{emptyMessage}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={`${title}-${item.unitName}`}
              className={`rounded-xl border border-border border-l-4 bg-surface px-4 py-3 ${borderClassName}`}
            >
              <p className="font-semibold text-text">{item.unitName}</p>
              <p className="mt-0.5 text-sm text-muted">{item.guestName}</p>
              <p className="mt-1 text-xs text-muted/80">{item.nightsInfo}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
