import { getWorkspaceId } from "@/lib/workspace";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function createAuthedClient(req: NextRequest): SupabaseClient | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

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

export async function POST(req: NextRequest) {
  try {
    const { guestName, unitName, checkIn, checkOut, nights, price, currency, source } =
      await req.json();

    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const from = process.env.TWILIO_WHATSAPP_FROM!;

    const authedClient = createAuthedClient(req);
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

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: from, To: to, Body: body }),
      },
    );

    if (!res.ok) {
      const err = await res.json();
      console.log("Twilio error:", err);
      return NextResponse.json({ error: err }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.log("Notify route error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
