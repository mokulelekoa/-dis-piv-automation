/**
 * Senior-test-engineer verification harness.
 *
 * Exercises the REAL lib/forms/fill.ts (compiled to .qa-build) against two fully
 * populated personas, reads back every AcroForm field with pdf-lib, and asserts
 * each value against an INDEPENDENT hand-computed oracle (so a bug in fill.ts's
 * own normalizers can't hide). Then runs the REAL analyze.ts over the generated
 * bytes to confirm the scanner's completeness math.
 *
 * Run from project root:  node scripts/verify-fill.cjs
 */
const fs = require('fs')
const path = require('path')
const { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown } = require('pdf-lib')
const { fillForm } = require('../.qa-build/lib/forms/fill.js')
const { analyzePdf } = require('../.qa-build/lib/forms/analyze.js')

const OUT = path.join(process.cwd(), '.qa-build', 'out')
fs.mkdirSync(OUT, { recursive: true })

let PASS = 0, FAIL = 0
const failures = []
function check(ctx, label, actual, expected, { trim = false } = {}) {
  const a = trim && typeof actual === 'string' ? actual.trim() : actual
  const ok = a === expected
  if (ok) PASS++
  else { FAIL++; failures.push(`[${ctx}] ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`) }
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`   ${mark}  ${label}  ${ok ? '' : `→ expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`)
}

async function readBack(bytes) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const form = doc.getForm()
  const out = {}
  for (const field of form.getFields()) {
    const name = field.getName()
    if (field instanceof PDFTextField) out[name] = { type: 'text', value: field.getText() ?? '' }
    else if (field instanceof PDFCheckBox) out[name] = { type: 'check', value: field.isChecked() }
    else if (field instanceof PDFRadioGroup) out[name] = { type: 'radio', value: field.getSelected() }
    else if (field instanceof PDFDropdown) out[name] = { type: 'drop', value: field.getSelected() }
  }
  return out
}
const T = (f, n) => (f[n] && f[n].type === 'text' ? f[n].value : undefined)
const R = (f, n) => (f[n] && f[n].type === 'radio' ? f[n].value : undefined)
const C = (f, n) => (f[n] && f[n].type === 'check' ? f[n].value : undefined)
const D = (f, n) => (f[n] && f[n].type === 'drop' ? (f[n].value[0] ?? undefined) : undefined)

// ---------- personas ----------
const personaA = {
  label: 'A: US-citizen male pharmacist (complete, no break in service)',
  bi: 'bi_pharmacist',
  profile: {
    firstName: 'James', middleName: 'Robert', lastName: 'Carter', suffix: 'Jr',
    hasNoMiddleName: false, dateOfBirth: '1985-07-04', sex: 'M', ssn: '123-45-6789',
    placeOfBirthCity: 'Richmond', placeOfBirthState: 'VA', placeOfBirthCountry: 'United States of America',
    citizenshipCountry: 'United States of America', email: 'james.carter@example.com', phone: '804-555-0101',
    addressLine: '12 Maple St', addressCity: 'Richmond', addressState: 'VA', addressZip: '23220',
  },
  answers: {
    citizenshipStatus: 'US', livedInUS3Years: '', maritalStatus: 'Married',
    otherNamesUsed: ['Jimmy Carter', 'J.R. Carter'],
    registeredSelectiveService: 'Yes', servedMilitary: 'Yes',
    militaryService: [{ branch: 'Army', from: '2003-06-01', to: '2007-06-01', discharge: 'Honorable' }],
    convicted7yr: 'No', courtMartialed7yr: 'No', underCharges: 'No', firedOrQuit: 'No', delinquentFederalDebt: 'No',
    backgroundExplanation: '', relativesInAgency: 'No', receivesFederalRetirement: 'No',
    leftLastFederalJob: '', waivedLifeInsurance: 'No', canceledWaivers: 'No',
    breakInService: 'none', dateLeftFederalEmployment: '',
  },
}
const personaB = {
  label: 'B: Permanent-resident female, foreign-born, NMN, break in service <36mo',
  bi: 'bi_pharmtech',
  profile: {
    firstName: 'Maria', middleName: '', lastName: 'Gonzalez', suffix: '',
    hasNoMiddleName: true, dateOfBirth: '1990-12-15', sex: 'F', ssn: '987-65-4321',
    placeOfBirthCity: 'Guadalajara', placeOfBirthState: '', placeOfBirthCountry: 'Mexico',
    citizenshipCountry: 'Mexico', email: 'maria.gonzalez@example.com', phone: '210-555-0199',
    addressLine: '88 Oak Ave', addressCity: 'San Antonio', addressState: 'TX', addressZip: '78205',
  },
  answers: {
    citizenshipStatus: 'PR', livedInUS3Years: 'Yes', maritalStatus: 'Never Married',
    otherNamesUsed: [],
    registeredSelectiveService: 'NA', servedMilitary: 'No', militaryService: [],
    convicted7yr: 'No', courtMartialed7yr: 'No', underCharges: 'No', firedOrQuit: 'No', delinquentFederalDebt: 'No',
    backgroundExplanation: '', relativesInAgency: 'No', receivesFederalRetirement: 'No',
    leftLastFederalJob: '', waivedLifeInsurance: '', canceledWaivers: '',
    breakInService: 'lt36', dateLeftFederalEmployment: '03/15/2024',
  },
}

async function gen(specId, persona) {
  const bytes = await fillForm(specId, persona.profile, persona.answers)
  fs.writeFileSync(path.join(OUT, `${persona.bi === specId ? 'bi' : specId}_${persona.label[0]}.pdf`), bytes)
  return bytes
}

async function analyze(specId, bytes) {
  const r = await analyzePdf(specId, bytes)
  console.log(`   analyze → ${r.completeness}% (${r.requiredOk}/${r.requiredTotal})  missing=${JSON.stringify(r.missing)}  issues=${JSON.stringify(r.issues)}`)
  return r
}

/** Stamp text fields into already-filled bytes — simulates the human wet-signing/dating before scanning back. */
async function setTextFields(bytes, fields) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const form = doc.getForm()
  for (const [name, val] of Object.entries(fields)) {
    try { form.getTextField(name).setText(val) } catch { /* absent on this form */ }
  }
  return doc.save()
}

// Wet-sign date fields the candidate hand-dates at signing (blank at generate-time, present in the uploaded scan).
const SIGN_DATES = {
  of306: { 'Date': '06/08/2026' },
  selfcert: { 'Date of Form Completion_af_date': '06/08/2026' },
  bi_pharmacist: {}, bi_pharmtech: {}, bi_shipper: {},
}

/** Generate → stamp wet-sign dates → analyze; assert the finished packet form scores 100%. */
async function simulateSignedScan(ctx, specId, persona) {
  let bytes = await fillForm(specId, persona.profile, persona.answers)
  bytes = await setTextFields(bytes, SIGN_DATES[specId] || {})
  const r = await analyzePdf(specId, bytes)
  check(ctx, `${specId} reaches 100% once wet-signed`, r.completeness, 100)
  if (r.completeness !== 100) console.log(`      still missing: ${JSON.stringify(r.missing)}  issues=${JSON.stringify(r.issues)}`)
  return r
}

async function main() {
  // ===================== PERSONA A =====================
  console.log('\n========================================================')
  console.log(personaA.label)
  console.log('========================================================')

  // ---- OF-306 ----
  console.log('\n-- OF-306 field values --')
  let b = await gen('of306', personaA)
  let f = await readBack(b)
  check('A/306', 'Full Name', T(f, 'Full Name'), 'James Robert Carter Jr')
  check('A/306', 'Social Security Number', T(f, 'Social Security Number'), '123-45-6789')
  check('A/306', 'DATE OF BIRTH', T(f, 'DATE OF BIRTH MM  DD  YYYY'), '07/04/1985')
  check('A/306', 'PLACE OF BIRTH', T(f, 'PLACE OF BIRTH Include city and state or country'), 'Richmond, VA, United States of America')
  check('A/306', 'Country of Citizenship', T(f, 'Country of Citizenship'), 'United States of America')
  check('A/306', 'US Citizen radio', R(f, 'Are you a U.S. Citizen?'), 'Yes')
  check('A/306', 'Male radio (sex=M)', R(f, 'Male'), 'Yes')
  check('A/306', 'Other Names 1', T(f, 'Other Names Used 1'), 'Jimmy Carter')
  check('A/306', 'Other Names 2', T(f, 'Other Names Used 2'), 'J.R. Carter')
  check('A/306', 'Selective Service radio', R(f, 'Have you registered with Selective Service'), 'Yes')
  check('A/306', 'Served military radio', R(f, 'Have you ever served in the U.S. Military'), 'Yes')
  check('A/306', 'BranchRow1', T(f, 'BranchRow1'), 'Army')
  check('A/306', 'From row1', T(f, 'From MMDDYYYYRow1'), '06/01/2003')
  check('A/306', 'To row1', T(f, 'To MMDDYYYYRow1'), '06/01/2007')
  check('A/306', 'Discharge 1', T(f, 'Type of Discharge 1'), 'Honorable')
  check('A/306', 'Q9 convicted', R(f, 'Have you been convicted imprisoned probation or paroled last 7 years'), 'No')
  check('A/306', 'Q10 court-martial', R(f, 'Have you been court martialed in the last 7 years'), 'No')
  check('A/306', 'Q11 under charges', R(f, 'Are you currently under charges'), 'No')
  check('A/306', 'Q12 fired/quit', R(f, 'Have you been fired or debarred or quit due to a specific problem or quit after being told you would be fired'), 'No')
  check('A/306', 'Q13 delinquent debt', R(f, 'Are you delinquent on any Federal debt'), 'No')
  check('A/306', 'Q14 relatives', R(f, 'Do any of your relatives work for the agency or government organization for which you are submitting this form'), 'No')
  check('A/306', 'Q15 retirement', R(f, 'Have you applied or do you receive retirement or pension benefits from the military Federal or D.C. government'), 'No')
  check('A/306', '18b waive insurance', R(f, 'Did you waive Basic Life Insurance or any type of optional life insurance'), 'No')
  check('A/306', '18c cancel waiver', R(f, 'If yes to 18b did you later cancel the waivers'), 'No')
  check('A/306', 'Signature Date blank (wet-sign)', T(f, 'Date'), '')
  await analyze('of306', b)

  // ---- BI (pharmacist) ----
  console.log('\n-- BI Pharmacist field values --')
  b = await gen(personaA.bi, personaA)
  f = await readBack(b)
  check('A/BI', 'Last Name', T(f, 'Last Name'), 'Carter')
  check('A/BI', 'First Name', T(f, 'First Name'), 'James')
  check('A/BI', 'Middle Name', T(f, 'Middle Name'), 'Robert')
  check('A/BI', 'SSN (9-cell comb field, digits only)', T(f, 'Social Security Number'), '123456789')
  check('A/BI', 'SSN (misspelled visible field)', T(f, 'Social Secuirty Number'), '123-45-6789')
  check('A/BI', 'Date of Birth', T(f, 'Date of Birth'), '07/04/1985')
  check('A/BI', 'City of Birth', T(f, 'City of Birth'), 'Richmond')
  check('A/BI', 'Email Address', T(f, 'Email Address'), 'james.carter@example.com')
  check('A/BI', 'SEX', T(f, 'SEX'), 'M')
  check('A/BI', 'State of Birth dropdown', D(f, 'State of Birth'), 'VA')
  check('A/BI', 'Country of Birth dropdown', D(f, 'Country of Birth'), 'United States of America', { trim: true })
  check('A/BI', 'Country of Citizenship dropdown', D(f, 'Country of Citizenship'), 'United States of America', { trim: true })
  check('A/BI', 'Gender dropdown', D(f, 'Gender'), 'Male')
  check('A/BI', 'Marital Status dropdown', D(f, 'Marital Status'), 'Married')
  // D-C is the "Dual Citizenship" box (verified by widget position), NOT "U.S.
  // Citizen". A plain U.S. citizen leaves all three citizenship boxes blank.
  check('A/BI', 'D-C checkbox (US citizen → blank; D-C = Dual Citizenship)', C(f, 'D-C'), false)
  check('A/BI', 'PR checkbox', C(f, 'PR'), false)
  check('A/BI', 'FN checkbox', C(f, 'FN'), false)
  check('A/BI', '3yr YES checkbox (US→unset)', C(f, 'YES'), false)
  check('A/BI', '3yr No checkbox (US→unset)', C(f, 'No'), false)
  await analyze(personaA.bi, b)

  // ---- Self-Cert ----
  console.log('\n-- Self-Certification field values --')
  b = await gen('selfcert', personaA)
  f = await readBack(b)
  check('A/SC', 'Print Name', T(f, 'Print Name'), 'James Robert Carter Jr')
  check('A/SC', 'Social Security Number', T(f, 'Social Security Number'), '123-45-6789')
  check('A/SC', 'No-break checkbox', C(f, 'I have NOT had a break in service'), true)
  check('A/SC', '<36mo checkbox unset', C(f, 'My break in service was less than 36 months'), false)
  check('A/SC', 'Date Left Fed Employment blank (none)', T(f, 'Date Left Federal Employment 1_af_date'), '')
  await analyze('selfcert', b)

  // ===================== PERSONA B =====================
  console.log('\n========================================================')
  console.log(personaB.label)
  console.log('========================================================')

  // ---- OF-306 ----
  console.log('\n-- OF-306 field values --')
  b = await gen('of306', personaB)
  f = await readBack(b)
  check('B/306', 'Full Name (NMN, no suffix)', T(f, 'Full Name'), 'Maria NMN Gonzalez')
  check('B/306', 'SSN', T(f, 'Social Security Number'), '987-65-4321')
  check('B/306', 'DOB', T(f, 'DATE OF BIRTH MM  DD  YYYY'), '12/15/1990')
  check('B/306', 'PLACE OF BIRTH (foreign, no state)', T(f, 'PLACE OF BIRTH Include city and state or country'), 'Guadalajara, Mexico')
  check('B/306', 'Country of Citizenship', T(f, 'Country of Citizenship'), 'Mexico')
  check('B/306', 'US Citizen radio (PR→No)', R(f, 'Are you a U.S. Citizen?'), 'No')
  check('B/306', 'Male radio (sex=F→No)', R(f, 'Male'), 'No')
  check('B/306', 'Selective Service radio (NA→unset)', R(f, 'Have you registered with Selective Service'), undefined)
  check('B/306', 'Served military radio (No)', R(f, 'Have you ever served in the U.S. Military'), 'No')
  check('B/306', 'BranchRow1 empty', T(f, 'BranchRow1'), '')
  check('B/306', 'Q9 convicted', R(f, 'Have you been convicted imprisoned probation or paroled last 7 years'), 'No')
  check('B/306', '18b waive (blank→unset)', R(f, 'Did you waive Basic Life Insurance or any type of optional life insurance'), undefined)
  check('B/306', '18c cancel (blank→unset)', R(f, 'If yes to 18b did you later cancel the waivers'), undefined)
  await analyze('of306', b)

  // ---- BI (pharmtech) ----
  console.log('\n-- BI Pharmacy Technician field values --')
  b = await gen(personaB.bi, personaB)
  f = await readBack(b)
  check('B/BI', 'Last Name', T(f, 'Last Name'), 'Gonzalez')
  check('B/BI', 'First Name', T(f, 'First Name'), 'Maria')
  check('B/BI', 'Middle Name (NMN)', T(f, 'Middle Name'), 'NMN')
  check('B/BI', 'SSN (9-cell comb field, digits only)', T(f, 'Social Security Number'), '987654321')
  check('B/BI', 'SSN misspelled field', T(f, 'Social Secuirty Number'), '987-65-4321')
  check('B/BI', 'City of Birth', T(f, 'City of Birth'), 'Guadalajara')
  check('B/BI', 'SEX', T(f, 'SEX'), 'F')
  check('B/BI', 'State of Birth (foreign→blank default)', D(f, 'State of Birth'), '', { trim: true })
  check('B/BI', 'Country of Birth (Mexico)', D(f, 'Country of Birth'), 'Mexico', { trim: true })
  check('B/BI', 'Country of Citizenship (Mexico)', D(f, 'Country of Citizenship'), 'Mexico', { trim: true })
  check('B/BI', 'Gender dropdown (Female)', D(f, 'Gender'), 'Female')
  check('B/BI', 'Marital Status (Never Married)', D(f, 'Marital Status'), 'Never Married')
  check('B/BI', 'D-C checkbox (not US)', C(f, 'D-C'), false)
  check('B/BI', 'PR checkbox', C(f, 'PR'), true)
  check('B/BI', 'FN checkbox', C(f, 'FN'), false)
  check('B/BI', '3yr YES checkbox', C(f, 'YES'), true)
  check('B/BI', '3yr No checkbox', C(f, 'No'), false)
  await analyze(personaB.bi, b)

  // ---- Self-Cert ----
  console.log('\n-- Self-Certification field values --')
  b = await gen('selfcert', personaB)
  f = await readBack(b)
  check('B/SC', 'Print Name', T(f, 'Print Name'), 'Maria NMN Gonzalez')
  check('B/SC', '<36mo checkbox', C(f, 'My break in service was less than 36 months'), true)
  check('B/SC', 'No-break checkbox unset', C(f, 'I have NOT had a break in service'), false)
  check('B/SC', 'Date Left Fed Employment', T(f, 'Date Left Federal Employment 1_af_date'), '03/15/2024')
  await analyze('selfcert', b)

  // ===================== SCAN-BACK: a finished, wet-signed packet must score 100% =====================
  console.log('\n========================================================')
  console.log('SCAN-BACK SIMULATION (fill → wet-sign dates → re-analyze)')
  console.log('========================================================')
  for (const persona of [personaA, personaB]) {
    console.log(`\n-- ${persona.label[0]}: finished packet completeness --`)
    for (const specId of ['of306', persona.bi, 'selfcert']) {
      await simulateSignedScan(`${persona.label[0]}/scan`, specId, persona)
    }
  }

  console.log('\n========================================================')
  console.log(`RESULT: ${PASS} passed, ${FAIL} failed`)
  if (FAIL) { console.log('\nFAILURES:'); failures.forEach(x => console.log(' - ' + x)) }
  console.log('Generated PDFs in .qa-build/out/ for manual inspection.')
  process.exit(FAIL ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(2) })
