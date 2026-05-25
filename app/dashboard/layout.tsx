"use client";

import { clearPlanCache, getUserPlan, type UserPlan } from "@/lib/plan";
import { supabase } from "@/lib/supabase";
import { clearWorkspaceCache } from "@/lib/workspace";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

function isTabActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/units") return pathname === "/dashboard/units";
  if (href === "/dashboard/properties") return pathname === "/dashboard/properties";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatHeaderDate(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

async function getPlanSafe(): Promise<UserPlan> {
  try {
    const result = await Promise.race([
      getUserPlan(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
    return result;
  } catch {
    return "starter";
  }
}

function DashboardLayoutInner({ children }: { children: ReactNode }) {
  const { t, dir, lang, toggle } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const [headerDate, setHeaderDate] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const tabs = [
    { href: "/dashboard", label: t("tab_today"), Icon: ClockIcon },
    { href: "/dashboard/tomorrow", label: t("tab_tomorrow"), Icon: CalendarIcon },
    { href: "/dashboard/add", label: t("tab_add"), Icon: PlusCircleIcon },
    { href: "/dashboard/manage", label: t("tab_manage"), Icon: EditIcon },
    { href: "/dashboard/history", label: t("tab_history"), Icon: HistoryIcon },
    { href: "/dashboard/units", label: t("tab_financials"), Icon: GridIcon },
    { href: "/dashboard/properties", label: t("tab_properties"), Icon: AddUnitIcon },
    { href: "/dashboard/calendar", label: t("tab_calendar"), Icon: CalendarGridIcon },
    { href: "/dashboard/channels", label: t("tab_sync"), Icon: ChannelsIcon },
    { href: "/dashboard/settings", label: t("tab_settings"), Icon: SettingsIcon },
  ];

  const avatarLetter = userEmail ? userEmail[0].toUpperCase() : "?";

  useEffect(() => { setHeaderDate(formatHeaderDate(new Date())); }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session) { router.replace("/signin"); return; }
      setUserEmail(session.user.email ?? "");
      setUserPlan(await getPlanSafe());
      if (mounted) setAuthReady(true);
    }

    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      clearWorkspaceCache();
      clearPlanCache();
      if (!session) {
        setAuthReady(false);
        setUserEmail("");
        setUserPlan(null);
        setMenuOpen(false);
        router.replace("/signin");
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [router]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  async function handleSignOut() {
    setIsSigningOut(true);
    setMenuOpen(false);
    clearWorkspaceCache();
    clearPlanCache();
    await supabase.auth.signOut();
    setIsSigningOut(false);
    router.replace("/signin");
  }

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" aria-hidden />
      </div>
    );
  }

  return (
    <div dir={dir} className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="font-display text-2xl text-accent">Rezify</Link>
          <div className="flex items-center gap-2">
            <time className="text-xs text-muted" {...(headerDate ? { dateTime: new Date().toISOString() } : {})}>{headerDate}</time>

            <button
              type="button"
              onClick={toggle}
              className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-accent"
            >
              {lang === "en" ? "AR" : "EN"}
            </button>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-background transition-opacity hover:opacity-90"
                aria-label="Account menu"
              >
                {avatarLetter}
              </button>
              {menuOpen && (
                <div role="menu" className="absolute end-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                  <p className="truncate px-3 py-2 text-xs text-muted">{userEmail}</p>
                  <div className="mx-2 border-t border-border" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="w-full px-3 py-2 text-start text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-60"
                  >
                    {isSigningOut ? t("signing_out") : t("sign_out")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-2">{children}</main>

      <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-border bg-surface/95 backdrop-blur-sm">
        <div className="overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
          <ul className="flex items-stretch justify-around px-0.5 py-2">
            {tabs.map(({ href, label, Icon }) => {
              const isActive = isTabActive(pathname, href);
              return (
                <li key={href} className="flex-1">
                  <Link href={href} className={`flex min-w-[3.25rem] flex-col items-center gap-0.5 rounded-lg px-0.5 py-1.5 text-[9px] font-medium transition-colors sm:text-[10px] ${isActive ? "text-accent" : "text-muted hover:text-text"}`}>
                    <Icon className={`h-5 w-5 ${isActive ? "text-accent" : "text-muted"}`} />
                    <span>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </LanguageProvider>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function CalendarIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" /></svg>;
}
function PlusCircleIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" strokeLinecap="round" /></svg>;
}
function EditIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden><path d="M4 20h4l10-10-4-4L4 16v4z" strokeLinejoin="round" /><path d="M13.5 6.5l4 4" strokeLinecap="round" /></svg>;
}
function HistoryIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden><path d="M3 12a9 9 0 1 0 3 6.7" strokeLinecap="round" /><path d="M3 12V8M3 12h4" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function GridIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
}
function AddUnitIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden><rect x="5" y="5" width="14" height="14" rx="2" /><path d="M12 9v6M9 12h6" strokeLinecap="round" /></svg>;
}
function CalendarGridIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="3" y="5" width="2.5" height="14" rx="0.5" opacity="0.35" /><rect x="6.5" y="5" width="2.5" height="14" rx="0.5" opacity="0.5" /><rect x="10" y="5" width="2.5" height="14" rx="0.5" opacity="0.65" /><rect x="13.5" y="5" width="2.5" height="14" rx="0.5" opacity="0.8" /><rect x="17" y="5" width="2.5" height="14" rx="0.5" /><rect x="20.5" y="5" width="0.5" height="14" rx="0.25" opacity="0.25" /></svg>;
}
function ChannelsIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden><path d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66" strokeLinecap="round" /><path d="M16 4h4v4M8 20H4v-4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function SettingsIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" strokeLinecap="round" /></svg>;
}
