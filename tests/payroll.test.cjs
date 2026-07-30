'use strict'
/** Unit tests — lib/hr/payroll.ts (Unanet parsing, issue detection, fixes, Paycor output). */
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  parseUnanetExport, analyzeRows, sumHours, fixDuplicates, fixNegatives, fixOvertime,
  toPaycorLines, payPeriodEnd,
} = require('../.test-build/payroll.js')
const { SEED_STATE, SAMPLE_UNANET_CSV, SAMPLE_REPORT_TOTAL } = require('../.test-build/data.js')

const REF_MAP = SEED_STATE.employeeRefMap
const CODE_MAP = SEED_STATE.payCodeMap
const EMPLOYEES = SEED_STATE.employees

const row = (over = {}) => ({
  line: 2, employeeRef: 'jkim', name: 'Kim, Jordan', date: '07/20/2026',
  project: 'CMOP-766-OPS', payCode: 'Regular Time', hours: 8, ...over,
})

/** Run a week of REG days for one person, Monday-first. */
function week(ref, hoursPerDay, startLine = 2) {
  const dates = ['07/20/2026', '07/21/2026', '07/22/2026', '07/23/2026', '07/24/2026']
  return hoursPerDay.map((h, i) => row({ line: startLine + i, employeeRef: ref, date: dates[i], hours: h }))
}

test('parseUnanetExport', async t => {
  await t.test('parses the bundled sample export', () => {
    const { rows, errors } = parseUnanetExport(SAMPLE_UNANET_CSV)
    assert.deepEqual(errors, [])
    assert.equal(rows.length, 28)
  })

  await t.test('numbers lines from 2, accounting for the header row', () => {
    const { rows } = parseUnanetExport('Person,Name,Date,Project,Pay Code,Hours\na,b,07/20/2026,p,Regular Time,8')
    assert.equal(rows[0].line, 2)
  })

  await t.test('accepts header aliases and any column order', () => {
    const { rows, errors } = parseUnanetExport(
      'Hours,Employee ID,Charge Code,Employee Name,Work Date,PayCode\n8,jkim,P1,"Kim, Jordan",07/20/2026,Regular Time')
    assert.deepEqual(errors, [])
    assert.deepEqual(rows[0], {
      line: 2, employeeRef: 'jkim', name: 'Kim, Jordan', date: '07/20/2026',
      project: 'P1', payCode: 'Regular Time', hours: 8,
    })
  })

  await t.test('names the missing columns rather than failing silently', () => {
    const { rows, errors } = parseUnanetExport('Person,Name\na,b')
    assert.equal(rows.length, 0)
    assert.match(errors[0], /date/)
    assert.match(errors[0], /hours/)
  })

  await t.test('reports an empty file instead of throwing', () => {
    assert.match(parseUnanetExport('').errors[0], /No data rows/)
  })

  await t.test('skips a non-numeric hours cell and says which line', () => {
    const { rows, errors } = parseUnanetExport(
      'Person,Name,Date,Project,Pay Code,Hours\na,b,07/20/2026,p,Regular Time,eight\nc,d,07/21/2026,p,Regular Time,8')
    assert.equal(rows.length, 1)
    assert.match(errors[0], /Line 2/)
  })

  await t.test('strips thousands separators from hours', () => {
    const { rows } = parseUnanetExport(
      'Person,Name,Date,Project,Pay Code,Hours\na,b,07/20/2026,p,Regular Time,"1,234.50"')
    assert.equal(rows[0].hours, 1234.5)
  })

  await t.test('preserves negative hours for the analyzer to flag', () => {
    const { rows } = parseUnanetExport(
      'Person,Name,Date,Project,Pay Code,Hours\na,b,07/20/2026,p,Regular Time,-4')
    assert.equal(rows[0].hours, -4)
  })
})

test('sumHours', async t => {
  await t.test('totals hours and rounds to cents', () => {
    assert.equal(sumHours([row({ hours: 0.1 }), row({ hours: 0.2 })]), 0.3)
  })

  await t.test('is zero for no rows', () => {
    assert.equal(sumHours([]), 0)
  })

  await t.test('includes negative adjustments', () => {
    assert.equal(sumHours([row({ hours: 8 }), row({ hours: -4 })]), 4)
  })
})

