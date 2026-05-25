"use client";

import { supabase } from "@/lib/supabase";
import {
  clearWorkspaceCache,
  getAuthenticatedUser,
  getWorkspaceId,
} from "@/lib/workspace";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-[var(--accent-muted)]";

const labelClass = "mb-2 block text-sm font-medium text-text";

const primaryButtonClass =
  "w-full rounded-lg bg-accent py-3.5 text-sm font-semibold text-background transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

const skipLinkClass =
  "block w-full py-2 text-center text-sm text-muted transition-colors hover:text-text";

const backButtonClass =
  "mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-text";

const TOTAL_STEPS = 3;

function ProgressIndicator({ step }: { step: number }) {
  return (
    <div className="mb-8">
      <p className="text-center text-xs font-medium uppercase tracking-wide text-muted">
        Step {step} of {TOTAL_STEPS}
      </p>
      <div className="mt-3 flex gap-2">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < step ? "bg-accent" : "bg-border"
            }`}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [authReady, setAuthReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [workspaceName, setWorkspaceName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [unitAdded, setUnitAdded] = useState(false);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [createdUnitName, setCreatedUnitName] = useState("");

  const [airbnbUrl, setAirbnbUrl] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/signin");
        return;
      }

      try {
        const { data } = await supabase
          .from("workspaces")
          .select("name")
          .eq("owner_id", session.user.id)
          .maybeSingle();

        if (data?.name && data.name !== "My Portfolio") {
          setWorkspaceName(data.name);
        }
      } catch {
        /* use empty default */
      }

      setAuthReady(true);
    }

    void checkAuth();
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    const name = workspaceName.trim();
    if (!name) {
      setToast("Please enter a workspace name");
      return;
    }

    setIsSaving(true);
    setToast(null);

    try {
      const user = await getAuthenticatedUser();
      const { error } = await supabase
        .from("workspaces")
        .upsert(
          { owner_id: user.id, name, slug: user.id, plan: "starter" },
          { onConflict: "owner_id" }
        );

      if (error) {
        setToast(error.message || "Failed to save workspace");
        return;
      }

      clearWorkspaceCache();
      setStep(2);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to save workspace");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddUnit(e: React.FormEvent) {
    e.preventDefault();
    const name = unitName.trim();
    if (!name) {
      setToast("Please enter a unit name");
      return;
    }

    setIsSaving(true);
    setToast(null);

    try {
      const workspaceId = await getWorkspaceId();
      const { data, error } = await supabase
        .from("properties")
        .insert({ workspace_id: workspaceId, name })
        .select("id")
        .single();

      if (error) {
        setToast(error.message || "Failed to add unit");
        return;
      }

      setPropertyId(data.id as string);
      setCreatedUnitName(name);
      setUnitAdded(true);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to add unit");
    } finally {
      setIsSaving(false);
    }
  }

  async function finishOnboarding() {
    setIsSaving(true);
    setToast(null);

    try {
      const workspaceId = await getWorkspaceId();
      const propertyUpdate: Record<string, string | null> = {};

      if (airbnbUrl.trim()) propertyUpdate.airbnb_ical_url = airbnbUrl.trim();
      if (bookingUrl.trim()) propertyUpdate.booking_ical_url = bookingUrl.trim();

      if (propertyId && Object.keys(propertyUpdate).length > 0) {
        const { error: propError } = await supabase
          .from("properties")
          .update(propertyUpdate)
          .eq("id", propertyId)
          .eq("workspace_id", workspaceId);

        if (propError) {
          const missingColumns =
            propError.message?.includes("airbnb_ical_url") ||
            propError.message?.includes("booking_ical_url");
          if (!missingColumns) {
            setToast(propError.message || "Failed to save iCal URLs");
            return;
          }
        }
      }

      if (whatsappNumber.trim()) {
        const { error: wsError } = await supabase
          .from("workspaces")
          .update({ whatsapp_number: whatsappNumber.trim() })
          .eq("id", workspaceId);

        if (wsError) {
          setToast(wsError.message || "Failed to save WhatsApp number");
          return;
        }
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to finish setup");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFinish(e: React.FormEvent) {
    e.preventDefault();
    await finishOnboarding();
  }

  function goToDashboard() {
    router.push("/dashboard");
    router.refresh();
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
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
      {toast && (
        <div
          role="alert"
          className="animate-toast-slide-up fixed bottom-6 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 rounded-lg border border-red-500/50 bg-red-500/15 px-4 py-3 text-sm font-medium text-red-300 shadow-xl"
        >
          {toast}
        </div>
      )}

      <div className="w-full max-w-[440px]">
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:p-10">
          <ProgressIndicator step={step} />

          {step === 1 && (
            <>
              <header className="mb-6 text-center">
                <h1 className="font-display text-3xl text-text">
                  Welcome to Rezify 👋
                </h1>
                <p className="mt-2 text-sm text-muted">
                  Let&apos;s set up your workspace in 3 quick steps
                </p>
              </header>

              <form onSubmit={handleStep1} className="space-y-5">
                <div>
                  <label htmlFor="workspace-name" className={labelClass}>
                    Workspace Name
                  </label>
                  <input
                    id="workspace-name"
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="Ahmed's Properties"
                    required
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className={primaryButtonClass}
                >
                  {isSaving ? "Saving…" : "Continue"}
                </button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className={backButtonClass}
              >
                <span aria-hidden>←</span> Back
              </button>

              <header className="mb-6 text-center">
                <h1 className="font-display text-3xl text-text">
                  Add your first unit
                </h1>
                <p className="mt-2 text-sm text-muted">
                  A unit is any property you manage — apartment, villa, studio
                </p>
              </header>

              {!unitAdded ? (
                <form onSubmit={handleAddUnit} className="space-y-5">
                  <div>
                    <label htmlFor="unit-name" className={labelClass}>
                      Unit Name
                    </label>
                    <input
                      id="unit-name"
                      type="text"
                      value={unitName}
                      onChange={(e) => setUnitName(e.target.value)}
                      placeholder="Studio A - Hurghada"
                      required
                      className={inputClass}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className={primaryButtonClass}
                  >
                    {isSaving ? "Adding…" : "Add Unit"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    disabled={isSaving}
                    className={skipLinkClass}
                  >
                    Skip for now →
                  </button>
                </form>
              ) : (
                <div className="space-y-5 text-center">
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-6">
                    <p className="text-2xl" aria-hidden>
                      ✓
                    </p>
                    <p className="mt-2 font-semibold text-emerald-300">
                      Unit added!
                    </p>
                    <p className="mt-1 text-sm text-muted">{createdUnitName}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className={primaryButtonClass}
                  >
                    Continue
                  </button>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <button
                type="button"
                onClick={() => setStep(2)}
                className={backButtonClass}
              >
                <span aria-hidden>←</span> Back
              </button>

              <header className="mb-6 text-center">
                <h1 className="font-display text-3xl text-text">
                  Connect your channels
                </h1>
                <p className="mt-2 text-sm text-muted">
                  Paste your Airbnb or Booking.com iCal URL to auto-sync
                  reservations
                </p>
              </header>

              {createdUnitName && (
                <div className="mb-5 rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    Your unit
                  </p>
                  <p className="mt-1 font-semibold text-text">
                    {createdUnitName}
                  </p>
                </div>
              )}

              <form onSubmit={handleFinish} className="space-y-4">
                <div>
                  <label htmlFor="airbnb-ical" className={labelClass}>
                    Airbnb iCal URL{" "}
                    <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <input
                    id="airbnb-ical"
                    type="url"
                    value={airbnbUrl}
                    onChange={(e) => setAirbnbUrl(e.target.value)}
                    placeholder="https://..."
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="booking-ical" className={labelClass}>
                    Booking.com iCal URL{" "}
                    <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <input
                    id="booking-ical"
                    type="url"
                    value={bookingUrl}
                    onChange={(e) => setBookingUrl(e.target.value)}
                    placeholder="https://..."
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="whatsapp" className={labelClass}>
                    WhatsApp number for notifications{" "}
                    <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <input
                    id="whatsapp"
                    type="tel"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="+20..."
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className={`${primaryButtonClass} mt-2`}
                >
                  {isSaving ? "Finishing…" : "Finish Setup"}
                </button>

                <button
                  type="button"
                  onClick={goToDashboard}
                  disabled={isSaving}
                  className={skipLinkClass}
                >
                  Skip →
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

