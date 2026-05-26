"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { getWorkspaceId } from "@/lib/workspace";
import { useCallback, useEffect, useState } from "react";

type StayCard = { id: string; unitName: string; guestName: string; nightsInfo: string };
type DbReservation = { id: string; guest_name: string; check_in: string; check_out: string; properties?: { name: string } | null };

function getTomorrowISO() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function calculateNights(ci: string, co: string) {
  const n = Math.round((new Date(`${co}T12:00:00`).getTime()-new Date(`${ci}T12:00:00`).getTime())/(1000*60*60*24));
  return n > 0 ? n : 0;
}
function mapToStayCard(row: DbReservation, nightsInfo: string): StayCard {
  return { id: row.id, unitName: row.properties?.name ?? "Unknown unit", guestName: row.guest_name, nightsInfo };
}
function formatFullDate(iso: string, lang: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function UpcomingPage() {
  const { t, lang } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(getTomorrowISO());
  const [checkIns, setCheckIns] = useState<StayCard[]>([]);
  const [checkOuts, setCheckOuts] = useState<StayCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadBriefing = useCallback(async (date: string) => {
    setIsLoading(true); setFetchError(null);
    try {
      const workspaceId = await getWorkspaceId();
      const [ciRes, coRes] = await Promise.all([
        supabase.from("reservations").select("*, properties(name)").eq("workspace_id", workspaceId).eq("check_in", date),
        supabase.from("reservations").select("*, properties(name)").eq("workspace_id", workspaceId).eq("check_out", date),
      ]);
      setCheckIns(((ciRes.data ?? []) as DbReservation[]).map(row => {
        const n = calculateNights(row.check_in, row.check_out);
        return mapToStayCard(row, `${n} ${n === 1 ? t("night") : t("nights")} - ${t("check_ins")}`);
      }));
      setCheckOuts(((coRes.data ?? []) as DbReservation[]).map(row => {
        const n = calculateNights(row.check_in, row.check_out);
        return mapToStayCard(row, `${n} ${n === 1 ? t("night") : t("nights")} - ${t("check_outs")}`);
      }));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load");
      setCheckIns([]); setCheckOuts([]);
    } finally { setIsLoading(false); }
  }, [t]);

  useEffect(() => { loadBriefing(selectedDate); }, [loadBriefing, selectedDate]);

  const totalCount = checkIns.length + checkOuts.length;

  return (
    <div className="animate-fade-up space-y-6 pb-4">
      <header className="pt-4">
        <h1 className="font-display text-3xl text-text">{lang === "ar" ? "القادم" : "Upcoming"}</h1>
        <p className="mt-1 text-sm text-muted">{formatFullDate(selectedDate, lang)}</p>
      </header>

      {/* Date picker */}
      <div className="flex items-center gap-3">
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm text-text transition-colors focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)] [color-scheme:dark]"
        />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              const d = new Date(`${selectedDate}T12:00:00`);
              d.setDate(d.getDate() - 1);
              setSelectedDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-text transition-colors hover:border-accent hover:text-accent"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date(`${selectedDate}T12:00:00`);
              d.setDate(d.getDate() + 1);
              setSelectedDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-text transition-colors hover:border-accent hover:text-accent"
          >
            →
          </button>
        </div>
        <button
          type="button"
          onClick={() => setSelectedDate(getTomorrowISO())}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent"
        >
          {lang === "ar" ? "غداً" : "Tomorrow"}
        </button>
      </div>

      {/* Summary badge */}
      {!isLoading && !fetchError && (
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${totalCount > 0 ? "bg-accent/15 text-accent" : "bg-border text-muted"}`}>
            {totalCount} {totalCount === 1 ? (lang === "ar" ? "حجز" : "booking") : (lang === "ar" ? "حجوزات" : "bookings")}
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" aria-hidden />
          <p className="mt-3 text-sm text-muted">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</p>
        </div>
      ) : fetchError ? (
        <div className="rounded-xl border border-dashed border-red-500/40 bg-red-500/10 px-4 py-10 text-center">
          <p className="text-sm text-red-300">{fetchError}</p>
        </div>
      ) : (
        <div className="space-y-8">
          <BriefingSection
            title={t("check_ins")}
            dotClassName="bg-emerald-500"
            badgeClassName="bg-emerald-500/15 text-emerald-400"
            borderClassName="border-s-emerald-500"
            items={checkIns}
            emptyEmoji="📋"
            emptyMessage={lang === "ar" ? "لا وصول في هذا اليوم" : "No check-ins on this date"}
          />
          <BriefingSection
            title={t("check_outs")}
            dotClassName="bg-red-500"
            badgeClassName="bg-red-500/15 text-red-400"
            borderClassName="border-s-red-500"
            items={checkOuts}
            emptyEmoji="👋"
            emptyMessage={lang === "ar" ? "لا مغادرة في هذا اليوم" : "No check-outs on this date"}
          />
        </div>
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
