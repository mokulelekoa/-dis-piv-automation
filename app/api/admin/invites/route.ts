import { NextRequest } from 'next/server'
import { getAuthUser, roleOf } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { createApplicant } from '@/lib/store'
import { ROLE_LABELS, type PacketRole } from '@/lib/forms/specs'

export const runtime = 'nodejs'

/**
 * Admin-only invite minting. The invitee is emailed a Supabase invite link; on
 * clicking it they land on /reset-password (via /auth/callback) to set a
 * password, then drop into their home. There is no open registration — this is
 * the only way an account comes into being.
 *
 * Demo transport: Supabase's built-in invite email. After project approval this
 * swaps to our own SMTP (nodemailer) send without changing the account flow.
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

  // Candidates carry name/role/station; teammates are email-only admins.
  let firstName = ''
  let lastName = ''
  let role: PacketRole | undefined
  let station: string | undefined
  if (kind === 'candidate') {
    firstName = (body.firstName ?? '').trim()
    lastName = (body.lastName ?? '').trim()
    station = (body.station ?? '').trim() || undefined
    if (!firstName || !lastName || !body.role) {
      return Response.json({ error: 'First name, last name, and role are required for a candidate.' }, { status: 400 })
    }
    if (!(body.role in ROLE_LABELS)) {
      return Response.json({ error: `Invalid role: ${body.role}` }, { status: 400 })
    }
    role = body.role as PacketRole
  }

  const sb = supabase()
  const redirectTo = `${request.nextUrl.origin}/auth/callback?next=/reset-password`

  // 1) Send the Supabase invite email (creates the auth user with no password).
  const { data: invited, error: inviteErr } = await sb.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    // Surfaced in the invite email template ({{ .Data.* }}) to personalize the
    // greeting and tailor candidate vs. teammate copy. (The tamper-proof role is
    // stamped into app_metadata below — this is cosmetic, for the email only.)
    data: kind === 'candidate'
      ? { first_name: firstName, last_name: lastName, role: 'candidate' }
      : { role: 'admin' },
  })
  if (inviteErr || !invited?.user) {
    console.error('[invites] inviteUserByEmail failed:', JSON.stringify({
      name: (inviteErr as { name?: string })?.name,
      message: inviteErr?.message,
      status: (inviteErr as { status?: number })?.status,
      code: (inviteErr as { code?: string })?.code,
    }))
    const msg = inviteErr?.message ?? 'Could not send the invitation.'
    if (/already|registered|exist/i.test(msg)) {
      return Response.json({ error: 'That email already has an account.' }, { status: 409 })
    }
    return Response.json({ error: msg }, { status: 502 })
  }

  // 2) Provision the applicant record a candidate account will own.
  let applicantId: string | null = null
  if (kind === 'candidate') {
    const applicant = await createApplicant({ firstName, lastName, email, role: role!, station })
    applicantId = applicant.id
  }

  // 3) Stamp the tamper-proof role + applicant linkage (only the service role can).
  const app_metadata =
    kind === 'admin' ? { role: 'admin' } : { role: 'candidate', applicant_id: applicantId }
  const { error: stampErr } = await sb.auth.admin.updateUserById(invited.user.id, { app_metadata })
  if (stampErr) {
    return Response.json({ error: `Invited, but failed to set role: ${stampErr.message}` }, { status: 500 })
  }

  return Response.json(
    { emailed: true, email, role: kind, ...(applicantId ? { applicantId } : {}) },
    { status: 201 },
  )
}
