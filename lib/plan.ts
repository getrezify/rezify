import { supabase } from "@/lib/supabase";
import { getAuthenticatedUser, getWorkspaceId } from "@/lib/workspace";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UserPlan = "starter" | "pro";

export const STARTER_UNIT_LIMIT = 2;

let cachedPlan: UserPlan | null = null;
let cachedPlanUserId: string | null = null;

export function clearPlanCache() {
  cachedPlan = null;
  cachedPlanUserId = null;
}

export function isStarterAtUnitLimit(plan: UserPlan, unitCount: number): boolean {
  return plan === "starter" && unitCount >= STARTER_UNIT_LIMIT;
}

/**
 * Returns the workspace plan for the currently logged-in user.
 */
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

  if (error) {
    throw new Error(error.message || "Failed to load plan");
  }

  const plan: UserPlan = data?.plan === "pro" ? "pro" : "starter";
  cachedPlan = plan;
  cachedPlanUserId = user.id;
  return plan;
}
