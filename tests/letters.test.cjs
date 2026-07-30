'use strict'
/** Unit tests — lib/hr/letters.ts (templates, money/date formatting, text + Word output). */
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  fieldsFor, formatMoney, buildLetter, letterToText, letterToWordHtml, lettersToWordHtml,
  todayLongDate, OFFER_FIELDS, INCREASE_FIELDS,
} = require('../.test-build/letters.js')

const OFFER = {
  candidateName: 'Priya Shah', position: 'Pharmacy Technician', payRate: '21.50',
  payUnit: 'per hour', startDate: '08/10/2026', shift: 'Day (6:00a-2:30p)',
  employmentType: 'Full-time', worksite: 'Tucson, AZ', contractName: 'VA CMOP - Tucson',
  responseBy: '08/03/2026', signerName: 'Jordan Ellis', signerTitle: 'HR Manager',
}

const RAISE = {
  employeeName: 'Robert Alvarez', position: 'Supply Technician',
  contractName: 'DHA Medical Logistics', currentRate: '19.75', newRate: '21.25',
  payUnit: 'per hour', effectiveDate: '08/16/2026', reason: 'Merit increase',
  signerName: 'Jordan Ellis', signerTitle: 'HR Manager',
}

test('fieldsFor', async t => {
  await t.test('returns the offer fields for offers', () => {
    assert.equal(fieldsFor('offer'), OFFER_FIELDS)
  })

  await t.test('returns the increase fields for increases', () => {
    assert.equal(fieldsFor('increase'), INCREASE_FIELDS)
  })

  await t.test('every field has a unique key', () => {
    for (const fields of [OFFER_FIELDS, INCREASE_FIELDS]) {
      const keys = fields.map(f => f.key)
      assert.equal(new Set(keys).size, keys.length)
    }
  })

  await t.test('select fields always offer options', () => {
    for (const f of [...OFFER_FIELDS, ...INCREASE_FIELDS]) {
      if (f.type === 'select') assert.ok(f.options && f.options.length > 0, f.key)
    }
  })

  await t.test('batch aliases are lowercase so header matching works', () => {
    for (const f of [...OFFER_FIELDS, ...INCREASE_FIELDS]) {
      for (const a of f.aliases ?? []) assert.equal(a, a.toLowerCase(), `${f.key}: ${a}`)
    }
  })
})

test('formatMoney', async t => {
  await t.test('formats an hourly rate as currency plus unit', () => {
    assert.equal(formatMoney('21.5', 'per hour'), '$21.50 per hour')
  })

  await t.test('adds thousands separators for salaries', () => {
    assert.equal(formatMoney('68000', 'per year'), '$68,000.00 per year')
  })

  await t.test('tolerates a leading dollar sign and commas', () => {
    assert.equal(formatMoney('$1,234.5', 'per hour'), '$1,234.50 per hour')
  })

  await t.test('defaults the unit when none is given', () => {
    assert.equal(formatMoney('20', ''), '$20.00 per hour')
  })

  await t.test('returns the raw input unchanged when it is not a number', () => {
    assert.equal(formatMoney('TBD', 'per hour'), 'TBD')
  })

  await t.test('returns the raw input for zero or negative amounts', () => {
    assert.equal(formatMoney('0', 'per hour'), '0')
    assert.equal(formatMoney('-5', 'per hour'), '-5')
  })
})

test('buildLetter — offer', async t => {
  const doc = buildLetter('offer', OFFER)

  await t.test('addresses the candidate by first name', () => {
    assert.equal(doc.paragraphs[0], 'Dear Priya,')
  })

  await t.test('names the position in the subject line', () => {
    assert.match(doc.subject, /Offer of Employment/)
    assert.match(doc.subject, /Pharmacy Technician/)
  })

  await t.test('states the rate and a long-form start date', () => {
    assert.match(doc.paragraphs[2], /\$21\.50 per hour/)
    assert.match(doc.paragraphs[2], /August 10, 2026/)
  })

  await t.test('states the response deadline in long form', () => {
    assert.match(doc.paragraphs[4], /August 3, 2026/)
  })

  await t.test('keeps the at-will and contingency language', () => {
    assert.match(doc.paragraphs[3], /contingent/)
    assert.match(doc.paragraphs[3], /at-will/)
    assert.match(doc.paragraphs[3], /I-9/)
  })

  await t.test('carries the signer through to the closing', () => {
    assert.deepEqual(doc.closing, { signerName: 'Jordan Ellis', signerTitle: 'HR Manager' })
  })

  await t.test('dates the letter today', () => {
    assert.equal(doc.date, todayLongDate())
  })

  await t.test('shows a blank placeholder rather than "undefined" for missing fields', () => {
    const bare = buildLetter('offer', {})
    assert.equal(bare.recipientName, 'Candidate')
    assert.ok(!JSON.stringify(bare).includes('undefined'))
    assert.match(bare.subject, /________/)
  })

  await t.test('leaves an unparseable date as typed instead of inventing one', () => {
    const odd = buildLetter('offer', { ...OFFER, startDate: 'ASAP' })
    assert.match(odd.paragraphs[2], /ASAP/)
  })

  await t.test('handles a single-word name', () => {
    assert.equal(buildLetter('offer', { ...OFFER, candidateName: 'Cher' }).paragraphs[0], 'Dear Cher,')
  })
})

