import 'server-only'

import { randomBytes } from 'crypto'
import { supabase } from './supabase'

/**
 * Invite codes that gate signup. An admin generates one from the dashboard; the
 * recipient redeems it at /signup with the exact email it was issued to. Codes
 * are single-use (used_at) and expiring (expires_at). All access is through the
 * service-role client, so the table needs no RLS.
 */

export type InviteRole = 'admin' | 'candidate'

export interface Invite {
  code: string
  email: string
  role: InviteRole
  applicant_id: string | null
  invited_by: string | null
  used_at: string | null
  expires_at: string
  created_at: string
}

const INVITES = 'invites'
const TTL_DAYS = 14

/** Unguessable, human-conveyable single-use code, e.g. "CMOP-1A2B-3C4D-5E6F-7G8H". */
function generateCode(): string {
  const hex = randomBytes(8).toString('hex').toUpperCase() // 16 chars / 64 bits
  const groups = hex.match(/.{4}/g) ?? [hex]
  return `CMOP-${groups.join('-')}`
}

export async function createInvite(input: {
  email: string
  role: InviteRole
  applicantId?: string | null
  invitedBy?: string | null
}): Promise<Invite> {
  const row = {
    code: generateCode(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    applicant_id: input.applicantId ?? null,
    invited_by: input.invitedBy ?? null,
    used_at: null,
    expires_at: new Date(Date.now() + TTL_DAYS * 86_400_000).toISOString(),
  }
  const { data, error } = await supabase().from(INVITES).insert(row).select().single()
  if (error) throw new Error(`invite create failed: ${error.message}`)
  return data as Invite
}

export type InviteCheck =
  | { ok: true; invite: Invite }
  | { ok: false; reason: string }

/** Validate a code for a given email at signup time. Does not consume it. */
export async function validateInvite(code: string, email: string): Promise<InviteCheck> {
  const { data, error } = await supabase().from(INVITES).select('*').eq('code', code.trim()).maybeSingle()
  if (error) throw new Error(`invite lookup failed: ${error.message}`)
  if (!data) return { ok: false, reason: 'That access code was not found. Check your invitation.' }

  const invite = data as Invite
  if (invite.used_at) return { ok: false, reason: 'That access code has already been used.' }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'That access code has expired — ask your coordinator for a new invite.' }
  }
  if (invite.email !== email.trim().toLowerCase()) {
    return { ok: false, reason: 'This access code was issued to a different email address.' }
  }
  return { ok: true, invite }
}

/** Mark a code consumed. The `is used_at null` guard keeps it single-use under races. */
export async function consumeInvite(code: string): Promise<void> {
  const { error } = await supabase()
    .from(INVITES)
    .update({ used_at: new Date().toISOString() })
    .eq('code', code.trim())
    .is('used_at', null)
  if (error) throw new Error(`invite consume failed: ${error.message}`)
}
