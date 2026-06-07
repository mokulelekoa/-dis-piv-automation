// One-off provisioning: creates the applicants table (via direct Postgres) and
// the private Storage buckets (via the service key). Safe to re-run.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)

const DB_PASSWORD = process.argv[2]
const ref = new URL(env.SUPABASE_URL).host.split('.')[0]

const SQL = `
create table if not exists public.applicants (
  id uuid primary key, email text, status text, data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists applicants_updated_at_idx on public.applicants (updated_at desc);
`

async function makeTable() {
  const hosts = [
    `db.${ref}.supabase.co`,
    `aws-0-us-east-1.pooler.supabase.com`,
    `aws-0-us-east-2.pooler.supabase.com`,
    `aws-0-us-west-1.pooler.supabase.com`,
  ]
  for (const host of hosts) {
    const isPooler = host.includes('pooler')
    const client = new pg.Client({
      host, port: isPooler ? 5432 : 5432,
      user: isPooler ? `postgres.${ref}` : 'postgres',
      password: DB_PASSWORD, database: 'postgres',
      ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000,
    })
    try {
      await client.connect()
      await client.query(SQL)
      await client.end()
      console.log(`TABLE OK via ${host}`)
      return true
    } catch (e) {
      console.log(`  ${host} -> ${e.message}`)
      try { await client.end() } catch {}
    }
  }
  return false
}

async function makeBuckets() {
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  for (const id of ['forms', 'photos']) {
    const { error } = await sb.storage.createBucket(id, { public: false })
    if (error && !/exist/i.test(error.message)) console.log(`BUCKET ${id} -> ${error.message}`)
    else console.log(`BUCKET ${id} OK`)
  }
}

const tableOk = await makeTable()
await makeBuckets()
if (!tableOk) {
  console.log('\nTABLE NOT CREATED — run supabase/schema.sql in the Supabase SQL editor.')
  process.exit(1)
}
console.log('\nDONE')
