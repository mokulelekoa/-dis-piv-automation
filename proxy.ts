import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next 16 Proxy (formerly middleware). Refreshes the Supabase session on every
 * protected request and does an optimistic redirect for unauthenticated/wrong-
 * role visitors. Per Next's guidance, this is NOT the only authz gate — each
 * admin page calls requireAdmin() and each applicant page/route re-checks
 * ownership, so a matcher gap can't expose data.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // Auth not configured yet → don't lock anyone out of the app.
  if (!url || !anon) return response

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const role = (user?.app_metadata?.role as string | undefined) ?? null
  const { pathname } = request.nextUrl

  // Admin console (except its own login) requires an admin.
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!user || role !== 'admin') return redirectTo(request, '/admin/login', response)
  }

  // Candidate portal requires any authenticated user; the page enforces ownership.
  if (pathname.startsWith('/applicant')) {
    if (!user) return redirectTo(request, '/login', response)
  }

  // First-login brief: an authenticated, role-authorized user who hasn't clicked
  // through the welcome tour gets sent there before reaching their home. Stamped
  // (user_metadata.briefSeenAt) on completion, so it shows exactly once. /welcome
  // is outside the matcher, so there's no redirect loop.
  if (user && !user.user_metadata?.briefSeenAt) {
    const onHome =
      (pathname.startsWith('/admin') && pathname !== '/admin/login') ||
      pathname.startsWith('/applicant')
    if (onHome) return redirectTo(request, '/welcome', response)
  }

  return response
}

/** Redirect while preserving any auth cookies the session refresh just set. */
function redirectTo(request: NextRequest, pathname: string, base: NextResponse) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  const redirect = NextResponse.redirect(url)
  for (const cookie of base.cookies.getAll()) redirect.cookies.set(cookie)
  return redirect
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/applicant/:path*'],
}
