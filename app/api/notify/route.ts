import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    console.log("SID:", process.env.TWILIO_ACCOUNT_SID?.slice(0, 5));
    console.log("TOKEN:", process.env.TWILIO_AUTH_TOKEN?.slice(0, 5));
    console.log("FROM:", process.env.TWILIO_WHATSAPP_FROM?.slice(0, 5));
    console.log("TO:", process.env.NOTIFY_WHATSAPP_TO?.slice(0, 5));

    const { guestName, unitName, checkIn, checkOut, nights, price, currency, source } =
      await req.json();

    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const from = process.env.TWILIO_WHATSAPP_FROM!;
    const to = process.env.NOTIFY_WHATSAPP_TO!;

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
