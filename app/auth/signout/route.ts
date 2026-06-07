import { NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/** Clears the Supabase session cookies and returns to the candidate login. */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  await supabase.auth.signOut()
  return Response.redirect(new URL('/login', request.nextUrl.origin), 303)
}
