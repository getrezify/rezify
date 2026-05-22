"use client";

import Link from "next/link";

const sectionClass = "rounded-xl border border-border bg-surface px-4 py-4";

export default function UpgradePage() {
  return (
    <div className="animate-fade-up pb-6">
      <header className="pt-4">
        <h1 className="font-display text-3xl text-text">Upgrade</h1>
        <p className="mt-1 text-sm text-muted">Choose the plan that fits your portfolio</p>
      </header>

      <div className="mt-6 rounded-xl border border-accent/40 bg-[var(--accent-muted)] px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Current plan
        </p>
        <p className="mt-1 font-display text-xl text-accent">Starter</p>
      </div>

      <div className="mt-6 space-y-4">
        <section className={sectionClass}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-lg text-text">Starter</h2>
            <span className="shrink-0 rounded-full bg-background px-2.5 py-0.5 text-xs font-semibold text-muted">
              Current
            </span>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Free up to 2 units</li>
            <li>$5/unit/month after that</li>
          </ul>
        </section>

        <section className="rounded-xl border border-accent/50 bg-surface px-4 py-4 ring-1 ring-accent/20">
          <h2 className="font-display text-lg text-text">Pro</h2>
          <p className="mt-1 text-sm font-semibold text-accent">$8/unit/month</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Unlimited units with channel sync</li>
            <li>Airbnb + Booking.com sync</li>
            <li>Channels tab & calendar integrations</li>
          </ul>
          <a
            href="mailto:hello@getrezify.com?subject=Rezify%20Pro%20upgrade"
            className="mt-4 block w-full rounded-lg bg-accent py-3.5 text-center text-sm font-semibold text-background transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Upgrade to Pro
          </a>
          <p className="mt-2 text-center text-xs text-muted">
            Coming soon — contact hello@getrezify.com
          </p>
        </section>
      </div>

      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-text"
      >
        <span aria-hidden>←</span>
        Back to dashboard
      </Link>
    </div>
  );
}
