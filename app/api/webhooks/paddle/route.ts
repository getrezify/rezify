import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const PRO_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID ?? "";
const BUSINESS_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_BUSINESS_PRICE_ID ?? "";

function getPlanFromPriceId(priceId: string): "pro" | "business" | null {
  if (priceId === PRO_PRICE_ID) return "pro";
  if (priceId === BUSINESS_PRICE_ID) return "business";
  return null;
}

async function verifyPaddleSignature(req: NextRequest, rawBody: string): Promise<boolean> {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) return false;

  const signatureHeader = req.headers.get("paddle-signature") ?? "";
  const parts = Object.fromEntries(
    signatureHeader.split(";").map((p) => p.split("=") as [string, string]),
  );

  const ts = parts["ts"];
  const h1 = parts["h1"];
  if (!ts || !h1) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${ts}:${rawBody}`),
  );

  const digest = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return digest === h1;
}

async function updateUserPlan(email: string, plan: UserPlan) {
  const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) throw new Error("Failed to list users");

  const user = users.users.find((u) => u.email === email);
  if (!user) throw new Error(`User not found: ${email}`);

  const { error: updateError } = await supabaseAdmin
    .from("workspaces")
    .update({ plan })
    .eq("owner_id", user.id);

  if (updateError) throw new Error(updateError.message);
  return user.email;
}

type UserPlan = "starter" | "pro" | "business";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const isValid = await verifyPaddleSignature(req, rawBody);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.event_type as string;
  const data = (event.data ?? {}) as Record<string, unknown>;

  // subscription.created or subscription.updated
  if (
    eventType === "subscription.created" ||
    eventType === "subscription.updated" ||
    eventType === "subscription.resumed"
  ) {
    const status = data.status as string;
    const customerEmail = (data.customer_id as string) ?? "";

    // Get customer email from items
    const items = (data.items as Record<string, unknown>[]) ?? [];
    const priceId = items[0]
      ? ((items[0].price as Record<string, unknown>)?.id as string)
      : "";

    const customData = data.custom_data as Record<string, unknown> | null;
    const email = (customData?.email as string) ?? (data.customer as Record<string, unknown>)?.email as string ?? customerEmail;

    if (!email || !priceId) {
      return NextResponse.json({ received: true, skipped: "missing email or price" });
    }

    if (status !== "active" && status !== "trialing") {
      return NextResponse.json({ received: true, skipped: `status: ${status}` });
    }

    const plan = getPlanFromPriceId(priceId);
    if (!plan) {
      return NextResponse.json({ received: true, skipped: "unknown price" });
    }

    try {
      await updateUserPlan(email, plan);
      return NextResponse.json({ received: true, plan, email });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Unknown error" },
        { status: 500 },
      );
    }
  }

  // subscription.canceled, subscription.paused
  if (eventType === "subscription.canceled" || eventType === "subscription.paused") {
    const customData = data.custom_data as Record<string, unknown> | null;
    const email = (customData?.email as string) ?? (data.customer as Record<string, unknown>)?.email as string;

    if (!email) return NextResponse.json({ received: true });

    try {
      await updateUserPlan(email, "starter");
      return NextResponse.json({ received: true, plan: "starter", email });
    } catch {
      return NextResponse.json({ received: true, skipped: "user not found" });
    }
  }

  return NextResponse.json({ received: true, skipped: "unhandled event" });
}
