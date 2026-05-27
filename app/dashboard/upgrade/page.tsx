"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { getCheckoutUrl, getUserPlan, type UserPlan } from "@/lib/plan";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";

const plans = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "Free",
    priceDetail: "up to 2 units",
    description: "For hosts just getting started.",
    features: ["Up to 2 units", "Reservations & calendar", "WhatsApp notifications", "Arabic + English interface", "EGP + USD dashboard"],
    cta: null,
    highlighted: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$5",
    priceDetail: "/ unit / month",
    description: "Full PMS for growing operators.",
    features: ["Unlimited units", "Everything in Starter", "Financials & occupancy reports", "7-day free trial"],
    cta: "Upgrade to Pro",
    highlighted: false,
  },
  {
    id: "business" as const,
    name: "Business",
    price: "$12",
    priceDetail: "/ unit / month",
    description: "Full PMS + channel sync.",
    features: ["Everything in Pro", "Airbnb + Booking.com sync", "Conflict detection alerts", "Auto calendar updates", "7-day free trial"],
    cta: "Upgrade to Business",
    highlighted: true,
  },
];

export default function UpgradePage() {
  const { t } = useLanguage();
  const [currentPlan, setCurrentPlan] = useState<UserPlan>("starter");
  const [userEmail, setUserEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [plan, { data: { session } }] = await Promise.all([
          getUserPlan(),
          supabase.auth.getSession(),
        ]);
        setCurrentPlan(plan);
        setUserEmail(session?.user?.email ?? "");
      } catch {
        setCurrentPlan("starter");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="animate-fade-up pb-6">
      <header className="pt-4">
        <h1 className="font-display text-3xl text-text">Upgrade</h1>
        <p className="mt-1 text-sm text-muted">Choose the plan that fits your portfolio</p>
      </header>

      {/* Current plan badge */}
      <div className="mt-6 rounded-xl border border-accent/40 bg-[var(--accent-muted)] px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Current plan</p>
        <p className="mt-1 font-display text-xl text-accent capitalize">{currentPlan}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const isDowngrade = plans.findIndex(p => p.id === plan.id) < plans.findIndex(p => p.id === currentPlan);

            return (
              <section
                key={plan.id}
                className={`rounded-xl border px-4 py-4 ${
                  plan.highlighted
                    ? "border-accent/50 bg-surface ring-1 ring-accent/20"
                    : "border-border bg-surface"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg text-text">{plan.name}</h2>
                    <p className="mt-0.5 text-sm text-muted">{plan.description}</p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="font-display text-xl text-accent">{plan.price}</p>
                    <p className="text-xs text-muted">{plan.priceDetail}</p>
                  </div>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted">
                      <span className="text-accent font-bold">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="mt-4 w-full rounded-lg border border-border py-3 text-center text-sm font-semibold text-muted">
                    Current Plan
                  </div>
                ) : isDowngrade ? (
                  <div className="mt-4 w-full rounded-lg border border-border py-3 text-center text-sm font-medium text-muted/60">
                    Downgrade
                  </div>
                ) : plan.cta ? (
                  <a
                    href={getCheckoutUrl(plan.id as "pro" | "business", userEmail)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-4 block w-full rounded-lg py-3.5 text-center text-sm font-semibold transition-colors ${
                      plan.highlighted
                        ? "bg-accent text-background hover:bg-accent-hover"
                        : "border border-accent text-accent hover:bg-[var(--accent-muted)]"
                    }`}
                  >
                    {plan.cta}
                  </a>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-center text-xs text-muted">
        Questions? Email <a href="mailto:hello@getrezify.com" className="text-accent hover:underline">hello@getrezify.com</a>
      </p>

      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-text"
      >
        <span aria-hidden>←</span>
        Back to dashboard
      </Link>
    </div>
  );
}
