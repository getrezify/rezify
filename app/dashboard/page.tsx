"use client";

import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";
const TOTAL_UNITS = 25;

type StayCard = {
  id: string;
  unitName: string;
  guestName: string;
  nightsInfo: string;
};

type DbReservation = {
  id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  units?: { name: string } | null;
};

function getTodayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateNights(checkIn: string, checkOut: string) {
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  const nights = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return nights > 0 ? nights : 0;
}

function nightOfStay(checkIn: string, checkOut: string, today: string) {
  const start = new Date(`${checkIn}T12:00:00`).getTime();
  const todayMs = new Date(`${today}T12:00:00`).getTime();
  const dayMs = 1000 * 60 * 60 * 24;
  const currentNight = Math.floor((todayMs - start) / dayMs) + 1;
  const totalNights = calculateNights(checkIn, checkOut);
  return `Night ${currentNight} of ${totalNights}`;
}

function mapToStayCard(
  row: DbReservation,
  nightsInfo: string,
): StayCard {
  return {
    id: row.id,
    unitName: row.units?.name ?? "—",
    guestName: row.guest_name,
    nightsInfo,
  };
}

async function fetchCheckIns(today: string) {
  const { data, error } = await supabase
    .from("reservations")
    .select("*, units(name)")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("check_in", today);

  if (!error) return (data ?? []) as DbReservation[];

  const fallback = await supabase
    .from("reservations")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("check_in", today);

  if (fallback.error) throw new Error(fallback.error.message);
  return (fallback.data ?? []) as DbReservation[];
}

async function fetchCheckOuts(today: string) {
  const { data, error } = await supabase
    .from("reservations")
    .select("*, units(name)")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("check_out", today);

  if (!error) return (data ?? []) as DbReservation[];

  const fallback = await supabase
    .from("reservations")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("check_out", today);

  if (fallback.error) throw new Error(fallback.error.message);
  return (fallback.data ?? []) as DbReservation[];
}

async function fetchOccupied(today: string) {
  const { data, error } = await supabase
    .from("reservations")
    .select("*, units(name)")
    .eq("workspace_id", WORKSPACE_ID)
    .lte("check_in", today)
    .gt("check_out", today);

  if (!error) return (data ?? []) as DbReservation[];

  const fallback = await supabase
    .from("reservations")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .lte("check_in", today)
    .gt("check_out", today);

  if (fallback.error) throw new Error(fallback.error.message);
  return (fallback.data ?? []) as DbReservation[];
}

function formatFullDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function TodayPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [checkIns, setCheckIns] = useState<StayCard[]>([]);
  const [checkOuts, setCheckOuts] = useState<StayCard[]>([]);
  const [occupied, setOccupied] = useState<StayCard[]>([]);
  const [availableCount, setAvailableCount] = useState(TOTAL_UNITS);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const todayLabel = useMemo(() => formatFullDate(new Date()), [refreshKey]);

  const loadBriefing = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);

    const today = getTodayISO();

    try {
      const [checkInRows, checkOutRows, occupiedRows] = await Promise.all([
        fetchCheckIns(today),
        fetchCheckOuts(today),
        fetchOccupied(today),
      ]);

      setCheckIns(
        checkInRows.map((row) => {
          const nights = calculateNights(row.check_in, row.check_out);
          return mapToStayCard(
            row,
            `${nights} ${nights === 1 ? "night" : "nights"} · Check-in today`,
          );
        }),
      );

      setCheckOuts(
        checkOutRows.map((row) => {
          const nights = calculateNights(row.check_in, row.check_out);
          return mapToStayCard(
            row,
            `${nights} ${nights === 1 ? "night" : "nights"} · Check-out today`,
          );
        }),
      );

      setOccupied(
        occupiedRows.map((row) =>
          mapToStayCard(row, nightOfStay(row.check_in, row.check_out, today)),
        ),
      );

      setAvailableCount(Math.max(0, TOTAL_UNITS - occupiedRows.length));
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "Failed to load briefing",
      );
      setCheckIns([]);
      setCheckOuts([]);
      setOccupied([]);
      setAvailableCount(TOTAL_UNITS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBriefing();
  }, [loadBriefing, refreshKey]);

  return (
    <div className="animate-fade-up space-y-8 pb-4">
      <header className="flex items-start justify-between gap-4 pt-4">
        <div>
          <h1 className="font-display text-3xl text-text">Today</h1>
          <p className="mt-1 text-sm text-muted">{todayLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={isLoading}
          className="shrink-0 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          Refresh
        </button>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent"
            aria-hidden
          />
          <p className="mt-3 text-sm text-muted">Loading today&apos;s briefing…</p>
        </div>
      ) : fetchError ? (
        <div className="rounded-xl border border-dashed border-red-500/40 bg-red-500/10 px-4 py-10 text-center">
          <p className="text-sm text-red-300">{fetchError}</p>
        </div>
      ) : (
        <>
          <BriefingSection
            title="Check-ins"
            dotClassName="bg-emerald-500"
            badgeClassName="bg-emerald-500/15 text-emerald-400"
            borderClassName="border-l-emerald-500"
            items={checkIns}
            emptyEmoji="📭"
            emptyMessage="No check-ins scheduled for today"
          />

          <BriefingSection
            title="Check-outs"
            dotClassName="bg-red-500"
            badgeClassName="bg-red-500/15 text-red-400"
            borderClassName="border-l-red-500"
            items={checkOuts}
            emptyEmoji="🧳"
            emptyMessage="No check-outs scheduled for today"
          />

          <BriefingSection
            title="Currently Occupied"
            dotClassName="bg-purple-500"
            badgeClassName="bg-purple-500/15 text-purple-400"
            borderClassName="border-l-purple-500"
            items={occupied}
            emptyEmoji="🏠"
            emptyMessage="No units currently occupied"
          />

          <BriefingSection
            title="Available Tonight"
            dotClassName="bg-emerald-500"
            badgeClassName="bg-emerald-500/15 text-emerald-400"
            borderClassName="border-l-emerald-500"
            items={[]}
            badgeCount={availableCount}
            emptyEmoji="✨"
            emptyMessage="No units available tonight"
            availableSummary={
              availableCount > 0
                ? `${availableCount} ${availableCount === 1 ? "unit" : "units"} available tonight`
                : undefined
            }
          />
        </>
      )}
    </div>
  );
}

function BriefingSection({
  title,
  dotClassName,
  badgeClassName,
  borderClassName,
  items,
  badgeCount,
  emptyEmoji,
  emptyMessage,
  availableSummary,
}: {
  title: string;
  dotClassName: string;
  badgeClassName: string;
  borderClassName: string;
  items: StayCard[];
  badgeCount?: number;
  emptyEmoji: string;
  emptyMessage: string;
  availableSummary?: string;
}) {
  const count = badgeCount ?? items.length;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClassName}`} />
        <h2 className="flex-1 text-sm font-semibold text-text">{title}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${badgeClassName}`}
        >
          {count}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center">
          {availableSummary ? (
            <p className="text-sm font-medium text-emerald-400">
              {availableSummary}
            </p>
          ) : (
            <>
              <span className="text-2xl" role="img" aria-hidden>
                {emptyEmoji}
              </span>
              <p className="mt-2 text-sm text-muted">{emptyMessage}</p>
            </>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
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
