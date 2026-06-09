// End-to-end check of the email-link → /auth/callback → /reset-password flow,
// without sending a real email. Mints a real OTP via the admin generateLink API,
// then hits the running dev server's callback exactly as the email button would.
//   node scripts/test-callback.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const BASE = process.env.TEST_BASE ?? 'http://localhost:3000'
const EMAIL = `jdudla+cbtest_${Date.now()}@menehune.io`

// Read service-role creds straight from .env.local (never printed).
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, key, { auth: { persistSession: false } })

const redirectTo = `${BASE}/auth/callback?next=/reset-password`

async function probe(label, type, hashedToken) {
  // Build the link exactly as the template does: RedirectTo + token_hash + type.
  const link = `${redirectTo}&token_hash=${hashedToken}&type=${type}`
  const res = await fetch(link, { redirect: 'manual' })
  const location = res.headers.get('location')
  const ok = res.status === 303 && location?.endsWith('/reset-password')
  console.log(`${ok ? 'PASS' : 'FAIL'} [${label}] status=${res.status} -> ${location}`)
  return ok
}

let userId
try {
  // 1) INVITE token (this also creates the auth user).
  const inv = await admin.auth.admin.generateLink({ type: 'invite', email: EMAIL, options: { redirectTo } })
  if (inv.error) throw new Error(`generateLink invite: ${inv.error.message}`)
  userId = inv.data.user?.id
  await probe('invite', 'invite', inv.data.properties.hashed_token)

  // 2) RECOVERY token for the same (now-existing) user.
  const rec = await admin.auth.admin.generateLink({ type: 'recovery', email: EMAIL, options: { redirectTo } })
  if (rec.error) throw new Error(`generateLink recovery: ${rec.error.message}`)
  await probe('recovery', 'recovery', rec.data.properties.hashed_token)
} finally {
  // 3) Clean up the throwaway auth user so no orphan is left behind.
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId)
    console.log(error ? `cleanup FAILED: ${error.message}` : `cleanup ok (deleted ${EMAIL})`)
  }
}
