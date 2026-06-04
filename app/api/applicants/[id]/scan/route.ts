import { NextRequest } from 'next/server'
import { analyzePdf } from '@/lib/forms/analyze'
import { getSpec } from '@/lib/forms/specs'
import { applyScan, getApplicant } from '@/lib/store'

/**
 * POST /api/applicants/[id]/scan
 *
 * Multipart upload of one filled packet PDF (specId + file). Reads the
 * AcroForm with pdf-lib, evaluates it against the form spec, persists the
 * result onto the applicant, and returns the updated record + analysis.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const applicant = await getApplicant(id)
    if (!applicant) {
      return Response.json({ error: 'Applicant not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const specId = formData.get('specId') as string | null
    const file = formData.get('file') as File | null
    if (!specId || !file) {
      return Response.json({ error: 'specId and file are required' }, { status: 400 })
    }
    if (!getSpec(specId)) {
      return Response.json({ error: `Unknown form: ${specId}` }, { status: 400 })
    }
    if (!applicant.forms.some(f => f.specId === specId)) {
      return Response.json({ error: `${specId} is not part of this applicant's packet` }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const result = await analyzePdf(specId, bytes)
    const updated = await applyScan(id, specId, file.name, result)

    return Response.json({ applicant: updated, analysis: result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Scan failed'
    return Response.json({ error: msg }, { status: 500 })
  }
}

export const runtime = 'nodejs'
