"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { getUserPlan, PADDLE_BUSINESS_PRICE_ID, PADDLE_PRO_PRICE_ID, type UserPlan } from "@/lib/plan";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    Paddle?: {
      Initialize: (opts: { token: string }) => void;
      Checkout: {
        open: (opts: {
          items: { priceId: string; quantity: number }[];
          customer?: { email: string };
          customData?: Record<string, string>;
          settings?: { successUrl: string };
        }) => void;
      };
    };
  }
}

const plans = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "Free",
    priceDetail: "up to 2 units",
    description: "For hosts just getting started.",
    features: ["Up to 2 units", "Reservations & calendar", "WhatsApp notifications", "Arabic + English interface", "EGP + USD dashboard"],
    priceId: null,
    highlighted: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$5",
    priceDetail: "/ unit / month",
    description: "Full PMS for growing operators.",
    features: ["Unlimited units", "Everything in Starter", "Financials & occupancy reports", "7-day free trial"],
    priceId: PADDLE_PRO_PRICE_ID,
    highlighted: false,
  },
  {
    id: "business" as const,
    name: "Business",
    price: "$12",
    priceDetail: "/ unit / month",
    description: "Full PMS + channel sync.",
    features: ["Everything in Pro", "Airbnb + Booking.com sync", "Conflict detection alerts", "Auto calendar updates", "7-day free trial"],
    priceId: PADDLE_BUSINESS_PRICE_ID,
    highlighted: true,
  },
];

export default function UpgradePage() {
  const { t } = useLanguage();
  const [currentPlan, setCurrentPlan] = useState<UserPlan>("starter");
  const [userEmail, setUserEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [units, setUnits] = useState(1);
  const paddleReady = useRef(false);

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

    // Load Paddle.js
    if (!paddleReady.current) {
      const script = document.createElement("script");
      script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
      script.onload = () => {
        if (window.Paddle) {
          window.Paddle.Initialize({
            token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "",
          });
          paddleReady.current = true;
        }
      };
      document.head.appendChild(script);
    }
  }, []);

  function handleUpgrade(priceId: string) {
    if (!window.Paddle) {
      alert("Payment system loading, please try again in a moment.");
      return;
    }
    window.Paddle.Checkout.open({
      items: [{ priceId, quantity: units }],
      customer: userEmail ? { email: userEmail } : undefined,
      customData: userEmail ? { email: userEmail } : undefined,
      settings: { successUrl: "https://www.getrezify.com/dashboard?upgraded=true" },
    });
  }

  return (
    <div className="animate-fade-up pb-6">
      <header className="pt-4">
        <h1 className="font-display text-3xl text-text">Upgrade</h1>
        <p className="mt-1 text-sm text-muted">Choose the plan that fits your portfolio</p>
      </header>

      <div className="mt-6 rounded-xl border border-accent/40 bg-[var(--accent-muted)] px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Current plan</p>
        <p className="mt-1 font-display text-xl text-accent capitalize">{currentPlan}</p>
      </div>

      {/* Unit selector */}
      <div className="mt-4 rounded-xl border border-border bg-surface px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted mb-2">How many units?</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setUnits(u => Math.max(1, u - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text hover:border-accent hover:text-accent"
          >
            −
          </button>
          <span className="font-display text-2xl text-text w-8 text-center">{units}</span>
          <button
            type="button"
            onClick={() => setUnits(u => u + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text hover:border-accent hover:text-accent"
          >
            +
          </button>
          <span className="text-sm text-muted">units</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const isDowngrade = plans.findIndex(p => p.id === plan.id) < plans.findIndex(p => p.id === currentPlan);
            const monthlyTotal = plan.priceId ? `$${parseInt(plan.price.replace("$", "")) * units}/mo` : null;

            return (
              <section
                key={plan.id}
                className={`rounded-xl border px-4 py-4 ${plan.highlighted ? "border-accent/50 bg-surface ring-1 ring-accent/20" : "border-border bg-surface"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg text-text">{plan.name}</h2>
                    <p className="mt-0.5 text-sm text-muted">{plan.description}</p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="font-display text-xl text-accent">{plan.price}</p>
                    <p className="text-xs text-muted">{plan.priceDetail}</p>
                    {monthlyTotal && <p className="text-xs font-semibold text-accent mt-0.5">= {monthlyTotal}</p>}
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
                ) : plan.priceId ? (
                  <button
                    type="button"
                    onClick={() => handleUpgrade(plan.priceId!)}
                    className={`mt-4 w-full rounded-lg py-3.5 text-sm font-semibold transition-colors ${
                      plan.highlighted
                        ? "bg-accent text-background hover:bg-accent-hover"
                        : "border border-accent text-accent hover:bg-[var(--accent-muted)]"
                    }`}
                  >
                    Upgrade to {plan.name} — {monthlyTotal}
                  </button>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-center text-xs text-muted">
        Questions? Email <a href="mailto:hello@getrezify.com" className="text-accent hover:underline">hello@getrezify.com</a>
      </p>

      <Link href="/dashboard" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-text">
        <span aria-hidden>←</span> Back to dashboard
      </Link>
    </div>
  );
}
