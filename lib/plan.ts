import { supabase } from "@/lib/supabase";
import { getAuthenticatedUser, getWorkspaceId } from "@/lib/workspace";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UserPlan = "starter" | "pro" | "business";

export const STARTER_UNIT_LIMIT = 2;
export const PRO_VARIANT_ID = process.env.NEXT_PUBLIC_LS_PRO_VARIANT_ID ?? "";
export const BUSINESS_VARIANT_ID = process.env.NEXT_PUBLIC_LS_BUSINESS_VARIANT_ID ?? "";

let cachedPlan: UserPlan | null = null;
let cachedPlanUserId: string | null = null;

export function clearPlanCache() {
  cachedPlan = null;
  cachedPlanUserId = null;
}

export function isStarterAtUnitLimit(plan: UserPlan, unitCount: number): boolean {
  return plan === "starter" && unitCount >= STARTER_UNIT_LIMIT;
}

export function canUseSync(plan: UserPlan): boolean {
  return plan === "business";
}

export function getCheckoutUrl(plan: "pro" | "business", email?: string): string {
  const variantId = plan === "pro" ? "1709781" : "1709793";
  const base = `https://getrezify.lemonsqueezy.com/checkout/buy/${variantId}`;
  if (email) return `${base}?checkout[email]=${encodeURIComponent(email)}`;
  return base;
}

export async function getUserPlan(
  client: SupabaseClient = supabase,
): Promise<UserPlan> {
  const user = await getAuthenticatedUser(client);
  if (cachedPlan && cachedPlanUserId === user.id) {
    return cachedPlan;
  }
  const workspaceId = await getWorkspaceId(client);
  const { data, error } = await client
    .from("workspaces")
    .select("plan")
    .eq("id", workspaceId)
    .single();
  if (error) throw new Error(error.message || "Failed to load plan");
  const raw = data?.plan ?? "starter";
  const plan: UserPlan = raw === "business" ? "business" : raw === "pro" ? "pro" : "starter";
  cachedPlan = plan;
  cachedPlanUserId = user.id;
  return plan;
}
