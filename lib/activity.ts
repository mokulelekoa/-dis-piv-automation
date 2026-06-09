import 'server-only'

import { supabase } from './supabase'

/**
 * Login/activity facts pulled from Supabase Auth, keyed by the applicant_id we
 * stamp into each candidate's app_metadata at invite time. Lets the admin see
 * who has actually signed in vs. who was invited but never showed up. Auth is
 * the source of truth here — we don't mirror sign-in timestamps into our table.
 */
export interface LoginActivity {
  email: string | null
  lastSignInAt: string | null
  createdAt: string | null
  emailConfirmedAt: string | null
  invitedAt: string | null
}

export async function loginActivityByApplicant(): Promise<Map<string, LoginActivity>> {
  const map = new Map<string, LoginActivity>()
  const sb = supabase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) break
    for (const u of data.users) {
      const aid = u.app_metadata?.applicant_id
      if (typeof aid === 'string') {
        map.set(aid, {
          email: u.email ?? null,
          lastSignInAt: u.last_sign_in_at ?? null,
          createdAt: u.created_at ?? null,
          emailConfirmedAt: u.email_confirmed_at ?? null,
          invitedAt: u.invited_at ?? null,
        })
      }
    }
    if (data.users.length < 200) break
  }
  return map
}

/** Single-applicant lookup (lists + filters; fine at admin-dashboard scale). */
export async function loginActivityForApplicant(applicantId: string): Promise<LoginActivity | null> {
  return (await loginActivityByApplicant()).get(applicantId) ?? null
}

/**
 * Delete the auth account linked to an applicant (matched on the applicant_id we
 * stamp into app_metadata), freeing the email for a future re-invite. No-op if no
 * such account exists (e.g. a candidate who was provisioned but never invited).
 */
export async function deleteAuthUserForApplicant(applicantId: string): Promise<void> {
  const sb = supabase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return
    const match = data.users.find(u => u.app_metadata?.applicant_id === applicantId)
    if (match) {
      await sb.auth.admin.deleteUser(match.id)
      return
    }
    if (data.users.length < 200) return
  }
}

/** Compact relative time ("just now", "5m ago", "3d ago", or a date). null → "Never". */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'Never'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'Never'
  const secs = Math.round((Date.now() - then) / 1000)
  if (secs < 45) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.round(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return new Date(iso).toLocaleDateString()
}
