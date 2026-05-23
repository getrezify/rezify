"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setToast(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsLoading(false);

    if (error) {
      setToast("Invalid email or password");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
      {toast && (
        <div
          role="alert"
          className="animate-toast-slide-up fixed bottom-6 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 rounded-lg border border-red-500/50 bg-red-500/15 px-4 py-3 text-sm font-medium text-red-300 shadow-xl"
        >
          {toast}
        </div>
      )}

      <div className="w-full max-w-[420px]">
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:p-10">
          <header className="mb-8 text-center">
            <h1 className="font-display text-4xl tracking-tight text-accent sm:text-[2.75rem]">
              Rezify
            </h1>
            <p className="mt-2 text-sm text-muted sm:text-base">
              Property management, simplified
            </p>
          </header>

          <form className="space-y-5" onSubmit={handleSignIn}>
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-text"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-text"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full rounded-lg bg-accent py-3 text-sm font-semibold text-background transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-muted">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
