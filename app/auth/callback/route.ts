import { NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'
import { roleOf, applicantIdOf, isStaff } from '@/lib/auth'

export const runtime = 'nodejs'

/**
 * Lands a session from email links and routes onward. Two shapes arrive here:
 *  - PKCE `code` (browser-initiated flows: signup confirm, forgot-password).
 *  - `token_hash` + `type` (server-generated links: admin invite, recovery) —
 *    verified with verifyOtp, since there's no client-side PKCE verifier.
 * An explicit `next` (e.g. /reset-password) wins; otherwise we send the user to
 * the right home for their role.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next')

  const supabase = await createServerSupabase()

  let failed = false
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    failed = !!error
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    failed = !!error
  } else {
    failed = true
  }
  if (failed) return Response.redirect(new URL('/login?error=link', origin), 303)

  if (next) return Response.redirect(new URL(next, origin), 303)

  const { data: { user } } = await supabase.auth.getUser()
  if (isStaff(user)) return Response.redirect(new URL('/admin', origin), 303)
  const applicantId = applicantIdOf(user)
  if (roleOf(user) === 'candidate' && applicantId) {
    return Response.redirect(new URL(`/applicant/${applicantId}`, origin), 303)
  }
  return Response.redirect(new URL('/login', origin), 303)
}
