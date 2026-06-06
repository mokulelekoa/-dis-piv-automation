import { NextRequest } from 'next/server'
import { promises as fs } from 'fs'
import { getApplicant, savePhoto, photoPath } from '@/lib/store'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/**
 * POST /api/applicants/[id]/photo — multipart upload of a candidate profile
 * photo. Validates type + size, persists bytes under .data/uploads/, and stores
 * metadata on the applicant.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const applicant = await getApplicant(id)
    if (!applicant) return Response.json({ error: 'Applicant not found' }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })
    if (!ALLOWED.includes(file.type)) {
      return Response.json({ error: 'Photo must be a JPEG, PNG, or WebP image' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: 'Photo must be 5 MB or smaller' }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const fileName = `profile.${EXT[file.type]}`
    const updated = await savePhoto(id, fileName, file.type, bytes)
    return Response.json({ applicant: updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Photo upload failed'
    return Response.json({ error: msg }, { status: 500 })
  }
}

/**
 * GET /api/applicants/[id]/photo — streams the stored profile photo, or 404 if
 * the candidate hasn't uploaded one.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const applicant = await getApplicant(id)
  if (!applicant?.photo) return new Response(null, { status: 404 })

  try {
    const bytes = await fs.readFile(photoPath(id, applicant.photo.fileName))
    return new Response(new Blob([bytes as BlobPart], { type: applicant.photo.mime }), {
      status: 200,
      headers: { 'Content-Type': applicant.photo.mime, 'Cache-Control': 'no-store' },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}

export const runtime = 'nodejs'
