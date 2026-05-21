"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setToast(null);

    if (password !== confirmPassword) {
      setToast("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setToast("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setIsLoading(false);

    if (error) {
      setToast(error.message || "Could not create account");
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
              Create your account
            </p>
          </header>

          <form className="space-y-5" onSubmit={handleSignUp}>
            <div className="space-y-2">
              <label
                htmlFor="signup-email"
                className="block text-sm font-medium text-text"
              >
                Email
              </label>
              <input
                id="signup-email"
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
                htmlFor="signup-password"
                className="block text-sm font-medium text-text"
              >
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-text"
              >
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              {isLoading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link
              href="/"
              className="font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
