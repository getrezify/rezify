import { parseIcsEvents } from "@/lib/ical";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import type { SupabaseClient } from "@supabase/supabase-js";

type PropertyRow = {
  id: string;
  name: string;
  airbnb_ical_url: string | null;
  booking_ical_url: string | null;
};

type Feed = {
  source: "airbnb" | "booking";
  url: string;
};

export type SyncIcalResult = {
  synced: number;
  skipped: number;
  properties: number;
  errors: string[];
};

async function fetchIcs(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Rezify/1.0 (iCal sync)" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch calendar (${res.status})`);
  }

  return res.text();
}

/**
 * Syncs Airbnb/Booking iCal feeds for all properties in a workspace.
 */
export async function syncWorkspaceIcal(
  client: SupabaseClient,
  workspaceId: string,
): Promise<SyncIcalResult> {
  const { data: properties, error: propertiesError } = await client
    .from("properties")
    .select("id, name, airbnb_ical_url, booking_ical_url")
    .eq("workspace_id", workspaceId)
    .or("airbnb_ical_url.not.is.null,booking_ical_url.not.is.null");

  if (propertiesError) {
    throw new Error(propertiesError.message || "Failed to load properties");
  }

  const rows = (properties ?? []) as PropertyRow[];
  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const property of rows) {
    const feeds: Feed[] = [];
    const airbnbUrl = property.airbnb_ical_url?.trim();
    const bookingUrl = property.booking_ical_url?.trim();

    if (airbnbUrl) feeds.push({ source: "airbnb", url: airbnbUrl });
    if (bookingUrl) feeds.push({ source: "booking", url: bookingUrl });

    for (const feed of feeds) {
      try {
        const icsText = await fetchIcs(feed.url);
        const events = parseIcsEvents(icsText);

        for (const event of events) {
          const { data: overlapping } = await client
            .from("reservations")
            .select("id, source, guest_name, check_in, check_out")
            .eq("workspace_id", workspaceId)
            .eq("property_id", property.id)
            .or("status.neq.cancelled,status.is.null")
            .lt("check_in", event.checkOut)
            .gt("check_out", event.checkIn)
            .limit(1);

          if (overlapping && overlapping.length > 0) {
            const existing = overlapping[0];
            if (existing.source !== feed.source) {
              try {
                const { data: workspace } = await client
                  .from("workspaces")
                  .select("whatsapp_number")
                  .eq("id", workspaceId)
                  .single();

                const whatsappNumber = workspace?.whatsapp_number;
                if (whatsappNumber) {
                  const formatDate = (iso: string) =>
                    new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });

                  const alertBody = [
                    "⚠️ *Booking Conflict Detected*",
                    "",
                    `🏠 *Unit:* ${property.name}`,
                    "",
                    `📌 *Booking 1 (${existing.source}):* ${existing.guest_name}`,
                    `📅 ${formatDate(existing.check_in)} → ${formatDate(existing.check_out)}`,
                    "",
                    `📌 *Booking 2 (${feed.source}):* ${event.summary}`,
                    `📅 ${formatDate(event.checkIn)} → ${formatDate(event.checkOut)}`,
                    "",
                    "🚨 Please resolve this conflict immediately!",
                  ].join("\n");

                  await sendWhatsAppMessage(whatsappNumber, alertBody);
                }
              } catch (alertErr) {
                errors.push(
                  `Conflict alert failed for ${property.name}: ${alertErr instanceof Error ? alertErr.message : "unknown"}`,
                );
              }
            }
            skipped += 1;
            continue;
          }

          const { error: insertError } = await client.from("reservations").insert({
            workspace_id: workspaceId,
            property_id: property.id,
            guest_name: event.summary,
            source: feed.source,
            check_in: event.checkIn,
            check_out: event.checkOut,
            total_price: 0,
            currency: "EGP",
            status: "confirmed",
          });

          if (insertError) {
            errors.push(
              `${property.name} (${feed.source}): ${insertError.message}`,
            );
            skipped += 1;
            continue;
          }

          synced += 1;
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to sync feed";
        errors.push(`${property.name} (${feed.source}): ${message}`);
      }
    }
  }

  return { synced, skipped, properties: rows.length, errors };
}
