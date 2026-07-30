'use strict'
/** Unit tests — lib/hr/exports.ts (Paycor / Employee Navigator import files + entry-kit field lists). */
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  paycorImportCsv, employeeNavigatorCensusCsv, paycorFieldList, enFieldList,
} = require('../.test-build/exports.js')
const { parseDelimited } = require('../.test-build/csv.js')
const { SEED_CONTRACTS, SEED_EMPLOYEES } = require('../.test-build/data.js')

const hourly = SEED_EMPLOYEES.find(e => e.payType === 'Hourly')
const salaried = SEED_EMPLOYEES.find(e => e.payType === 'Salary')
const contractOf = e => SEED_CONTRACTS.find(c => c.id === e.contractId)

/** Parse generated CSV into an array of {header: value} objects. */
function asRecords(csv) {
  const [header, ...rows] = parseDelimited(csv)
  return rows.map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])))
}

test('paycorImportCsv', async t => {
  await t.test('emits a header plus one row per employee', () => {
    const grid = parseDelimited(paycorImportCsv(SEED_EMPLOYEES, SEED_CONTRACTS))
    assert.equal(grid.length, SEED_EMPLOYEES.length + 1)
  })

  await t.test('every row has exactly as many cells as the header', () => {
    const grid = parseDelimited(paycorImportCsv(SEED_EMPLOYEES, SEED_CONTRACTS))
    for (const row of grid) assert.equal(row.length, grid[0].length)
  })

  await t.test('maps each field to the right column', () => {
    const rec = asRecords(paycorImportCsv([hourly], SEED_CONTRACTS))[0]
    assert.equal(rec['Employee Number'], hourly.paycorId)
    assert.equal(rec['First Name'], hourly.firstName)
    assert.equal(rec['Last Name'], hourly.lastName)
    assert.equal(rec['Birth Date'], hourly.dob)
    assert.equal(rec['Hire Date'], hourly.startDate)
    assert.equal(rec['Job Title'], hourly.position)
    assert.equal(rec['FLSA Status'], hourly.flsa)
    assert.equal(rec['Contract Code'], contractOf(hourly).code)
  })

  await t.test('masks the SSN to the last four digits', () => {
    const rec = asRecords(paycorImportCsv([hourly], SEED_CONTRACTS))[0]
    assert.equal(rec['SSN Last 4'], `xxx-xx-${hourly.ssnLast4}`)
  })

  await t.test('never emits a full nine-digit SSN', () => {
    assert.doesNotMatch(paycorImportCsv(SEED_EMPLOYEES, SEED_CONTRACTS), /\d{3}-\d{2}-\d{4}/)
  })

  await t.test('writes hourly rates with two decimals', () => {
    assert.equal(asRecords(paycorImportCsv([hourly], SEED_CONTRACTS))[0]['Pay Rate'],
      hourly.payRate.toFixed(2))
  })

  await t.test('writes salaries as whole numbers, not cents', () => {
    assert.equal(asRecords(paycorImportCsv([salaried], SEED_CONTRACTS))[0]['Pay Rate'],
      String(salaried.payRate))
  })

  await t.test('leaves the contract code blank for an unknown contract', () => {
    const orphan = { ...hourly, contractId: 'does-not-exist' }
    assert.equal(asRecords(paycorImportCsv([orphan], SEED_CONTRACTS))[0]['Contract Code'], '')
  })

  await t.test('quotes values containing commas so columns stay aligned', () => {
    const comma = { ...hourly, address1: '1 Main St, Apt 2' }
    const rec = asRecords(paycorImportCsv([comma], SEED_CONTRACTS))[0]
    assert.equal(rec['Address 1'], '1 Main St, Apt 2')
    assert.equal(rec['City'], comma.city)
  })

  await t.test('produces just a header for an empty roster', () => {
    assert.equal(parseDelimited(paycorImportCsv([], SEED_CONTRACTS)).length, 1)
  })
})

