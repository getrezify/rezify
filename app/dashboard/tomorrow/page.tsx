"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { getWorkspaceId } from "@/lib/workspace";
import { useCallback, useEffect, useMemo, useState } from "react";

type StayCard = { id: string; unitName: string; guestName: string; nightsInfo: string };
type DbReservation = { id: string; guest_name: string; check_in: string; check_out: string; properties?: { name: string } | null };

function getTomorrowISO() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getTomorrowDate() { const d = new Date(); d.setDate(d.getDate()+1); return d; }
function calculateNights(ci: string, co: string) {
  const n = Math.round((new Date(`${co}T12:00:00`).getTime()-new Date(`${ci}T12:00:00`).getTime())/(1000*60*60*24));
  return n > 0 ? n : 0;
}
function mapToStayCard(row: DbReservation, nightsInfo: string): StayCard {
  return { id: row.id, unitName: row.properties?.name ?? "Unknown unit", guestName: row.guest_name, nightsInfo };
}
function formatFullDate(date: Date, lang: string) {
  return date.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function TomorrowPage() {
  const { t, lang } = useLanguage();
  const [refreshKey, setRefreshKey] = useState(0);
  const [checkIns, setCheckIns] = useState<StayCard[]>([]);
  const [checkOuts, setCheckOuts] = useState<StayCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const tomorrowLabel = useMemo(() => formatFullDate(getTomorrowDate(), lang), [refreshKey, lang]);

  const loadBriefing = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    const tomorrow = getTomorrowISO();
    try {
      const workspaceId = await getWorkspaceId();
      const [ciRes, coRes] = await Promise.all([
        supabase.from("reservations").select("*, properties(name)").eq("workspace_id", workspaceId).eq("check_in", tomorrow),
        supabase.from("reservations").select("*, properties(name)").eq("workspace_id", workspaceId).eq("check_out", tomorrow),
      ]);
      setCheckIns(((ciRes.data ?? []) as DbReservation[]).map(row => {
        const n = calculateNights(row.check_in, row.check_out);
        return mapToStayCard(row, `${n} ${n === 1 ? t("night") : t("nights")} - ${t("checkin_tomorrow")}`);
      }));
      setCheckOuts(((coRes.data ?? []) as DbReservation[]).map(row => {
        const n = calculateNights(row.check_in, row.check_out);
        return mapToStayCard(row, `${n} ${n === 1 ? t("night") : t("nights")} - ${t("checkout_tomorrow")}`);
      }));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load briefing");
      setCheckIns([]); setCheckOuts([]);
    } finally { setIsLoading(false); }
  }, [t]);

  useEffect(() => { loadBriefing(); }, [loadBriefing, refreshKey]);

  return (
    <div className="animate-fade-up space-y-8 pb-4">
      <header className="flex items-start justify-between gap-4 pt-4">
        <div>
          <h1 className="font-display text-3xl text-text">{t("tomorrow")}</h1>
          <p className="mt-1 text-sm text-muted">{tomorrowLabel}</p>
        </div>
        <button type="button" onClick={() => setRefreshKey(k => k+1)} disabled={isLoading} className="shrink-0 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-50">
          {t("refresh")}
        </button>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" aria-hidden />
          <p className="mt-3 text-sm text-muted">{t("loading_tomorrow")}</p>
        </div>
      ) : fetchError ? (
        <div className="rounded-xl border border-dashed border-red-500/40 bg-red-500/10 px-4 py-10 text-center">
          <p className="text-sm text-red-300">{fetchError}</p>
        </div>
      ) : (
        <>
          <BriefingSection title={t("check_ins")} dotClassName="bg-emerald-500" badgeClassName="bg-emerald-500/15 text-emerald-400" borderClassName="border-l-emerald-500" items={checkIns} emptyEmoji="📋" emptyMessage={t("no_checkins_tomorrow")} />
          <BriefingSection title={t("check_outs")} dotClassName="bg-red-500" badgeClassName="bg-red-500/15 text-red-400" borderClassName="border-l-red-500" items={checkOuts} emptyEmoji="👋" emptyMessage={t("no_checkouts_tomorrow")} />
        </>
      )}
    </div>
  );
}

function BriefingSection({ title, dotClassName, badgeClassName, borderClassName, items, emptyEmoji, emptyMessage }: {
  title: string; dotClassName: string; badgeClassName: string; borderClassName: string;
  items: StayCard[]; emptyEmoji: string; emptyMessage: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClassName}`} />
        <h2 className="flex-1 text-sm font-semibold text-text">{title}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${badgeClassName}`}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center">
          <span className="text-2xl" role="img" aria-hidden>{emptyEmoji}</span>
          <p className="mt-2 text-sm text-muted">{emptyMessage}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map(item => (
            <li key={item.id} className={`rounded-xl border border-border border-s-4 bg-surface px-4 py-3 ${borderClassName}`}>
              <p className="font-semibold text-text">{item.unitName}</p>
              <p className="mt-0.5 text-sm text-muted">{item.guestName}</p>
              <p className="mt-1 text-xs text-muted/80">{item.nightsInfo}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
