import { supabase } from "@/lib/supabase";
import type { SupabaseClient, User } from "@supabase/supabase-js";

let cachedWorkspaceId: string | null = null;
let cachedUserId: string | null = null;
let inFlight: Promise<string> | null = null;

export function clearWorkspaceCache() {
  cachedWorkspaceId = null;
  cachedUserId = null;
  inFlight = null;
}

/**
 * Reads the current user from the local session (fast, client-safe).
 * Prefer over auth.getUser(), which can hang waiting on network validation.
 */
export async function getAuthenticatedUser(
  client: SupabaseClient = supabase,
): Promise<User> {
  const {
    data: { session },
    error,
  } = await client.auth.getSession();

  if (error) {
    throw new Error(error.message || "Failed to read session");
  }

  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  return session.user;
}

/**
 * Returns the workspace id for the currently logged-in user.
 * Cached for the session until clearWorkspaceCache() is called (e.g. on sign out).
 */
export async function getWorkspaceId(
  client: SupabaseClient = supabase,
): Promise<string> {
  const user = await getAuthenticatedUser(client);

  if (cachedWorkspaceId && cachedUserId === user.id) {
    return cachedWorkspaceId;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    const { data, error } = await client
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
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
