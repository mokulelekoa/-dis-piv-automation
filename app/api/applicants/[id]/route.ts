import { getApplicant, markReviewed, deleteApplicant, setArchived } from '@/lib/store'
import { canAccessApplicant, isAdminRequest, isStaffRequest } from '@/lib/auth'
import { deleteAuthUserForApplicant, setAuthUserBannedForApplicant } from '@/lib/activity'
import { supabase } from '@/lib/supabase'

export async function GET(
  _request: Request,
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
  return Response.json({ applicant })
}

/**
 * PATCH /api/applicants/[id] — admin actions on an applicant:
 *  - { action: 'review' }         move a complete packet to REVIEWED (unlocks download).
 *  - { action: 'reset-password' } email the candidate a branded link to set a new password.
 *  - { action: 'archive' }        keep the record but revoke sign-in (reversible).
 *  - { action: 'unarchive' }      restore an archived candidate and lift the ban.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!(await isStaffRequest())) {
    return Response.json({ error: 'Not authorized.' }, { status: 403 })
  }

  let body: { action?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (body.action === 'review') {
    const applicant = await markReviewed(id)
    if (!applicant) {
      return Response.json({ error: 'Applicant not found' }, { status: 404 })
    }
    if (applicant.status !== 'REVIEWED') {
      return Response.json(
        { error: 'Packet is not complete and ready for review yet.' },
        { status: 409 },
      )
    }
    return Response.json({ applicant })
  }

  if (body.action === 'archive' || body.action === 'unarchive') {
    const archive = body.action === 'archive'
    const applicant = await setArchived(id, archive)
    if (!applicant) {
      return Response.json({ error: 'Applicant not found' }, { status: 404 })
    }
    // Toggle the sign-in ban to match. Best-effort: the record state is the source
    // of truth, and a candidate with no provisioned account is a no-op here.
    await setAuthUserBannedForApplicant(id, archive)
    return Response.json({ applicant })
  }

  if (body.action === 'reset-password') {
    const applicant = await getApplicant(id)
    if (!applicant) {
      return Response.json({ error: 'Applicant not found' }, { status: 404 })
    }
    // Lands on the password-recovery flow via the shared auth callback.
    const origin = new URL(request.url).origin
    const { error } = await supabase().auth.resetPasswordForEmail(applicant.email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    })
    if (error) {
      console.error('[applicants] resetPasswordForEmail failed:', error)
      return Response.json({ error: `Could not send the reset link: ${error.message}` }, { status: 502 })
    }
    return Response.json({ sent: true, email: applicant.email })
  }

  return Response.json({ error: 'Unsupported action.' }, { status: 400 })
}

/**
 * DELETE /api/applicants/[id] — admin-only. Permanently removes the candidate:
 * their Storage objects, the applicants row, and the linked auth account (so the
 * email can be re-invited). Irreversible — the client gates this behind an
 * explicit confirmation.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!(await isAdminRequest())) {
    return Response.json({ error: 'Not authorized.' }, { status: 403 })
  }

  const existed = await deleteApplicant(id)
  if (!existed) {
    return Response.json({ error: 'Applicant not found' }, { status: 404 })
  }
  // Best-effort auth cleanup; the candidate record is already gone.
  await deleteAuthUserForApplicant(id)

  return Response.json({ deleted: true })
}

export const runtime = 'nodejs'
