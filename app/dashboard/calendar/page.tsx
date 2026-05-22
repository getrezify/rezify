"use client";

import {
  isBookingSource,
  SourceBadge,
  type BookingSource,
} from "@/lib/booking-source";
import { supabase } from "@/lib/supabase";
import { getWorkspaceId } from "@/lib/workspace";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const UNIT_COL_WIDTH = 160;
const DAY_COL_WIDTH = 36;
const ROW_HEIGHT = 52;
const BAR_HEIGHT = 36;
const BAR_TOP = (ROW_HEIGHT - BAR_HEIGHT) / 2;

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";

const labelClass = "mb-2 block text-sm font-medium text-text";

type ViewMode = "all" | "single";
type Currency = "EGP" | "USD";

type Property = { id: string; name: string };

type Reservation = {
  id: string;
  propertyId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: string | null;
  source: BookingSource;
  price: number;
  currency: Currency;
};

type DayColumn = {
  iso: string;
  isToday: boolean;
  label: string;
  weekday: string;
};

type BarLayout = {
  reservation: Reservation;
  left: number;
  width: number;
  showCheckInEdge: boolean;
  showCheckOutEdge: boolean;
  showGuestName: boolean;
  showBadge: boolean;
};

type SelectedBooking = {
  reservation: Reservation;
  unitName: string;
};

type DbReservation = {
  id: string;
  property_id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  source: string;
  total_price: number;
  currency: string;
  status?: string | null;
};

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getTodayISO() {
  return toISODate(new Date());
}

function toISODate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(iso: string) {
  return new Date(`${iso}T12:00:00`);
}

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getMonthBounds(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = `${monthKey}-01`;
  const nextMonth =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthEnd = `${monthKey}-${String(daysInMonth).padStart(2, "0")}`;
  return { monthStart, nextMonth, daysInMonth, monthEnd };
}

