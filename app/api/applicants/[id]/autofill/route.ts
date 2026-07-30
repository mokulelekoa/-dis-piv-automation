import { NextRequest } from 'next/server'
import { getApplicant } from '@/lib/store'
import { canAccessApplicant } from '@/lib/auth'
import { emptyProfile } from '@/lib/profile'
import { detectFormFields } from '@/lib/forms/universal'

export const runtime = 'nodejs'
export const maxDuration = 120 // vision passes on multi-page scans can be slow

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png'])

/**
 * POST /api/applicants/[id]/autofill — analyze an uploaded blank form (any PDF,
 * or a JPG/PNG phone photo) and return the detected blanks with values
 * suggested from the candidate's saved profile. Nothing is persisted — the
 * client reviews/edits, then calls autofill/generate with the same file.
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
  if (!file || typeof file === 'string') {
    return Response.json({ error: 'A file is required.' }, { status: 400 })
  }
  if (file.size === 0) {
    return Response.json({ error: 'That file is empty.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: `${file.name} exceeds 20 MB.` }, { status: 400 })
  }
  const mime = file.type || 'application/octet-stream'
  if (!ALLOWED_MIME.has(mime)) {
    return Response.json(
      { error: 'Unsupported file type — upload a PDF, or a JPG/PNG photo of the form.' },
      { status: 400 },
    )
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const detection = await detectFormFields(buffer, mime, applicant.profile ?? emptyProfile(), applicant.workHistory)
    return Response.json({ detection, hasProfile: !!applicant.profile })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Could not analyze that form.'
    return Response.json({ error: msg }, { status: 422 })
  }
}
