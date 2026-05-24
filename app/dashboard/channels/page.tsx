"use client";

import { supabase } from "@/lib/supabase";
import { getWorkspaceId } from "@/lib/workspace";
import { useCallback, useEffect, useState } from "react";

const sectionClass = "rounded-xl border border-border bg-surface px-4 py-4";

const ICAL_EXPORT_HOST = "https://getrezify.com";

const readOnlyInputClass =
  "min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-xs text-text";

const editInputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";

const copyButtonClass =
  "shrink-0 rounded-lg border border-border px-3 py-2.5 text-xs font-semibold text-text transition-colors hover:border-accent hover:text-accent";

const rowActionClass =
  "rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-50";

const labelClass = "mb-1.5 block text-xs font-medium text-muted";

type SyncProperty = {
  id: string;
  name: string;
  ical_token: string | null;
  airbnb_ical_url: string | null;
  booking_ical_url: string | null;
};

type IcalDraft = {
  airbnb: string;
  booking: string;
};

function getIcalExportUrl(token: string) {
  return `${ICAL_EXPORT_HOST}/api/ical/${token}`;
}

export default function ChannelsPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<{
    synced: number;
    skipped: number;
    properties: number;
    errors: string[];
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [properties, setProperties] = useState<SyncProperty[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [propertiesError, setPropertiesError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [icalDrafts, setIcalDrafts] = useState<Record<string, IcalDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [copiedPropertyId, setCopiedPropertyId] = useState<string | null>(null);

  const loadProperties = useCallback(async () => {
    setPropertiesLoading(true);
    setPropertiesError(null);

    try {
      const workspaceId = await getWorkspaceId();

      let { data, error } = await supabase
        .from("properties")
        .select("id, name, ical_token, airbnb_ical_url, booking_ical_url")
        .eq("workspace_id", workspaceId)
        .order("name");

      const missingColumns =
        error?.message?.includes("ical") || error?.code === "42703";

      if (missingColumns) {
        const fallback = await supabase
          .from("properties")
          .select("id, name")
          .eq("workspace_id", workspaceId)
          .order("name");

        data = (fallback.data ?? []).map((row) => ({
          ...row,
          ical_token: null,
          airbnb_ical_url: null,
          booking_ical_url: null,
        }));
        error = fallback.error;
      }

      if (error) {
        throw new Error(error.message || "Failed to load properties");
      }

      const list = (data ?? [])
        .map((row) => ({
          id: row.id as string,
          name: row.name as string,
          ical_token: missingColumns
            ? null
            : ((row as { ical_token?: string | null }).ical_token ?? null),
          airbnb_ical_url: missingColumns
            ? null
            : ((row as { airbnb_ical_url?: string | null }).airbnb_ical_url ??
              null),
          booking_ical_url: missingColumns
            ? null
            : ((row as { booking_ical_url?: string | null }).booking_ical_url ??
              null),
        }))
        .filter((p) => p.name?.trim());

      setProperties(list);
      setIcalDrafts(
        Object.fromEntries(
          list.map((p) => [
            p.id,
            {
              airbnb: p.airbnb_ical_url ?? "",
              booking: p.booking_ical_url ?? "",
            },
          ]),
        ),
      );

      if (missingColumns) {
        setPropertiesError(
          "iCal columns missing. Run supabase/add-ical-urls.sql and supabase/add-ical-export-token.sql in Supabase.",
        );
      }
    } catch (err) {
      setProperties([]);
      setPropertiesError(
        err instanceof Error ? err.message : "Failed to load properties",
      );
    } finally {
      setPropertiesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    if (!result && !syncError) return;
    const timer = setTimeout(() => {
      setResult(null);
      setSyncError(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [result, syncError]);

  async function handleSync() {
    setIsSyncing(true);
    setResult(null);
    setSyncError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setSyncError("You must be signed in to sync");
        return;
      }

      const workspaceId = await getWorkspaceId();

      const res = await fetch("/api/sync-ical", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workspaceId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSyncError(data.error ?? "Sync failed");
        return;
      }

      setResult({
        synced: data.synced ?? 0,
        skipped: data.skipped ?? 0,
        properties: data.properties ?? 0,
        errors: data.errors ?? [],
      });
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  }

  function startEdit(property: SyncProperty) {
    setEditingId(property.id);
    setIcalDrafts((prev) => ({
      ...prev,
      [property.id]: {
        airbnb: property.airbnb_ical_url ?? "",
        booking: property.booking_ical_url ?? "",
      },
    }));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function updateDraft(
    propertyId: string,
    field: keyof IcalDraft,
    value: string,
  ) {
    setIcalDrafts((prev) => ({
      ...prev,
      [propertyId]: {
        airbnb: prev[propertyId]?.airbnb ?? "",
        booking: prev[propertyId]?.booking ?? "",
        [field]: value,
      },
    }));
  }

  async function handleSave(propertyId: string) {
    const draft = icalDrafts[propertyId];
    if (!draft) return;

    setSavingId(propertyId);

    try {
      const workspaceId = await getWorkspaceId();
      const { error } = await supabase
        .from("properties")
        .update({
          airbnb_ical_url: draft.airbnb.trim() || null,
          booking_ical_url: draft.booking.trim() || null,
        })
        .eq("id", propertyId)
        .eq("workspace_id", workspaceId);

      if (error) {
        setSyncError(error.message || "Failed to save URLs");
        return;
      }

      setEditingId(null);
      await loadProperties();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Failed to save URLs");
    } finally {
      setSavingId(null);
    }
  }

  async function handleCopyExport(property: SyncProperty) {
    if (!property.ical_token) return;

    try {
      await navigator.clipboard.writeText(
        getIcalExportUrl(property.ical_token),
      );
      setCopiedPropertyId(property.id);
      setTimeout(() => {
        setCopiedPropertyId((current) =>
          current === property.id ? null : current,
        );
      }, 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="animate-fade-up relative pb-6">
      <header className="pt-4">
        <h1 className="font-display text-3xl text-text">Sync</h1>
        <p className="mt-1 text-sm text-muted">
          Manage your iCal connections for each unit
        </p>
      </header>

      <section className={`mt-8 ${sectionClass}`}>
        <h2 className="text-sm font-semibold text-text">iCal sync</h2>
        <p className="mt-2 text-sm text-muted">
          Import reservations from Airbnb and Booking.com calendar feeds.
        </p>
        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={isSyncing}
          className="mt-4 w-full rounded-lg bg-accent py-3.5 text-sm font-semibold text-background transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSyncing ? "Syncing…" : "Sync Now"}
        </button>
      </section>

      {syncError && (
        <div className="mt-4 rounded-xl border border-red-500/50 bg-red-500/15 px-4 py-3 text-sm text-red-300">
          {syncError}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-300">
          <p className="font-semibold text-emerald-200">Sync complete</p>
          <p className="mt-1">
            {result.synced} reservation{result.synced === 1 ? "" : "s"} added
            {result.skipped > 0
              ? ` · ${result.skipped} skipped (already on calendar)`
              : ""}
          </p>
          <p className="mt-1 text-emerald-300/80">
            {result.properties} unit{result.properties === 1 ? "" : "s"} with
            iCal feeds
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-red-300">
              {result.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <section className="mt-8 space-y-4">
        <div>
          <h2 className="font-display text-xl text-text">Unit connections</h2>
          <p className="mt-1 text-sm text-muted">
            Import and export calendars per property
          </p>
        </div>

        {propertiesError && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {propertiesError}
          </div>
        )}

        {propertiesLoading ? (
          <div className="flex flex-col items-center justify-center py-14">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent"
              aria-hidden
            />
            <p className="mt-3 text-sm text-muted">Loading units…</p>
          </div>
        ) : properties.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center">
            <p className="text-sm text-muted">No units yet</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {properties.map((property) => {
              const isEditing = editingId === property.id;
              const exportUrl = property.ical_token
                ? getIcalExportUrl(property.ical_token)
                : null;

              return (
                <li
                  key={property.id}
                  className={`${sectionClass} space-y-4`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-text">{property.name}</h3>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSave(property.id)}
                          disabled={savingId === property.id}
                          className={rowActionClass}
                        >
                          {savingId === property.id ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={savingId === property.id}
                          className={rowActionClass}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(property)}
                        disabled={savingId !== null}
                        className={rowActionClass}
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <>
                      <div>
                        <label
                          htmlFor={`airbnb-${property.id}`}
                          className={labelClass}
                        >
                          Import from Airbnb
                        </label>
                        <input
                          id={`airbnb-${property.id}`}
                          type="url"
                          value={icalDrafts[property.id]?.airbnb ?? ""}
                          onChange={(e) =>
                            updateDraft(property.id, "airbnb", e.target.value)
                          }
                          placeholder="https://..."
                          className={editInputClass}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`booking-${property.id}`}
                          className={labelClass}
                        >
                          Import from Booking.com
                        </label>
                        <input
                          id={`booking-${property.id}`}
                          type="url"
                          value={icalDrafts[property.id]?.booking ?? ""}
                          onChange={(e) =>
                            updateDraft(property.id, "booking", e.target.value)
                          }
                          placeholder="https://..."
                          className={editInputClass}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className={labelClass}>Import from Airbnb</p>
                        <input
                          type="text"
                          readOnly
                          value={property.airbnb_ical_url ?? ""}
                          placeholder="No Airbnb URL set"
                          className={readOnlyInputClass}
                        />
                      </div>
                      <div>
                        <p className={labelClass}>Import from Booking.com</p>
                        <input
                          type="text"
                          readOnly
                          value={property.booking_ical_url ?? ""}
                          placeholder="No Booking.com URL set"
                          className={readOnlyInputClass}
                        />
                      </div>
                      <div>
                        <p className={labelClass}>
                          Export to Airbnb/Booking.com
                        </p>
                        {exportUrl ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              readOnly
                              value={exportUrl}
                              className={readOnlyInputClass}
                            />
                            <button
                              type="button"
                              onClick={() => void handleCopyExport(property)}
                              className={copyButtonClass}
                            >
                              {copiedPropertyId === property.id
                                ? "Copied!"
                                : "Copy"}
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted">
                            Export URL unavailable. Run
                            supabase/add-ical-export-token.sql, then refresh.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
