import { NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { supabase as serviceClient } from '@/lib/supabase'
import { validateInvite, consumeInvite } from '@/lib/invites'

export const runtime = 'nodejs'

/**
 * Invite-gated signup. A valid, unused, unexpired code (issued to this exact
 * email by an admin) is required — there is no open registration. We create the
 * auth user (Supabase sends the confirmation email), stamp a tamper-proof role +
 * applicant linkage via the service role, then burn the invite.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string; code?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const code = (body.code ?? '').trim()

  if (!email || !password || !code) {
    return Response.json({ error: 'Email, password, and access code are all required.' }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const check = await validateInvite(code, email)
  if (!check.ok) return Response.json({ error: check.reason }, { status: 400 })
  const invite = check.invite

  const supabase = await createServerSupabase()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${request.nextUrl.origin}/auth/callback` },
  })
  if (error || !data.user) {
    return Response.json({ error: error?.message ?? 'Could not create your account.' }, { status: 400 })
  }

  // Only the service role can set app_metadata, so the role can't be self-assigned.
  const { error: metaErr } = await serviceClient().auth.admin.updateUserById(data.user.id, {
    app_metadata: { role: invite.role, applicant_id: invite.applicant_id },
  })
  if (metaErr) {
    return Response.json(
      { error: 'Account created but role assignment failed — contact your coordinator.' },
      { status: 500 },
    )
  }

  await consumeInvite(code)

  return Response.json({ ok: true, needsConfirmation: !data.session, role: invite.role })
}
