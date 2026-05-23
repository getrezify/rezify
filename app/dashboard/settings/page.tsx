"use client";

import { supabase } from "@/lib/supabase";
import { clearWorkspaceCache, getWorkspaceId } from "@/lib/workspace";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";

const labelClass = "mb-2 block text-sm font-medium text-text";

const secondaryButtonClass =
  "rounded-lg border border-border py-2.5 text-sm font-semibold text-text transition-colors hover:border-muted disabled:opacity-50";

const sectionClass = "rounded-xl border border-border bg-surface px-4 py-4";

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingWorkspace, setIsEditingWorkspace] = useState(false);
  const [workspaceDraft, setWorkspaceDraft] = useState("");
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [isSavingWhatsapp, setIsSavingWhatsapp] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Not authenticated");
      }

      setEmail(user.email ?? "");

      const id = await getWorkspaceId();
      setWorkspaceId(id);

      const { data, error } = await supabase
        .from("workspaces")
        .select("name, whatsapp_number")
        .eq("id", id)
        .single();

      if (error) {
        throw new Error(error.message || "Failed to load workspace");
      }

      setWorkspaceName(data.name ?? "");
      setWorkspaceDraft(data.name ?? "");
      setWhatsappNumber(data.whatsapp_number ?? "");
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to load settings",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  function startWorkspaceEdit() {
    setWorkspaceDraft(workspaceName);
    setIsEditingWorkspace(true);
  }

  function cancelWorkspaceEdit() {
    setWorkspaceDraft(workspaceName);
    setIsEditingWorkspace(false);
  }

  async function handleWorkspaceSave() {
    const name = workspaceDraft.trim();
    if (!name) {
      setToast({ message: "Please enter a workspace name", type: "error" });
      return;
    }

    if (!workspaceId) return;

    setIsSavingWorkspace(true);

    try {
      const { error } = await supabase
        .from("workspaces")
        .update({ name })
        .eq("id", workspaceId);

      if (error) {
        setToast({
          message: error.message || "Failed to update workspace",
          type: "error",
        });
        return;
      }

      setWorkspaceName(name);
      setIsEditingWorkspace(false);
      setToast({ message: "Workspace updated", type: "success" });
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to update workspace",
        type: "error",
      });
    } finally {
      setIsSavingWorkspace(false);
    }
  }

  async function handleWhatsappSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!workspaceId) return;

    setIsSavingWhatsapp(true);

    try {
      const trimmed = whatsappNumber.trim();
      const { error } = await supabase
        .from("workspaces")
        .update({ whatsapp_number: trimmed || null })
        .eq("id", workspaceId);

      if (error) {
        setToast({
          message: error.message || "Failed to save WhatsApp number",
          type: "error",
        });
        return;
      }

      setWhatsappNumber(trimmed);
      setToast({ message: "WhatsApp number saved", type: "success" });
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to save WhatsApp number",
        type: "error",
      });
    } finally {
      setIsSavingWhatsapp(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email) {
      setToast({ message: "Email not available", type: "error" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setToast({ message: "New passwords do not match", type: "error" });
      return;
    }

    if (newPassword.length < 6) {
      setToast({
        message: "Password must be at least 6 characters",
        type: "error",
      });
      return;
    }

    setIsChangingPassword(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError) {
        setToast({ message: "Current password is incorrect", type: "error" });
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setToast({
          message: error.message || "Failed to change password",
          type: "error",
        });
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setToast({ message: "Password updated", type: "success" });
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to change password",
        type: "error",
      });
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    clearWorkspaceCache();
    await supabase.auth.signOut();
    setIsSigningOut(false);
    router.replace("/signin");
  }

  return (
    <div className="animate-fade-up relative pb-6">
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

      <header className="pt-4">
        <h1 className="font-display text-3xl text-text">Settings</h1>
        <p className="mt-1 text-sm text-muted">Account and workspace</p>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent"
            aria-hidden
          />
          <p className="mt-3 text-sm text-muted">Loading settings…</p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <section className={sectionClass}>
            <h2 className="text-sm font-semibold text-text">Account</h2>
            <div className="mt-4">
              <label htmlFor="settings-email" className={labelClass}>
                Email
              </label>
              <input
                id="settings-email"
                type="email"
                value={email}
                readOnly
                className={`${inputClass} cursor-default opacity-90`}
              />
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className="text-sm font-semibold text-text">Workspace</h2>
            <div className="mt-4">
              <label htmlFor="workspace-name" className={labelClass}>
                Workspace Name
              </label>
              {isEditingWorkspace ? (
                <div className="space-y-3">
                  <input
                    id="workspace-name"
                    type="text"
                    value={workspaceDraft}
                    onChange={(e) => setWorkspaceDraft(e.target.value)}
                    className={inputClass}
                    autoFocus
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={cancelWorkspaceEdit}
                      disabled={isSavingWorkspace}
                      className={secondaryButtonClass}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleWorkspaceSave}
                      disabled={isSavingWorkspace}
                      className="rounded-lg bg-accent py-2.5 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:opacity-60"
                    >
                      {isSavingWorkspace ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm text-text">
                    {workspaceName || "—"}
                  </p>
                  <button
                    type="button"
                    onClick={startWorkspaceEdit}
                    className={secondaryButtonClass}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className="text-sm font-semibold text-text">Notifications</h2>
            <form onSubmit={handleWhatsappSave} className="mt-4 space-y-4">
              <div>
                <label htmlFor="whatsapp-number" className={labelClass}>
                  WhatsApp Number for Notifications
                </label>
                <input
                  id="whatsapp-number"
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+201XXXXXXXXX"
                  className={inputClass}
                  autoComplete="tel"
                />
              </div>
              <button
                type="submit"
                disabled={isSavingWhatsapp}
                className="w-full rounded-lg bg-accent py-3.5 text-sm font-semibold text-background transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingWhatsapp ? "Saving…" : "Save"}
              </button>
            </form>
          </section>

          <section className={sectionClass}>
            <h2 className="text-sm font-semibold text-text">Change Password</h2>
            <form
              onSubmit={handlePasswordChange}
              className="mt-4 space-y-4"
            >
              <div>
                <label htmlFor="current-password" className={labelClass}>
                  Current Password
                </label>
                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label htmlFor="new-password" className={labelClass}>
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className={labelClass}>
                  Confirm New Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  required
                  minLength={6}
                />
              </div>
              <button
                type="submit"
                disabled={isChangingPassword}
                className="w-full rounded-lg bg-accent py-3.5 text-sm font-semibold text-background transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isChangingPassword ? "Updating…" : "Update Password"}
              </button>
            </form>
          </section>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full rounded-lg border border-red-500/50 bg-red-500/15 py-3.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-60"
          >
            {isSigningOut ? "Signing out…" : "Sign Out"}
          </button>
        </div>
      )}
    </div>
  );
}
