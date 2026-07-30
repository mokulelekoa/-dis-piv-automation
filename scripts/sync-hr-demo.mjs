#!/usr/bin/env node
/**
 * Copies the HR Command Center sources into the standalone deployable at
 * apps/hr-demo. That app is what Vercel builds when its Root Directory is set
 * to apps/hr-demo — it ships ONLY the /hr tools, with no CMOP routes and no
 * Supabase environment variables required.
 *
 * The copy is verbatim: app/hr and lib/hr are portable because the only
 * environment-specific value (where "Candidate Packets" links to) lives in
 * lib/hr/links.ts and is driven by NEXT_PUBLIC_PACKETS_URL.
 *
 * Run after changing anything under app/hr or lib/hr:
 *   node scripts/sync-hr-demo.mjs
 * Verify nothing drifted (CI-friendly, non-zero exit on difference):
 *   node scripts/sync-hr-demo.mjs --check
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const demo = join(root, 'apps', 'hr-demo')
const check = process.argv.includes('--check')

/** Directories mirrored 1:1 from the main app into the standalone app. */
const MIRRORED = [
  ['app/hr', 'app/hr'],
  ['lib/hr', 'lib/hr'],
  ['public/dis-logo.png', 'public/dis-logo.png'],
  ['app/globals.css', 'app/globals.css'],
  ['app/favicon.ico', 'app/favicon.ico'],
]

/** Every file below `dir`, as paths relative to `base`. Accumulates into `out`. */
function filesUnder(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out
  if (statSync(dir).isFile()) {
    out.push(relative(base, dir))
    return out
  }
  for (const entry of readdirSync(dir)) filesUnder(join(dir, entry), base, out)
  return out
}

const drifted = []

for (const [from, to] of MIRRORED) {
  const src = join(root, from)
  const dest = join(demo, to)
  if (!existsSync(src)) throw new Error(`Missing source: ${from}`)

  if (check) {
    if (statSync(src).isFile()) {
      if (!existsSync(dest) || !readFileSync(src).equals(readFileSync(dest))) {
        drifted.push(`${to} (differs or missing)`)
      }
      continue
    }

    const sourceNames = filesUnder(src)
    for (const name of sourceNames) {
      const a = join(src, name)
      const b = join(dest, name)
      if (!existsSync(b)) drifted.push(`${join(to, name)} (missing from copy)`)
      else if (!readFileSync(a).equals(readFileSync(b))) drifted.push(`${join(to, name)} (differs)`)
    }

    // A source file that was deleted or renamed leaves a stale copy behind;
    // syncing would remove it, so the check has to notice it too.
    const expected = new Set(sourceNames)
    for (const name of filesUnder(dest)) {
      if (!expected.has(name)) drifted.push(`${join(to, name)} (no longer in source)`)
    }
    continue
  }

  mkdirSync(dirname(dest), { recursive: true })
  if (statSync(src).isDirectory()) rmSync(dest, { recursive: true, force: true })
  cpSync(src, dest, { recursive: true })
}

if (check) {
  if (drifted.length > 0) {
    console.error('apps/hr-demo is out of date. Run: node scripts/sync-hr-demo.mjs')
    for (const f of drifted) console.error(`  - ${f}`)
    process.exit(1)
  }
  console.log('apps/hr-demo is in sync.')
} else {
  console.log(`Synced ${MIRRORED.length} path(s) into apps/hr-demo.`)
}
