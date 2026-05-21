"use client";

import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

type Source = "airbnb" | "booking" | "offline" | "owner";

type HistoryReservation = {
  id: string;
  unitName: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  price: number;
  currency: "EGP" | "USD";
  source: Source;
  createdAt: string;
};

type DbReservation = {
  id: string;
  guest_name: string;
  source: string;
  check_in: string;
  check_out: string;
  total_price: number;
  currency: string;
  created_at: string;
  units?: { name: string } | null;
};

const SOURCE_LABELS: Record<Source, string> = {
  airbnb: "Airbnb",
  booking: "Booking.com",
  offline: "Offline",
  owner: "Owner",
};

const SOURCE_BORDER: Record<Source, string> = {
  airbnb: "border-l-red-500",
  booking: "border-l-blue-500",
  offline: "border-l-emerald-500",
  owner: "border-l-purple-500",
};

const SOURCE_DOT: Record<Source, string> = {
  airbnb: "bg-red-500",
  booking: "bg-blue-500",
  offline: "bg-emerald-500",
  owner: "bg-purple-500",
};

const selectClass =
  "w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text transition-colors focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)] [color-scheme:dark]";

function isSource(value: string): value is Source {
  return value in SOURCE_LABELS;
}

function calculateNights(checkIn: string, checkOut: string) {
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  const nights = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return nights > 0 ? nights : 0;
}

function mapReservation(row: DbReservation): HistoryReservation | null {
  if (!isSource(row.source)) return null;
  const currency = row.currency === "USD" ? "USD" : "EGP";

  return {
    id: row.id,
    unitName: row.units?.name ?? "—",
    guestName: row.guest_name,
    checkIn: row.check_in,
    checkOut: row.check_out,
    nights: calculateNights(row.check_in, row.check_out),
    price: Number(row.total_price),
    currency,
    source: row.source,
    createdAt: row.created_at,
  };
}

