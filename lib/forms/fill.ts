/**
 * Fill the ORIGINAL VA AcroForm PDFs (lowest VA-rejection risk) from a single
 * CandidateProfile + PacketAnswers. We only touch the candidate's own fields —
 * the prefilled contract defaults (station 766, contract #, Tier 1, etc.) are
 * left exactly as the templates ship. Signature fields and their adjacent dates
 * are left blank on purpose: these forms require a wet signature, so the
 * candidate prints, signs in black ink, dates, and scans back.
 *
 * Field names + export values were extracted from the real templates
 * (scripts/dump-fields.mjs); OF-306 radios use inconsistent option ordering, so
 * we always select by literal export value ("Yes"/"No"), never by index.
 */

import { promises as fs } from 'fs'
import path from 'path'
import { PDFDocument, PDFForm } from 'pdf-lib'
import type { CandidateProfile } from '../profile'
import type { PacketAnswers } from './questions'
import { getSpec } from './specs'

const TEMPLATE_DIR = path.join(process.cwd(), 'lib', 'forms', 'templates')

/** specId -> template filename (without dir). */
const TEMPLATE_FILE: Record<string, string> = {
  of306: 'of306.pdf',
  bi_pharmacist: 'bi_pharmacist.pdf',
  bi_pharmtech: 'bi_pharmtech.pdf',
  bi_shipper: 'bi_shipper.pdf',
  selfcert: 'selfcert.pdf',
}

// ---- safe field setters (never throw on a missing/renamed field) ----

function setText(form: PDFForm, name: string, value: string | undefined) {
  if (!value) return
  try { form.getTextField(name).setText(value) } catch { /* field absent */ }
}

function selectRadio(form: PDFForm, name: string, value: string | undefined) {
  if (!value) return
  try {
    const g = form.getRadioGroup(name)
    if (g.getOptions().includes(value)) g.select(value)
  } catch { /* field absent */ }
}

function check(form: PDFForm, name: string, on: boolean) {
  if (!on) return
  try { form.getCheckBox(name).check() } catch { /* field absent */ }
}

function selectDropdown(form: PDFForm, name: string, value: string | undefined) {
  if (!value) return
  try {
    const d = form.getDropdown(name)
    const match = d.getOptions().find(o => o.trim().toLowerCase() === value.trim().toLowerCase())
    if (match) d.select(match)
  } catch { /* field absent */ }
}

// ---- value normalizers ----

function mmddyyyy(iso: string): string {
  // accepts YYYY-MM-DD (from a date input) or passes through anything else.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso
}

function middleOrNMN(p: CandidateProfile): string {
  if (p.hasNoMiddleName) return 'NMN'
  return p.middleName || ''
}

function fullName(p: CandidateProfile): string {
  return [p.firstName, middleOrNMN(p), p.lastName, p.suffix].filter(Boolean).join(' ').trim()
}

function placeOfBirth(p: CandidateProfile): string {
  return [p.placeOfBirthCity, p.placeOfBirthState, p.placeOfBirthCountry].filter(Boolean).join(', ')
}

