import { NextRequest } from 'next/server'
import { addAttachment, getApplicant } from '@/lib/store'
import { getAuthUser, isStaff } from '@/lib/auth'

export const runtime = 'nodejs'

const MAX_SIZE = 25 * 1024 * 1024 // 25 MB

/**
 * POST /api/applicants/[id]/attachments — staff upload one general document to a
 * candidate's profile (anything outside the required form set: a scanned ID,
 * offer letter, correspondence). Multipart: a single `file`. Returns the new
 * attachment record. Coordinators may upload; only admins may delete (see [attId]).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const me = await getAuthUser()
  if (!isStaff(me)) {
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
    return Response.json({ error: `${file.name} exceeds 25 MB.` }, { status: 400 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const mime = file.type || 'application/octet-stream'
  const result = await addAttachment(id, file.name, mime, bytes, me?.email ?? undefined)
  if (!result) {
    return Response.json({ error: 'Applicant not found' }, { status: 404 })
  }
  return Response.json({ attachment: result.attachment }, { status: 201 })
}
