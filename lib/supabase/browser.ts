'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side Supabase client for auth (sign-in/up, password reset). Uses the
 * publishable/anon key and persists the session in cookies so the server
 * (proxy.ts + server components) can read it. Never used for data writes — those
 * go through the service-role server store.
 */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error(
      'Supabase auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }
  return createBrowserClient(url, anon)
}
