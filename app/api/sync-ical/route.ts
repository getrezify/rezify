import { createAuthedClient } from "@/lib/supabase-auth";
import { syncWorkspaceIcal } from "@/lib/sync-ical";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const client = createAuthedClient(req.headers.get("Authorization"));

    if (!client) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { workspaceId?: string };
    const workspaceId = body.workspaceId?.trim();

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 },
      );
    }

    const result = await syncWorkspaceIcal(client, workspaceId);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