function monthKeyFromCheckIn(checkIn: string) {
  const d = new Date(`${checkIn}T12:00:00`);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatDateRange(checkIn: string, checkOut: string) {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  const start = new Date(`${checkIn}T12:00:00`).toLocaleDateString(
    "en-US",
    opts,
  );
  const end = new Date(`${checkOut}T12:00:00`).toLocaleDateString("en-US", {
    ...opts,
    year: "numeric",
  });
  return `${start} – ${end}`;
}

function formatRevenue(amount: number, currency: "EGP" | "USD") {
  return `${currency} ${amount.toLocaleString()}`;
}

export default function HistoryPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [monthFilter, setMonthFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [reservations, setReservations] = useState<HistoryReservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchReservations = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);

    const { data, error } = await supabase
      .from("reservations")
      .select("*, units(name)")
      .eq("workspace_id", WORKSPACE_ID)
      .order("created_at", { ascending: false });

    if (error) {
      const fallback = await supabase
        .from("reservations")
        .select("*")
        .eq("workspace_id", WORKSPACE_ID)
        .order("created_at", { ascending: false });

      if (fallback.error) {
        setFetchError(fallback.error.message);
        setReservations([]);
        setIsLoading(false);
        return;
      }

      const mapped = (fallback.data as DbReservation[])
        .map(mapReservation)
        .filter((r): r is HistoryReservation => r !== null);
      setReservations(mapped);
      setIsLoading(false);
      return;
    }

    const mapped = (data as DbReservation[])
      .map(mapReservation)
      .filter((r): r is HistoryReservation => r !== null);
    setReservations(mapped);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations, refreshKey]);

  const monthOptions = useMemo(() => {
    const keys = [
      ...new Set(reservations.map((r) => monthKeyFromCheckIn(r.checkIn))),
    ].sort((a, b) => b.localeCompare(a));
    return keys;
  }, [reservations]);

  const filtered = useMemo(() => {
    return reservations
      .filter((r) => {
        const monthMatch =
          monthFilter === "all" ||
          monthKeyFromCheckIn(r.checkIn) === monthFilter;
        const sourceMatch =
          sourceFilter === "all" || r.source === sourceFilter;
        return monthMatch && sourceMatch;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [reservations, monthFilter, sourceFilter]);

  const summary = useMemo(() => {
    let egp = 0;
    let usd = 0;
    for (const r of filtered) {
      if (r.currency === "EGP") egp += r.price;
      else usd += r.price;
    }
    return { count: filtered.length, egp, usd };
  }, [filtered]);

  const grouped = useMemo(() => {
    const map = new Map<string, HistoryReservation[]>();
    for (const r of filtered) {
      const key = monthKeyFromCheckIn(r.checkIn);
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, groupReservations]) => {
        let egp = 0;
        let usd = 0;
        for (const r of groupReservations) {
          if (r.currency === "EGP") egp += r.price;
          else usd += r.price;
        }
        return {
          key,
          label: formatMonthLabel(key),
          reservations: groupReservations,
          egp,
          usd,
        };
      });
  }, [filtered]);

  return (
    <div className="animate-fade-up pb-6">
      <header className="flex items-start justify-between gap-4 pt-4">
        <div>
          <h1 className="font-display text-3xl text-text">History</h1>
          <p className="mt-1 text-sm text-muted">All reservations</p>
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

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="month-filter"
            className="mb-2 block text-xs font-medium text-muted"
          >
            Filter by Month
          </label>
          <select
            id="month-filter"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className={selectClass}
            disabled={isLoading}
          >
            <option value="all">All months</option>
            {monthOptions.map((key) => (
              <option key={key} value={key}>
                {formatMonthLabel(key)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="source-filter"
            className="mb-2 block text-xs font-medium text-muted"
          >
            Filter by Source
          </label>
          <select
            id="source-filter"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className={selectClass}
            disabled={isLoading}
          >
            <option value="all">All sources</option>
            {(Object.keys(SOURCE_LABELS) as Source[]).map((src) => (
              <option key={src} value={src}>
                {SOURCE_LABELS[src]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
        <span className="font-semibold text-text">
          {summary.count} {summary.count === 1 ? "booking" : "bookings"}
        </span>
        <span className="text-muted">·</span>
        <span className="font-medium text-accent">
          {formatRevenue(summary.egp, "EGP")}
        </span>
        <span className="text-muted">·</span>
        <span className="font-medium text-blue-400">
          {formatRevenue(summary.usd, "USD")}
        </span>
      </div>

      <div className="mt-6 space-y-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent"
              aria-hidden
            />
            <p className="mt-3 text-sm text-muted">Loading reservations…</p>
          </div>
        ) : fetchError ? (
          <div className="rounded-xl border border-dashed border-red-500/40 bg-red-500/10 px-4 py-10 text-center">
            <p className="text-sm text-red-300">{fetchError}</p>
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-10 text-center">
            <span className="text-2xl" role="img" aria-hidden>
              📋
            </span>
            <p className="mt-2 text-sm text-muted">
              No reservations match your filters
            </p>
          </div>
        ) : (
          grouped.map((group) => (
            <section key={group.key}>
              <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h2 className="font-display text-lg text-text">
                  {group.label}
                </h2>
                <span className="text-xs text-muted">
                  {group.reservations.length}{" "}
                  {group.reservations.length === 1 ? "booking" : "bookings"}
                  {" · "}
                  <span className="text-accent">
                    {formatRevenue(group.egp, "EGP")}
                  </span>
                  {group.usd > 0 && (
                    <>
                      {" · "}
                      <span className="text-blue-400">
                        {formatRevenue(group.usd, "USD")}
                      </span>
                    </>
                  )}
                </span>
              </div>

              <ul className="space-y-2">
                {group.reservations.map((r) => (
                  <li
                    key={r.id}
                    className={`rounded-xl border border-border border-l-4 bg-surface px-4 py-3 ${SOURCE_BORDER[r.source]}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-text">{r.unitName}</p>
                        <p className="mt-0.5 text-sm text-muted">
                          {r.guestName}
                        </p>
                      </div>
                      <p
                        className={`shrink-0 text-sm font-semibold tabular-nums ${
                          r.currency === "EGP" ? "text-accent" : "text-blue-400"
                        }`}
                      >
                        {formatRevenue(r.price, r.currency)}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span>{formatDateRange(r.checkIn, r.checkOut)}</span>
                      <span>·</span>
                      <span>
                        {r.nights} {r.nights === 1 ? "night" : "nights"}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${SOURCE_DOT[r.source]}`}
                        />
                        {SOURCE_LABELS[r.source]}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