const US_COUNTRY = 'United States of America'
function normCountry(input: string): string {
  const v = input.trim().toLowerCase()
  if (['us', 'usa', 'u.s.', 'u.s.a.', 'united states', 'united states of america', 'america'].includes(v)) {
    return US_COUNTRY
  }
  return input
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

function sexToGender(sex: string): string | undefined {
  const s = sex.trim().toUpperCase()
  if (s.startsWith('M')) return 'Male'
  if (s.startsWith('F')) return 'Female'
  return undefined
}

// ---- per-form fillers ----

function fillOf306(form: PDFForm, p: CandidateProfile, a: PacketAnswers) {
  setText(form, 'Full Name', fullName(p))
  setText(form, 'Social Security Number', p.ssn)
  setText(form, 'DATE OF BIRTH MM  DD  YYYY', mmddyyyy(p.dateOfBirth))
  setText(form, 'PLACE OF BIRTH Include city and state or country', placeOfBirth(p))
  setText(form, 'Country of Citizenship', p.citizenshipCountry)

  // U.S. citizen radio — derive from citizenship status answer.
  if (a.citizenshipStatus) selectRadio(form, 'Are you a U.S. Citizen?', a.citizenshipStatus === 'US' ? 'Yes' : 'No')

  // "Male" radio is the sex declaration (selective-service context).
  const g = sexToGender(p.sex)
  if (g) selectRadio(form, 'Male', g === 'Male' ? 'Yes' : 'No')

  // Other names used (up to 2).
  setText(form, 'Other Names Used 1', a.otherNamesUsed[0])
  setText(form, 'Other Names Used 2', a.otherNamesUsed[1])

  // Selective Service.
  if (a.registeredSelectiveService === 'Yes' || a.registeredSelectiveService === 'No') {
    selectRadio(form, 'Have you registered with Selective Service', a.registeredSelectiveService)
  }

  // Military service + up to 3 rows.
  if (a.servedMilitary) selectRadio(form, 'Have you ever served in the U.S. Military', a.servedMilitary)
  a.militaryService.slice(0, 3).forEach((m, i) => {
    const n = i + 1
    setText(form, `BranchRow${n}`, m.branch)
    setText(form, `From MMDDYYYYRow${n}`, mmddyyyy(m.from))
    setText(form, `To MMDDYYYYRow${n}`, mmddyyyy(m.to))
    setText(form, `Type of Discharge ${n}`, m.discharge)
  })

  // Background declarations Q9–Q13.
  selectRadio(form, 'Have you been convicted imprisoned probation or paroled last 7 years', a.convicted7yr)
  selectRadio(form, 'Have you been court martialed in the last 7 years', a.courtMartialed7yr)
  selectRadio(form, 'Are you currently under charges', a.underCharges)
  selectRadio(form, 'Have you been fired or debarred or quit due to a specific problem or quit after being told you would be fired', a.firedOrQuit)
  selectRadio(form, 'Are you delinquent on any Federal debt', a.delinquentFederalDebt)
  setText(form, 'Continuation of Space or Agency Specific Questions', a.backgroundExplanation)

  // Federal-employment history Q14–Q16.
  selectRadio(form, 'Do any of your relatives work for the agency or government organization for which you are submitting this form', a.relativesInAgency)
  selectRadio(form, 'Have you applied or do you receive retirement or pension benefits from the military Federal or D.C. government', a.receivesFederalRetirement)
  setText(form, 'When did you leave your last Federal job', a.leftLastFederalJob)
  selectRadio(form, 'Did you waive Basic Life Insurance or any type of optional life insurance', a.waivedLifeInsurance)
  selectRadio(form, 'If yes to 18b did you later cancel the waivers', a.canceledWaivers)
  // 'Date' (signature date) left blank — candidate dates when wet-signing.
}

function fillBI(form: PDFForm, p: CandidateProfile, a: PacketAnswers) {
  setText(form, 'Last Name', p.lastName)
  setText(form, 'First Name', p.firstName)
  setText(form, 'Middle Name', middleOrNMN(p))
  setText(form, 'Social Security Number', digitsOnly(p.ssn)) // maxLength=9: dashes won't fit
  setText(form, 'Social Secuirty Number', p.ssn) // misspelled in the VA template; the visible box
  setText(form, 'Date of Birth', mmddyyyy(p.dateOfBirth))
  setText(form, 'City of Birth', p.placeOfBirthCity)
  setText(form, 'Email Address', p.email)
  setText(form, 'SEX', p.sex)

  selectDropdown(form, 'State of Birth', p.placeOfBirthState)
  selectDropdown(form, 'Country of Birth', normCountry(p.placeOfBirthCountry))
  selectDropdown(form, 'Country of Citizenship', normCountry(p.citizenshipCountry))
  selectDropdown(form, 'Gender', sexToGender(p.sex))
  selectDropdown(form, 'Marital Status', a.maritalStatus)

  // Citizenship on the BI form. The only checkboxes are Dual Citizenship (D-C),
  // Permanent Resident (PR), and Foreign National (FN) — there is NO "U.S.
  // Citizen" box. A plain U.S. citizen leaves all three blank ("Country of
  // Citizenship" already states it). We never collect dual citizenship, so D-C
  // is never auto-checked — checking it would falsely declare a second
  // nationality on a federal background-investigation request.
  check(form, 'PR', a.citizenshipStatus === 'PR')
  check(form, 'FN', a.citizenshipStatus === 'FN')

  // 3-consecutive-years-in-US — relevant for PR/FN.
  if (a.livedInUS3Years === 'Yes') check(form, 'YES', true)
  else if (a.livedInUS3Years === 'No') check(form, 'No', true)
}

function fillSelfCert(form: PDFForm, p: CandidateProfile, a: PacketAnswers) {
  setText(form, 'Print Name', fullName(p))
  setText(form, 'Social Security Number', p.ssn)

  const breakField: Record<string, string> = {
    none: 'I have NOT had a break in service',
    lt36: 'My break in service was less than 36 months',
    '36to60': 'My break in service is greater than 36 months, but less than 60 months',
    gt60: 'My break in service is greater than 60 months or I have never worked',
  }
  if (a.breakInService) check(form, breakField[a.breakInService], true)
  if (a.breakInService && a.breakInService !== 'none') {
    setText(form, 'Date Left Federal Employment 1_af_date', a.dateLeftFederalEmployment)
  }
  // 'Date of Form Completion_af_date' left blank — dated at wet-signing.
}

/** Fill one form by specId and return the PDF bytes. */
export async function fillForm(
  specId: string, profile: CandidateProfile, answers: PacketAnswers,
): Promise<Uint8Array> {
  const file = TEMPLATE_FILE[specId]
  if (!file) throw new Error(`No template for spec: ${specId}`)
  const bytes = await fs.readFile(path.join(TEMPLATE_DIR, file))
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const form = doc.getForm()

  if (specId === 'of306') fillOf306(form, profile, answers)
  else if (specId === 'selfcert') fillSelfCert(form, profile, answers)
  else if (specId.startsWith('bi_')) fillBI(form, profile, answers)
  else throw new Error(`Don't know how to fill spec: ${specId}`)

  return doc.save()
}

export interface FilledForm {
  specId: string
  label: string
  fileName: string
  bytes: Uint8Array
}

/**
 * Fill every form required for a role's packet. fileNamePrefix follows the
 * 766_<LastName><last4>_ convention used elsewhere; suffix per form.
 */
export async function fillPacket(
  specIds: string[], profile: CandidateProfile, answers: PacketAnswers, fileNamePrefix: string,
): Promise<FilledForm[]> {
  const suffix: Record<string, string> = {
    of306: '306', selfcert: 'SC',
    bi_pharmacist: 'REQ', bi_pharmtech: 'REQ', bi_shipper: 'REQ',
  }
  const out: FilledForm[] = []
  for (const specId of specIds) {
    if (!TEMPLATE_FILE[specId]) continue
    const bytes = await fillForm(specId, profile, answers)
    out.push({
      specId,
      label: getSpec(specId)?.label ?? specId,
      fileName: `${fileNamePrefix}_${suffix[specId] ?? specId}.pdf`,
      bytes,
    })
  }
  return out
}
