"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

type Currency = "EGP" | "USD";

type Reservation = {
  unitName: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  price: string;
  currency: Currency;
  source: string;
};

const MOCK_RESERVATION: Reservation = {
  unitName: "Marina View 4B",
  guestName: "Sarah Al-Mansouri",
  checkIn: "2026-05-21",
  checkOut: "2026-05-24",
  price: "4500",
  currency: "EGP",
  source: "Airbnb",
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";

const labelClass = "mb-2 block text-sm font-medium text-text";

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
  const [unitQuery, setUnitQuery] = useState(MOCK_RESERVATION.unitName);
  const [selectedUnit, setSelectedUnit] = useState(MOCK_RESERVATION.unitName);
  const [unitOpen, setUnitOpen] = useState(false);
  const [checkIn, setCheckIn] = useState(MOCK_RESERVATION.checkIn);
  const [hasSearched, setHasSearched] = useState(true);
  const [reservation, setReservation] = useState<Reservation | null>({
    ...MOCK_RESERVATION,
  });
  const [isModifying, setIsModifying] = useState(false);

  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCurrency, setEditCurrency] = useState<Currency>("EGP");

  const unitRef = useRef<HTMLDivElement>(null);

  const filteredUnits = useMemo(() => {
    const q = unitQuery.trim().toLowerCase();
    if (!q) return MOCK_UNITS;
    return MOCK_UNITS.filter((unit) => unit.toLowerCase().includes(q));
  }, [unitQuery]);

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
  }

  function openModifyForm(res: Reservation) {
    setEditCheckIn(res.checkIn);
    setEditCheckOut(res.checkOut);
    setEditPrice(res.price);
    setEditCurrency(res.currency);
    setIsModifying(true);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setHasSearched(true);
    setIsModifying(false);

    const unitMatch =
      selectedUnit === MOCK_RESERVATION.unitName ||
      unitQuery.trim() === MOCK_RESERVATION.unitName;
    const dateMatch = !checkIn || checkIn === MOCK_RESERVATION.checkIn;

    if (unitMatch && dateMatch) {
      setReservation({ ...MOCK_RESERVATION });
    } else {
      setReservation(null);
    }
  }

  function handleSaveChanges(e: React.FormEvent) {
    e.preventDefault();
    if (!reservation) return;
    setReservation({
      ...reservation,
      checkIn: editCheckIn,
      checkOut: editCheckOut,
      price: editPrice,
      currency: editCurrency,
    });
    setIsModifying(false);
  }

  return (
    <div className="animate-fade-up pb-6">
      <header className="pt-4">
        <h1 className="font-display text-3xl text-text">Manage</h1>
        <p className="mt-1 text-sm text-muted">
          Find, modify or cancel a booking
        </p>
      </header>

      <form onSubmit={handleSearch} className="mt-8 space-y-5">
        <div ref={unitRef} className="relative">
          <label htmlFor="manage-unit-search" className={labelClass}>
            Unit
          </label>
          <input
            id="manage-unit-search"
            type="text"
            value={unitQuery}
            placeholder="Search units..."
            autoComplete="off"
            onChange={(e) => {
              setUnitQuery(e.target.value);
              setSelectedUnit("");
              setUnitOpen(true);
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
          <label htmlFor="manage-check-in" className={labelClass}>
            Check-in
          </label>
          <input
            id="manage-check-in"
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className={`${inputClass} [color-scheme:dark]`}
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-accent py-3.5 text-sm font-semibold text-background transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Search Reservation
        </button>
      </form>

      {hasSearched && (
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
                <InfoBox label="Source" value={reservation.source} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-red-500/60 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:border-red-500 hover:bg-red-500/10"
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
                  className="rounded-lg border border-accent py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-[var(--accent-muted)]"
                >
                  {isModifying ? "Close" : "Modify"}
                </button>
              </div>

              {isModifying && (
                <form
                  onSubmit={handleSaveChanges}
                  className="mt-4 space-y-4 border-t border-border pt-4 animate-fade-up"
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
                    className="w-full rounded-lg bg-accent py-3 text-sm font-semibold text-background transition-colors hover:bg-accent-hover"
                  >
                    Save Changes
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
                Try &quot;Marina View 4B&quot; with check-in May 21, 2026
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
