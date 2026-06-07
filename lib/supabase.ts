import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client using the service-role key. This bypasses RLS, so
 * it must NEVER be imported into a client component. All persistence (applicants
 * table + Storage buckets for form PDFs and profile photos) goes through here.
 */
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let client: SupabaseClient | null = null

export function supabase(): SupabaseClient {
  if (!url || !serviceKey) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    )
  }
  client ??= createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}

export const FORMS_BUCKET = 'forms'
export const PHOTOS_BUCKET = 'photos'
