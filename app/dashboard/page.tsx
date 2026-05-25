"use client";

import { supabase } from "@/lib/supabase";
import { getWorkspaceId } from "@/lib/workspace";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  property_id?: string;
  properties?: { name: string } | null;
};

type AvailabilityGap = {
  from: string;
  to: string;
  nights: number;
};

type UnitAvailability = {
  unitId: string;
  unitName: string;
  isOccupied: boolean;
  gaps: AvailabilityGap[];
  openEndedFrom: string | null;
};

function getTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function calculateNights(from: string, to: string) {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function nightOfStay(checkIn: string, checkOut: string, today: string) {
  const start = new Date(`${checkIn}T12:00:00`).getTime();
  const todayMs = new Date(`${today}T12:00:00`).getTime();
  const currentNight = Math.floor((todayMs - start) / (1000 * 60 * 60 * 24)) + 1;
  return `Night ${currentNight} of ${calculateNights(checkIn, checkOut)}`;
}

function mapToStayCard(row: DbReservation, nightsInfo: string): StayCard {
  return { id: row.id, unitName: row.properties?.name ?? "Unknown unit", guestName: row.guest_name, nightsInfo };
}

function formatFullDate(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatShortDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function buildUnitAvailability(
  units: { id: string; name: string }[],
  reservations: { property_id: string; check_in: string; check_out: string }[],
  today: string,
): UnitAvailability[] {
  return units.map((unit) => {
    const unitReservations = reservations
      .filter((r) => r.property_id === unit.id)
      .sort((a, b) => a.check_in.localeCompare(b.check_in));

    const isOccupied = unitReservations.some(
      (r) => r.check_in <= today && r.check_out > today,
    );

    const gaps: AvailabilityGap[] = [];
    let pointer = today;

    for (const res of unitReservations) {
      if (res.check_out <= today) continue;
      if (res.check_in > pointer) {
        const nights = calculateNights(pointer, res.check_in);
        if (nights > 0) {
          gaps.push({ from: pointer, to: res.check_in, nights });
        }
      }
      if (res.check_out > pointer) {
        pointer = res.check_out;
      }
    }

    return { unitId: unit.id, unitName: unit.name, isOccupied, gaps, openEndedFrom: pointer };
  });
}

function NoUnitsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface text-3xl">
        🏠
      </div>
      <h2 className="font-display text-xl text-text">No units yet</h2>
      <p className="mt-2 max-w-xs text-sm text-muted">
        Add your first property to start tracking check-ins, check-outs, and reservations.
      </p>
      <Link
        href="/dashboard/properties/add"
        className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-accent-hover"
      >
        + Add your first unit
      </Link>
    </div>
  );
}