function buildMonthDays(monthKey: string, todayIso: string): DayColumn[] {
  const { daysInMonth } = getMonthBounds(monthKey);
  const columns: DayColumn[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${monthKey}-${String(day).padStart(2, "0")}`;
    const d = parseDate(iso);
    columns.push({
      iso,
      isToday: iso === todayIso,
      weekday: d.toLocaleDateString("en-US", { weekday: "narrow" }),
      label: String(day),
    });
  }

  return columns;
}

function dayIndexInMonth(iso: string, monthKey: string) {
  if (!iso.startsWith(`${monthKey}-`)) return null;
  return Number(iso.slice(monthKey.length + 1));
}

function isCancelled(status: string | null | undefined) {
  return status?.toLowerCase() === "cancelled";
}

function calculateNights(checkIn: string, checkOut: string) {
  const nights = Math.round(
    (parseDate(checkOut).getTime() - parseDate(checkIn).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  return nights > 0 ? nights : 0;
}

function formatDateRange(checkIn: string, checkOut: string) {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  const start = parseDate(checkIn).toLocaleDateString("en-US", opts);
  const end = parseDate(checkOut).toLocaleDateString("en-US", {
    ...opts,
    year: "numeric",
  });
  return `${start} – ${end}`;
}

function formatPrice(price: number, currency: Currency) {
  return `${currency} ${price.toLocaleString()}`;
}

function mapRow(row: DbReservation): Reservation | null {
  if (!isBookingSource(row.source)) return null;
  return {
    id: row.id,
    propertyId: row.property_id,
    guestName: row.guest_name,
    checkIn: row.check_in,
    checkOut: row.check_out,
    status: row.status ?? null,
    source: row.source,
    price: Number(row.total_price),
    currency: row.currency === "USD" ? "USD" : "EGP",
  };
}

function getBarLayout(
  reservation: Reservation,
  monthKey: string,
  daysInMonth: number,
): BarLayout | null {
  const { monthStart, monthEnd } = getMonthBounds(monthKey);

  if (reservation.checkOut < monthStart || reservation.checkIn > monthEnd) {
    return null;
  }

  let startIdx = 0;
  let endIdx = daysInMonth - 1;

  const checkInIdx = dayIndexInMonth(reservation.checkIn, monthKey);
  const checkOutIdx = dayIndexInMonth(reservation.checkOut, monthKey);

  if (checkInIdx !== null) startIdx = checkInIdx - 1;
  if (checkOutIdx !== null) endIdx = checkOutIdx - 1;

  const span = endIdx - startIdx + 1;
  const width = span * DAY_COL_WIDTH - 4;
  const left = startIdx * DAY_COL_WIDTH + 2;

  const showCheckInEdge =
    checkInIdx !== null && reservation.checkIn >= monthStart;
  const showCheckOutEdge =
    checkOutIdx !== null && reservation.checkOut <= monthEnd;

  return {
    reservation,
    left,
    width: Math.max(width, DAY_COL_WIDTH - 4),
    showCheckInEdge,
    showCheckOutEdge,
    showGuestName: width >= 64,
    showBadge: width >= 44,
  };
}

function TodayHighlights({ days }: { days: DayColumn[] }) {
  return (
    <>
      {days.map((day, index) =>
        day.isToday ? (
          <div
            key={day.iso}
            className="pointer-events-none absolute top-0 bottom-0 bg-[#c9a84c]/12"
            style={{ left: index * DAY_COL_WIDTH, width: DAY_COL_WIDTH }}
          />
        ) : null,
      )}
    </>
  );
}

function TimelineHeader({ days, timelineWidth }: { days: DayColumn[]; timelineWidth: number }) {
  return (
    <div
      className="relative flex shrink-0 border-b border-border bg-surface"
      style={{ width: timelineWidth, height: 40 }}
    >
      <TodayHighlights days={days} />
      {days.map((day) => (
        <div
          key={day.iso}
          className={`flex shrink-0 flex-col items-center justify-center border-r border-border/40 text-center last:border-r-0 ${
            day.isToday ? "text-accent" : "text-muted"
          }`}
          style={{ width: DAY_COL_WIDTH }}
        >
          <span className="text-[8px] font-medium uppercase leading-none opacity-70">
            {day.weekday}
          </span>
          <span
            className={`mt-0.5 text-[11px] font-semibold leading-none ${
              day.isToday ? "text-accent" : "text-text"
            }`}
          >
            {day.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function UnitTimelineRow({
  property,
  days,
  timelineWidth,
  reservations,
  onSelect,
}: {
  property: Property;
  days: DayColumn[];
  timelineWidth: number;
  reservations: Reservation[];
  onSelect: (booking: SelectedBooking) => void;
}) {
  const monthKey = days[0]?.iso.slice(0, 7) ?? "";

  const barLayouts = useMemo(
    () =>
      reservations
        .filter((r) => !isCancelled(r.status))
        .map((r) => getBarLayout(r, monthKey, days.length))
        .filter((b): b is BarLayout => b !== null),
    [reservations, monthKey, days.length],
  );

  return (
    <div className="flex border-b border-border/50 last:border-b-0">
      <div
        className="sticky left-0 z-10 flex shrink-0 items-center border-r border-border px-2.5 py-1"
        style={{
          width: UNIT_COL_WIDTH,
          minHeight: ROW_HEIGHT,
          background: "#0a0a0a",
        }}
      >
        <span className="text-[12px] font-medium leading-snug text-text [overflow-wrap:anywhere]">
          {property.name}
        </span>
      </div>

      <div
        className="relative shrink-0 bg-[#111111]"
        style={{ width: timelineWidth, height: ROW_HEIGHT }}
      >
        <TodayHighlights days={days} />

        <div
          className="pointer-events-none absolute inset-0 flex"
          aria-hidden
        >
          {days.map((day) => (
            <div
              key={day.iso}
              className="shrink-0 border-r border-border/20 last:border-r-0"
              style={{ width: DAY_COL_WIDTH }}
            />
          ))}
        </div>

        {barLayouts.map((bar) => (
          <button
            key={bar.reservation.id}
            type="button"
            onClick={() =>
              onSelect({
                reservation: bar.reservation,
                unitName: property.name,
              })
            }
            className={`absolute z-10 flex min-w-0 overflow-hidden rounded-md bg-[#c9a84c] px-1.5 text-left text-[#0a0a0a] shadow-sm transition-transform active:scale-[0.98] ${
              bar.showCheckInEdge ? "border-l-[3px] border-l-emerald-500" : ""
            } ${bar.showCheckOutEdge ? "border-r-[3px] border-r-red-500" : ""}`}
            style={{
              left: bar.left,
              width: bar.width,
              top: BAR_TOP,
              height: BAR_HEIGHT,
            }}
            title={`${bar.reservation.guestName} · ${formatDateRange(bar.reservation.checkIn, bar.reservation.checkOut)}`}
          >
            <div className="flex h-full w-full min-w-0 flex-col items-start justify-center gap-0.5">
              {bar.showGuestName && (
                <span className="w-full truncate text-[10px] font-semibold leading-none">
                  {bar.reservation.guestName}
                </span>
              )}
              {bar.showBadge && (
                <SourceBadge source={bar.reservation.source} size="xs" />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function BookingSheet({
  booking,
  onClose,
}: {
  booking: SelectedBooking;
  onClose: () => void;
}) {
  const { reservation, unitName } = booking;
  const nights = calculateNights(reservation.checkIn, reservation.checkOut);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[110] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="animate-toast-slide-up relative z-10 rounded-t-2xl border-t border-border bg-surface px-5 pb-8 pt-5 shadow-[0_-16px_48px_rgba(0,0,0,0.5)]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

        <h2 className="font-display text-xl text-text">{unitName}</h2>
        <p className="mt-1 text-lg font-semibold text-text">
          {reservation.guestName}
        </p>

        <dl className="mt-5 space-y-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">
              Stay
            </dt>
            <dd className="mt-1 text-sm text-text">
              {formatDateRange(reservation.checkIn, reservation.checkOut)}
              <span className="text-muted"> · {nights} night{nights !== 1 ? "s" : ""}</span>
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">
              Source
            </dt>
            <dd className="mt-1">
              <SourceBadge source={reservation.source} size="md" />
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">
              Price
            </dt>
            <dd className="mt-1 text-sm font-semibold text-accent">
              {formatPrice(reservation.price, reservation.currency)}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-lg border border-border bg-background py-3 text-sm font-semibold text-text transition-colors hover:border-accent/40 hover:text-accent"
        >
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}

const STICKY_UNIT_STYLE = {
  width: UNIT_COL_WIDTH,
  background: "#0a0a0a",
} as const;

function MasterCalendar({
  properties,
  days,
  byProperty,
  onSelectBooking,
  scrollRef,
}: {
  properties: Property[];
  days: DayColumn[];
  byProperty: Map<string, Reservation[]>;
  onSelectBooking: (booking: SelectedBooking) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const timelineWidth = days.length * DAY_COL_WIDTH;
  const gridMinWidth = UNIT_COL_WIDTH + timelineWidth;

  return (
    <div className="relative -mx-4 sm:mx-0">
      <div
        ref={scrollRef}
        className="overflow-x-auto overscroll-x-contain px-4 touch-pan-x sm:px-0"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div
          className="w-max rounded-xl border border-border bg-surface shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
          style={{ minWidth: gridMinWidth, width: gridMinWidth }}
        >
          <div className="sticky top-0 z-20 flex border-b border-border bg-surface">
            <div
              className="sticky left-0 z-30 flex shrink-0 items-end border-r border-border px-2.5 pb-2"
              style={{ ...STICKY_UNIT_STYLE, height: 40 }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Unit
              </span>
            </div>
            <TimelineHeader days={days} timelineWidth={timelineWidth} />
          </div>

          {properties.map((property) => (
            <UnitTimelineRow
              key={property.id}
              property={property}
              days={days}
              timelineWidth={timelineWidth}
              reservations={byProperty.get(property.id) ?? []}
              onSelect={onSelectBooking}
            />
          ))}
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-40 w-12 rounded-r-xl"
        style={{
          background:
            "linear-gradient(to right, transparent 0%, rgba(10, 10, 10, 0.65) 55%, #0a0a0a 100%)",
        }}
      />
    </div>
  );
}

export default function CalendarPage() {
  const today = useMemo(() => getTodayISO(), []);
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [properties, setProperties] = useState<Property[]>([]);
  const [byProperty, setByProperty] = useState<Map<string, Reservation[]>>(
    () => new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<SelectedBooking | null>(
    null,
  );

  const [unitQuery, setUnitQuery] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [unitOpen, setUnitOpen] = useState(false);
  const [menuRect, setMenuRect] = useState({ top: 0, left: 0, width: 0 });

  const unitRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const visibleDays = useMemo(
    () => buildMonthDays(monthKey, today),
    [monthKey, today],
  );

  const monthLabel = useMemo(() => formatMonthLabel(monthKey), [monthKey]);

  const filteredProperties = useMemo(() => {
    const q = unitQuery.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) => p.name.toLowerCase().includes(q));
  }, [unitQuery, properties]);

  const displayedProperties = useMemo(() => {
    if (viewMode === "all") return properties;
    if (!selectedPropertyId) return [];
    const selected = properties.find((p) => p.id === selectedPropertyId);
    return selected ? [selected] : [];
  }, [viewMode, properties, selectedPropertyId]);

  const loadProperties = useCallback(async () => {
    const workspaceId = await getWorkspaceId();
    const { data, error: propsError } = await supabase
      .from("properties")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .order("name");

    if (propsError || !data) {
      setProperties([]);
      return;
    }

    setProperties(
      data
        .map((row) => ({
          id: row.id as string,
          name: (row.name as string)?.trim() || "—",
        }))
        .filter((p) => p.id),
    );
  }, []);

  const loadReservations = useCallback(async (month: string) => {
    setIsLoading(true);
    setError(null);

    const workspaceId = await getWorkspaceId();
    const { monthStart, nextMonth } = getMonthBounds(month);

    const { data, error: resError } = await supabase
      .from("reservations")
      .select(
        "id, property_id, guest_name, check_in, check_out, source, total_price, currency, status",
      )
      .eq("workspace_id", workspaceId)
      .or("status.neq.cancelled,status.is.null")
      .lt("check_in", nextMonth)
      .gte("check_out", monthStart);

    if (resError) {
      setError(resError.message);
      setByProperty(new Map());
      setIsLoading(false);
      return;
    }

    const grouped = new Map<string, Reservation[]>();

    for (const row of (data ?? []) as DbReservation[]) {
      const mapped = mapRow(row);
      if (!mapped) continue;

      const list = grouped.get(mapped.propertyId) ?? [];
      list.push(mapped);
      grouped.set(mapped.propertyId, list);
    }

    setByProperty(grouped);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    loadReservations(monthKey);
  }, [monthKey, loadReservations]);

  useLayoutEffect(() => {
    if (isLoading) return;

    const el = scrollRef.current;
    if (!el) return;

    const todayIndex = visibleDays.findIndex((d) => d.isToday);

    function scrollToToday() {
      if (!el) return;

      if (todayIndex < 0) {
        el.scrollLeft = 0;
        return;
      }

      const timelineVisible = Math.max(0, el.clientWidth - UNIT_COL_WIDTH);
      const target =
        UNIT_COL_WIDTH +
        todayIndex * DAY_COL_WIDTH -
        timelineVisible / 2 +
        DAY_COL_WIDTH / 2;

      el.scrollLeft = Math.max(
        0,
        Math.min(target, el.scrollWidth - el.clientWidth),
      );
    }

    scrollToToday();
    requestAnimationFrame(scrollToToday);
  }, [isLoading, monthKey, visibleDays, displayedProperties.length]);

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
  }

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    if (mode === "single" && !selectedPropertyId && properties.length > 0) {
      const first = properties[0];
      setSelectedPropertyId(first.id);
      setUnitQuery(first.name);
    }
  }

  const showCalendar =
    !isLoading &&
    properties.length > 0 &&
    (viewMode === "all" || selectedPropertyId);

  return (
    <div className="animate-fade-up pb-4">
      <header className="mb-4">
        <h1 className="font-display text-3xl text-text">Calendar</h1>
        <p className="mt-1 text-sm text-muted">
          {monthLabel} · {displayedProperties.length} unit
          {displayedProperties.length !== 1 ? "s" : ""}
        </p>
      </header>

      <div className="mb-4 space-y-3">
        <div className="flex rounded-lg border border-border bg-background p-1">
          <button
            type="button"
            onClick={() => handleViewModeChange("all")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === "all"
                ? "bg-accent text-background"
                : "text-muted hover:text-text"
            }`}
          >
            All Units
          </button>
          <button
            type="button"
            onClick={() => handleViewModeChange("single")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === "single"
                ? "bg-accent text-background"
                : "text-muted hover:text-text"
            }`}
          >
            Single Unit
          </button>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-2 py-1.5">
          <button
            type="button"
            onClick={() => setMonthKey((m) => shiftMonth(m, -1))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-text"
            aria-label="Previous month"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <span className="px-2 text-center text-sm font-semibold text-text">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => setMonthKey((m) => shiftMonth(m, 1))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-text"
            aria-label="Next month"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>

        {viewMode === "single" && (
          <div ref={unitRef}>
            <label htmlFor="calendar-unit-search" className={labelClass}>
              Unit
            </label>
            <input
              id="calendar-unit-search"
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
              }}
              onFocus={() => setUnitOpen(true)}
              className={inputClass}
            />
          </div>
        )}
        {viewMode === "single" &&
          unitOpen &&
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
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent"
            aria-hidden
          />
        </div>
      ) : properties.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-12 text-center">
          <p className="text-sm text-muted">No units found for this workspace</p>
        </div>
      ) : viewMode === "single" && !selectedPropertyId ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-12 text-center">
          <p className="text-sm text-muted">Select a unit to view its calendar</p>
        </div>
      ) : showCalendar ? (
        <MasterCalendar
          scrollRef={scrollRef}
          properties={displayedProperties}
          days={visibleDays}
          byProperty={byProperty}
          onSelectBooking={setSelectedBooking}
        />
      ) : null}

      {showCalendar && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-8 rounded-sm bg-[#c9a84c]" />
            Booking
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-1 rounded-sm bg-emerald-500" />
            Check-in
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-1 rounded-sm bg-red-500" />
            Check-out
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-8 rounded-sm bg-[#c9a84c]/15 ring-1 ring-accent/30" />
            Today
          </span>
        </div>
      )}

      {selectedBooking && (
        <BookingSheet
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </div>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
