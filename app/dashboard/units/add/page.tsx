"use client";

import { supabase } from "@/lib/supabase";
import { getWorkspaceId } from "@/lib/workspace";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Property = {
  id: string;
  name: string;
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";

const labelClass = "mb-2 block text-sm font-medium text-text";

const secondaryButtonClass =
  "rounded-lg border border-border py-2.5 text-sm font-semibold text-text transition-colors hover:border-muted disabled:opacity-50";

const dangerButtonClass =
  "rounded-lg border border-red-500/50 bg-red-500/15 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50";

const rowActionClass =
  "shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50";

const rowDeleteClass =
  "shrink-0 rounded-md border border-red-500/40 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50";

const inlineInputClass =
  "min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text transition-colors focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";

export default function AddUnitPage() {
  const [unitName, setUnitName] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isListActionLoading, setIsListActionLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inlineEditName, setInlineEditName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{
    propertyId: string;
    name: string;
  } | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const loadProperties = useCallback(async () => {
    setListLoading(true);

    try {
      const workspaceId = await getWorkspaceId();
      const { data, error } = await supabase
        .from("properties")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .order("name");

      if (error) {
        setProperties([]);
        setToast({
          message: error.message || "Failed to load units",
          type: "error",
        });
        return;
      }

      const list = (data ?? [])
        .map((row) => ({
          id: row.id as string,
          name: row.name as string,
        }))
        .filter((p) => p.name?.trim());

      setProperties(list);
    } catch (err) {
      setProperties([]);
      setToast({
        message: err instanceof Error ? err.message : "Failed to load units",
        type: "error",
      });
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!deleteConfirm) return;

    function handleEscape(e: KeyboardEvent) {
      if (e.key !== "Escape" || isListActionLoading) return;
      setDeleteConfirm(null);
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [deleteConfirm, isListActionLoading]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setToast(null);

    const name = unitName.trim();
    if (!name) {
      setToast({ message: "Please enter a unit name", type: "error" });
      return;
    }

    setIsSaving(true);

    try {
      const workspaceId = await getWorkspaceId();
      const { error } = await supabase.from("properties").insert({
        workspace_id: workspaceId,
        name,
      });

      if (error) {
        setToast({
          message: error.message || "Failed to add unit",
          type: "error",
        });
        return;
      }

      setToast({ message: "Unit added!", type: "success" });
      setUnitName("");
      await loadProperties();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to add unit",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function startInlineEdit(unit: Property) {
    setEditingId(unit.id);
    setInlineEditName(unit.name);
    setDeleteConfirm(null);
  }

  function cancelInlineEdit() {
    setEditingId(null);
    setInlineEditName("");
  }

  async function handleInlineSave(propertyId: string) {
    const name = inlineEditName.trim();
    if (!name) {
      setToast({ message: "Please enter a unit name", type: "error" });
      return;
    }

    setIsListActionLoading(true);

    try {
      const workspaceId = await getWorkspaceId();
      const { error } = await supabase
        .from("properties")
        .update({ name })
        .eq("id", propertyId)
        .eq("workspace_id", workspaceId);

      if (error) {
        setToast({
          message: error.message || "Failed to rename unit",
          type: "error",
        });
        return;
      }

      cancelInlineEdit();
      await loadProperties();
      setToast({ message: "Unit renamed", type: "success" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to rename unit",
        type: "error",
      });
    } finally {
      setIsListActionLoading(false);
    }
  }

  async function handleDeleteUnit() {
    if (!deleteConfirm) return;

    setIsListActionLoading(true);

    try {
      const workspaceId = await getWorkspaceId();
      const { error } = await supabase
        .from("properties")
        .delete()
        .eq("id", deleteConfirm.propertyId)
        .eq("workspace_id", workspaceId);

      if (error) {
        setToast({
          message: error.message || "Failed to delete unit",
          type: "error",
        });
        return;
      }

      if (editingId === deleteConfirm.propertyId) cancelInlineEdit();
      setDeleteConfirm(null);
      await loadProperties();
      setToast({ message: "Unit deleted", type: "success" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to delete unit",
        type: "error",
      });
    } finally {
      setIsListActionLoading(false);
    }
  }

  return (
    <div className="animate-fade-up relative pb-6">
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-unit-title"
        >
          <div className="w-full max-w-[400px] rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <h2
              id="delete-unit-title"
              className="font-display text-xl text-text"
            >
              Delete Unit?
            </h2>
            <p className="mt-3 text-sm text-muted">
              This will permanently remove{" "}
              <span className="font-semibold text-text">
                {deleteConfirm.name}
              </span>
              . This action cannot be undone.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={isListActionLoading}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUnit}
                disabled={isListActionLoading}
                className={dangerButtonClass}
              >
                {isListActionLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={`animate-toast-slide-up fixed bottom-6 z-[100] w-[calc(100%-2rem)] max-w-[448px] rounded-lg border px-4 py-3 text-sm font-medium shadow-xl ${
            toast.type === "success"
              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
              : "border-red-500/50 bg-red-500/15 text-red-300"
          }`}
        >
          {toast.message}
        </div>
      )}

      <Link
        href="/dashboard/units"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-text"
      >
        <span aria-hidden>←</span>
        Back
      </Link>

      <header className="pt-4">
        <h1 className="font-display text-3xl text-text">Add Unit</h1>
        <p className="mt-1 text-sm text-muted">Create a new property</p>
      </header>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="animate-fade-up [animation-delay:50ms]">
          <label htmlFor="unit-name" className={labelClass}>
            Unit Name
          </label>
          <input
            id="unit-name"
            type="text"
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
            placeholder="e.g. Studio A"
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="animate-fade-up w-full rounded-lg bg-accent py-3.5 text-sm font-semibold text-background transition-colors duration-200 hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 [animation-delay:100ms]"
        >
          {isSaving ? "Saving…" : "Add Unit"}
        </button>
      </form>

      <section className="mt-10">
        <h2 className="font-display text-xl text-text">Your Units</h2>
        <p className="mt-1 text-sm text-muted">Rename or remove existing properties</p>

        {listLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent"
              aria-hidden
            />
            <p className="mt-3 text-sm text-muted">Loading units…</p>
          </div>
        ) : properties.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center">
            <p className="text-sm text-muted">No units yet</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {properties.map((unit) => (
              <li
                key={unit.id}
                className="rounded-xl border border-border bg-surface px-4 py-3"
              >
                {editingId === unit.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={inlineEditName}
                      onChange={(e) => setInlineEditName(e.target.value)}
                      className={inlineInputClass}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleInlineSave(unit.id);
                        }
                        if (e.key === "Escape") cancelInlineEdit();
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleInlineSave(unit.id)}
                      disabled={isListActionLoading}
                      className={rowActionClass}
                    >
                      {isListActionLoading ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelInlineEdit}
                      disabled={isListActionLoading}
                      className={rowActionClass}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 font-semibold text-text">
                      {unit.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => startInlineEdit(unit)}
                      disabled={isListActionLoading}
                      className={rowActionClass}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirm({
                          propertyId: unit.id,
                          name: unit.name,
                        });
                        cancelInlineEdit();
                      }}
                      disabled={isListActionLoading}
                      className={rowDeleteClass}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
