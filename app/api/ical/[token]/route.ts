import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params

  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('id, name')
    .eq('ical_token', token)
    .single()

  if (propError || !property) {
    return new NextResponse('Not found', { status: 404 })
  }

  const { data: reservations, error: resError } = await supabase
    .from('reservations')
    .select('id, guest_name, check_in, check_out, status')
    .eq('property_id', property.id)
    .neq('status', 'cancelled')

  if (resError) {
    return new NextResponse('Error fetching reservations', { status: 500 })
  }

  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
  const host = request.headers.get('host') || 'getrezify.com'

  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rezify//Rezify PMS//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${property.name}`,
    'X-WR-TIMEZONE:UTC',
  ].join('\r\n')

  for (const res of reservations || []) {
    const checkIn = res.check_in.replace(/-/g, '')
    const checkOut = res.check_out.replace(/-/g, '')

    ical += '\r\n' + [
      'BEGIN:VEVENT',
      `UID:${res.id}@${host}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${checkIn}`,
      `DTEND;VALUE=DATE:${checkOut}`,
      `SUMMARY:${res.guest_name || 'Blocked'}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
    ].join('\r\n')
  }

  ical += '\r\nEND:VCALENDAR'

  return new NextResponse(ical, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${property.name}.ics"`,
      'Cache-Control': 'no-cache, no-store',
    },
  })
}
