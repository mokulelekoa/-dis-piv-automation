import { NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth'

/**
 * US ZIP → city/state lookup. Backs the place-of-birth smart autofill in the
 * packet wizard: a candidate types a ZIP and we fill City of Birth and select
 * the State of Birth dropdown (2-letter code, matching the VA AcroForm options).
 *
 * Proxied server-side (not called from the browser) so the candidate's birth ZIP
 * isn't sent to a third party from their device, and so the data source can be
 * swapped without touching the client. Degrades gracefully — on any failure the
 * candidate still types city/state by hand.
 */
export interface ZipPlace {
  city: string
  state: string // 2-letter code (e.g. "HI")
}

export interface ZipLookupResult extends ZipPlace {
  zip: string
  /** All place names sharing this ZIP (usually one). */
  places: ZipPlace[]
}

export async function GET(request: NextRequest) {
  if (!(await getAuthUser())) {
    return Response.json({ error: 'Not authorized.' }, { status: 401 })
  }
  const zip = (request.nextUrl.searchParams.get('zip') ?? '').trim()
  if (!/^\d{5}$/.test(zip)) {
    return Response.json({ error: 'Enter a 5-digit US ZIP code.' }, { status: 400 })
  }

  let res: Response
  try {
    res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      // Cache aggressively — ZIP→city/state is effectively static.
      next: { revalidate: 86_400 },
    })
  } catch {
    return Response.json(
      { error: 'ZIP lookup is unavailable right now — enter city and state manually.' },
      { status: 502 },
    )
  }

  if (res.status === 404) {
    return Response.json({ error: 'No US city found for that ZIP code.' }, { status: 404 })
  }
  if (!res.ok) {
    return Response.json(
      { error: 'ZIP lookup is unavailable right now — enter city and state manually.' },
      { status: 502 },
    )
  }

  const data = (await res.json()) as {
    places?: { 'place name'?: string; 'state abbreviation'?: string }[]
  }
  const places: ZipPlace[] = (data.places ?? [])
    .map(p => ({ city: (p['place name'] ?? '').trim(), state: (p['state abbreviation'] ?? '').trim() }))
    .filter(p => p.city && p.state)

  if (places.length === 0) {
    return Response.json({ error: 'No US city found for that ZIP code.' }, { status: 404 })
  }

  const result: ZipLookupResult = { zip, city: places[0].city, state: places[0].state, places }
  return Response.json(result)
}

export const runtime = 'nodejs'
