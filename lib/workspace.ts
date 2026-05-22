import { supabase } from "@/lib/supabase";

let cachedWorkspaceId: string | null = null;
let cachedUserId: string | null = null;
let inFlight: Promise<string> | null = null;

export function clearWorkspaceCache() {
  cachedWorkspaceId = null;
  cachedUserId = null;
  inFlight = null;
}

/**
 * Returns the workspace id for the currently logged-in user.
 * Cached for the session until clearWorkspaceCache() is called (e.g. on sign out).
 */
export async function getWorkspaceId(): Promise<string> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not authenticated");
  }

  if (cachedWorkspaceId && cachedUserId === user.id) {
    return cachedWorkspaceId;
  }

  if (!inFlight) {
    inFlight = (async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (error) {
        throw new Error(error.message || "Failed to load workspace");
      }

      if (!data?.id) {
        throw new Error("No workspace found for this account");
      }

      cachedWorkspaceId = data.id;
      cachedUserId = user.id;
      return data.id;
    })().finally(() => {
      inFlight = null;
    });
  }

  return inFlight;
}
