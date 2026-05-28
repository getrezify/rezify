"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { getWorkspaceId } from "@/lib/workspace";
import { useEffect, useMemo, useState } from "react";

type Currency = "EGP" | "USD";
type BrokeredReservation = {
  id: string;
  unit_description: string;
  broker_name: string | null;
  broker_phone: string | null;
  guest_name: string;
  guest_phone: string | null;
  check_in: string;
  check_out: string;
  cost_price: number;
  sell_price: number;
  currency: string;
  source: string;
  status: string;
  created_at: string;
};

const inputClass = "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";
const labelClass = "mb-2 block text-sm font-medium text-text";

function calculateNights(ci: string, co: string): number | null {
  if (!ci || !co) return null;
  const n = Math.round((new Date(`${co}T12:00:00`).getTime() - new Date(`${ci}T12:00:00`).getTime()) / (1000 * 60 * 60 * 24));
  return n > 0 ? n : null;
}

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const SOURCES = [
  { id: "airbnb", label: "Airbnb", icon: "🏠", bg: "#FF5A5F" },
  { id: "booking", label: "Booking.com", icon: "🔵", bg: "#003580" },
  { id: "direct", label: "Direct", icon: "💬", bg: "#25D366" },
  { id: "other", label: "Other", icon: "📋", bg: "#6B6458" },
];


type EditableBrokered = {
  unit_description: string;
  broker_name: string;
  broker_phone: string;
  guest_name: string;
  guest_phone: string;
  check_in: string;
  check_out: string;
  cost_price: string;
  sell_price: string;
  currency: string;
};

