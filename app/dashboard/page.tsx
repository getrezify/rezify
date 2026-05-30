"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { getWorkspaceId } from "@/lib/workspace";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type StayCard = { id: string; unitName: string; guestName: string; nightsInfo: string; isBrokered?: boolean };
type DbReservation = { id: string; guest_name: string; check_in: string; check_out: string; property_id?: string; properties?: { name: string } | null };
type DbBrokered = { id: string; guest_name: string; check_in: string; check_out: string; unit_description: string };
type AvailabilityGap = { from: string; to: string; nights: number };
type UnitAvailability = { unitId: string; unitName: string; isOccupied: boolean; gaps: AvailabilityGap[]; openEndedFrom: string | null };

function getTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function calculateNights(from: string, to: string) {
  return Math.max(0, Math.round((new Date(`${to}T12:00:00`).getTime()-new Date(`${from}T12:00:00`).getTime())/(1000*60*60*24)));
}
function nightOfStay(checkIn: string, checkOut: string, today: string, nightLabel: string, ofLabel: string) {
  const start = new Date(`${checkIn}T12:00:00`).getTime();
  const todayMs = new Date(`${today}T12:00:00`).getTime();
  const currentNight = Math.floor((todayMs - start)/(1000*60*60*24)) + 1;
  return `${nightLabel} ${currentNight} ${ofLabel} ${calculateNights(checkIn, checkOut)}`;
}
function mapToStayCard(row: DbReservation, nightsInfo: string): StayCard {
  return { id: row.id, unitName: row.properties?.name ?? "Unknown unit", guestName: row.guest_name, nightsInfo };
}
function mapBrokeredToStayCard(row: DbBrokered, nightsInfo: string): StayCard {
  return { id: row.id, unitName: row.unit_description, guestName: row.guest_name, nightsInfo, isBrokered: true };
}
function formatFullDate(date: Date, lang: string) {
  return date.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
function formatShortDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}
function buildUnitAvailability(units: { id: string; name: string }[], reservations: { property_id: string; check_in: string; check_out: string }[], today: string): UnitAvailability[] {
  return units.map(unit => {
    const res = reservations.filter(r => r.property_id === unit.id).sort((a,b) => a.check_in.localeCompare(b.check_in));
    const isOccupied = res.some(r => r.check_in <= today && r.check_out > today);
    const gaps: AvailabilityGap[] = [];
    let pointer = today;
    for (const r of res) {
      if (r.check_out <= today) continue;
      if (r.check_in > pointer) { const n = calculateNights(pointer, r.check_in); if (n > 0) gaps.push({ from: pointer, to: r.check_in, nights: n }); }
      if (r.check_out > pointer) pointer = r.check_out;
    }
    return { unitId: unit.id, unitName: unit.name, isOccupied, gaps, openEndedFrom: pointer };
  });
}

