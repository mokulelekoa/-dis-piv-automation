// Drives the running dev server with a headless browser and captures real
// screenshots for the guided demo at /demo.html. Run while `npm run dev` is up.
//   node scripts/capture-demo.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(ROOT, 'public', 'demo')
mkdirSync(OUT, { recursive: true })

const BASE = process.env.DEMO_BASE ?? 'http://localhost:3000'
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'jdudla@menehune.io'
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'test9999'

const shot = async (page, name) => {
  await page.waitForTimeout(600)
  await page.screenshot({ path: join(OUT, `${name}.png`) })
  console.log('captured', name)
}

const run = async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()

  // 1) Admin login
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' })
  await shot(page, '01-login')

  await page.fill('input[type=email]', EMAIL)
  await page.fill('input[type=password]', PASSWORD)
  await shot(page, '02-login-filled')
  await page.click('button[type=submit]')
  await page.waitForURL('**/admin', { timeout: 20000 })
  await page.waitForLoadState('networkidle')

  // 2) Admin dashboard (badge + last login + credential packet columns)
  await shot(page, '03-admin-dashboard')

  // 3) Invite form — opened and filled, but NOT submitted (avoid a real email)
  const inviteBtn = page.getByRole('button', { name: /invite candidate/i })
  if (await inviteBtn.count()) {
    await inviteBtn.first().click()
    await page.waitForTimeout(400)
    const byLabel = async (re, val) => {
      const el = page.locator('label', { hasText: re }).locator('input,select')
      if (await el.count()) await el.first().fill(val).catch(() => {})
    }
    await byLabel(/first name/i, 'Jordan')
    await byLabel(/last name/i, 'Avery')
    await page.locator('input[type=email]').fill('jordan.avery@example.com').catch(() => {})
    await byLabel(/station/i, '766')
    await shot(page, '04-invite-form')
    // Close without submitting.
    const cancel = page.getByRole('button', { name: /cancel/i })
    if (await cancel.count()) await cancel.first().click().catch(() => {})
  }

  // 4) Applicant detail (first candidate row)
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  const detailHref = await page.locator('a[href^="/admin/applicants/"]').first().getAttribute('href').catch(() => null)
  let applicantId = null
  if (detailHref) {
    applicantId = detailHref.split('/').pop()
    await page.goto(`${BASE}${detailHref}`, { waitUntil: 'networkidle' })
    await shot(page, '05-applicant-detail')
  }

  // 5) Candidate portal + questionnaire (admins can view any applicant)
  if (applicantId) {
    await page.goto(`${BASE}/applicant/${applicantId}`, { waitUntil: 'networkidle' })
    await shot(page, '06-candidate-portal')
    await page.goto(`${BASE}/applicant/${applicantId}/questionnaire`, { waitUntil: 'networkidle' })
    await shot(page, '07-questionnaire')
  }

  await browser.close()
  console.log('DONE')
}

run().catch(e => { console.error(e); process.exit(1) })
