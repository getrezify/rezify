"use client";

import { supabase } from "@/lib/supabase";
import { getWorkspaceId } from "@/lib/workspace";
import Link from "next/link";
import { useEffect, useState } from "react";

const sectionClass = "rounded-xl border border-border bg-surface px-4 py-4";

export default function ChannelsPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<{
    synced: number;
    skipped: number;
    properties: number;
    errors: string[];
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

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

  return (
    <div className="animate-fade-up relative pb-6">
      <header className="pt-4">
        <h1 className="font-display text-3xl text-text">Channels</h1>
        <p className="mt-1 text-sm text-muted">
          Sync reservations from Airbnb and Booking.com iCal feeds
        </p>
      </header>

      <section className={`mt-8 ${sectionClass}`}>
        <h2 className="text-sm font-semibold text-text">iCal sync</h2>
        <p className="mt-2 text-sm text-muted">
          Add Airbnb and Booking.com calendar URLs on each unit, then sync to
          import confirmed reservations.
        </p>
        <Link
          href="/dashboard/units/add"
          className="mt-3 inline-block text-sm font-medium text-accent transition-colors hover:text-accent-hover"
        >
          Manage unit iCal URLs →
        </Link>
        <button
          type="button"
          onClick={handleSync}
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
    </div>
  );
}
