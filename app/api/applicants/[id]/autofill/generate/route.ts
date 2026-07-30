import { NextRequest } from 'next/server'
import { addAttachment, getApplicant } from '@/lib/store'
import { canAccessApplicant, getAuthUser } from '@/lib/auth'
import { generateFilledPdf, type GenerateInput } from '@/lib/forms/universal'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB

/**
 * POST /api/applicants/[id]/autofill/generate — produce the filled PDF.
 * Multipart: the ORIGINAL blank form (`file`) plus a `payload` JSON field with
 * the user-confirmed values (see GenerateInput). The filled PDF is returned as
 * a download AND saved to the candidate's attachments so it stays on record.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!(await canAccessApplicant(id))) {
    return Response.json({ error: 'Not authorized.' }, { status: 403 })
  }
  const applicant = await getApplicant(id)
  if (!applicant) {
    return Response.json({ error: 'Applicant not found' }, { status: 404 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const file = formData.get('file') as File | null
  const payloadRaw = formData.get('payload')
  if (!file || typeof file === 'string' || typeof payloadRaw !== 'string') {
    return Response.json({ error: 'The original form file and a payload are required.' }, { status: 400 })
  }
  if (file.size === 0 || file.size > MAX_SIZE) {
    return Response.json({ error: 'The form file is empty or exceeds 20 MB.' }, { status: 400 })
  }

  let payload: GenerateInput
  try {
    payload = JSON.parse(payloadRaw) as GenerateInput
  } catch {
    return Response.json({ error: 'Invalid payload.' }, { status: 400 })
  }
  if (!['acroform', 'overlay-pdf', 'overlay-image'].includes(payload.mode)
    || typeof payload.values !== 'object' || payload.values === null) {
    return Response.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const mime = file.type || 'application/octet-stream'
    const bytes = await generateFilledPdf(buffer, mime, payload)

    const baseName = file.name.replace(/\.(pdf|jpe?g|png)$/i, '')
    const outName = `${baseName || 'form'}_filled.pdf`

    // Keep a copy on the candidate's record; a save failure shouldn't lose the download.
    let saved = false
    try {
      const me = await getAuthUser()
      saved = !!(await addAttachment(id, outName, 'application/pdf', bytes, me?.email ?? undefined))
    } catch (err) {
      console.warn('[autofill] attachment save failed:', err)
    }

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${outName.replace(/"/g, '')}"`,
        'X-Saved-To-Record': saved ? '1' : '0',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Could not generate the filled form.'
    return Response.json({ error: msg }, { status: 422 })
  }
}