test('analyzeRows — duplicate detection', async t => {
  await t.test('flags identical lines and counts the extra hours', () => {
    const rows = [row({ line: 2 }), row({ line: 3 })]
    const [issue] = analyzeRows(rows, REF_MAP, CODE_MAP).filter(i => i.kind === 'duplicate')
    assert.deepEqual(issue.lines, [2, 3])
    assert.match(issue.detail, /8\.00 extra hours/)
  })

  await t.test('does not flag same-day lines that differ in hours', () => {
    const rows = [row({ line: 2, hours: 8 }), row({ line: 3, hours: 4 })]
    assert.equal(analyzeRows(rows, REF_MAP, CODE_MAP).filter(i => i.kind === 'duplicate').length, 0)
  })

  await t.test('does not flag the same day on different projects', () => {
    const rows = [row({ line: 2 }), row({ line: 3, project: 'OTHER' })]
    assert.equal(analyzeRows(rows, REF_MAP, CODE_MAP).filter(i => i.kind === 'duplicate').length, 0)
  })

  await t.test('groups a triplicate into one issue spanning three lines', () => {
    const rows = [row({ line: 2 }), row({ line: 3 }), row({ line: 4 })]
    const [issue] = analyzeRows(rows, REF_MAP, CODE_MAP).filter(i => i.kind === 'duplicate')
    assert.deepEqual(issue.lines, [2, 3, 4])
    assert.match(issue.detail, /16\.00 extra hours/)
  })
})

test('analyzeRows — employee and pay-code mapping', async t => {
  await t.test('flags a Unanet ref with no Paycor employee', () => {
    const rows = [row({ employeeRef: 'balvarez', name: 'Alvarez, Bob' })]
    const [issue] = analyzeRows(rows, REF_MAP, CODE_MAP).filter(i => i.kind === 'unknownEmployee')
    assert.match(issue.summary, /balvarez/)
  })

  await t.test('groups every line for one unknown ref into a single issue', () => {
    const rows = week('balvarez', [8, 8, 8, 8, 8])
    const found = analyzeRows(rows, REF_MAP, CODE_MAP).filter(i => i.kind === 'unknownEmployee')
    assert.equal(found.length, 1)
    assert.equal(found[0].lines.length, 5)
    assert.match(found[0].detail, /40\.00 h/)
  })

  await t.test('flags a pay code with no Paycor earn code', () => {
    const rows = [row({ payCode: 'Training', hours: 2 })]
    const [issue] = analyzeRows(rows, REF_MAP, CODE_MAP).filter(i => i.kind === 'unmappedCode')
    assert.match(issue.summary, /Training/)
  })

  await t.test('accepts a code once it has been mapped', () => {
    const rows = [row({ payCode: 'Training', hours: 2 })]
    const mapped = { ...CODE_MAP, Training: 'TRN' }
    assert.equal(analyzeRows(rows, REF_MAP, mapped).filter(i => i.kind === 'unmappedCode').length, 0)
  })
})

test('analyzeRows — overtime and negative hours', async t => {
  await t.test('flags a >40h REG week', () => {
    const [issue] = analyzeRows(week('jkim', [9, 9, 9, 9, 8]), REF_MAP, CODE_MAP)
      .filter(i => i.kind === 'otNotSplit')
    assert.match(issue.summary, /44\.00 regular hours/)
    assert.match(issue.detail, /4\.00 h OT/)
  })

  await t.test('leaves an exactly-40h week alone', () => {
    const found = analyzeRows(week('jkim', [8, 8, 8, 8, 8]), REF_MAP, CODE_MAP)
      .filter(i => i.kind === 'otNotSplit')
    assert.equal(found.length, 0)
  })

  await t.test('counts only REG toward the 40h threshold', () => {
    const rows = [...week('jkim', [8, 8, 8, 8, 8]), row({ line: 7, date: '07/25/2026', payCode: 'PTO', hours: 8 })]
    assert.equal(analyzeRows(rows, REF_MAP, CODE_MAP).filter(i => i.kind === 'otNotSplit').length, 0)
  })

  await t.test('does not merge two separate people into one week', () => {
    const rows = [...week('jkim', [8, 8, 8, 8, 8]), ...week('mruiz', [8, 8, 8, 8, 8], 10)]
    assert.equal(analyzeRows(rows, REF_MAP, CODE_MAP).filter(i => i.kind === 'otNotSplit').length, 0)
  })

  await t.test('does not merge two calendar weeks into one', () => {
    const rows = [
      ...week('jkim', [8, 8, 8, 8, 8]),
      row({ line: 10, date: '07/27/2026', hours: 8 }),
      row({ line: 11, date: '07/28/2026', hours: 8 }),
    ]
    assert.equal(analyzeRows(rows, REF_MAP, CODE_MAP).filter(i => i.kind === 'otNotSplit').length, 0)
  })

  await t.test('collects all negative lines into one issue', () => {
    const rows = [row({ line: 2, hours: -4 }), row({ line: 3, hours: -2, date: '07/21/2026' })]
    const found = analyzeRows(rows, REF_MAP, CODE_MAP).filter(i => i.kind === 'negativeHours')
    assert.equal(found.length, 1)
    assert.deepEqual(found[0].lines, [2, 3])
  })

  await t.test('reports no issues for a clean export', () => {
    assert.deepEqual(analyzeRows(week('jkim', [8, 8, 8, 8, 8]), REF_MAP, CODE_MAP), [])
  })
})