test('employeeNavigatorCensusCsv', async t => {
  await t.test('emits a header plus one row per employee', () => {
    const grid = parseDelimited(employeeNavigatorCensusCsv(SEED_EMPLOYEES, SEED_CONTRACTS))
    assert.equal(grid.length, SEED_EMPLOYEES.length + 1)
  })

  await t.test('leads with last name, as the census template expects', () => {
    const grid = parseDelimited(employeeNavigatorCensusCsv([hourly], SEED_CONTRACTS))
    assert.equal(grid[0][0], 'Last Name')
    assert.equal(grid[1][0], hourly.lastName)
  })

  await t.test('carries the Paycor id across as the payroll ID', () => {
    const rec = asRecords(employeeNavigatorCensusCsv([hourly], SEED_CONTRACTS))[0]
    assert.equal(rec['Payroll ID'], hourly.paycorId)
  })

  await t.test('derives hours per week from employment type', () => {
    const ft = asRecords(employeeNavigatorCensusCsv([{ ...hourly, employmentType: 'Full-time' }], SEED_CONTRACTS))[0]
    const pt = asRecords(employeeNavigatorCensusCsv([{ ...hourly, employmentType: 'Part-time' }], SEED_CONTRACTS))[0]
    assert.equal(ft['Hours Per Week'], '40')
    assert.equal(pt['Hours Per Week'], '24')
  })

  await t.test('uses the contract name as the division', () => {
    const rec = asRecords(employeeNavigatorCensusCsv([hourly], SEED_CONTRACTS))[0]
    assert.equal(rec['Division'], contractOf(hourly).name)
  })

  await t.test('carries no SSN at all — benefits enrolment does not need one', () => {
    const csv = employeeNavigatorCensusCsv(SEED_EMPLOYEES, SEED_CONTRACTS)
    assert.doesNotMatch(csv, /SSN/i)
    assert.doesNotMatch(csv, /xxx-xx/)
  })
})

test('paycorFieldList', async t => {
  const fields = paycorFieldList(hourly, contractOf(hourly))

  await t.test('starts with the employee number, matching Paycor data entry order', () => {
    assert.equal(fields[0].label, 'Employee number')
    assert.equal(fields[0].value, hourly.paycorId)
  })

  await t.test('every entry has a label and a string value', () => {
    for (const f of fields) {
      assert.ok(f.label)
      assert.equal(typeof f.value, 'string')
    }
  })

  await t.test('combines city, state and ZIP into one copyable line', () => {
    const city = fields.find(f => f.label === 'City / State / ZIP')
    assert.equal(city.value, `${hourly.city}, ${hourly.state} ${hourly.zip}`)
  })

  await t.test('renders hourly and salaried pay differently', () => {
    assert.match(paycorFieldList(hourly, contractOf(hourly)).find(f => f.label === 'Pay rate').value, /\/ hour$/)
    assert.match(paycorFieldList(salaried, contractOf(salaried)).find(f => f.label === 'Pay rate').value, /\/ year$/)
  })

  await t.test('masks the SSN', () => {
    assert.equal(fields.find(f => f.label === 'SSN (last 4)').value, `xxx-xx-${hourly.ssnLast4}`)
  })

  await t.test('tolerates a missing contract', () => {
    assert.equal(paycorFieldList(hourly, undefined).find(f => f.label === 'Contract code').value, '')
  })
})

test('enFieldList', async t => {
  const fields = enFieldList(hourly, contractOf(hourly))

  await t.test('starts with last name', () => {
    assert.equal(fields[0].label, 'Last name')
  })

  await t.test('every entry has a label and a string value', () => {
    for (const f of fields) {
      assert.ok(f.label)
      assert.equal(typeof f.value, 'string')
    }
  })

  await t.test('exposes no SSN field', () => {
    assert.equal(fields.filter(f => /ssn/i.test(f.label)).length, 0)
  })

  await t.test('tolerates a missing contract', () => {
    assert.equal(enFieldList(hourly, undefined).find(f => f.label === 'Division').value, '')
  })
})