function AvailabilitySection({ units }: { units: UnitAvailability[] }) {
  const availableCount = units.filter((u) => !u.isOccupied).length;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
        <h2 className="flex-1 text-sm font-semibold text-text">Available Tonight</h2>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-400">
          {availableCount}
        </span>
      </div>

      {units.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center">
          <span className="text-2xl">🌙</span>
          <p className="mt-2 text-sm text-muted">No units available tonight</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {units.map((unit) => (
            <li key={unit.unitId} className="rounded-xl border border-border bg-surface px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-text">{unit.unitName}</p>
                {unit.isOccupied ? (
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
                    Occupied
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                    Free tonight
                  </span>
                )}
              </div>

              <div className="mt-2 space-y-1">
                {unit.gaps.length === 0 ? (
                  <p className="text-xs text-muted">
                    🟢 No upcoming bookings from {formatShortDate(unit.openEndedFrom!)}
                  </p>
                ) : (
                  <>
                    {unit.gaps.map((gap, i) => (
                      <p key={i} className="text-xs text-muted">
                        🟡 Available {formatShortDate(gap.from)} to {formatShortDate(gap.to)} — {gap.nights} {gap.nights === 1 ? "night" : "nights"}
                      </p>
                    ))}
                    <p className="text-xs text-muted">
                      🟢 No upcoming bookings from {formatShortDate(unit.openEndedFrom!)}
                    </p>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function TodayPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [checkIns, setCheckIns] = useState<StayCard[]>([]);
  const [checkOuts, setCheckOuts] = useState<StayCard[]>([]);
  const [occupied, setOccupied] = useState<StayCard[]>([]);
  const [unitAvailability, setUnitAvailability] = useState<UnitAvailability[]>([]);
  const [hasUnits, setHasUnits] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const todayLabel = useMemo(() => formatFullDate(new Date()), [refreshKey]);

  const loadBriefing = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    const today = getTodayISO();

    try {
      const workspaceId = await getWorkspaceId();

      const [unitsRes, checkInRows, checkOutRows, occupiedRows, futureRes] = await Promise.all([
        supabase.from("properties").select("id, name").eq("workspace_id", workspaceId),
        supabase.from("reservations").select("*, properties(name)").eq("workspace_id", workspaceId).eq("check_in", today),
        supabase.from("reservations").select("*, properties(name)").eq("workspace_id", workspaceId).eq("check_out", today),
        supabase.from("reservations").select("*, properties(name)").eq("workspace_id", workspaceId).lte("check_in", today).gt("check_out", today),
        supabase.from("reservations").select("property_id, check_in, check_out").eq("workspace_id", workspaceId).gte("check_out", today).order("check_in"),
      ]);

      const units = (unitsRes.data ?? []) as { id: string; name: string }[];
      setHasUnits(units.length > 0);

      setCheckIns(
        ((checkInRows.data ?? []) as DbReservation[]).map((row) => {
          const n = calculateNights(row.check_in, row.check_out);
          return mapToStayCard(row, `${n} ${n === 1 ? "night" : "nights"} - Check-in today`);
        }),
      );
      setCheckOuts(
        ((checkOutRows.data ?? []) as DbReservation[]).map((row) => {
          const n = calculateNights(row.check_in, row.check_out);
          return mapToStayCard(row, `${n} ${n === 1 ? "night" : "nights"} - Check-out today`);
        }),
      );
      setOccupied(
        ((occupiedRows.data ?? []) as DbReservation[]).map((row) =>
          mapToStayCard(row, nightOfStay(row.check_in, row.check_out, today)),
        ),
      );

      const availability = buildUnitAvailability(
        units,
        (futureRes.data ?? []) as { property_id: string; check_in: string; check_out: string }[],
        today,
      );
      setUnitAvailability(availability);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load briefing");
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
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
          <p className="mt-3 text-sm text-muted">Loading today&apos;s briefing...</p>
        </div>
      ) : fetchError ? (
        <div className="rounded-xl border border-dashed border-red-500/40 bg-red-500/10 px-4 py-10 text-center">
          <p className="text-sm text-red-300">{fetchError}</p>
        </div>
      ) : !hasUnits ? (
        <NoUnitsEmptyState />
      ) : (
        <>
          <BriefingSection title="Check-ins" dotClassName="bg-emerald-500" badgeClassName="bg-emerald-500/15 text-emerald-400" borderClassName="border-l-emerald-500" items={checkIns} emptyEmoji="📋" emptyMessage="No check-ins scheduled for today" />
          <BriefingSection title="Check-outs" dotClassName="bg-red-500" badgeClassName="bg-red-500/15 text-red-400" borderClassName="border-l-red-500" items={checkOuts} emptyEmoji="👋" emptyMessage="No check-outs scheduled for today" />
          <BriefingSection title="Currently Occupied" dotClassName="bg-purple-500" badgeClassName="bg-purple-500/15 text-purple-400" borderClassName="border-l-purple-500" items={occupied} emptyEmoji="🛋️" emptyMessage="No units currently occupied" />
          <AvailabilitySection units={unitAvailability} />
        </>
      )}
    </div>
  );
}

function BriefingSection({ title, dotClassName, badgeClassName, borderClassName, items, emptyEmoji, emptyMessage }: {
  title: string; dotClassName: string; badgeClassName: string; borderClassName: string;
  items: StayCard[]; emptyEmoji: string; emptyMessage: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClassName}`} />
        <h2 className="flex-1 text-sm font-semibold text-text">{title}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${badgeClassName}`}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center">
          <span className="text-2xl" role="img" aria-hidden>{emptyEmoji}</span>
          <p className="mt-2 text-sm text-muted">{emptyMessage}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className={`rounded-xl border border-border border-l-4 bg-surface px-4 py-3 ${borderClassName}`}>
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
