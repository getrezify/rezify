"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Source = "airbnb" | "booking" | "offline" | "owner";

type UnitReservation = {
  id: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  price: number;
  currency: "EGP" | "USD";
  source: Source;
};

type DayStatus = "check-in" | "check-out" | "booked" | "available";

const MOCK_UNITS = [
  "Marina View 4B",
  "Palm Heights 12",
  "Downtown Studio 7",
  "Creek Villa 2",
  "Skyline Loft 9",
  "Garden Flat 1A",
];

const MARINA_UNIT = "Marina View 4B";
const MARINA_MAY_KEY = "2026-05";

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

const MARINA_MAY_RESERVATIONS: UnitReservation[] = [
  {
    id: "m1",
    guestName: "James Okonkwo",
    checkIn: "2026-05-03",
    checkOut: "2026-05-07",
    nights: 4,
    price: 5200,
    currency: "EGP",
    source: "booking",
  },
  {
    id: "m2",
    guestName: "Omar Hassan",
    checkIn: "2026-05-12",
    checkOut: "2026-05-15",
    nights: 3,
    price: 2800,
    currency: "EGP",
    source: "offline",
  },
  {
    id: "m3",
    guestName: "Sarah Al-Mansouri",
    checkIn: "2026-05-21",
    checkOut: "2026-05-24",
    nights: 3,
    price: 4500,
    currency: "EGP",
    source: "airbnb",
  },
];

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";

const selectClass =
  "w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text transition-colors focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)] [color-scheme:dark]";

const labelClass = "mb-2 block text-sm font-medium text-text";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMonthOptions() {
  const options: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    options.push({ key, label });
  }
  return options;
}

function formatDateRange(checkIn: string, checkOut: string) {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const start = new Date(`${checkIn}T12:00:00`).toLocaleDateString("en-US", opts);
  const end = new Date(`${checkOut}T12:00:00`).toLocaleDateString("en-US", {
    ...opts,
    year: "numeric",
  });
  return `${start} – ${end}`;
}

function formatRevenue(amount: number, currency: "EGP" | "USD") {
  return `${currency} ${amount.toLocaleString()}`;
}

function parseDate(iso: string) {
  return new Date(`${iso}T12:00:00`);
}

