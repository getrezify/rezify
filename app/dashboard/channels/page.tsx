"use client";

export default function ChannelsPage() {
  return (
    <div className="animate-fade-up pb-6">
      <header className="pt-4">
        <h1 className="font-display text-3xl text-text">Channels</h1>
        <p className="mt-1 text-sm text-muted">
          Sync reservations from Airbnb and Booking.com
        </p>
      </header>

      <div className="mt-8 rounded-xl border border-dashed border-border bg-surface/50 px-4 py-12 text-center">
        <p className="text-sm text-muted">
          Channel connections coming soon. Link your Airbnb and Booking.com
          accounts to sync bookings automatically.
        </p>
      </div>
    </div>
  );
}
