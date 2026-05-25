"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { clearWorkspaceCache, getWorkspaceId } from "@/lib/workspace";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const inputClass = "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";
const labelClass = "mb-2 block text-sm font-medium text-text";
const secondaryButtonClass = "rounded-lg border border-border py-2.5 text-sm font-semibold text-text transition-colors hover:border-muted disabled:opacity-50";
const sectionClass = "rounded-xl border border-border bg-surface px-4 py-4";

export default function SettingsPage() {
  const { t } = useLanguage();
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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Not authenticated");
      setEmail(user.email ?? "");
      const id = await getWorkspaceId();
      setWorkspaceId(id);
      const { data, error } = await supabase.from("workspaces").select("name, whatsapp_number").eq("id", id).single();
      if (error) throw new Error(error.message);
      setWorkspaceName(data.name ?? "");
      setWorkspaceDraft(data.name ?? "");
      setWhatsappNumber(data.whatsapp_number ?? "");
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to load settings", type: "error" });
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  async function handleWorkspaceSave() {
    const name = workspaceDraft.trim();
    if (!name || !workspaceId) return;
    setIsSavingWorkspace(true);
    try {
      const { error } = await supabase.from("workspaces").update({ name }).eq("id", workspaceId);
      if (error) { setToast({ message: error.message, type: "error" }); return; }
      setWorkspaceName(name);
      setIsEditingWorkspace(false);
      setToast({ message: t("workspace_updated"), type: "success" });
    } finally { setIsSavingWorkspace(false); }
  }

  async function handleWhatsappSave(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    setIsSavingWhatsapp(true);
    try {
      const trimmed = whatsappNumber.trim();
      const { error } = await supabase.from("workspaces").update({ whatsapp_number: trimmed || null }).eq("id", workspaceId);
      if (error) { setToast({ message: error.message, type: "error" }); return; }
      setWhatsappNumber(trimmed);
      setToast({ message: t("whatsapp_saved"), type: "success" });
    } finally { setIsSavingWhatsapp(false); }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setToast({ message: "New passwords do not match", type: "error" }); return; }
    if (newPassword.length < 6) { setToast({ message: "Password must be at least 6 characters", type: "error" }); return; }
    setIsChangingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (signInError) { setToast({ message: "Current password is incorrect", type: "error" }); return; }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { setToast({ message: error.message, type: "error" }); return; }
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setToast({ message: t("password_updated"), type: "success" });
    } finally { setIsChangingPassword(false); }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    clearWorkspaceCache();
    await supabase.auth.signOut();
    router.replace("/signin");
  }

  return (
    <div className="animate-fade-up relative pb-6">
      {toast && (
        <div role="status" className={`animate-toast-slide-up fixed bottom-6 z-[100] w-[calc(100%-2rem)] max-w-[448px] rounded-lg border px-4 py-3 text-sm font-medium shadow-xl ${toast.type === "success" ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" : "border-red-500/50 bg-red-500/15 text-red-300"}`}>
          {toast.message}
        </div>
      )}

      <header className="pt-4">
        <h1 className="font-display text-3xl text-text">{t("settings")}</h1>
        <p className="mt-1 text-sm text-muted">{t("settings_desc")}</p>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" aria-hidden />
          <p className="mt-3 text-sm text-muted">{t("loading_settings")}</p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <section className={sectionClass}>
            <h2 className="text-sm font-semibold text-text">{t("account")}</h2>
            <div className="mt-4">
              <label className={labelClass}>{t("email")}</label>
              <input type="email" value={email} readOnly className={`${inputClass} cursor-default opacity-90`} />
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className="text-sm font-semibold text-text">{t("workspace_section")}</h2>
            <div className="mt-4">
              <label className={labelClass}>{t("workspace_name")}</label>
              {isEditingWorkspace ? (
                <div className="space-y-3">
                  <input type="text" value={workspaceDraft} onChange={e => setWorkspaceDraft(e.target.value)} className={inputClass} autoFocus />
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setIsEditingWorkspace(false)} disabled={isSavingWorkspace} className={secondaryButtonClass}>{t("cancel")}</button>
                    <button type="button" onClick={handleWorkspaceSave} disabled={isSavingWorkspace} className="rounded-lg bg-accent py-2.5 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:opacity-60">
                      {isSavingWorkspace ? t("saving") : t("save")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm text-text">{workspaceName || "-"}</p>
                  <button type="button" onClick={() => { setWorkspaceDraft(workspaceName); setIsEditingWorkspace(true); }} className={secondaryButtonClass}>{t("edit")}</button>
                </div>
              )}
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className="text-sm font-semibold text-text">{t("notifications")}</h2>
            <form onSubmit={handleWhatsappSave} className="mt-4 space-y-4">
              <div>
                <label className={labelClass}>{t("whatsapp_number")}</label>
                <input type="tel" value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} placeholder="+201XXXXXXXXX" className={inputClass} />
              </div>
              <button type="submit" disabled={isSavingWhatsapp} className="w-full rounded-lg bg-accent py-3.5 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:opacity-60">
                {isSavingWhatsapp ? t("saving") : t("save")}
              </button>
            </form>
          </section>

          <section className={sectionClass}>
            <h2 className="text-sm font-semibold text-text">{t("change_password")}</h2>
            <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
              <div>
                <label className={labelClass}>{t("current_password")}</label>
                <input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label className={labelClass}>{t("new_password")}</label>
                <input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} required minLength={6} />
              </div>
              <div>
                <label className={labelClass}>{t("confirm_password")}</label>
                <input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} required minLength={6} />
              </div>
              <button type="submit" disabled={isChangingPassword} className="w-full rounded-lg bg-accent py-3.5 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:opacity-60">
                {isChangingPassword ? t("updating") : t("update_password")}
              </button>
            </form>
          </section>

          <button type="button" onClick={handleSignOut} disabled={isSigningOut} className="w-full rounded-lg border border-red-500/50 bg-red-500/15 py-3.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-60">
            {isSigningOut ? t("signing_out") : t("sign_out")}
          </button>
        </div>
      )}
    </div>
  );
}
