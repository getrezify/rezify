"use client";

import { isBookingSource, SourceBadge, type BookingSource } from "@/lib/booking-source";
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

type Currency = "EGP" | "USD";

type Reservation = {
  id: string;
  unitName: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  price: string;
  currency: Currency;
  sourceId: BookingSource | null;
  sourceLabel: string;
};

type DbReservation = {
  id: string;
  guest_name: string;
  source: string;
  check_in: string;
  check_out: string;
  total_price: number;
  currency: string;
  status?: string;
  properties?: { name: string } | null;
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";

const labelClass = "mb-2 block text-sm font-medium text-text";

function mapRow(row: DbReservation): Reservation {
  const currency = row.currency === "USD" ? "USD" : "EGP";
  const sourceId = isBookingSource(row.source) ? row.source : null;
  return {
    id: row.id,
    unitName: row.properties?.name ?? "—",
    guestName: row.guest_name,
    checkIn: row.check_in,
    checkOut: row.check_out,
    price: String(row.total_price),
    currency,
    sourceId,
    sourceLabel: row.source,
  };
}

function formatDisplayDate(iso: string) {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPrice(price: string, currency: Currency) {
  const num = Number(price);
  if (!price || Number.isNaN(num)) return "—";
  return `${currency} ${num.toLocaleString()}`;
}

export default function ManageReservationPage() {
  const [unitQuery, setUnitQuery] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitOptions, setUnitOptions] = useState<string[]>([]);
  const [checkIn, setCheckIn] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [isModifying, setIsModifying] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCurrency, setEditCurrency] = useState<Currency>("EGP");
  const [menuRect, setMenuRect] = useState({ top: 0, left: 0, width: 0 });

  const unitRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  const filteredUnits = useMemo(() => {
    const q = unitQuery.trim().toLowerCase();
    if (!q) return unitOptions;
    return unitOptions.filter((unit) => unit.toLowerCase().includes(q));
  }, [unitQuery, unitOptions]);

  const loadUnitOptions = useCallback(async () => {
    const { data: units, error } = await supabase
      .from("properties")
      .select("name")
      .eq("workspace_id", WORKSPACE_ID)
      .order("name");

    if (error || !units) {
      setUnitOptions([]);
      return;
    }

    setUnitOptions(
      units.map((row) => row.name as string).filter((name) => name?.trim()),
    );
  }, []);

  useEffect(() => {
    loadUnitOptions();
  }, [loadUnitOptions]);

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
  }, [unitOpen, unitQuery, filteredUnits.length]);

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

  function openModifyForm(res: Reservation) {
    setEditCheckIn(res.checkIn);
    setEditCheckOut(res.checkOut);
    setEditPrice(res.price);
    setEditCurrency(res.currency);
    setIsModifying(true);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!checkIn) {
      setToast({ message: "Please select a check-in date", type: "error" });
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setIsModifying(false);
    setToast(null);

    const searchTerm = unitQuery.trim().toLowerCase();

    const { data, error } = await supabase
      .from("reservations")
      .select("*, properties(name)")
      .eq("workspace_id", WORKSPACE_ID)
      .eq("check_in", checkIn);

    setIsSearching(false);

    if (error) {
      const fallback = await supabase
        .from("reservations")
        .select("*")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("check_in", checkIn);

      if (fallback.error) {
        setToast({ message: fallback.error.message, type: "error" });
        setReservation(null);
        return;
      }

      const rows = (fallback.data ?? []) as DbReservation[];
      const match = findMatch(rows, searchTerm);
      setReservation(match ? mapRow(match) : null);
      return;
    }

    const rows = (data ?? []) as DbReservation[];
    const match = findMatch(rows, searchTerm);
    setReservation(match ? mapRow(match) : null);
  }

  async function handleCancel() {
    if (!reservation) return;

    setIsSaving(true);
    setToast(null);

    const { error } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", reservation.id);

    setIsSaving(false);

    if (error) {
      setToast({
        message: error.message || "Failed to cancel reservation",
        type: "error",
      });
      return;
    }

    setToast({ message: "Reservation cancelled", type: "success" });
    setReservation(null);
    setIsModifying(false);
  }

  async function handleSaveChanges(e: React.FormEvent) {
    e.preventDefault();
    if (!reservation) return;

    setIsSaving(true);
    setToast(null);

    const { data, error } = await supabase
      .from("reservations")
      .update({
        check_in: editCheckIn,
        check_out: editCheckOut,
        total_price: Number(editPrice),
        currency: editCurrency,
      })
      .eq("id", reservation.id)
      .select("*, properties(name)")
      .single();

    setIsSaving(false);

    if (error) {
      const { error: fallbackError } = await supabase
        .from("reservations")
        .update({
          check_in: editCheckIn,
          check_out: editCheckOut,
          total_price: Number(editPrice),
          currency: editCurrency,
        })
        .eq("id", reservation.id);

      if (fallbackError) {
        setToast({
          message: fallbackError.message || "Failed to update reservation",
          type: "error",
        });
        return;
      }

      setReservation({
        ...reservation,
        checkIn: editCheckIn,
        checkOut: editCheckOut,
        price: editPrice,
        currency: editCurrency,
      });
      setToast({ message: "Changes saved!", type: "success" });
      setIsModifying(false);
      return;
    }

    if (data) {
      setReservation(mapRow(data as DbReservation));
    }
    setToast({ message: "Changes saved!", type: "success" });
    setIsModifying(false);
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
        <h1 className="font-display text-3xl text-text">Manage</h1>
        <p className="mt-1 text-sm text-muted">
          Find, modify or cancel a booking
        </p>
      </header>

      <form onSubmit={handleSearch} className="mt-8 space-y-5">
        <div ref={unitRef}>
          <label htmlFor="manage-unit-search" className={labelClass}>
            Unit
          </label>
          <input
            id="manage-unit-search"
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
            </ul>,
            document.body,
          )}

        <div>
          <label htmlFor="manage-check-in" className={labelClass}>
            Check-in
          </label>
          <input
            id="manage-check-in"
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            required
            className={`${inputClass} [color-scheme:dark]`}
          />
        </div>

        <button
          type="submit"
          disabled={isSearching}
          className="w-full rounded-lg bg-accent py-3.5 text-sm font-semibold text-background transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSearching ? "Searching…" : "Search Reservation"}
        </button>
      </form>

      {hasSearched && !isSearching && (
        <div className="mt-8 animate-fade-up">
          {reservation ? (
            <article className="rounded-xl border border-border bg-surface p-4">
              <p className="font-semibold text-text">{reservation.unitName}</p>
              <p className="mt-0.5 text-sm text-muted">{reservation.guestName}</p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <InfoBox
                  label="Check-in"
                  value={formatDisplayDate(reservation.checkIn)}
                />
                <InfoBox
                  label="Check-out"
                  value={formatDisplayDate(reservation.checkOut)}
                />
                <InfoBox
                  label="Price"
                  value={formatPrice(
                    reservation.price,
                    reservation.currency,
                  )}
                />
                <div className="rounded-lg border border-border bg-background px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                    Source
                  </p>
                  <div className="mt-1.5">
                    {reservation.sourceId ? (
                      <SourceBadge source={reservation.sourceId} size="sm" />
                    ) : (
                      <p className="text-sm text-text">{reservation.sourceLabel}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="rounded-lg border border-red-500/60 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:border-red-500 hover:bg-red-500/10 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    isModifying
                      ? setIsModifying(false)
                      : openModifyForm(reservation)
                  }
                  disabled={isSaving}
                  className="rounded-lg border border-accent py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-[var(--accent-muted)] disabled:opacity-50"
                >
                  {isModifying ? "Close" : "Modify"}
                </button>
              </div>

              {isModifying && (
                <form
                  onSubmit={handleSaveChanges}
                  className="mt-4 animate-fade-up space-y-4 border-t border-border pt-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Edit reservation
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="edit-check-in" className={labelClass}>
                        New check-in
                      </label>
                      <input
                        id="edit-check-in"
                        type="date"
                        value={editCheckIn}
                        onChange={(e) => setEditCheckIn(e.target.value)}
                        className={`${inputClass} [color-scheme:dark]`}
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-check-out" className={labelClass}>
                        New check-out
                      </label>
                      <input
                        id="edit-check-out"
                        type="date"
                        value={editCheckOut}
                        min={editCheckIn || undefined}
                        onChange={(e) => setEditCheckOut(e.target.value)}
                        className={`${inputClass} [color-scheme:dark]`}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="edit-price" className={labelClass}>
                      New price
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="edit-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className={`${inputClass} min-w-0 flex-1`}
                      />
                      <div className="flex shrink-0 rounded-lg border border-border bg-background p-1">
                        {(["EGP", "USD"] as const).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditCurrency(c)}
                            className={`rounded-md px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                              editCurrency === c
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
                    className="w-full rounded-lg bg-accent py-3 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:opacity-60"
                  >
                    {isSaving ? "Saving…" : "Save Changes"}
                  </button>
                </form>
              )}
            </article>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-10 text-center">
              <span className="text-2xl" role="img" aria-hidden>
                🔍
              </span>
              <p className="mt-2 text-sm font-medium text-text">
                No reservation found
              </p>
              <p className="mt-1 text-xs text-muted">
                Try a different check-in date or search term
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function findMatch(rows: DbReservation[], searchTerm: string) {
  const active = rows.filter((r) => r.status !== "cancelled");
  const pool = active.length > 0 ? active : rows;

  if (!searchTerm) return pool[0] ?? null;

  const match = pool.find((row) => {
    const guest = row.guest_name.toLowerCase();
    const property = (row.properties?.name ?? "").toLowerCase();
    return guest.includes(searchTerm) || property.includes(searchTerm);
  });

  return match ?? null;
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-text">{value}</p>
    </div>
  );
}
