import { createAuthedClient } from "@/lib/supabase-auth";
import { getWorkspaceId } from "@/lib/workspace";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  function formatWhatsAppTo(number: string): string {
    const trimmed = number.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("whatsapp:")) return trimmed;
    const digits = trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
    return `whatsapp:${digits}`;
  }

  async function resolveNotifyTo(
    client: SupabaseClient | null,
  ): Promise<string | null> {
    const envFallback = process.env.NOTIFY_WHATSAPP_TO?.trim() || null;

    if (!client) return envFallback;

    try {
      const workspaceId = await getWorkspaceId(client);
      const { data, error } = await client
        .from("workspaces")
        .select("whatsapp_number")
        .eq("id", workspaceId)
        .single();

      if (error) return envFallback;

      const saved = data?.whatsapp_number?.trim();
      if (saved) return formatWhatsAppTo(saved);

      return envFallback;
    } catch {
      return envFallback;
    }
  }

  try {
    const {
      guestName,
      unitName,
      checkIn,
      checkOut,
      nights,
      price,
      currency,
      source,
    } = await req.json();

    const authedClient = createAuthedClient(req.headers.get("Authorization"));
    const to = await resolveNotifyTo(authedClient);

    if (!to) {
      return NextResponse.json(
        { error: "No WhatsApp number configured" },
        { status: 400 },
      );
    }

    const sourceEmoji: Record<string, string> = {
      airbnb: "🏠 Airbnb",
      booking: "🌐 Booking.com",
      direct: "🤝 Direct",
      other: "📋 Other",
    };

    const formatDate = (iso: string) =>
      new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

    const body = [
      `✅ *New Reservation*`,
      ``,
      `🏠 *Unit:* ${unitName}`,
      `👤 *Guest:* ${guestName}`,
      `📅 ${formatDate(checkIn)} → ${formatDate(checkOut)} (${nights} ${nights === 1 ? "night" : "nights"})`,
      `💰 ${Number(price).toLocaleString()} ${currency}`,
      `📌 ${sourceEmoji[source] ?? source}`,
    ].join("\n");

    await sendWhatsAppMessage(to, body);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.log("Notify route error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