export default function TodayPage() {
  const { t, lang } = useLanguage();
  const [refreshKey, setRefreshKey] = useState(0);
  const [checkIns, setCheckIns] = useState<StayCard[]>([]);
  const [checkOuts, setCheckOuts] = useState<StayCard[]>([]);
  const [occupied, setOccupied] = useState<StayCard[]>([]);
  const [unitAvailability, setUnitAvailability] = useState<UnitAvailability[]>([]);
  const [hasUnits, setHasUnits] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const todayLabel = useMemo(() => formatFullDate(new Date(), lang), [refreshKey, lang]);

  const loadBriefing = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    const today = getTodayISO();
    try {
      const workspaceId = await getWorkspaceId();
      const [unitsRes, ciRows, coRows, occRows, futureRes, brokeredCi, brokeredCo, brokeredOcc] = await Promise.all([
        supabase.from("properties").select("id, name").eq("workspace_id", workspaceId),
        supabase.from("reservations").select("*, properties(name)").eq("workspace_id", workspaceId).eq("check_in", today),
        supabase.from("reservations").select("*, properties(name)").eq("workspace_id", workspaceId).eq("check_out", today),
        supabase.from("reservations").select("*, properties(name)").eq("workspace_id", workspaceId).lte("check_in", today).gt("check_out", today),
        supabase.from("reservations").select("property_id, check_in, check_out").eq("workspace_id", workspaceId).gte("check_out", today).order("check_in"),
        supabase.from("brokered_reservations").select("*").eq("workspace_id", workspaceId).eq("check_in", today).neq("status", "cancelled"),
        supabase.from("brokered_reservations").select("*").eq("workspace_id", workspaceId).eq("check_out", today).neq("status", "cancelled"),
        supabase.from("brokered_reservations").select("*").eq("workspace_id", workspaceId).lte("check_in", today).gt("check_out", today).neq("status", "cancelled"),
      ]);

      const units = (unitsRes.data ?? []) as { id: string; name: string }[];
      setHasUnits(units.length > 0);

      const nightLabel = lang === "ar" ? "ليلة" : "Night";
      const ofLabel = lang === "ar" ? "من" : "of";

      // Regular check-ins + brokered check-ins
      const regularCi = ((ciRows.data ?? []) as DbReservation[]).map(row => {
        const n = calculateNights(row.check_in, row.check_out);
        return mapToStayCard(row, `${n} ${n === 1 ? t("night") : t("nights")} - ${t("checkin_today")}`);
      });
      const brokerCi = ((brokeredCi.data ?? []) as DbBrokered[]).map(row => {
        const n = calculateNights(row.check_in, row.check_out);
        return mapBrokeredToStayCard(row, `${n} ${n === 1 ? t("night") : t("nights")} - ${t("checkin_today")}`);
      });
      setCheckIns([...regularCi, ...brokerCi]);

      // Regular check-outs + brokered check-outs
      const regularCo = ((coRows.data ?? []) as DbReservation[]).map(row => {
        const n = calculateNights(row.check_in, row.check_out);
        return mapToStayCard(row, `${n} ${n === 1 ? t("night") : t("nights")} - ${t("checkout_today")}`);
      });
      const brokerCo = ((brokeredCo.data ?? []) as DbBrokered[]).map(row => {
        const n = calculateNights(row.check_in, row.check_out);
        return mapBrokeredToStayCard(row, `${n} ${n === 1 ? t("night") : t("nights")} - ${t("checkout_today")}`);
      });
      setCheckOuts([...regularCo, ...brokerCo]);

      // Occupied + brokered occupied
      const regularOcc = ((occRows.data ?? []) as DbReservation[]).map(row =>
        mapToStayCard(row, nightOfStay(row.check_in, row.check_out, today, nightLabel, ofLabel))
      );
      const brokerOcc = ((brokeredOcc.data ?? []) as DbBrokered[]).map(row =>
        mapBrokeredToStayCard(row, nightOfStay(row.check_in, row.check_out, today, nightLabel, ofLabel))
      );
      setOccupied([...regularOcc, ...brokerOcc]);

      setUnitAvailability(buildUnitAvailability(units, (futureRes.data ?? []) as { property_id: string; check_in: string; check_out: string }[], today));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load briefing");
    } finally { setIsLoading(false); }
  }, [t, lang]);

  useEffect(() => { loadBriefing(); }, [loadBriefing, refreshKey]);

  return (
    <div className="animate-fade-up space-y-8 pb-4">
      <header className="flex items-start justify-between gap-4 pt-4">
        <div>
          <h1 className="font-display text-3xl text-text">{t("today")}</h1>
          <p className="mt-1 text-sm text-muted">{todayLabel}</p>
        </div>
        <button type="button" onClick={() => setRefreshKey(k=>k+1)} disabled={isLoading} className="shrink-0 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-50">
          {t("refresh")}
        </button>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
          <p className="mt-3 text-sm text-muted">{t("loading_today")}</p>
        </div>
      ) : fetchError ? (
        <div className="rounded-xl border border-dashed border-red-500/40 bg-red-500/10 px-4 py-10 text-center">
          <p className="text-sm text-red-300">{fetchError}</p>
        </div>
      ) : !hasUnits ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface text-3xl">&#127968;</div>
          <h2 className="font-display text-xl text-text">{t("no_units_yet")}</h2>
          <p className="mt-2 max-w-xs text-sm text-muted">{t("add_first_unit_desc")}</p>
          <Link href="/dashboard/properties" className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-accent-hover">
            {t("add_first_unit")}
          </Link>
        </div>
      ) : (
        <>
          <BriefingSection title={t("check_ins")} dotClassName="bg-emerald-500" badgeClassName="bg-emerald-500/15 text-emerald-400" borderClassName="border-s-emerald-500" items={checkIns} emptyEmoji="&#128077;" emptyMessage={t("no_checkins_today")} />
          <BriefingSection title={t("check_outs")} dotClassName="bg-red-500" badgeClassName="bg-red-500/15 text-red-400" borderClassName="border-s-red-500" items={checkOuts} emptyEmoji="&#128075;" emptyMessage={t("no_checkouts_today")} />
          <BriefingSection title={t("currently_occupied")} dotClassName="bg-purple-500" badgeClassName="bg-purple-500/15 text-purple-400" borderClassName="border-s-purple-500" items={occupied} emptyEmoji="&#127968;" emptyMessage={t("no_occupied")} />
          <AvailabilitySection units={unitAvailability} t={t} />
        </>
      )}
    </div>
  );
}

function AvailabilitySection({ units, t }: { units: UnitAvailability[]; t: (k: import("@/lib/i18n").TranslationKey) => string }) {
  const availableCount = units.filter(u => !u.isOccupied).length;
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
        <h2 className="flex-1 text-sm font-semibold text-text">{t("available_tonight")}</h2>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-400">{availableCount}</span>
      </div>
      {units.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center">
          <span className="text-2xl">&#127968;</span>
          <p className="mt-2 text-sm text-muted">{t("no_available")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {units.map(unit => (
            <li key={unit.unitId} className="rounded-xl border border-border bg-surface px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-text">{unit.unitName}</p>
                {unit.isOccupied ? (
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">{t("occupied")}</span>
                ) : (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">{t("free_tonight")}</span>
                )}
              </div>
              <div className="mt-2 space-y-1">
                {unit.gaps.length === 0 ? (
                  <p className="text-xs text-muted">&#128197; {t("no_upcoming_from")} {formatShortDate(unit.openEndedFrom!)}</p>
                ) : (
                  <>
                    {unit.gaps.map((gap, i) => (
                      <p key={i} className="text-xs text-muted">
                        &#128197; {t("available_label")} {formatShortDate(gap.from)} - {formatShortDate(gap.to)} &mdash; {gap.nights} {gap.nights === 1 ? t("night") : t("nights")}
                      </p>
                    ))}
                    <p className="text-xs text-muted">&#128197; {t("no_upcoming_from")} {formatShortDate(unit.openEndedFrom!)}</p>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
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
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-text">{item.unitName}</p>
                  <p className="mt-0.5 text-sm text-muted">{item.guestName}</p>
                  <p className="mt-1 text-xs text-muted/80">{item.nightsInfo}</p>
                </div>
                {item.isBrokered && (
                  <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400">Brokered</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
