"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { getUserPlan, isStarterAtUnitLimit, STARTER_UNIT_LIMIT, type UserPlan } from "@/lib/plan";
import { supabase } from "@/lib/supabase";
import { getWorkspaceId } from "@/lib/workspace";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Property = { id: string; name: string };

const inputClass = "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";
const labelClass = "mb-2 block text-sm font-medium text-text";
const secondaryButtonClass = "rounded-lg border border-border py-2.5 text-sm font-semibold text-text transition-colors hover:border-muted disabled:opacity-50";
const dangerButtonClass = "rounded-lg border border-red-500/50 bg-red-500/15 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50";
const rowActionClass = "shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50";
const rowDeleteClass = "shrink-0 rounded-md border border-red-500/40 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50";
const inlineInputClass = "min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text transition-colors focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";

export default function PropertiesPage() {
  const { t } = useLanguage();
  const [unitName, setUnitName] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isListActionLoading, setIsListActionLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inlineEditName, setInlineEditName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ propertyId: string; name: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProperties = useCallback(async () => {
    const workspaceId = await getWorkspaceId();
    const { data, error } = await supabase.from("properties").select("id, name").eq("workspace_id", workspaceId).order("name");
    if (error) { setProperties([]); throw new Error(error.message); }
    setProperties((data ?? []).map(row => ({ id: row.id as string, name: row.name as string })).filter(p => p.name?.trim()));
  }, []);

  const runPageLoad = useCallback(async () => {
    setPlanLoading(true); setListLoading(true); setLoadError(null);
    const [planResult, propertiesResult] = await Promise.allSettled([getUserPlan(), loadProperties()]);
    setUserPlan(planResult.status === "fulfilled" ? planResult.value : "starter");
    if (propertiesResult.status === "rejected") setLoadError(propertiesResult.reason instanceof Error ? propertiesResult.reason.message : "Failed to load");
    setPlanLoading(false); setListLoading(false);
  }, [loadProperties]);

  useEffect(() => { void runPageLoad(); }, [runPageLoad]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 4000); return () => clearTimeout(timer); }, [toast]);

  const atLimit = userPlan !== null && isStarterAtUnitLimit(userPlan, properties.length);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = unitName.trim();
    if (!name) { setToast({ message: t("unit_name"), type: "error" }); return; }
    setIsSaving(true);
    try {
      const workspaceId = await getWorkspaceId();
      const { error } = await supabase.from("properties").insert({ workspace_id: workspaceId, name });
      if (error) { setToast({ message: error.message, type: "error" }); return; }
      setToast({ message: t("unit_added"), type: "success" });
      setUnitName("");
      await loadProperties();
    } finally { setIsSaving(false); }
  }

  async function handleInlineSave(propertyId: string) {
    const name = inlineEditName.trim();
    if (!name) return;
    setIsListActionLoading(true);
    try {
      const workspaceId = await getWorkspaceId();
      const { error } = await supabase.from("properties").update({ name }).eq("id", propertyId).eq("workspace_id", workspaceId);
      if (error) { setToast({ message: error.message, type: "error" }); return; }
      setEditingId(null); setInlineEditName("");
      await loadProperties();
      setToast({ message: t("unit_renamed"), type: "success" });
    } finally { setIsListActionLoading(false); }
  }

  async function handleDeleteUnit() {
    if (!deleteConfirm) return;
    setIsListActionLoading(true);
    try {
      const workspaceId = await getWorkspaceId();
      const { error } = await supabase.from("properties").delete().eq("id", deleteConfirm.propertyId).eq("workspace_id", workspaceId);
      if (error) { setToast({ message: error.message, type: "error" }); return; }
      if (editingId === deleteConfirm.propertyId) { setEditingId(null); setInlineEditName(""); }
      setDeleteConfirm(null);
      await loadProperties();
      setToast({ message: t("unit_deleted"), type: "success" });
    } finally { setIsListActionLoading(false); }
  }

  return (
    <div className="animate-fade-up relative pb-6">
      {deleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-[400px] rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <h2 className="font-display text-xl text-text">{t("delete_unit_title")}</h2>
            <p className="mt-3 text-sm text-muted">
              {t("delete_unit_desc")} <span className="font-semibold text-text">{deleteConfirm.name}</span>. {t("cannot_undo")}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDeleteConfirm(null)} disabled={isListActionLoading} className={secondaryButtonClass}>{t("cancel")}</button>
              <button type="button" onClick={handleDeleteUnit} disabled={isListActionLoading} className={dangerButtonClass}>
                {isListActionLoading ? t("deleting") : t("delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className={`animate-toast-slide-up fixed bottom-6 z-[100] w-[calc(100%-2rem)] max-w-[448px] rounded-lg border px-4 py-3 text-sm font-medium shadow-xl ${toast.type === "success" ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" : "border-red-500/50 bg-red-500/15 text-red-300"}`}>
          {toast.message}
        </div>
      )}

      <Link href="/dashboard/units" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-text">
        <span aria-hidden>←</span> {t("back")}
      </Link>

      <header className="pt-4">
        <h1 className="font-display text-3xl text-text">{t("properties")}</h1>
        <p className="mt-1 text-sm text-muted">{t("properties_desc")}</p>
      </header>

      {planLoading || listLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" aria-hidden />
          <p className="mt-3 text-sm text-muted">{t("loading")}</p>
        </div>
      ) : atLimit ? (
        <div className="mt-8 rounded-xl border border-accent/40 bg-[var(--accent-muted)] px-4 py-6">
          <h2 className="font-display text-xl text-text">Unit limit reached</h2>
          <p className="mt-2 text-sm text-muted">Starter includes up to {STARTER_UNIT_LIMIT} units.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label className={labelClass}>{t("unit_name")}</label>
            <input type="text" value={unitName} onChange={e => setUnitName(e.target.value)} placeholder="e.g. Studio A" className={inputClass} />
          </div>
          <button type="submit" disabled={isSaving} className="w-full rounded-lg bg-accent py-3.5 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:opacity-60">
            {isSaving ? t("saving") : t("add_unit")}
          </button>
        </form>
      )}

      {!planLoading && !listLoading && (
        <section className="mt-10">
          <h2 className="font-display text-xl text-text">{t("your_units")}</h2>
          <p className="mt-1 text-sm text-muted">{t("rename_remove")}</p>
          {properties.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center">
              <p className="text-sm text-muted">{t("no_units_yet")}</p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {properties.map(unit => (
                <li key={unit.id} className="rounded-xl border border-border bg-surface px-4 py-3">
                  {editingId === unit.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="text" value={inlineEditName} onChange={e => setInlineEditName(e.target.value)} className={inlineInputClass} autoFocus
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void handleInlineSave(unit.id); } if (e.key === "Escape") { setEditingId(null); setInlineEditName(""); } }} />
                      <button type="button" onClick={() => void handleInlineSave(unit.id)} disabled={isListActionLoading} className={rowActionClass}>
                        {isListActionLoading ? t("saving") : t("save")}
                      </button>
                      <button type="button" onClick={() => { setEditingId(null); setInlineEditName(""); }} disabled={isListActionLoading} className={rowActionClass}>{t("cancel")}</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 font-semibold text-text">{unit.name}</p>
                      <button type="button" onClick={() => { setEditingId(unit.id); setInlineEditName(unit.name); }} disabled={isListActionLoading} className={rowActionClass}>{t("edit")}</button>
                      <button type="button" onClick={() => setDeleteConfirm({ propertyId: unit.id, name: unit.name })} disabled={isListActionLoading} className={rowDeleteClass}>{t("delete")}</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
