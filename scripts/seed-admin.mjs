// Bootstrap the first admin. There is no open admin signup — this script seeds
// one coordinator, and from there admins invite other admins from the dashboard.
//
// You supply the credentials (the script never invents them). Either put them in
// .env.local or pass them as environment variables:
//
//   $env:SEED_ADMIN_EMAIL="you@disconsulting.com"
//   $env:SEED_ADMIN_PASSWORD="a-strong-password"
//   node scripts/seed-admin.mjs
//
// Safe to re-run: if the user already exists, it just (re)stamps the admin role.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

let envFile = ''
try {
  envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
} catch {
  // No .env.local (e.g. on a deploy host) — rely on real environment variables.
}
const env = Object.fromEntries(
  envFile
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)

const url = process.env.SUPABASE_URL || env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY
const email = (process.env.SEED_ADMIN_EMAIL || env.SEED_ADMIN_EMAIL || '').trim().toLowerCase()
const password = process.env.SEED_ADMIN_PASSWORD || env.SEED_ADMIN_PASSWORD || ''

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (check .env.local).')
  process.exit(1)
}
if (!email || !password) {
  console.error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (env vars or .env.local) and re-run.')
  process.exit(1)
}
if (password.length < 8) {
  console.error('SEED_ADMIN_PASSWORD must be at least 8 characters.')
  process.exit(1)
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } })

async function findUserByEmail(addr) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    const hit = data.users.find(u => (u.email ?? '').toLowerCase() === addr)
    if (hit) return hit
    if (data.users.length < 200) break
  }
  return null
}

const { data: created, error: createErr } = await sb.auth.admin.createUser({
  email,
  password,
  email_confirm: true, // seeded admin skips the confirmation email
  app_metadata: { role: 'admin' },
})

if (!createErr && created?.user) {
  console.log(`ADMIN CREATED: ${email}`)
  process.exit(0)
}

// Already exists (or a transient duplicate) — make sure they're a confirmed admin.
if (createErr && /registered|exist|already/i.test(createErr.message)) {
  const existing = await findUserByEmail(email)
  if (!existing) {
    console.error(`Create said "${createErr.message}" but the user wasn't found. Aborting.`)
    process.exit(1)
  }
  const { error: updErr } = await sb.auth.admin.updateUserById(existing.id, {
    app_metadata: { ...existing.app_metadata, role: 'admin' },
  })
  if (updErr) {
    console.error(`Failed to stamp admin role: ${updErr.message}`)
    process.exit(1)
  }
  console.log(`ADMIN ROLE CONFIRMED on existing user: ${email}`)
  process.exit(0)
}

console.error(`Could not seed admin: ${createErr?.message ?? 'unknown error'}`)
process.exit(1)
