"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { BOOKING_SOURCE_LIST, type BookingSource } from "@/lib/booking-source";
import { supabase } from "@/lib/supabase";
import { getWorkspaceId } from "@/lib/workspace";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Property = { id: string; name: string };
type BookingSourceId = BookingSource;
type Currency = "EGP" | "USD";
type ConflictingReservation = { unitName: string; guestName: string; checkIn: string; checkOut: string };
type DbConflictRow = { guest_name: string; check_in: string; check_out: string; status?: string | null; properties?: { name: string } | null };

const inputClass = "w-full min-w-0 rounded-xl border border-border bg-background px-4 py-3.5 text-base text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";
const labelClass = "mb-2 block text-sm font-semibold text-text";

function formatDisplayDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function calculateNights(ci: string, co: string): number | null {
  if (!ci || !co) return null;
  const n = Math.round((new Date(`${co}T12:00:00`).getTime() - new Date(`${ci}T12:00:00`).getTime()) / (1000 * 60 * 60 * 24));
  return n > 0 ? n : null;
}

function triggerHaptic() {
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(10);
  }
}

export default function AddReservationPage() {
  const { t } = useLanguage();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [unitQuery, setUnitQuery] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [unitOpen, setUnitOpen] = useState(false);
  const [source, setSource] = useState<BookingSourceId>("airbnb");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [currency, setCurrency] = useState<Currency>("EGP");
  const [deposit, setDeposit] = useState("");
  const [insurance, setInsurance] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [conflict, setConflict] = useState<ConflictingReservation | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const unitRef = useRef<HTMLDivElement>(null);
  const nights = useMemo(() => calculateNights(checkIn, checkOut), [checkIn, checkOut]);
  const isOffline = source === "offline";

  const remaining = useMemo(() => {
    const total = parseFloat(totalPrice) || 0;
    const dep = parseFloat(deposit) || 0;
    return Math.max(0, total - dep);
  }, [totalPrice, deposit]);

  const filteredProperties = useMemo(() => {
    const q = unitQuery.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(p => p.name.toLowerCase().includes(q));
  }, [unitQuery, properties]);

  const loadProperties = useCallback(async () => {
    const workspaceId = await getWorkspaceId();
    const { data } = await supabase.from("properties").select("id, name").eq("workspace_id", workspaceId).order("name");
    setProperties((data ?? []).map(row => ({ id: row.id as string, name: row.name as string })).filter(p => p.name?.trim()));
  }, []);

  useEffect(() => { loadProperties(); }, [loadProperties]);

  useEffect(() => {
    if (!unitOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (unitRef.current && !unitRef.current.contains(e.target as Node)) setUnitOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, [unitOpen]);

  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 4000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { if (!isOffline) { setDeposit(""); setInsurance(""); } }, [isOffline]);

  function clearForm() {
    setCheckIn(""); setCheckOut(""); setUnitQuery(""); setSelectedPropertyId("");
    setSource("airbnb"); setGuestName(""); setGuestPhone(""); setTotalPrice("");
    setCurrency("EGP"); setDeposit(""); setInsurance("");
    setUnitOpen(false); setConflict(null);
  }

  function resolvePropertyId() {
    return selectedPropertyId || properties.find(p => p.name === unitQuery.trim())?.id;
  }

  async function findConflict(propertyId: string): Promise<ConflictingReservation | null> {
    const workspaceId = await getWorkspaceId();
    const { data } = await supabase.from("reservations").select("guest_name, check_in, check_out, status, properties(name)").eq("workspace_id", workspaceId).eq("property_id", propertyId).or("status.neq.cancelled,status.is.null").lt("check_in", checkOut).gt("check_out", checkIn).limit(1);
    if (!data?.length) return null;
    const row = data[0] as unknown as DbConflictRow;
    return { unitName: row.properties?.name ?? unitQuery.trim(), guestName: row.guest_name, checkIn: row.check_in, checkOut: row.check_out };
  }

  async function insertReservation(propertyId: string) {
    const workspaceId = await getWorkspaceId();
    const insertData: Record<string, unknown> = {
      workspace_id: workspaceId, property_id: propertyId,
      guest_name: guestName.trim(), source, check_in: checkIn, check_out: checkOut,
      total_price: Number(totalPrice), currency,
    };
    if (guestPhone.trim()) insertData.guest_phone = guestPhone.trim();
    if (isOffline) { insertData.deposit = Number(deposit) || 0; insertData.insurance = Number(insurance) || 0; }

    const { error } = await supabase.from("reservations").insert(insertData);
    if (error) { setToast({ message: error.message || "Failed to save", type: "error" }); return false; }

    const unitName = properties.find(p => p.id === propertyId)?.name ?? unitQuery.trim();
    const nightCount = calculateNights(checkIn, checkOut) ?? 0;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }, body: JSON.stringify({ guestName: guestName.trim(), unitName, checkIn, checkOut, nights: nightCount, price: totalPrice, currency, source: source === "offline" ? "direct" : source === "owner" ? "other" : source }) });
    } catch { /* best-effort */ }

    triggerHaptic();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
    setToast({ message: t("reservation_saved"), type: "success" });
    clearForm();
    return true;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setToast(null); setConflict(null);
    const propertyId = resolvePropertyId();
    if (!propertyId) { setToast({ message: t("select_unit"), type: "error" }); return; }
    if (!checkIn || !checkOut) { setToast({ message: t("select_dates"), type: "error" }); return; }
    if (calculateNights(checkIn, checkOut) === null) { setToast({ message: t("checkout_after_checkin"), type: "error" }); return; }
    setIsSaving(true);
    const existing = await findConflict(propertyId);
    if (existing) { setIsSaving(false); setConflict(existing); return; }
    await insertReservation(propertyId);
    setIsSaving(false);
  }

  async function handleSaveAnyway() {
    const propertyId = resolvePropertyId();
    if (!propertyId) return;
    setIsSaving(true); setConflict(null);
    await insertReservation(propertyId);
    setIsSaving(false);
  }

  return (
    <div className="animate-fade-up relative pb-8">
      {conflict && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 px-4 pb-8 sm:items-center sm:pb-0" role="dialog" aria-modal="true">
          <div className="w-full max-w-[400px] rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-2xl text-red-400" aria-hidden>&#9888;</span>
              <h2 className="mt-4 font-display text-xl text-text">{t("conflict_title")}</h2>
              <p className="mt-3 text-sm text-muted">{t("conflict_desc")}</p>
              <div className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-start">
                <p className="font-semibold text-text">{conflict.unitName}</p>
                <p className="mt-0.5 text-sm text-muted">{conflict.guestName}</p>
                <p className="mt-2 text-sm text-text">{formatDisplayDate(conflict.checkIn)} - {formatDisplayDate(conflict.checkOut)}</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConflict(null)} disabled={isSaving} className="rounded-xl border border-border py-3.5 text-sm font-semibold text-text hover:border-muted disabled:opacity-50">{t("cancel")}</button>
              <button type="button" onClick={handleSaveAnyway} disabled={isSaving} className="rounded-xl bg-accent py-3.5 text-sm font-semibold text-background hover:bg-accent-hover disabled:opacity-60">
                {isSaving ? t("saving") : t("save_anyway")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className={`animate-toast-slide-up fixed bottom-24 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-[448px] -translate-x-1/2 rounded-xl border px-4 py-3.5 text-sm font-medium shadow-xl ${toast.type === "success" ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" : "border-red-500/50 bg-red-500/15 text-red-300"}`}>
          {toast.message}
        </div>
      )}

      <header className="pt-4">
        <h1 className="font-display text-3xl text-text">{t("new_reservation")}</h1>
        <p className="mt-1 text-sm text-muted">{t("add_new_booking")}</p>
      </header>

      <form onSubmit={handleSave} className="mt-8 space-y-5">

        {/* Dates — stacked vertically */}
        <fieldset className="space-y-3">
          <legend className="sr-only">Stay dates</legend>
          <div className="overflow-hidden"><label className={labelClass}>{t("check_in")}</label>
            <input type="date" value={checkIn} onChange={e => { setCheckIn(e.target.value); triggerHaptic(); }} className={`${inputClass} [color-scheme:dark]`} />
          </div>
          <div className="overflow-hidden"><label className={labelClass}>{t("check_out")}</label>
            <input type="date" value={checkOut} min={checkIn || undefined} onChange={e => { setCheckOut(e.target.value); triggerHaptic(); }} className={`${inputClass} [color-scheme:dark]`} />
          </div>
          {nights !== null && (
            <div className="flex justify-center pt-1">
              <span className="rounded-full bg-[var(--accent-muted)] px-5 py-2 text-sm font-bold text-accent">
                {nights} {nights === 1 ? t("night") : t("nights")}
              </span>
            </div>
          )}
        </fieldset>

        {/* Unit */}
        <div ref={unitRef} className={`relative ${unitOpen ? "z-50" : ""}`}>
          <label className={labelClass}>{t("unit")}</label>
          <input type="text" value={unitQuery} placeholder={t("search_units")} autoComplete="off"
            onChange={e => { setUnitQuery(e.target.value); setSelectedPropertyId(""); setUnitOpen(true); }}
            onFocus={() => setUnitOpen(true)} className={inputClass} />
          {unitOpen && (
            <ul role="listbox" className="absolute start-0 end-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-2xl">
              {filteredProperties.length === 0
                ? <li className="px-4 py-4 text-sm text-muted">{t("no_units_found")}</li>
                : filteredProperties.map(property => (
                  <li key={property.id}>
                    <button type="button" onClick={() => { setSelectedPropertyId(property.id); setUnitQuery(property.name); setUnitOpen(false); triggerHaptic(); }}
                      className={`w-full px-4 py-3.5 text-start text-sm font-medium transition-colors active:bg-background ${selectedPropertyId === property.id ? "bg-[var(--accent-muted)] text-accent" : "text-text hover:bg-background"}`}>
                      {property.name}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>

        {/* Booking Source */}
        <fieldset>
          <legend className={labelClass}>{t("booking_source")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {BOOKING_SOURCE_LIST.map(({ id, icon, label, bg }) => {
              const selected = source === id;
              return (
                <button key={id} type="button" onClick={() => { setSource(id); triggerHaptic(); }}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-4 text-sm font-semibold transition-all active:scale-95 ${selected ? "border-transparent text-white shadow-md" : "border-border bg-surface text-text"}`}
                  style={selected ? { backgroundColor: bg } : undefined}>
                  <span aria-hidden className="text-lg">{icon}</span>{label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Guest Name */}
        <div>
          <label className={labelClass}>{t("guest_name")}</label>
          <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} placeholder={t("full_name")} autoCapitalize="words" className={inputClass} />
        </div>

        {/* Guest Phone */}
        <div>
          <label className={labelClass}>Guest Phone <span className="text-muted font-normal text-xs">(optional)</span></label>
          <input type="tel" inputMode="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="+20 100 000 0000" className={inputClass} />
        </div>

        {/* Total Price */}
        <div>
          <label className={labelClass}>{t("total_price")}</label>
          <div className="flex gap-2">
            <input type="number" inputMode="numeric" min="0" step="1" value={totalPrice} onChange={e => setTotalPrice(e.target.value)} placeholder="0" className={`${inputClass} min-w-0 flex-1`} />
            <div className="flex shrink-0 rounded-xl border border-border bg-surface p-1">
              {(["EGP", "USD"] as const).map(c => (
                <button key={c} type="button" onClick={() => { setCurrency(c); triggerHaptic(); }}
                  className={`rounded-lg px-3 py-2.5 text-xs font-bold transition-all ${currency === c ? "bg-accent text-background" : "text-muted"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Offline fields */}
        {isOffline && (
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Offline Details</p>
            <div>
              <label className={labelClass}>Deposit Paid</label>
              <input type="number" inputMode="numeric" min="0" step="1" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Insurance <span className="text-muted font-normal text-xs">(refundable)</span></label>
              <input type="number" inputMode="numeric" min="0" step="1" value={insurance} onChange={e => setInsurance(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            {totalPrice && (
              <div className="rounded-xl border border-accent/30 bg-[var(--accent-muted)] px-4 py-3">
                <p className="text-xs text-muted mb-1">Remaining to collect</p>
                <p className="font-display text-2xl text-accent">
                  {remaining.toLocaleString()} <span className="text-sm font-sans text-muted">{currency}</span>
                </p>
                <p className="text-xs text-muted mt-1">{totalPrice} &minus; {deposit || "0"} deposit</p>
              </div>
            )}
          </div>
        )}

        <button type="submit" disabled={isSaving} onClick={() => triggerHaptic()}
          className={`w-full rounded-xl py-4 text-base font-bold text-background transition-all active:scale-95 disabled:opacity-60 ${saveSuccess ? "bg-emerald-500" : "bg-accent hover:bg-accent-hover"}`}>
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10"/></svg>
              {t("saving")}
            </span>
          ) : saveSuccess ? "✓ Saved!" : t("save_reservation")}
        </button>
      </form>
    </div>
  );
}