test('buildLetter — salary increase', async t => {
  const doc = buildLetter('increase', RAISE)

  await t.test('states both the old and new rate', () => {
    assert.match(doc.paragraphs[2], /\$19\.75 per hour/)
    assert.match(doc.paragraphs[2], /\$21\.25 per hour/)
  })

  await t.test('uses the effective date in subject and body', () => {
    assert.match(doc.subject, /Compensation Adjustment/)
    assert.match(doc.subject, /08\/16\/2026/)
    assert.match(doc.paragraphs[2], /August 16, 2026/)
  })

  await t.test('mentions the reason in the opening paragraph', () => {
    assert.match(doc.paragraphs[1], /merit increase/i)
  })

  await t.test('confirms other terms are unchanged', () => {
    assert.match(doc.paragraphs[2], /remain unchanged/)
  })

  await t.test('promotion with a new title changes the subject and wording', () => {
    const promo = buildLetter('increase', { ...RAISE, reason: 'Promotion', newTitle: 'Warehouse Lead' })
    assert.match(promo.subject, /Promotion and Compensation Adjustment/)
    assert.match(promo.paragraphs[1], /promote you from Supply Technician to Warehouse Lead/)
  })

  await t.test('promotion without a new title falls back to the plain wording', () => {
    const promo = buildLetter('increase', { ...RAISE, reason: 'Promotion' })
    assert.match(promo.subject, /^Compensation Adjustment/)
    assert.doesNotMatch(promo.paragraphs[1], /promote you from/)
  })

  await t.test('supports salaried increases', () => {
    const salaried = buildLetter('increase', {
      ...RAISE, payUnit: 'per year', currentRate: '68000', newRate: '72000',
    })
    assert.match(salaried.paragraphs[2], /\$68,000\.00 per year/)
    assert.match(salaried.paragraphs[2], /\$72,000\.00 per year/)
  })
})

test('letterToText', async t => {
  const text = letterToText(buildLetter('offer', OFFER))

  await t.test('includes the RE line, body and signer', () => {
    assert.match(text, /RE: Offer of Employment/)
    assert.match(text, /Dear Priya,/)
    assert.match(text, /Jordan Ellis/)
  })

  await t.test('ends with an acceptance signature block', () => {
    assert.match(text, /Accepted and agreed:/)
    assert.match(text, /Signature: _+\s+Date: _+/)
  })

  await t.test('separates paragraphs with blank lines', () => {
    assert.match(text, /Dear Priya,\n\n/)
  })
})

test('letterToWordHtml', async t => {
  const html = letterToWordHtml(buildLetter('offer', OFFER), true)

  await t.test('emits a Word-namespaced document with the subject as title', () => {
    assert.match(html, /xmlns:w="urn:schemas-microsoft-com:office:word"/)
    assert.match(html, /<title>Offer of Employment/)
  })

  await t.test('carries the DIS letterhead', () => {
    assert.match(html, /DIS Consulting/)
    assert.match(html, /Human Resources/)
  })

  await t.test('includes the signature block when asked', () => {
    assert.match(html, /Accepted and agreed:/)
  })

  await t.test('omits the signature block when not asked', () => {
    assert.doesNotMatch(letterToWordHtml(buildLetter('offer', OFFER), false), /Accepted and agreed:/)
  })

  await t.test('escapes HTML metacharacters from user input', () => {
    const doc = buildLetter('offer', { ...OFFER, candidateName: 'A <script>alert(1)</script> B' })
    const out = letterToWordHtml(doc, true)
    assert.doesNotMatch(out, /<script>/)
    assert.match(out, /&lt;script&gt;/)
  })

  await t.test('escapes ampersands without double-escaping the entities it creates', () => {
    const doc = buildLetter('offer', { ...OFFER, worksite: 'Ben & Jerry' })
    const out = letterToWordHtml(doc, true)
    assert.match(out, /Ben &amp; Jerry/)
    assert.doesNotMatch(out, /&amp;amp;/)
  })
})

test('lettersToWordHtml', async t => {
  const docs = [buildLetter('offer', OFFER), buildLetter('increase', RAISE)]
  const html = lettersToWordHtml(docs, true)

  await t.test('produces a single document containing every letter', () => {
    assert.equal(html.match(/<html/g).length, 1)
    assert.match(html, /Priya/)
    assert.match(html, /Robert/)
  })

  await t.test('page-breaks between letters but not before the first', () => {
    assert.equal(html.match(/page-break-before:always/g).length, docs.length - 1)
  })

  await t.test('handles a single-letter batch with no page break', () => {
    assert.equal((lettersToWordHtml([docs[0]], true).match(/page-break-before/g) ?? []).length, 0)
  })
})
