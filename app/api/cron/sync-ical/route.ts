import { verifyCronSecret } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase-admin";
import { syncWorkspaceIcal } from "@/lib/sync-ical";
import { NextRequest, NextResponse } from "next/server";

type WorkspaceResult = {
  workspaceId: string;
  synced: number;
  skipped: number;
  properties: number;
  errors: string[];
};

export async function GET(req: NextRequest) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  try {
    const client = createServiceClient();

    const { data: workspaces, error: workspacesError } = await client
      .from("workspaces")
      .select("id");

    if (workspacesError) {
      return NextResponse.json(
        { error: workspacesError.message || "Failed to load workspaces" },
        { status: 500 },
      );
    }

    const workspaceIds = (workspaces ?? []).map((w) => w.id as string);
    const results: WorkspaceResult[] = [];
    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const workspaceId of workspaceIds) {
      try {
        const result = await syncWorkspaceIcal(client, workspaceId);
        synced += result.synced;
        skipped += result.skipped;
        errors.push(...result.errors);
        results.push({ workspaceId, ...result });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Workspace sync failed";
        errors.push(`${workspaceId}: ${message}`);
        results.push({
          workspaceId,
          synced: 0,
          skipped: 0,
          properties: 0,
          errors: [message],
        });
      }
    }

    return NextResponse.json({
      synced,
      skipped,
      workspaces: workspaceIds.length,
      results,
      errors,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
