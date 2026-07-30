'use strict'
/**
 * Unit tests — lib/hr/data.ts (seed integrity).
 *
 * The seed is what every demo runs on, and the Payroll Bridge walkthrough only
 * lands on "Clean and balanced" if the sample export's arithmetic is exact. These
 * guard the invariants the UI quietly assumes.
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  SEED_CONTRACTS, SEED_EMPLOYEES, SEED_STATE, SEED_PAY_CODE_MAP, PAYCOR_EARN_CODES,
  SAMPLE_UNANET_CSV, SAMPLE_REPORT_TOTAL,
} = require('../.test-build/data.js')
const { parseUnanetExport, sumHours } = require('../.test-build/payroll.js')

test('contracts', async t => {
  await t.test('ids are unique', () => {
    const ids = SEED_CONTRACTS.map(c => c.id)
    assert.equal(new Set(ids).size, ids.length)
  })

  await t.test('every contract has a code, client, location and colour', () => {
    for (const c of SEED_CONTRACTS) {
      assert.ok(c.code, c.id)
      assert.ok(c.client, c.id)
      assert.ok(c.location, c.id)
      assert.match(c.color, /^#[0-9a-f]{6}$/i, c.id)
    }
  })

  await t.test('every contract offers at least one position with a positive rate', () => {
    for (const c of SEED_CONTRACTS) {
      assert.ok(c.positions.length > 0, c.id)
      for (const p of c.positions) {
        assert.ok(p.defaultRate > 0, `${c.id}/${p.title}`)
        assert.ok(['Hourly', 'Salary'].includes(p.payType))
        assert.ok(['Non-exempt', 'Exempt'].includes(p.flsa))
      }
    }
  })

  await t.test('salaried positions are exempt and hourly ones are not', () => {
    for (const c of SEED_CONTRACTS) {
      for (const p of c.positions) {
        if (p.payType === 'Salary') assert.equal(p.flsa, 'Exempt', `${c.id}/${p.title}`)
        else assert.equal(p.flsa, 'Non-exempt', `${c.id}/${p.title}`)
      }
    }
  })

  await t.test('position titles are unique within a contract', () => {
    for (const c of SEED_CONTRACTS) {
      const titles = c.positions.map(p => p.title)
      assert.equal(new Set(titles).size, titles.length, c.id)
    }
  })

  await t.test('every contract declares at least one Unanet project', () => {
    for (const c of SEED_CONTRACTS) assert.ok(c.unanetProjects.length > 0, c.id)
  })
})

test('employees', async t => {
  await t.test('ids and Paycor numbers are unique', () => {
    for (const key of ['id', 'paycorId']) {
      const values = SEED_EMPLOYEES.map(e => e[key])
      assert.equal(new Set(values).size, values.length, key)
    }
  })

  await t.test('every employee belongs to a real contract', () => {
    const ids = new Set(SEED_CONTRACTS.map(c => c.id))
    for (const e of SEED_EMPLOYEES) assert.ok(ids.has(e.contractId), e.id)
  })

  await t.test('every position exists on that employee\'s contract', () => {
    for (const e of SEED_EMPLOYEES) {
      const c = SEED_CONTRACTS.find(x => x.id === e.contractId)
      assert.ok(c.positions.some(p => p.title === e.position), `${e.id}: ${e.position}`)
    }
  })

  await t.test('pay type and FLSA match the contract position', () => {
    for (const e of SEED_EMPLOYEES) {
      const c = SEED_CONTRACTS.find(x => x.id === e.contractId)
      const p = c.positions.find(p => p.title === e.position)
      assert.equal(e.payType, p.payType, e.id)
      assert.equal(e.flsa, p.flsa, e.id)
    }
  })

  await t.test('dates are MM/DD/YYYY and SSNs are four digits', () => {
    for (const e of SEED_EMPLOYEES) {
      assert.match(e.dob, /^\d{2}\/\d{2}\/\d{4}$/, e.id)
      assert.match(e.startDate, /^\d{2}\/\d{2}\/\d{4}$/, e.id)
      assert.match(e.ssnLast4, /^\d{4}$/, e.id)
    }
  })

  await t.test('every employee carries both sync flags', () => {
    for (const e of SEED_EMPLOYEES) {
      assert.equal(typeof e.sync.paycor.done, 'boolean', e.id)
      assert.equal(typeof e.sync.employeeNavigator.done, 'boolean', e.id)
    }
  })

  await t.test('sample data uses example.com addresses, never real ones', () => {
    for (const e of SEED_EMPLOYEES) assert.match(e.email, /@example\.com$/, e.id)
  })

  await t.test('at least one hire is still pending, so the demo has work to show', () => {
    assert.ok(SEED_EMPLOYEES.some(e => !e.sync.paycor.done || !e.sync.employeeNavigator.done))
  })
})

test('pay code and earn code maps', async t => {
  await t.test('earn codes are unique', () => {
    const codes = PAYCOR_EARN_CODES.map(c => c.code)
    assert.equal(new Set(codes).size, codes.length)
  })

  await t.test('every mapped pay code targets a real earn code', () => {
    const valid = new Set(PAYCOR_EARN_CODES.map(c => c.code))
    for (const [unanet, paycor] of Object.entries(SEED_PAY_CODE_MAP)) {
      assert.ok(valid.has(paycor), `${unanet} -> ${paycor}`)
    }
  })

  await t.test('exactly one pay code maps to OT, so the split has one target', () => {
    assert.equal(Object.values(SEED_PAY_CODE_MAP).filter(v => v === 'OT').length, 1)
  })

  await t.test('REG is mapped — the overtime rule depends on it', () => {
    assert.ok(Object.values(SEED_PAY_CODE_MAP).includes('REG'))
  })

  await t.test('"Training" is deliberately left unmapped to demo the fix', () => {
    assert.equal(SEED_PAY_CODE_MAP.Training, undefined)
    assert.match(SAMPLE_UNANET_CSV, /Training/)
  })
})

test('sample Unanet export', async t => {
  const { rows, errors } = parseUnanetExport(SAMPLE_UNANET_CSV)

  await t.test('parses without errors', () => {
    assert.deepEqual(errors, [])
    assert.ok(rows.length > 0)
  })

  await t.test('totals 210.00 h before any fixes', () => {
    assert.equal(sumHours(rows), 210)
  })

  await t.test('the export overstates the report by exactly the duplicate and the negative line', () => {
    assert.equal(SAMPLE_REPORT_TOTAL, 206)
    const dup = rows.filter(r => r.employeeRef === 'jkim' && r.date === '07/22/2026')
    assert.equal(dup.length, 2, 'the duplicated day should appear twice')
    const negativeHours = sumHours(rows.filter(r => r.hours < 0))

    // 210 raw - 8 (drop the duplicate) + 4 (drop the -4 adjustment) = 206.
    assert.equal(sumHours(rows) - dup[0].hours - negativeHours, SAMPLE_REPORT_TOTAL)
  })

  await t.test('contains the unknown employee ref the demo links up', () => {
    assert.ok(rows.some(r => r.employeeRef === 'balvarez'))
    assert.equal(SEED_STATE.employeeRefMap.balvarez, undefined)
  })

  await t.test('every other ref is already mapped', () => {
    const unmapped = new Set(rows.map(r => r.employeeRef).filter(ref => !SEED_STATE.employeeRefMap[ref]))
    assert.deepEqual([...unmapped], ['balvarez'])
  })

  await t.test('every mapped ref points at a real employee', () => {
    const ids = new Set(SEED_EMPLOYEES.map(e => e.paycorId))
    for (const [ref, id] of Object.entries(SEED_STATE.employeeRefMap)) {
      assert.ok(ids.has(id), `${ref} -> ${id}`)
    }
  })

  await t.test('every project belongs to a contract', () => {
    const known = new Set(SEED_CONTRACTS.flatMap(c => c.unanetProjects))
    for (const r of rows) assert.ok(known.has(r.project), r.project)
  })

  await t.test('contains exactly one negative adjustment', () => {
    assert.equal(rows.filter(r => r.hours < 0).length, 1)
  })

  await t.test('contains a >40h regular week for the overtime demo', () => {
    const reg = rows.filter(r => r.employeeRef === 'mruiz' && r.payCode === 'Regular Time')
    assert.equal(sumHours(reg), 44)
  })
})

test('seed state and stats', async t => {
  await t.test('wires the contracts and employees into the state', () => {
    assert.equal(SEED_STATE.contracts, SEED_CONTRACTS)
    assert.equal(SEED_STATE.employees, SEED_EMPLOYEES)
  })

  await t.test('hiresSynced matches the fully-synced employees', () => {
    const synced = SEED_EMPLOYEES.filter(e => e.sync.paycor.done && e.sync.employeeNavigator.done).length
    assert.equal(SEED_STATE.stats.hiresSynced, synced)
  })

  await t.test('lettersGenerated matches the seeded letter history', () => {
    assert.equal(SEED_STATE.stats.lettersGenerated, SEED_STATE.letters.length)
  })

  await t.test('activity entries carry a valid ISO timestamp and known module', () => {
    for (const a of SEED_STATE.activity) {
      assert.ok(!Number.isNaN(Date.parse(a.at)), a.id)
      assert.ok(['new-hires', 'letters', 'payroll'].includes(a.module), a.module)
    }
  })
})
