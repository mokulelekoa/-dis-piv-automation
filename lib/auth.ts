import 'server-only'

import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createServerSupabase } from './supabase/server'

/**
 * Server-side authn/authz helpers. Role + applicant linkage live in the auth
 * user's `app_metadata` (tamper-proof — only the service-role key can write it,
 * set during signup). Pages use the redirecting guards; API routes use the
 * boolean checks so they can return a clean 401/403.
 */

export type AppRole = 'admin' | 'candidate'

export function roleOf(user: User | null): AppRole | null {
  const r = user?.app_metadata?.role
  return r === 'admin' || r === 'candidate' ? r : null
}

export function applicantIdOf(user: User | null): string | null {
  const id = user?.app_metadata?.applicant_id
  return typeof id === 'string' ? id : null
}

/** The current authenticated user (revalidated against Supabase), or null. */
export async function getAuthUser(): Promise<User | null> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
}

/** Page guard: require an admin, else send to the admin login. */
export async function requireAdmin(): Promise<User> {
  const user = await getAuthUser()
  if (!user || roleOf(user) !== 'admin') redirect('/admin/login')
  return user
}

/** Page guard: require the admin, or the candidate who owns `applicantId`. */
export async function requireApplicantAccess(applicantId: string): Promise<User> {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (roleOf(user) === 'admin') return user
  if (roleOf(user) === 'candidate' && applicantIdOf(user) === applicantId) return user
  redirect('/login')
}

/** API check: true when the caller is an authenticated admin. */
export async function isAdminRequest(): Promise<boolean> {
  const user = await getAuthUser()
  return !!user && roleOf(user) === 'admin'
}

/** API check: true when the caller is an admin or the candidate who owns `applicantId`. */
export async function canAccessApplicant(applicantId: string): Promise<boolean> {
  const user = await getAuthUser()
  if (!user) return false
  if (roleOf(user) === 'admin') return true
  return roleOf(user) === 'candidate' && applicantIdOf(user) === applicantId
}
