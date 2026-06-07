import { NextRequest } from 'next/server'
import { getAuthUser, roleOf } from '@/lib/auth'
import { createInvite, type Invite } from '@/lib/invites'
import { createApplicant } from '@/lib/store'
import { ROLE_LABELS, type PacketRole } from '@/lib/forms/specs'

export const runtime = 'nodejs'

/**
 * Admin-only invite minting. A candidate invite also provisions the applicant
 * record the new account will own; a teammate invite is email-only (admin role,
 * no applicant). Returns the code and a ready-to-share signup link — there is no
 * open registration, so this is the only way an account comes into being.
 */
export async function POST(request: NextRequest) {
  const admin = await getAuthUser()
  if (!admin || roleOf(admin) !== 'admin') {
    return Response.json({ error: 'Not authorized.' }, { status: 403 })
  }

  let body: {
    kind?: string; email?: string; firstName?: string; lastName?: string; role?: string; station?: string
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const kind = body.kind === 'admin' ? 'admin' : 'candidate'
  const email = (body.email ?? '').trim().toLowerCase()
  if (!email) return Response.json({ error: 'An email address is required.' }, { status: 400 })

  const invitedBy = admin.email ?? null

  if (kind === 'admin') {
    const invite = await createInvite({ email, role: 'admin', applicantId: null, invitedBy })
    return Response.json(inviteResult(request, invite), { status: 201 })
  }

  // Candidate: provision the applicant record this account will be linked to.
  const firstName = (body.firstName ?? '').trim()
  const lastName = (body.lastName ?? '').trim()
  const role = body.role
  const station = (body.station ?? '').trim() || undefined
  if (!firstName || !lastName || !role) {
    return Response.json({ error: 'First name, last name, and role are required for a candidate.' }, { status: 400 })
  }
  if (!(role in ROLE_LABELS)) {
    return Response.json({ error: `Invalid role: ${role}` }, { status: 400 })
  }

  const applicant = await createApplicant({ firstName, lastName, email, role: role as PacketRole, station })
  const invite = await createInvite({ email, role: 'candidate', applicantId: applicant.id, invitedBy })
  return Response.json({ ...inviteResult(request, invite), applicantId: applicant.id }, { status: 201 })
}

function inviteResult(request: NextRequest, invite: Invite) {
  const url = new URL('/signup', request.nextUrl.origin)
  url.searchParams.set('code', invite.code)
  url.searchParams.set('email', invite.email)
  return {
    code: invite.code,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expires_at,
    signupUrl: url.toString(),
  }
}