function eachNight(checkIn: string, checkOut: string) {
  const nights: string[] = [];
  const cur = parseDate(checkIn);
  const end = parseDate(checkOut);
  while (cur < end) {
    nights.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`,
    );
    cur.setDate(cur.getDate() + 1);
  }
  return nights;
}

function buildDayStatusMap(
  reservations: UnitReservation[],
  monthKey: string,
): Map<number, DayStatus> {
  const map = new Map<number, DayStatus>();
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    map.set(d, "available");
  }

  for (const r of reservations) {
    const checkIn = parseDate(r.checkIn);
    const checkOut = parseDate(r.checkOut);
    const inKey = `${checkIn.getFullYear()}-${String(checkIn.getMonth() + 1).padStart(2, "0")}`;
    const outKey = `${checkOut.getFullYear()}-${String(checkOut.getMonth() + 1).padStart(2, "0")}`;

    if (inKey === monthKey) {
      const day = checkIn.getDate();
      map.set(day, "check-in");
    }
    if (outKey === monthKey) {
      const day = checkOut.getDate();
      const existing = map.get(day);
      if (existing !== "check-in") {
        map.set(day, "check-out");
      }
    }

    for (const nightIso of eachNight(r.checkIn, r.checkOut)) {
      const [y, m, dayStr] = nightIso.split("-");
      if (`${y}-${m}` === monthKey) {
        const day = Number(dayStr);
        const existing = map.get(day);
        if (existing !== "check-in" && existing !== "check-out") {
          map.set(day, "booked");
        }
      }
    }
  }

  return map;
}

function computeKpis(reservations: UnitReservation[], monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  let egp = 0;
  let usd = 0;
  const occupiedNights = new Set<string>();

  for (const r of reservations) {
    if (r.currency === "EGP") egp += r.price;
    else usd += r.price;
    for (const night of eachNight(r.checkIn, r.checkOut)) {
      if (night.startsWith(monthKey)) occupiedNights.add(night);
    }
  }

  const occupancy = Math.round((occupiedNights.size / daysInMonth) * 100);

  return {
    egp,
    usd,
    occupancy,
    bookings: reservations.length,
  };
}

function dayCellClass(status: DayStatus) {
  switch (status) {
    case "check-in":
      return "bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-500/50";
    case "check-out":
      return "bg-red-500/25 text-red-300 ring-1 ring-red-500/50";
    case "booked":
      return "bg-[var(--accent-muted)] text-accent ring-1 ring-accent/40";
    default:
      return "bg-background text-muted";
  }
}

export default function UnitsPage() {
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const defaultMonth = monthOptions[0]?.key ?? MARINA_MAY_KEY;

  const [unitQuery, setUnitQuery] = useState(MARINA_UNIT);
  const [selectedUnit, setSelectedUnit] = useState(MARINA_UNIT);
  const [unitOpen, setUnitOpen] = useState(false);
  const [monthKey, setMonthKey] = useState(
    monthOptions.some((m) => m.key === MARINA_MAY_KEY)
      ? MARINA_MAY_KEY
      : defaultMonth,
  );
  const [isViewed, setIsViewed] = useState(false);
  const [viewKey, setViewKey] = useState(0);

  const unitRef = useRef<HTMLDivElement>(null);

  const filteredUnits = useMemo(() => {
    const q = unitQuery.trim().toLowerCase();
    if (!q) return MOCK_UNITS;
    return MOCK_UNITS.filter((u) => u.toLowerCase().includes(q));
  }, [unitQuery]);

  const hasMockData =
    selectedUnit === MARINA_UNIT && monthKey === MARINA_MAY_KEY;

  const reservations = hasMockData ? MARINA_MAY_RESERVATIONS : [];

  const kpis = useMemo(
    () => (hasMockData ? computeKpis(reservations, monthKey) : null),
    [hasMockData, reservations, monthKey],
  );

  const dayStatusMap = useMemo(
    () =>
      hasMockData
        ? buildDayStatusMap(reservations, monthKey)
        : new Map<number, DayStatus>(),
    [hasMockData, reservations, monthKey],
  );

  const calendarCells = useMemo(() => {
    const [year, month] = monthKey.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startOffset = firstDay.getDay();

    const cells: ({ type: "empty" } | { type: "day"; day: number })[] = [];
    for (let i = 0; i < startOffset; i++) cells.push({ type: "empty" });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ type: "day", day: d });
    return cells;
  }, [monthKey]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (unitRef.current && !unitRef.current.contains(e.target as Node)) {
        setUnitOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelectUnit(unit: string) {
    setSelectedUnit(unit);
    setUnitQuery(unit);
    setUnitOpen(false);
    setIsViewed(false);
  }

  function handleViewDashboard(e: React.FormEvent) {
    e.preventDefault();
    setIsViewed(true);
    setViewKey((k) => k + 1);
  }

  return (
    <div className="animate-fade-up pb-6">
      <header className="pt-4">
        <h1 className="font-display text-3xl text-text">Units</h1>
        <p className="mt-1 text-sm text-muted">Calendar & stats by unit</p>
      </header>

      <form onSubmit={handleViewDashboard} className="mt-8 space-y-5">
        <div ref={unitRef} className="relative">
          <label htmlFor="units-search" className={labelClass}>
            Unit
          </label>
          <input
            id="units-search"
            type="text"
            value={unitQuery}
            placeholder="Search units..."
            autoComplete="off"
            onChange={(e) => {
              setUnitQuery(e.target.value);
              setSelectedUnit("");
              setUnitOpen(true);
              setIsViewed(false);
            }}
            onFocus={() => setUnitOpen(true)}
            className={inputClass}
          />
          {unitOpen && (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg">
              {filteredUnits.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted">No units found</li>
              ) : (
                filteredUnits.map((unit) => (
                  <li key={unit}>
                    <button
                      type="button"
                      onClick={() => handleSelectUnit(unit)}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-background ${
                        selectedUnit === unit
                          ? "bg-[var(--accent-muted)] text-accent"
                          : "text-text"
                      }`}
                    >
                      {unit}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <div>
          <label htmlFor="month-select" className={labelClass}>
            Month
          </label>
          <select
            id="month-select"
            value={monthKey}
            onChange={(e) => {
              setMonthKey(e.target.value);
              setIsViewed(false);
            }}
            className={selectClass}
          >
            {monthOptions.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-accent py-3.5 text-sm font-semibold text-background transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          View Dashboard
        </button>
      </form>

      {isViewed && (
        <div key={viewKey} className="mt-8 animate-fade-up space-y-6">
          {!hasMockData ? (
            <div className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-10 text-center">
              <span className="text-2xl" role="img" aria-hidden>
                📊
              </span>
              <p className="mt-2 text-sm text-muted">
                No dashboard data for this unit and month yet
              </p>
              <p className="mt-1 text-xs text-muted">
                Try Marina View 4B · May 2026
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted">
                <span className="font-medium text-text">{selectedUnit}</span>
                {" · "}
                {monthOptions.find((m) => m.key === monthKey)?.label}
              </p>

              <div className="grid grid-cols-2 gap-2">
                <KpiCard
                  label="Revenue EGP"
                  value={formatRevenue(kpis!.egp, "EGP")}
                  valueClass="text-accent"
                />
                <KpiCard
                  label="Revenue USD"
                  value={formatRevenue(kpis!.usd, "USD")}
                  valueClass="text-blue-400"
                />
                <KpiCard
                  label="Occupancy"
                  value={`${kpis!.occupancy}%`}
                  valueClass="text-emerald-400"
                />
                <KpiCard
                  label="Bookings"
                  value={String(kpis!.bookings)}
                  valueClass="text-muted"
                />
              </div>

              <section>
                <div className="mb-2 grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((d) => (
                    <div
                      key={d}
                      className="py-1 text-center text-[10px] font-medium uppercase text-muted"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarCells.map((cell, i) =>
                    cell.type === "empty" ? (
                      <div key={`empty-${i}`} className="aspect-square" />
                    ) : (
                      <div
                        key={cell.day}
                        className={`flex aspect-square items-center justify-center rounded-md text-xs font-medium ${dayCellClass(
                          dayStatusMap.get(cell.day) ?? "available",
                        )}`}
                      >
                        {cell.day}
                      </div>
                    ),
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted">
                  <LegendItem color="bg-emerald-500" label="Check-in" />
                  <LegendItem color="bg-red-500" label="Check-out" />
                  <LegendItem color="bg-accent" label="Booked" />
                  <LegendItem color="bg-background ring-1 ring-border" label="Available" />
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold text-text">
                  Reservations
                </h2>
                <ul className="space-y-2">
                  {[...reservations]
                    .sort(
                      (a, b) =>
                        parseDate(b.checkIn).getTime() -
                        parseDate(a.checkIn).getTime(),
                    )
                    .map((r) => (
                      <li
                        key={r.id}
                        className={`rounded-xl border border-border border-l-4 bg-surface px-4 py-3 ${SOURCE_BORDER[r.source]}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-text">
                              {selectedUnit}
                            </p>
                            <p className="mt-0.5 text-sm text-muted">
                              {r.guestName}
                            </p>
                          </div>
                          <p
                            className={`shrink-0 text-sm font-semibold tabular-nums ${
                              r.currency === "EGP"
                                ? "text-accent"
                                : "text-blue-400"
                            }`}
                          >
                            {formatRevenue(r.price, r.currency)}
                          </p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                          <span>
                            {formatDateRange(r.checkIn, r.checkOut)}
                          </span>
                          <span>·</span>
                          <span>
                            {r.nights}{" "}
                            {r.nights === 1 ? "night" : "nights"}
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
            </>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-sm ${color}`} />
      {label}
    </span>
  );
}
