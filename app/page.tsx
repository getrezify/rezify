export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
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

          <form className="space-y-5" action="#" method="post">
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
                placeholder="you@company.com"
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]"
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
                placeholder="••••••••"
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]"
              />
            </div>

            <button
              type="submit"
              className="mt-2 w-full rounded-lg bg-accent py-3 text-sm font-semibold text-background transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Sign In
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-muted">
            Don&apos;t have an account?{" "}
            <a
              href="#"
              className="font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
