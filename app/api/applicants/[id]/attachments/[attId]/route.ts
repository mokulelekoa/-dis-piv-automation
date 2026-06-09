import { NextRequest } from 'next/server'
import { getApplicant, getAttachmentBytes, deleteAttachment } from '@/lib/store'
import { canAccessApplicant, isAdminRequest } from '@/lib/auth'

export const runtime = 'nodejs'

/**
 * GET /api/applicants/[id]/attachments/[attId] — stream a stored attachment
 * inline. Readable by staff or the owning candidate (canAccessApplicant).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attId: string }> },
) {
  const { id, attId } = await params
  if (!(await canAccessApplicant(id))) {
    return new Response(null, { status: 403 })
  }
  const applicant = await getApplicant(id)
  const att = applicant?.attachments?.find(a => a.id === attId)
  if (!att) return new Response(null, { status: 404 })

  const bytes = await getAttachmentBytes(id, attId)
  if (!bytes) return new Response(null, { status: 404 })

  const name = att.fileName.replace(/[^\x20-\x7E]/g, '_')
  return new Response(new Blob([bytes as BlobPart], { type: att.mime }), {
    status: 200,
    headers: {
      'Content-Type': att.mime,
      'Content-Disposition': `inline; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  })
}

/**
 * DELETE /api/applicants/[id]/attachments/[attId] — admin-only. Removing a file
 * is a delete action, which coordinators are not permitted to perform.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attId: string }> },
) {
  const { id, attId } = await params
  if (!(await isAdminRequest())) {
    return Response.json({ error: 'Not authorized.' }, { status: 403 })
  }
  const applicant = await deleteAttachment(id, attId)
  if (!applicant) {
    return Response.json({ error: 'Applicant not found' }, { status: 404 })
  }
  return Response.json({ deleted: true })
}
