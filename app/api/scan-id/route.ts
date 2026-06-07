import { NextRequest } from 'next/server'
import { extractIdData } from '@/lib/ai/id-parser'
import { getAuthUser } from '@/lib/auth'

/**
 * POST /api/scan-id
 *
 * Accepts a single ID image/PDF, runs vision PII extraction, and returns
 * suggested candidate-profile fields plus the document classification. Does NOT
 * persist anything — the candidate reviews/corrects on the client, then saves.
 */
export async function POST(request: NextRequest) {
  if (!(await getAuthUser())) {
    return Response.json({ error: 'Not authorized.' }, { status: 401 })
  }
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const data = await extractIdData(buffer, file.type)

    if (!data) {
      // No API key, unreadable doc, or nothing extracted — degrade to manual entry.
      return Response.json({ scanned: false, data: null })
    }

    return Response.json({ scanned: true, data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Scan failed'
    return Response.json({ error: msg }, { status: 500 })
  }
}

export const runtime = 'nodejs'
