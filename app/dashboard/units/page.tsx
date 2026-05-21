"use client";

import { supabase } from "@/lib/supabase";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

type Property = {
  id: string;
  name: string;
};

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

type DbReservation = {
  id: string;
  guest_name: string;
  source: string;
  check_in: string;
  check_out: string;
  total_price: number;
  currency: string;
  status?: string | null;
  properties?: { name: string } | null;
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

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";

const selectClass =
  "w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text transition-colors focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)] [color-scheme:dark]";

const labelClass = "mb-2 block text-sm font-medium text-text";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isSource(value: string): value is Source {
  return value in SOURCE_LABELS;
}

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

function getMonthBounds(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = `${monthKey}-01`;
  const nextMonth =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  return { monthStart, nextMonth, daysInMonth };
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

function calculateNights(checkIn: string, checkOut: string) {
  const nights = Math.round(
    (parseDate(checkOut).getTime() - parseDate(checkIn).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  return nights > 0 ? nights : 0;
}

function mapRow(row: DbReservation): UnitReservation | null {
  if (!isSource(row.source)) return null;
  return {
    id: row.id,
    guestName: row.guest_name,
    checkIn: row.check_in,
    checkOut: row.check_out,
    nights: calculateNights(row.check_in, row.check_out),
    price: Number(row.total_price),
    currency: row.currency === "USD" ? "USD" : "EGP",
    source: row.source,
  };
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
  const { daysInMonth } = getMonthBounds(monthKey);

  for (let d = 1; d <= daysInMonth; d++) {
    map.set(d, "available");
  }

  for (const r of reservations) {
    const checkIn = parseDate(r.checkIn);
    const checkOut = parseDate(r.checkOut);
    const inKey = `${checkIn.getFullYear()}-${String(checkIn.getMonth() + 1).padStart(2, "0")}`;
    const outKey = `${checkOut.getFullYear()}-${String(checkOut.getMonth() + 1).padStart(2, "0")}`;

    if (inKey === monthKey) {
      map.set(checkIn.getDate(), "check-in");
    }
    if (outKey === monthKey) {
      const day = checkOut.getDate();
      if (map.get(day) !== "check-in") {
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
  const { daysInMonth } = getMonthBounds(monthKey);

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
  const defaultMonth = monthOptions[0]?.key ?? "";

  const [properties, setProperties] = useState<Property[]>([]);
  const [unitQuery, setUnitQuery] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [unitOpen, setUnitOpen] = useState(false);
  const [menuRect, setMenuRect] = useState({ top: 0, left: 0, width: 0 });
  const [monthKey, setMonthKey] = useState(defaultMonth);
  const [isViewed, setIsViewed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [viewKey, setViewKey] = useState(0);
  const [reservations, setReservations] = useState<UnitReservation[]>([]);
  const [displayPropertyName, setDisplayPropertyName] = useState("");

  const unitRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  const filteredProperties = useMemo(() => {
    const q = unitQuery.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) => p.name.toLowerCase().includes(q));
  }, [unitQuery, properties]);

  const kpis = useMemo(
    () => computeKpis(reservations, monthKey),
    [reservations, monthKey],
  );

  const dayStatusMap = useMemo(
    () => buildDayStatusMap(reservations, monthKey),
    [reservations, monthKey],
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

  const loadProperties = useCallback(async () => {
    const { data, error } = await supabase
      .from("properties")
      .select("id, name")
      .eq("workspace_id", WORKSPACE_ID)
      .order("name");

    if (error || !data) {
      setProperties([]);
      return;
    }

    setProperties(
      data
        .map((row) => ({
          id: row.id as string,
          name: row.name as string,
        }))
        .filter((p) => p.name?.trim()),
    );
  }, []);

  const fetchDashboard = useCallback(
    async (propertyId: string, propertyName: string, month: string) => {
      setIsLoading(true);
      setReservations([]);
      setDisplayPropertyName(propertyName);

      const { monthStart, nextMonth } = getMonthBounds(month);

      const { data, error } = await supabase
        .from("reservations")
        .select(
          "id, guest_name, source, check_in, check_out, total_price, currency, status, properties(name)",
        )
        .eq("workspace_id", WORKSPACE_ID)
        .eq("property_id", propertyId)
        .or("status.neq.cancelled,status.is.null")
        .lt("check_in", nextMonth)
        .gt("check_out", monthStart);

      if (error) {
        const fallback = await supabase
          .from("reservations")
          .select(
            "id, guest_name, source, check_in, check_out, total_price, currency, status",
          )
          .eq("workspace_id", WORKSPACE_ID)
          .eq("property_id", propertyId)
          .or("status.neq.cancelled,status.is.null")
          .lt("check_in", nextMonth)
          .gt("check_out", monthStart);

        const mapped = (fallback.data ?? [])
          .map((row) => mapRow(row as DbReservation))
          .filter((r): r is UnitReservation => r !== null);
        setReservations(mapped);
        setIsLoading(false);
        return;
      }

      const mapped = (data ?? [])
        .map((row) => mapRow(row as unknown as DbReservation))
        .filter((r): r is UnitReservation => r !== null);
      setReservations(mapped);
      setIsLoading(false);
    },
    [],
  );

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  useLayoutEffect(() => {
    if (!unitOpen || !unitRef.current) return;

    function updatePosition() {
      if (!unitRef.current) return;
      const rect = unitRef.current.getBoundingClientRect();
      setMenuRect({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [unitOpen, unitQuery, filteredProperties.length]);

  useEffect(() => {
    if (!unitOpen) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (unitRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setUnitOpen(false);
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setUnitOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [unitOpen]);

  function handleSelectProperty(property: Property) {
    setSelectedPropertyId(property.id);
    setUnitQuery(property.name);
    setUnitOpen(false);
    setIsViewed(false);
  }

  function resolveProperty() {
    const id =
      selectedPropertyId ||
      properties.find((p) => p.name === unitQuery.trim())?.id;
    const name =
      properties.find((p) => p.id === id)?.name ?? unitQuery.trim();
    return id ? { id, name } : null;
  }

  async function handleViewDashboard(e: React.FormEvent) {
    e.preventDefault();

    const property = resolveProperty();
    if (!property) return;

    setIsViewed(true);
    setViewKey((k) => k + 1);
    await fetchDashboard(property.id, property.name, monthKey);
  }

  return (
    <div className="animate-fade-up pb-6">
      <header className="pt-4">
        <h1 className="font-display text-3xl text-text">Units</h1>
        <p className="mt-1 text-sm text-muted">Calendar & stats by unit</p>
      </header>

      <form onSubmit={handleViewDashboard} className="mt-8 space-y-5">
        <div ref={unitRef}>
          <label htmlFor="units-search" className={labelClass}>
            Unit
          </label>
          <input
            id="units-search"
            type="text"
            value={unitQuery}
            placeholder="Search units..."
            autoComplete="off"
            aria-expanded={unitOpen}
            aria-haspopup="listbox"
            onChange={(e) => {
              setUnitQuery(e.target.value);
              setSelectedPropertyId("");
              setUnitOpen(true);
              setIsViewed(false);
            }}
            onFocus={() => setUnitOpen(true)}
            className={inputClass}
          />
        </div>
        {unitOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <ul
              ref={dropdownRef}
              role="listbox"
              style={{
                top: menuRect.top,
                left: menuRect.left,
                width: menuRect.width,
              }}
              className="fixed z-[100] max-h-48 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-xl"
            >
              {filteredProperties.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted">No units found</li>
              ) : (
                filteredProperties.map((property) => (
                  <li key={property.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectProperty(property)}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-background ${
                        selectedPropertyId === property.id
                          ? "bg-[var(--accent-muted)] text-accent"
                          : "text-text"
                      }`}
                    >
                      {property.name}
                    </button>
                  </li>
                ))
              )}
            </ul>,
            document.body,
          )}

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
          disabled={isLoading}
          className="w-full rounded-lg bg-accent py-3.5 text-sm font-semibold text-background transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Loading…" : "View Dashboard"}
        </button>
      </form>

      {isViewed && (
        <div key={viewKey} className="mt-8 animate-fade-up space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent"
                aria-hidden
              />
              <p className="mt-3 text-sm text-muted">Loading unit dashboard…</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted">
                <span className="font-medium text-text">
                  {displayPropertyName}
                </span>
                {" · "}
                {monthOptions.find((m) => m.key === monthKey)?.label}
              </p>

              <div className="grid grid-cols-2 gap-2">
                <KpiCard
                  label="Revenue EGP"
                  value={formatRevenue(kpis.egp, "EGP")}
                  valueClass="text-accent"
                />
                <KpiCard
                  label="Revenue USD"
                  value={formatRevenue(kpis.usd, "USD")}
                  valueClass="text-blue-400"
                />
                <KpiCard
                  label="Occupancy"
                  value={`${kpis.occupancy}%`}
                  valueClass="text-emerald-400"
                />
                <KpiCard
                  label="Bookings"
                  value={String(kpis.bookings)}
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
                  <LegendItem
                    color="bg-background ring-1 ring-border"
                    label="Available"
                  />
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold text-text">
                  Reservations
                </h2>
                {reservations.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center">
                    <p className="text-sm text-muted">
                      No reservations this month
                    </p>
                  </div>
                ) : (
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
                                {displayPropertyName}
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
                )}
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
