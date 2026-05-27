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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [view, setView] = useState<"signin" | "forgot">("signin");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    if (error) {
      setToast({ message: error.message, type: "error" });
      setIsGoogleLoading(false);
    }
  }

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
      setToast({ message: "Invalid email or password", type: "error" });
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleForgotPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setToast(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/settings`,
    });

    setIsLoading(false);

    if (error) {
      setToast({ message: error.message, type: "error" });
      return;
    }

    setResetSent(true);
  }

  if (view === "forgot") {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
        {toast && (
          <div role="alert" className={`animate-toast-slide-up fixed bottom-6 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 rounded-lg border px-4 py-3 text-sm font-medium shadow-xl ${toast.type === "success" ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" : "border-red-500/50 bg-red-500/15 text-red-300"}`}>
            {toast.message}
          </div>
        )}
        <div className="w-full max-w-[420px]">
          <div className="rounded-2xl border border-border bg-surface p-8 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:p-10">
            <header className="mb-8 text-center">
              <h1 className="font-display text-4xl tracking-tight text-accent sm:text-[2.75rem]">Rezify</h1>
              <p className="mt-2 text-sm text-muted">Reset your password</p>
            </header>

            {resetSent ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-3xl">✉️</div>
                <h2 className="font-display text-xl text-text">Check your email</h2>
                <p className="mt-3 text-sm text-muted">We sent a password reset link to <span className="font-semibold text-text">{email}</span>.</p>
                <button type="button" onClick={() => { setView("signin"); setResetSent(false); }} className="mt-6 text-sm font-medium text-accent hover:underline">
                  Back to sign in
                </button>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleForgotPassword}>
                <div className="space-y-2">
                  <label htmlFor="reset-email" className="block text-sm font-medium text-text">Email</label>
                  <input id="reset-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required className={inputClass} />
                </div>
                <button type="submit" disabled={isLoading} className="mt-2 w-full rounded-lg bg-accent py-3 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:opacity-60">
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </button>
                <button type="button" onClick={() => setView("signin")} className="w-full text-center text-sm text-muted hover:text-text">
                  Back to sign in
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
      {toast && (
        <div role="alert" className={`animate-toast-slide-up fixed bottom-6 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 rounded-lg border px-4 py-3 text-sm font-medium shadow-xl ${toast.type === "success" ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" : "border-red-500/50 bg-red-500/15 text-red-300"}`}>
          {toast.message}
        </div>
      )}

      <div className="w-full max-w-[420px]">
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:p-10">
          <header className="mb-8 text-center">
            <h1 className="font-display text-4xl tracking-tight text-accent sm:text-[2.75rem]">Rezify</h1>
            <p className="mt-2 text-sm text-muted">Property management, simplified</p>
          </header>

          {/* Google Sign In */}
          <button type="button" onClick={handleGoogleSignIn} disabled={isGoogleLoading} className="mb-6 flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-surface py-3 text-sm font-semibold text-text transition-colors hover:border-accent/50 hover:bg-background disabled:opacity-60">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {isGoogleLoading ? "Redirecting..." : "Continue with Google"}
          </button>

          <div className="mb-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted">or sign in with email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-5" onSubmit={handleSignIn}>
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-text">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required className={inputClass} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-text">Password</label>
                <button type="button" onClick={() => setView("forgot")} className="text-xs text-accent hover:underline">
                  Forgot password?
                </button>
              </div>
              <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required className={inputClass} />
            </div>

            <button type="submit" disabled={isLoading} className="mt-2 w-full rounded-lg bg-accent py-3 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:opacity-60">
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-muted">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-accent transition-colors hover:text-accent-hover">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
