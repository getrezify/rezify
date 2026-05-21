"use client";

export type BookingSource = "airbnb" | "booking" | "offline" | "owner";

export type BookingSourceMeta = {
  id: BookingSource;
  label: string;
  icon: string;
  bg: string;
};

export const BOOKING_SOURCE_LIST: readonly BookingSourceMeta[] = [
  { id: "airbnb", label: "Airbnb", icon: "🏠", bg: "#FF5A5F" },
  { id: "booking", label: "Booking", icon: "🛏", bg: "#003580" },
  { id: "offline", label: "Offline", icon: "🤝", bg: "#4caf82" },
  { id: "owner", label: "Owner", icon: "👤", bg: "#7c3aed" },
] as const;

export const BOOKING_SOURCE_META: Record<BookingSource, BookingSourceMeta> =
  Object.fromEntries(
    BOOKING_SOURCE_LIST.map((item) => [item.id, item]),
  ) as Record<BookingSource, BookingSourceMeta>;

const SIZE_CLASSES = {
  xs: "gap-0.5 rounded px-1 py-px text-[8px] font-semibold leading-tight",
  sm: "gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
  md: "gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
} as const;

export function isBookingSource(value: string): value is BookingSource {
  return value in BOOKING_SOURCE_META;
}

export function getBookingSourceBorderStyle(source: BookingSource) {
  return { borderLeftColor: BOOKING_SOURCE_META[source].bg };
}

export function SourceBadge({
  source,
  size = "md",
  className = "",
}: {
  source: BookingSource;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const meta = BOOKING_SOURCE_META[source];

  return (
    <span
      className={`inline-flex max-w-full shrink-0 items-center whitespace-nowrap text-white ${SIZE_CLASSES[size]} ${className}`.trim()}
      style={{ backgroundColor: meta.bg }}
    >
      <span aria-hidden className="leading-none">
        {meta.icon}
      </span>
      <span className="truncate">{meta.label}</span>
    </span>
  );
}