test('fixes', async t => {
  await t.test('fixDuplicates keeps the first occurrence only', () => {
    const rows = [row({ line: 2 }), row({ line: 3 }), row({ line: 4, date: '07/21/2026' })]
    const fixed = fixDuplicates(rows)
    assert.equal(fixed.length, 2)
    assert.deepEqual(fixed.map(r => r.line), [2, 4])
  })

  await t.test('fixDuplicates leaves negative adjustments untouched', () => {
    const rows = [row({ line: 2, hours: -4 }), row({ line: 3, hours: -4 })]
    assert.equal(fixDuplicates(rows).length, 2)
  })

  await t.test('fixNegatives drops only the negative lines', () => {
    const rows = [row({ line: 2, hours: 8 }), row({ line: 3, hours: -4 })]
    assert.deepEqual(fixNegatives(rows).map(r => r.hours), [8])
  })

  await t.test('fixNegatives keeps zero-hour lines', () => {
    assert.equal(fixNegatives([row({ hours: 0 })]).length, 1)
  })

  await t.test('fixOvertime splits 44h into 40 REG + 4 OT without changing the total', () => {
    const rows = week('jkim', [9, 9, 9, 9, 8])
    const fixed = fixOvertime(rows, CODE_MAP)
    assert.equal(sumHours(fixed), 44)
    const reg = fixed.filter(r => CODE_MAP[r.payCode] === 'REG')
    const ot = fixed.filter(r => r.payCode === 'Overtime')
    assert.equal(sumHours(reg), 40)
    assert.equal(sumHours(ot), 4)
  })

  await t.test('fixOvertime takes overtime from the last day only when it covers the excess', () => {
    // 44h week, 4h excess — the final 8h day absorbs all of it.
    const fixed = fixOvertime(week('jkim', [9, 9, 9, 9, 8]), CODE_MAP)
    const ot = fixed.filter(r => r.payCode === 'Overtime')
    assert.deepEqual(ot.map(r => r.date), ['07/24/2026'])
    assert.equal(ot[0].hours, 4)
    // The day it came from keeps its remaining regular hours.
    const sameDay = fixed.find(r => r.date === '07/24/2026' && r.payCode === 'Regular Time')
    assert.equal(sameDay.hours, 4)
  })

  await t.test('fixOvertime walks backwards through days until the excess is covered', () => {
    // 60h week, 20h excess — 12h off the last day, then 8h off the day before.
    const fixed = fixOvertime(week('jkim', [12, 12, 12, 12, 12]), CODE_MAP)
    assert.equal(sumHours(fixed), 60)
    // Rows keep their original positions, so compare by date rather than order.
    const ot = Object.fromEntries(
      fixed.filter(r => r.payCode === 'Overtime').map(r => [r.date, r.hours]))
    assert.deepEqual(ot, { '07/24/2026': 12, '07/23/2026': 8 })
    assert.equal(sumHours(fixed.filter(r => r.payCode === 'Regular Time')), 40)
  })

  await t.test('fixOvertime removes a day entirely consumed by the split', () => {
    // 48h week, 8h excess — the final day is exactly 8h, so no REG remains on it.
    const fixed = fixOvertime(week('jkim', [10, 10, 10, 10, 8]), CODE_MAP)
    assert.equal(sumHours(fixed), 48)
    assert.equal(sumHours(fixed.filter(r => r.payCode === 'Overtime')), 8)
    assert.equal(fixed.filter(r => r.date === '07/24/2026' && r.payCode === 'Regular Time').length, 0)
  })

  await t.test('fixOvertime is a no-op on a compliant week', () => {
    const rows = week('jkim', [8, 8, 8, 8, 8])
    assert.deepEqual(fixOvertime(rows, CODE_MAP), rows)
  })

  await t.test('fixOvertime reuses the mapped OT code name', () => {
    const custom = { 'Regular Time': 'REG', 'OT Premium': 'OT' }
    const fixed = fixOvertime(week('jkim', [9, 9, 9, 9, 8]), custom)
    assert.ok(fixed.some(r => r.payCode === 'OT Premium'))
  })
})

