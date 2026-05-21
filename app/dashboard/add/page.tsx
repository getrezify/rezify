"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useRef, useState } from "react";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

const MOCK_UNITS = [
  "Marina View 4B",
  "Palm Heights 12",
  "Downtown Studio 7",
  "Creek Villa 2",
  "Skyline Loft 9",
  "Garden Flat 1A",
  "Bay Tower 3C",
  "Old Town Suite 5",
  "Harbor House 8",
];

const BOOKING_SOURCES = [
  { id: "airbnb", emoji: "✈", label: "Airbnb" },
  { id: "booking", emoji: "🏨", label: "Booking.com" },
  { id: "offline", emoji: "🤝", label: "Offline" },
  { id: "owner", emoji: "👤", label: "Owner" },
] as const;

type BookingSourceId = (typeof BOOKING_SOURCES)[number]["id"];
type Currency = "EGP" | "USD";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";

const labelClass = "mb-2 block text-sm font-medium text-text";

function calculateNights(checkIn: string, checkOut: string): number | null {
  if (!checkIn || !checkOut) return null;
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  const nights = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return nights > 0 ? nights : null;
}

export default function AddReservationPage() {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [unitQuery, setUnitQuery] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [unitOpen, setUnitOpen] = useState(false);
  const [source, setSource] = useState<BookingSourceId>("airbnb");
  const [guestName, setGuestName] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [currency, setCurrency] = useState<Currency>("EGP");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const unitRef = useRef<HTMLDivElement>(null);

  const nights = useMemo(
    () => calculateNights(checkIn, checkOut),
    [checkIn, checkOut],
  );

  const filteredUnits = useMemo(() => {
    const q = unitQuery.trim().toLowerCase();
    if (!q) return MOCK_UNITS;
    return MOCK_UNITS.filter((unit) => unit.toLowerCase().includes(q));
  }, [unitQuery]);

  useEffect(() => {
    if (!unitOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (unitRef.current && !unitRef.current.contains(e.target as Node)) {
        setUnitOpen(false);
      }
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

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  function handleSelectUnit(unit: string) {
    setSelectedUnit(unit);
    setUnitQuery(unit);
    setUnitOpen(false);
  }

  function clearForm() {
    setCheckIn("");
    setCheckOut("");
    setUnitQuery("");
    setSelectedUnit("");
    setSource("airbnb");
    setGuestName("");
    setTotalPrice("");
    setCurrency("EGP");
    setUnitOpen(false);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setToast(null);

    const { error } = await supabase.from("reservations").insert({
      workspace_id: WORKSPACE_ID,
      guest_name: guestName.trim(),
      source,
      check_in: checkIn,
      check_out: checkOut,
      total_price: Number(totalPrice),
      currency,
    });

    setIsSaving(false);

    if (error) {
      setToast({
        message: error.message || "Failed to save reservation",
        type: "error",
      });
      return;
    }

    setToast({ message: "Reservation saved!", type: "success" });
    clearForm();
  }

  return (
    <div className="animate-fade-up relative pb-6">
      {toast && (
        <div
          role="status"
          className={`animate-toast-slide-up fixed bottom-6 z-[100] w-[calc(100%-2rem)] max-w-[448px] rounded-lg border px-4 py-3 text-sm font-medium shadow-xl ${
            toast.type === "success"
              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
              : "border-red-500/50 bg-red-500/15 text-red-300"
          }`}
        >
          {toast.message}
        </div>
      )}
      <header className="pt-4">
        <h1 className="font-display text-3xl text-text">New Reservation</h1>
        <p className="mt-1 text-sm text-muted">Add a new booking</p>
      </header>

      <form onSubmit={handleSave} className="mt-8 space-y-6">
        <fieldset className="animate-fade-up space-y-4 [animation-delay:50ms]">
          <legend className="sr-only">Stay dates</legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="check-in" className={labelClass}>
                Check-in
              </label>
              <input
                id="check-in"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </div>
            <div>
              <label htmlFor="check-out" className={labelClass}>
                Check-out
              </label>
              <input
                id="check-out"
                type="date"
                value={checkOut}
                min={checkIn || undefined}
                onChange={(e) => setCheckOut(e.target.value)}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </div>
          </div>

          {nights !== null && (
            <div className="flex justify-center">
              <span className="rounded-full bg-[var(--accent-muted)] px-4 py-1.5 text-sm font-semibold text-accent transition-all duration-300">
                {nights} {nights === 1 ? "night" : "nights"}
              </span>
            </div>
          )}
        </fieldset>

        <div
          ref={unitRef}
          className={`relative animate-fade-up [animation-delay:100ms] ${unitOpen ? "z-50" : ""}`}
        >
          <label htmlFor="unit-search" className={labelClass}>
            Unit
          </label>
          <input
            id="unit-search"
            type="text"
            value={unitQuery}
            placeholder="Search units..."
            autoComplete="off"
            aria-expanded={unitOpen}
            aria-haspopup="listbox"
            onChange={(e) => {
              setUnitQuery(e.target.value);
              setSelectedUnit("");
              setUnitOpen(true);
            }}
            onFocus={() => setUnitOpen(true)}
            className={inputClass}
          />
          {unitOpen && (
            <ul
              role="listbox"
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-xl"
            >
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

        <fieldset className="animate-fade-up [animation-delay:150ms]">
          <legend className={labelClass}>Booking Source</legend>
          <div className="grid grid-cols-2 gap-2">
            {BOOKING_SOURCES.map(({ id, emoji, label }) => {
              const selected = source === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSource(id)}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3.5 text-sm font-medium transition-all duration-200 ${
                    selected
                      ? "border-accent bg-[var(--accent-muted)] text-accent"
                      : "border-border bg-surface text-text hover:border-muted"
                  }`}
                >
                  <span aria-hidden>{emoji}</span>
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="animate-fade-up [animation-delay:200ms]">
          <label htmlFor="guest-name" className={labelClass}>
            Guest Name
          </label>
          <input
            id="guest-name"
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Full name"
            className={inputClass}
          />
        </div>

        <div className="animate-fade-up [animation-delay:250ms]">
          <label htmlFor="total-price" className={labelClass}>
            Total Price
          </label>
          <div className="flex gap-2">
            <input
              id="total-price"
              type="number"
              min="0"
              step="0.01"
              value={totalPrice}
              onChange={(e) => setTotalPrice(e.target.value)}
              placeholder="0.00"
              className={`${inputClass} min-w-0 flex-1`}
            />
            <div className="flex shrink-0 rounded-lg border border-border bg-surface p-1">
              {(["EGP", "USD"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`rounded-md px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                    currency === c
                      ? "bg-accent text-background"
                      : "text-muted hover:text-text"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="animate-fade-up w-full rounded-lg bg-accent py-3.5 text-sm font-semibold text-background transition-colors duration-200 hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 [animation-delay:300ms]"
        >
          {isSaving ? "Saving…" : "Save Reservation"}
        </button>
      </form>
    </div>
  );
}
