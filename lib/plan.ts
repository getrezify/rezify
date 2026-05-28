import { supabase } from "@/lib/supabase";
import { getAuthenticatedUser, getWorkspaceId } from "@/lib/workspace";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UserPlan = "starter" | "pro" | "business";

export const STARTER_UNIT_LIMIT = 1;
export const PRO_UNIT_LIMIT = 5;

export const PADDLE_PRO_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID ?? "";
export const PADDLE_BUSINESS_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_BUSINESS_PRICE_ID ?? "";

let cachedPlan: UserPlan | null = null;
let cachedPlanUserId: string | null = null;

export function clearPlanCache() {
  cachedPlan = null;
  cachedPlanUserId = null;
}

export function isAtUnitLimit(plan: UserPlan, unitCount: number): boolean {
  if (plan === "starter") return unitCount >= STARTER_UNIT_LIMIT;
  if (plan === "pro") return unitCount >= PRO_UNIT_LIMIT;
  return false; // business = unlimited
}

// Keep backward compat
export function isStarterAtUnitLimit(plan: UserPlan, unitCount: number): boolean {
  return isAtUnitLimit(plan, unitCount);
}

export function canUseSync(plan: UserPlan): boolean {
  return true; // all plans have sync now
}

export function getPlanLabel(plan: UserPlan): string {
  if (plan === "pro") return "Pro — $25/month";
  if (plan === "business") return "Business — $50/month";
  return "Starter — Free";
}

export function getUnitLimit(plan: UserPlan): string {
  if (plan === "starter") return "1 unit";
  if (plan === "pro") return "up to 5 units";
  return "unlimited units";
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