test('toPaycorLines', async t => {
  await t.test('aggregates a week into one line per employee and earn code', () => {
    const lines = toPaycorLines(week('jkim', [8, 8, 8, 8, 8]), REF_MAP, CODE_MAP, EMPLOYEES)
    assert.deepEqual(lines, [{ paycorId: '10241', employeeName: 'Kim, Jordan', earnCode: 'REG', hours: 40 }])
  })

  await t.test('separates earn codes for the same employee', () => {
    const rows = [...week('jkim', [8, 8, 8, 8, 8]), row({ line: 7, date: '07/25/2026', payCode: 'PTO', hours: 8 })]
    const lines = toPaycorLines(rows, REF_MAP, CODE_MAP, EMPLOYEES)
    assert.deepEqual(lines.map(l => [l.earnCode, l.hours]), [['REG', 40], ['PTO', 8]])
  })

  await t.test('uses the roster name, not the exported one', () => {
    const rows = [row({ employeeRef: 'ralvarez', name: 'Alvarez, Bob' })]
    assert.equal(toPaycorLines(rows, REF_MAP, CODE_MAP, EMPLOYEES)[0].employeeName, 'Alvarez, Robert')
  })

  await t.test('omits unmapped employees and codes rather than guessing', () => {
    const rows = [row({ employeeRef: 'nobody' }), row({ line: 3, payCode: 'Training' })]
    assert.deepEqual(toPaycorLines(rows, REF_MAP, CODE_MAP, EMPLOYEES), [])
  })

  await t.test('sorts by employee name, then REG before OT', () => {
    const rows = [
      ...week('mruiz', [8, 8, 8, 8, 8], 10),
      row({ line: 20, payCode: 'Overtime', hours: 4 }),
      ...week('jkim', [8, 8, 8, 8, 8]),
    ]
    const lines = toPaycorLines(rows, REF_MAP, CODE_MAP, EMPLOYEES)
    assert.deepEqual(lines.map(l => `${l.employeeName}:${l.earnCode}`),
      ['Kim, Jordan:REG', 'Kim, Jordan:OT', 'Ruiz, Marisol:REG'])
  })
})

test('payPeriodEnd', async t => {
  await t.test('returns the latest date regardless of row order', () => {
    const rows = [row({ date: '07/24/2026' }), row({ date: '07/20/2026' })]
    assert.equal(payPeriodEnd(rows), '07/24/2026')
  })

  await t.test('is empty for no rows', () => {
    assert.equal(payPeriodEnd([]), '')
  })
})

test('end-to-end: the sample export reconciles to the Unanet report', async t => {
  await t.test('raw export overstates hours and carries five issue kinds', () => {
    const { rows } = parseUnanetExport(SAMPLE_UNANET_CSV)
    assert.equal(sumHours(rows), 210)
    const kinds = new Set(analyzeRows(rows, REF_MAP, CODE_MAP).map(i => i.kind))
    assert.deepEqual([...kinds].sort(),
      ['duplicate', 'negativeHours', 'otNotSplit', 'unknownEmployee', 'unmappedCode'])
  })

  await t.test('applying every fix lands exactly on the report total', () => {
    const { rows } = parseUnanetExport(SAMPLE_UNANET_CSV)
    const refMap = { ...REF_MAP, balvarez: '10305' }
    const codeMap = { ...CODE_MAP, Training: 'TRN' }
    const fixed = fixOvertime(fixNegatives(fixDuplicates(rows)), codeMap)

    assert.equal(sumHours(fixed), SAMPLE_REPORT_TOTAL)
    assert.deepEqual(analyzeRows(fixed, refMap, codeMap), [])

    const lines = toPaycorLines(fixed, refMap, codeMap, EMPLOYEES)
    assert.equal(lines.reduce((t, l) => t + l.hours, 0), SAMPLE_REPORT_TOTAL)
    assert.deepEqual(lines.map(l => `${l.employeeName}:${l.earnCode}:${l.hours}`), [
      'Alvarez, Robert:REG:40',
      'Kim, Jordan:REG:40',
      'Nguyen, Tessa:REG:32',
      'Nguyen, Tessa:PTO:8',
      'Okafor, Daniel:REG:40',
      'Okafor, Daniel:TRN:2',
      'Ruiz, Marisol:REG:40',
      'Ruiz, Marisol:OT:4',
    ])
  })

  await t.test('the pay period ends on the last day of the sample week', () => {
    const { rows } = parseUnanetExport(SAMPLE_UNANET_CSV)
    assert.equal(payPeriodEnd(rows), '07/24/2026')
  })
})
