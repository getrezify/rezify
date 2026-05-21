"use client";

import { BOOKING_SOURCE_LIST, type BookingSource } from "@/lib/booking-source";
import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

type Property = {
  id: string;
  name: string;
};

type BookingSourceId = BookingSource;
type Currency = "EGP" | "USD";

type ConflictingReservation = {
  unitName: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
};

type DbConflictRow = {
  guest_name: string;
  check_in: string;
  check_out: string;
  status?: string | null;
  properties?: { name: string } | null;
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";

const labelClass = "mb-2 block text-sm font-medium text-text";

function formatDisplayDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
  const [properties, setProperties] = useState<Property[]>([]);
  const [unitQuery, setUnitQuery] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
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
  const [conflict, setConflict] = useState<ConflictingReservation | null>(
    null,
  );

  const unitRef = useRef<HTMLDivElement>(null);

  const nights = useMemo(
    () => calculateNights(checkIn, checkOut),
    [checkIn, checkOut],
  );

  const filteredProperties = useMemo(() => {
    const q = unitQuery.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) => p.name.toLowerCase().includes(q));
  }, [unitQuery, properties]);

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

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

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

  useEffect(() => {
    if (!conflict) return;

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setConflict(null);
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [conflict]);

  function handleSelectProperty(property: Property) {
    setSelectedPropertyId(property.id);
    setUnitQuery(property.name);
    setUnitOpen(false);
  }

  function clearForm() {
    setCheckIn("");
    setCheckOut("");
    setUnitQuery("");
    setSelectedPropertyId("");
    setSource("airbnb");
    setGuestName("");
    setTotalPrice("");
    setCurrency("EGP");
    setUnitOpen(false);
    setConflict(null);
  }

  function resolvePropertyId() {
    return (
      selectedPropertyId ||
      properties.find((p) => p.name === unitQuery.trim())?.id
    );
  }

  async function findConflict(
    propertyId: string,
  ): Promise<ConflictingReservation | null> {
    const { data, error } = await supabase
      .from("reservations")
      .select("guest_name, check_in, check_out, status, properties(name)")
      .eq("workspace_id", WORKSPACE_ID)
      .eq("property_id", propertyId)
      .or("status.neq.cancelled,status.is.null")
      .lt("check_in", checkOut)
      .gt("check_out", checkIn)
      .limit(1);

    if (error) {
      const fallback = await supabase
        .from("reservations")
        .select("guest_name, check_in, check_out, status")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("property_id", propertyId)
        .or("status.neq.cancelled,status.is.null")
        .lt("check_in", checkOut)
        .gt("check_out", checkIn)
        .limit(1);

      if (fallback.error || !fallback.data?.length) return null;

      const row = fallback.data[0] as unknown as DbConflictRow;
      return {
        unitName:
          properties.find((p) => p.id === propertyId)?.name ?? unitQuery.trim(),
        guestName: row.guest_name,
        checkIn: row.check_in,
        checkOut: row.check_out,
      };
    }

    if (!data?.length) return null;

    const row = data[0] as unknown as DbConflictRow;
    return {
      unitName: row.properties?.name ?? unitQuery.trim(),
      guestName: row.guest_name,
      checkIn: row.check_in,
      checkOut: row.check_out,
    };
  }

  async function insertReservation(propertyId: string) {
    const { error } = await supabase.from("reservations").insert({
      workspace_id: WORKSPACE_ID,
      property_id: propertyId,
      guest_name: guestName.trim(),
      source,
      check_in: checkIn,
      check_out: checkOut,
      total_price: Number(totalPrice),
      currency,
    });

    if (error) {
      setToast({
        message: error.message || "Failed to save reservation",
        type: "error",
      });
      return false;
    }

    setToast({ message: "Reservation saved!", type: "success" });
    clearForm();
    return true;
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setToast(null);
    setConflict(null);

    const propertyId = resolvePropertyId();

    if (!propertyId) {
      setToast({ message: "Please select a unit", type: "error" });
      return;
    }

    if (!checkIn || !checkOut) {
      setToast({ message: "Please select check-in and check-out dates", type: "error" });
      return;
    }

    if (calculateNights(checkIn, checkOut) === null) {
      setToast({ message: "Check-out must be after check-in", type: "error" });
      return;
    }

    setIsSaving(true);

    const existing = await findConflict(propertyId);
    if (existing) {
      setIsSaving(false);
      setConflict(existing);
      return;
    }

    await insertReservation(propertyId);
    setIsSaving(false);
  }

  async function handleSaveAnyway() {
    const propertyId = resolvePropertyId();
    if (!propertyId) return;

    setIsSaving(true);
    setConflict(null);
    await insertReservation(propertyId);
    setIsSaving(false);
  }

  return (
    <div className="animate-fade-up relative pb-6">
      {conflict && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="conflict-title"
        >
          <div className="w-full max-w-[400px] rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-2xl text-red-400"
                aria-hidden
              >
                ⚠
              </span>
              <h2
                id="conflict-title"
                className="mt-4 font-display text-xl text-text"
              >
                Reservation Already Exists
              </h2>
              <p className="mt-3 text-sm text-muted">
                This unit already has a booking that overlaps your dates:
              </p>
              <div className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-left">
                <p className="font-semibold text-text">{conflict.unitName}</p>
                <p className="mt-0.5 text-sm text-muted">{conflict.guestName}</p>
                <p className="mt-2 text-sm text-text">
                  {formatDisplayDate(conflict.checkIn)} –{" "}
                  {formatDisplayDate(conflict.checkOut)}
                </p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConflict(null)}
                disabled={isSaving}
                className="rounded-lg border border-border py-2.5 text-sm font-semibold text-text transition-colors hover:border-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAnyway}
                disabled={isSaving}
                className="rounded-lg bg-accent py-2.5 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {isSaving ? "Saving…" : "Save Anyway"}
              </button>
            </div>
          </div>
        </div>
      )}

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
              setSelectedPropertyId("");
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
            </ul>
          )}
        </div>

        <fieldset className="animate-fade-up [animation-delay:150ms]">
          <legend className={labelClass}>Booking Source</legend>
          <div className="grid grid-cols-2 gap-2">
            {BOOKING_SOURCE_LIST.map(({ id, icon, label, bg }) => {
              const selected = source === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSource(id)}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3.5 text-sm font-semibold transition-all duration-200 ${
                    selected
                      ? "border-transparent text-white shadow-md"
                      : "border-border bg-surface text-text hover:border-muted"
                  }`}
                  style={selected ? { backgroundColor: bg } : undefined}
                >
                  <span aria-hidden>{icon}</span>
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