function ExpandedBrokeredCard({ r, onCancel, onDone, onSaved }: { r: BrokeredReservation; onCancel: () => void; onDone: () => void; onSaved: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fields, setFields] = useState<EditableBrokered>({
    unit_description: r.unit_description,
    broker_name: r.broker_name ?? "",
    broker_phone: r.broker_phone ?? "",
    guest_name: r.guest_name,
    guest_phone: r.guest_phone ?? "",
    check_in: r.check_in,
    check_out: r.check_out,
    cost_price: String(r.cost_price),
    sell_price: String(r.sell_price),
    currency: r.currency,
  });

  const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text transition-colors focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";
  const labelCls = "mb-1 block text-xs font-medium text-muted";

  async function handleSave() {
    setIsSaving(true);
    const workspaceId = await getWorkspaceId();
    const { error } = await supabase.from("brokered_reservations").update({
      unit_description: fields.unit_description,
      broker_name: fields.broker_name || null,
      broker_phone: fields.broker_phone || null,
      guest_name: fields.guest_name,
      guest_phone: fields.guest_phone || null,
      check_in: fields.check_in,
      check_out: fields.check_out,
      cost_price: Number(fields.cost_price) || 0,
      sell_price: Number(fields.sell_price) || 0,
      currency: fields.currency,
    }).eq("id", r.id).eq("workspace_id", workspaceId);
    setIsSaving(false);
    if (!error) { setIsEditing(false); onSaved(); }
  }

  const profit = (Number(fields.sell_price) || 0) - (Number(fields.cost_price) || 0);

  return (
    <div className="border-t border-border px-4 py-3 space-y-3">
      {!isEditing ? (
        <>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><p className="text-muted text-xs">Check-in</p><p className="text-text">{formatDate(r.check_in)}</p></div>
            <div><p className="text-muted text-xs">Check-out</p><p className="text-text">{formatDate(r.check_out)}</p></div>
            <div><p className="text-muted text-xs">Cost</p><p className="text-text">{r.cost_price.toLocaleString()} {r.currency}</p></div>
            <div><p className="text-muted text-xs">Sell</p><p className="text-text">{r.sell_price.toLocaleString()} {r.currency}</p></div>
            {r.broker_name && <div><p className="text-muted text-xs">Broker</p><p className="text-text">{r.broker_name}</p></div>}
            {r.broker_phone && <div><p className="text-muted text-xs">Broker Phone</p><a href={`tel:${r.broker_phone}`} className="text-accent hover:underline text-sm">{r.broker_phone}</a></div>}
            {r.guest_phone && <div><p className="text-muted text-xs">Guest Phone</p><a href={`tel:${r.guest_phone}`} className="text-accent hover:underline text-sm">{r.guest_phone}</a></div>}
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button type="button" onClick={onCancel} className="rounded-lg border border-red-500/40 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10">Cancel</button>
            <button type="button" onClick={() => setIsEditing(true)} className="rounded-lg border border-accent py-2 text-xs font-semibold text-accent hover:bg-[var(--accent-muted)]">Modify</button>
            <button type="button" onClick={onDone} className="rounded-lg border border-border py-2 text-xs font-semibold text-muted hover:border-muted hover:text-text">Done</button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Edit Reservation</p>
          <div><label className={labelCls}>Unit Description</label><input className={inputCls} value={fields.unit_description} onChange={e => setFields(f => ({...f, unit_description: e.target.value}))} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>Broker Name</label><input className={inputCls} value={fields.broker_name} onChange={e => setFields(f => ({...f, broker_name: e.target.value}))} /></div>
            <div><label className={labelCls}>Broker Phone</label><input className={inputCls} value={fields.broker_phone} onChange={e => setFields(f => ({...f, broker_phone: e.target.value}))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>Guest Name</label><input className={inputCls} value={fields.guest_name} onChange={e => setFields(f => ({...f, guest_name: e.target.value}))} /></div>
            <div><label className={labelCls}>Guest Phone</label><input className={inputCls} value={fields.guest_phone} onChange={e => setFields(f => ({...f, guest_phone: e.target.value}))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>Check-in</label><input type="date" className={`${inputCls} [color-scheme:dark]`} value={fields.check_in} onChange={e => setFields(f => ({...f, check_in: e.target.value}))} /></div>
            <div><label className={labelCls}>Check-out</label><input type="date" className={`${inputCls} [color-scheme:dark]`} value={fields.check_out} onChange={e => setFields(f => ({...f, check_out: e.target.value}))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>Cost Price</label><input type="number" className={inputCls} value={fields.cost_price} onChange={e => setFields(f => ({...f, cost_price: e.target.value}))} /></div>
            <div><label className={labelCls}>Sell Price</label><input type="number" className={inputCls} value={fields.sell_price} onChange={e => setFields(f => ({...f, sell_price: e.target.value}))} /></div>
          </div>
          <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${profit >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
            Profit: {profit >= 0 ? "+" : ""}{profit.toLocaleString()} {fields.currency}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setIsEditing(false)} disabled={isSaving} className="rounded-lg border border-border py-2.5 text-sm font-semibold text-muted hover:border-muted">Cancel</button>
            <button type="button" onClick={handleSave} disabled={isSaving} className="rounded-lg bg-accent py-2.5 text-sm font-semibold text-background hover:bg-accent-hover disabled:opacity-60">
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BrokeredPage() {
  const { t } = useLanguage();
  const [view, setView] = useState<"list" | "add">("list");
  const [reservations, setReservations] = useState<BrokeredReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form fields
  const [unitDescription, setUnitDescription] = useState("");
  const [brokerName, setBrokerName] = useState("");
  const [brokerPhone, setBrokerPhone] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [currency, setCurrency] = useState<Currency>("EGP");
  const [source, setSource] = useState("direct");

  const nights = useMemo(() => calculateNights(checkIn, checkOut), [checkIn, checkOut]);
  const profit = useMemo(() => {
    const sell = parseFloat(sellPrice) || 0;
    const cost = parseFloat(costPrice) || 0;
    return sell - cost;
  }, [sellPrice, costPrice]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  async function loadReservations() {
    setLoading(true);
    try {
      const workspaceId = await getWorkspaceId();
      const { data, error } = await supabase
        .from("brokered_reservations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("check_in", { ascending: false });
      if (error) throw error;
      setReservations((data ?? []) as BrokeredReservation[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadReservations(); }, []);

  function clearForm() {
    setUnitDescription(""); setBrokerName(""); setBrokerPhone("");
    setGuestName(""); setGuestPhone(""); setCheckIn(""); setCheckOut("");
    setCostPrice(""); setSellPrice(""); setCurrency("EGP"); setSource("direct");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!unitDescription.trim()) { setToast({ message: "Unit description is required", type: "error" }); return; }
    if (!guestName.trim()) { setToast({ message: "Guest name is required", type: "error" }); return; }
    if (!checkIn || !checkOut) { setToast({ message: "Check-in and check-out dates are required", type: "error" }); return; }
    if (calculateNights(checkIn, checkOut) === null) { setToast({ message: "Check-out must be after check-in", type: "error" }); return; }

    setIsSaving(true);
    try {
      const workspaceId = await getWorkspaceId();
      const { error } = await supabase.from("brokered_reservations").insert({
        workspace_id: workspaceId,
        unit_description: unitDescription.trim(),
        broker_name: brokerName.trim() || null,
        broker_phone: brokerPhone.trim() || null,
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim() || null,
        check_in: checkIn,
        check_out: checkOut,
        cost_price: Number(costPrice) || 0,
        sell_price: Number(sellPrice) || 0,
        currency,
        source,
        status: "confirmed",
      });
      if (error) { setToast({ message: error.message, type: "error" }); return; }
      setToast({ message: "Brokered reservation saved!", type: "success" });
      clearForm();
      setView("list");
      await loadReservations();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCancel(id: string) {
    const workspaceId = await getWorkspaceId();
    await supabase.from("brokered_reservations").update({ status: "cancelled" }).eq("id", id).eq("workspace_id", workspaceId);
    await loadReservations();
  }

  const active = reservations.filter(r => r.status !== "cancelled");
  const cancelled = reservations.filter(r => r.status === "cancelled");

  return (
    <div className="animate-fade-up pb-6">
      {toast && (
        <div role="status" className={`animate-toast-slide-up fixed bottom-6 z-[100] w-[calc(100%-2rem)] max-w-[448px] rounded-lg border px-4 py-3 text-sm font-medium shadow-xl ${toast.type === "success" ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" : "border-red-500/50 bg-red-500/15 text-red-300"}`}>
          {toast.message}
        </div>
      )}

      <header className="pt-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-text">Brokered</h1>
          <p className="mt-1 text-sm text-muted">External units you broker for guests</p>
        </div>
        {view === "list" && (
          <button type="button" onClick={() => setView("add")} className="shrink-0 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background hover:bg-accent-hover">
            + Add
          </button>
        )}
        {view === "add" && (
          <button type="button" onClick={() => { setView("list"); clearForm(); }} className="shrink-0 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text hover:border-muted">
            Cancel
          </button>
        )}
      </header>

      {view === "add" && (
        <form onSubmit={handleSave} className="mt-8 space-y-6">

          {/* Unit & Broker Info */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Unit & Broker</p>
            <div>
              <label className={labelClass}>Unit Description</label>
              <input type="text" value={unitDescription} onChange={e => setUnitDescription(e.target.value)} placeholder="e.g. 2BR Chalet, Stella Di Mare, El Gouna" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Broker / Company Name <span className="text-muted font-normal">(optional)</span></label>
              <input type="text" value={brokerName} onChange={e => setBrokerName(e.target.value)} placeholder="e.g. Marina Properties" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Broker Phone <span className="text-muted font-normal">(optional)</span></label>
              <input type="tel" value={brokerPhone} onChange={e => setBrokerPhone(e.target.value)} placeholder="+20 100 000 0000" className={inputClass} />
            </div>
          </div>

          {/* Guest Info */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Guest</p>
            <div>
              <label className={labelClass}>Guest Name</label>
              <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Full name" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Guest Phone <span className="text-muted font-normal">(optional)</span></label>
              <input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="+20 100 000 0000" className={inputClass} />
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t("check_in")}</label>
                <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className={`${inputClass} [color-scheme:dark]`} />
              </div>
              <div>
                <label className={labelClass}>{t("check_out")}</label>
                <input type="date" value={checkOut} min={checkIn || undefined} onChange={e => setCheckOut(e.target.value)} className={`${inputClass} [color-scheme:dark]`} />
              </div>
            </div>
            {nights !== null && (
              <div className="flex justify-center">
                <span className="rounded-full bg-[var(--accent-muted)] px-4 py-1.5 text-sm font-semibold text-accent">
                  {nights} {nights === 1 ? "night" : "nights"}
                </span>
              </div>
            )}
          </div>

          {/* Source */}
          <div>
            <label className={labelClass}>Booking Source</label>
            <div className="grid grid-cols-2 gap-2">
              {SOURCES.map(s => {
                const selected = source === s.id;
                return (
                  <button key={s.id} type="button" onClick={() => setSource(s.id)}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3.5 text-sm font-semibold transition-all ${selected ? "border-transparent text-white shadow-md" : "border-border bg-surface text-text hover:border-muted"}`}
                    style={selected ? { backgroundColor: s.bg } : undefined}>
                    <span>{s.icon}</span>{s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pricing */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Pricing</p>

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className={labelClass}>Cost Price <span className="text-muted font-normal">(what you pay broker)</span></label>
                <input type="number" min="0" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0.00" className={inputClass} />
              </div>
              <div className="flex shrink-0 rounded-lg border border-border bg-background p-1 mb-0.5">
                {(["EGP", "USD"] as const).map(c => (
                  <button key={c} type="button" onClick={() => setCurrency(c)}
                    className={`rounded-md px-3 py-2 text-xs font-semibold transition-all ${currency === c ? "bg-accent text-background" : "text-muted hover:text-text"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Sell Price <span className="text-muted font-normal">(what you charge guest)</span></label>
              <input type="number" min="0" step="0.01" value={sellPrice} onChange={e => setSellPrice(e.target.value)} placeholder="0.00" className={inputClass} />
            </div>

            {(costPrice || sellPrice) && (
              <div className={`rounded-lg border px-4 py-3 ${profit >= 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}>
                <p className="text-xs text-muted mb-1">Your profit</p>
                <p className={`font-display text-2xl ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {profit >= 0 ? "+" : ""}{profit.toLocaleString()} <span className="text-sm font-sans">{currency}</span>
                </p>
                <p className="text-xs text-muted mt-1">{sellPrice || "0"} sell &minus; {costPrice || "0"} cost</p>
              </div>
            )}
          </div>

          <button type="submit" disabled={isSaving} className="w-full rounded-lg bg-accent py-3.5 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:opacity-60">
            {isSaving ? "Saving..." : "Save Brokered Reservation"}
          </button>
        </form>
      )}

      {view === "list" && (
        <div className="mt-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
            </div>
          ) : reservations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-12 text-center">
              <p className="text-2xl mb-2">🤝</p>
              <p className="font-semibold text-text">No brokered reservations yet</p>
              <p className="mt-1 text-sm text-muted">Add reservations for units you broker from other companies</p>
              <button type="button" onClick={() => setView("add")} className="mt-4 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background hover:bg-accent-hover">
                Add First Reservation
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {active.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Active</p>
                  {active.map(r => {
                    const p = r.sell_price - r.cost_price;
                    const isExpanded = expandedId === r.id;
                    return (
                      <div key={r.id} className="rounded-xl border border-border bg-surface overflow-hidden">
                        <button type="button" onClick={() => setExpandedId(isExpanded ? null : r.id)} className="w-full px-4 py-3 text-start">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-text truncate">{r.unit_description}</p>
                              <p className="text-sm text-muted">{r.guest_name}</p>
                            </div>
                            <div className="shrink-0 text-end">
                              <p className={`font-semibold text-sm ${p >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {p >= 0 ? "+" : ""}{p.toLocaleString()} {r.currency}
                              </p>
                              <p className="text-xs text-muted">{formatDate(r.check_in)}</p>
                            </div>
                          </div>
                        </button>
                        {isExpanded && (
                          <ExpandedBrokeredCard
                            r={r}
                            onCancel={() => handleCancel(r.id)}
                            onDone={() => setExpandedId(null)}
                            onSaved={loadReservations}
                          />
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {cancelled.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted mt-6">Cancelled</p>
                  {cancelled.map(r => (
                    <div key={r.id} className="rounded-xl border border-border bg-surface/50 px-4 py-3 opacity-50">
                      <p className="font-semibold text-text line-through">{r.unit_description}</p>
                      <p className="text-sm text-muted">{r.guest_name} &middot; {formatDate(r.check_in)}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
