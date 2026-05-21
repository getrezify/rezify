"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

const tabs = [
  { href: "/dashboard", label: "Today", Icon: ClockIcon },
  { href: "/dashboard/tomorrow", label: "Tomorrow", Icon: CalendarIcon },
  { href: "/dashboard/add", label: "Add", Icon: PlusCircleIcon },
  { href: "/dashboard/manage", label: "Manage", Icon: EditIcon },
  { href: "/dashboard/history", label: "History", Icon: HistoryIcon },
  { href: "/dashboard/units", label: "Units", Icon: GridIcon },
] as const;

function formatHeaderDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [headerDate, setHeaderDate] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const avatarLetter = userEmail ? userEmail[0].toUpperCase() : "?";

  useEffect(() => {
    setHeaderDate(formatHeaderDate(new Date()));
  }, []);

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/");
        return;
      }

      setUserEmail(session.user.email ?? "");
      setAuthReady(true);
    }

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setAuthReady(false);
        setUserEmail("");
        setMenuOpen(false);
        router.replace("/");
      } else {
        setUserEmail(session.user.email ?? "");
      }
    });

    return () => subscription.unsubscribe();
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
    await supabase.auth.signOut();
    setIsSigningOut(false);
    router.replace("/");
  }

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="font-display text-2xl text-accent">
            Rezify
          </Link>
          <div className="flex items-center gap-3">
            <time
              className="text-xs text-muted"
              {...(headerDate ? { dateTime: new Date().toISOString() } : {})}
            >
              {headerDate}
            </time>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                aria-label="Account menu"
                aria-expanded={menuOpen}
                aria-haspopup="true"
              >
                {avatarLetter}
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
                >
                  <p className="truncate px-3 py-2 text-xs text-muted">
                    {userEmail}
                  </p>
                  <div className="mx-2 border-t border-border" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-60"
                  >
                    {isSigningOut ? "Signing out…" : "Sign Out"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-2">{children}</main>

      <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-border bg-surface/95 backdrop-blur-sm">
        <ul className="flex items-stretch justify-around px-1 py-2">
          {tabs.map(({ href, label, Icon }) => {
            const isActive =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);

            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className={`flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors ${
                    isActive ? "text-accent" : "text-muted hover:text-text"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${isActive ? "text-accent" : "text-muted"}`}
                  />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

function PlusCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 20h4l10-10-4-4L4 16v4z" strokeLinejoin="round" />
      <path d="M13.5 6.5l4 4" strokeLinecap="round" />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3 6.7" strokeLinecap="round" />
      <path d="M3 12V8M3 12h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
