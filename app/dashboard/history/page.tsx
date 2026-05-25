"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { BOOKING_SOURCE_LIST, getBookingSourceBorderStyle, isBookingSource, SourceBadge, type BookingSource } from "@/lib/booking-source";
import { supabase } from "@/lib/supabase";
import { getWorkspaceId } from "@/lib/workspace";
import { useCallback, useEffect, useMemo, useState } from "react";

type HistoryReservation = { id: string; unitName: string; guestName: string; checkIn: string; checkOut: string; nights: number; price: number; currency: "EGP" | "USD"; source: BookingSource; createdAt: string };
type DbReservation = { id: string; guest_name: string; source: string; check_in: string; check_out: string; total_price: number; currency: string; created_at: string; properties?: { name: string } | null };

const selectClass = "w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text transition-colors focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)] [color-scheme:dark]";

function calculateNights(ci: string, co: string) {
  const n = Math.round((new Date(`${co}T12:00:00`).getTime()-new Date(`${ci}T12:00:00`).getTime())/(1000*60*60*24));
  return n > 0 ? n : 0;
}
function mapReservation(row: DbReservation): HistoryReservation | null {
  if (!isBookingSource(row.source)) return null;
  return { id: row.id, unitName: row.properties?.name ?? "Unknown unit", guestName: row.guest_name, checkIn: row.check_in, checkOut: row.check_out, nights: calculateNights(row.check_in, row.check_out), price: Number(row.total_price), currency: row.currency === "USD" ? "USD" : "EGP", source: row.source, createdAt: row.created_at };
}
function monthKey(ci: string) { const d = new Date(`${ci}T12:00:00`); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function formatMonthLabel(key: string) { const [y,m] = key.split("-"); return new Date(Number(y),Number(m)-1,1).toLocaleDateString("en-US",{month:"long",year:"numeric"}); }
function formatDateRange(ci: string, co: string) {
  const opts: Intl.DateTimeFormatOptions = {month:"short",day:"numeric"};
  return `${new Date(`${ci}T12:00:00`).toLocaleDateString("en-US",opts)} - ${new Date(`${co}T12:00:00`).toLocaleDateString("en-US",{...opts,year:"numeric"})}`;
}
function formatRevenue(amount: number, currency: "EGP"|"USD") { return `${currency} ${amount.toLocaleString()}`; }

export default function HistoryPage() {
  const { t } = useLanguage();
  const [refreshKey, setRefreshKey] = useState(0);
  const [monthFilter, setMonthFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [reservations, setReservations] = useState<HistoryReservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchReservations = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    const workspaceId = await getWorkspaceId();
    const { data, error } = await supabase.from("reservations").select("*, properties(name)").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
    if (error) { setFetchError(error.message); setReservations([]); setIsLoading(false); return; }
    setReservations((data as DbReservation[]).map(mapReservation).filter((r): r is HistoryReservation => r !== null));
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchReservations(); }, [fetchReservations, refreshKey]);

  const monthOptions = useMemo(() => [...new Set(reservations.map(r => monthKey(r.checkIn)))].sort((a,b) => b.localeCompare(a)), [reservations]);

  const filtered = useMemo(() => reservations.filter(r => {
    const monthMatch = monthFilter === "all" || monthKey(r.checkIn) === monthFilter;
    const sourceMatch = sourceFilter === "all" || r.source === sourceFilter;
    return monthMatch && sourceMatch;
  }).sort((a,b) => new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()), [reservations, monthFilter, sourceFilter]);

  const summary = useMemo(() => {
    let egp = 0, usd = 0;
    for (const r of filtered) { if (r.currency === "EGP") egp += r.price; else usd += r.price; }
    return { count: filtered.length, egp, usd };
  }, [filtered]);

  const grouped = useMemo(() => {
    const map = new Map<string, HistoryReservation[]>();
    for (const r of filtered) { const key = monthKey(r.checkIn); map.set(key, [...(map.get(key)??[]), r]); }
    return [...map.entries()].sort(([a],[b]) => b.localeCompare(a)).map(([key, res]) => {
      let egp = 0, usd = 0;
      for (const r of res) { if (r.currency === "EGP") egp += r.price; else usd += r.price; }
      return { key, label: formatMonthLabel(key), reservations: res, egp, usd };
    });
  }, [filtered]);

  return (
    <div className="animate-fade-up pb-6">
      <header className="flex items-start justify-between gap-4 pt-4">
        <div>
          <h1 className="font-display text-3xl text-text">{t("history")}</h1>
          <p className="mt-1 text-sm text-muted">{t("all_reservations")}</p>
        </div>
        <button type="button" onClick={() => setRefreshKey(k=>k+1)} disabled={isLoading} className="shrink-0 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-50">{t("refresh")}</button>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-2 block text-xs font-medium text-muted">{t("filter_month")}</label>
          <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className={selectClass} disabled={isLoading}>
            <option value="all">{t("all_months")}</option>
            {monthOptions.map(key => <option key={key} value={key}>{formatMonthLabel(key)}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium text-muted">{t("filter_source")}</label>
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className={selectClass} disabled={isLoading}>
            <option value="all">{t("all_sources")}</option>
            {BOOKING_SOURCE_LIST.map(src => <option key={src.id} value={src.id}>{src.label}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
        <span className="font-semibold text-text">{summary.count} {summary.count === 1 ? t("booking") : t("bookings")}</span>
        <span className="text-muted">·</span>
        <span className="font-medium text-accent">{formatRevenue(summary.egp, "EGP")}</span>
        <span className="text-muted">·</span>
        <span className="font-medium text-blue-400">{formatRevenue(summary.usd, "USD")}</span>
      </div>

      <div className="mt-6 space-y-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" aria-hidden />
            <p className="mt-3 text-sm text-muted">{t("loading_reservations")}</p>
          </div>
        ) : fetchError ? (
          <div className="rounded-xl border border-dashed border-red-500/40 bg-red-500/10 px-4 py-10 text-center">
            <p className="text-sm text-red-300">{fetchError}</p>
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-10 text-center">
            <span className="text-2xl" role="img" aria-hidden>📭</span>
            <p className="mt-2 text-sm text-muted">{t("no_reservations_filter")}</p>
          </div>
        ) : grouped.map(group => (
          <section key={group.key}>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 className="font-display text-lg text-text">{group.label}</h2>
              <span className="text-xs text-muted">
                {group.reservations.length} {group.reservations.length === 1 ? t("booking") : t("bookings")}
                {" · "}<span className="text-accent">{formatRevenue(group.egp,"EGP")}</span>
                {group.usd > 0 && <>{" · "}<span className="text-blue-400">{formatRevenue(group.usd,"USD")}</span></>}
              </span>
            </div>
            <ul className="space-y-2">
              {group.reservations.map(r => (
                <li key={r.id} className="rounded-xl border border-border border-s-4 bg-surface px-4 py-3" style={getBookingSourceBorderStyle(r.source)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-text">{r.unitName}</p>
                      <p className="mt-0.5 text-sm text-muted">{r.guestName}</p>
                    </div>
                    <p className={`shrink-0 text-sm font-semibold tabular-nums ${r.currency==="EGP"?"text-accent":"text-blue-400"}`}>{formatRevenue(r.price,r.currency)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <span>{formatDateRange(r.checkIn,r.checkOut)}</span>
                    <span>·</span>
                    <span>{r.nights} {r.nights===1?t("night"):t("nights")}</span>
                    <span>·</span>
                    <SourceBadge source={r.source} size="sm" />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
