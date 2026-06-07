import { NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { roleOf, applicantIdOf } from '@/lib/auth'

export const runtime = 'nodejs'

/**
 * Lands the PKCE `code` from confirmation + password-reset emails, exchanges it
 * for a session, then routes onward. An explicit `next` (e.g. /reset-password)
 * wins; otherwise we send the user to the right home for their role.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (!code) return Response.redirect(new URL('/login?error=link', origin), 303)

  const supabase = await createServerSupabase()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return Response.redirect(new URL('/login?error=link', origin), 303)

  if (next) return Response.redirect(new URL(next, origin), 303)

  const { data: { user } } = await supabase.auth.getUser()
  if (roleOf(user) === 'admin') return Response.redirect(new URL('/admin', origin), 303)
  const applicantId = applicantIdOf(user)
  if (roleOf(user) === 'candidate' && applicantId) {
    return Response.redirect(new URL(`/applicant/${applicantId}`, origin), 303)
  }
  return Response.redirect(new URL('/login', origin), 303)
}
